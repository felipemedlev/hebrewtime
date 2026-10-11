import { afterEach, describe, expect, it, vi } from "vitest";
import { DictionarySuggestionSearch, type SuggestionSearchUpdate } from "./dictionarySuggestionSearch";
import { needsDictionaryCompletion, normalizeDictionarySearch } from "./dictionarySearch";
import type { DictionarySuggestion } from "./dictionaryLookup";

const word: DictionarySuggestion = {
  pealimId: 1, word: "מבחן", wordWithNekudot: "מִבְחָן", meaning: "test",
  transliteration: "mivhan", partOfSpeech: "Noun", matchType: "headword", matchedText: "מבחן",
};
const spelling = { ...word, pealimId: 2, matchType: "fuzzy" as const };
const response = (suggestions = [word], needsCompletion = false) => Response.json({
  suggestions, needsCompletion, status: suggestions.length ? "success" : "empty",
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("normalization and completion eligibility", () => {
  it("normalizes niqqud, punctuation, casing, and repeated spaces", () => {
    expect(normalizeDictionarySearch("  מִבְחָן  ")).toBe("מבחן");
    expect(normalizeDictionarySearch(" Test—CODExquiz ")).toBe("test codexquiz");
    expect(normalizeDictionarySearch(" ’be   lost’ ")).toBe("be lost");
  });

  it("only completes eligible queries with spare result slots", () => {
    expect(needsDictionaryCompletion("test", 2)).toBe(true);
    for (const query of ["", "tx", "be lost", "ab—cd", "a".repeat(41)]) {
      expect(needsDictionaryCompletion(query, 0)).toBe(false);
    }
    expect(needsDictionaryCompletion("test", 8)).toBe(false);
  });
});

describe("two stage suggestions", () => {
  it("calls browser fetch without binding it to the search instance", async () => {
    const browserFetch = vi.fn(function (this: unknown) {
      if (this instanceof DictionarySuggestionSearch) throw new TypeError("Illegal invocation");
      return Promise.resolve(response());
    });
    vi.stubGlobal("fetch", browserFetch);
    const search = new DictionarySuggestionSearch();
    const update = vi.fn();
    await search.search("test", update);
    expect(update).toHaveBeenCalledWith({ suggestions: [word], isCompleting: false });
  });

  it("publishes direct matches before completion and shares a pending search", async () => {
    const completion = deferred<Response>();
    const fetcher = vi.fn().mockResolvedValueOnce(response([word], true)).mockReturnValueOnce(completion.promise);
    const search = new DictionarySuggestionSearch(fetcher);
    const updates: SuggestionSearchUpdate[] = [];
    const first = search.search("test", (update) => updates.push(update));
    expect(search.search("TEST", vi.fn())).toBe(first);
    await vi.waitFor(() => expect(updates).toHaveLength(1));
    expect(updates[0]).toEqual({ suggestions: [word], isCompleting: true });
    completion.resolve(response([word, spelling]));
    await first;
    expect(updates[1]).toEqual({ suggestions: [word, spelling], isCompleting: false });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][0]).toContain("mode=direct");
    expect(fetcher.mock.calls[1][0]).toContain("mode=complete");
  });

  it("reuses complete results immediately without any fetch", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response([word], true)).mockResolvedValueOnce(response([word, spelling]));
    const search = new DictionarySuggestionSearch(fetcher);
    await search.search("מִבְחָן", vi.fn());
    const update = vi.fn();
    const cached = search.search("  מבחן ", update);
    expect(update).toHaveBeenCalledWith({ suggestions: [word, spelling], isCompleting: false });
    await cached;
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("expires cached results after five minutes", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response()));
    const search = new DictionarySuggestionSearch(fetcher);
    await search.search("test", vi.fn());
    vi.advanceTimersByTime(5 * 60_000);
    expect(search.getCached("test")).toBeUndefined();
    await search.search("test", vi.fn());
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("limits the cache to 128 queries", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response()));
    const search = new DictionarySuggestionSearch(fetcher);
    for (let index = 0; index < 129; index++) await search.search(`query${index}`, vi.fn());
    expect(search.getCached("query0")).toBeUndefined();
    expect(search.getCached("query128")).toBeDefined();
  });

  it("keeps direct matches when completion fails and retries only completion", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response([word], true))
      .mockResolvedValueOnce(Response.json({ status: "unavailable" }, { status: 503 }))
      .mockResolvedValueOnce(response([word, spelling]));
    const search = new DictionarySuggestionSearch(fetcher);
    const updates: SuggestionSearchUpdate[] = [];
    await search.search("test", (update) => updates.push(update));
    expect(updates[1]).toMatchObject({ suggestions: [word], isCompleting: false, completionFailed: true });
    await search.search("test", vi.fn());
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[2][0]).toContain("mode=complete");
  });

  it("surfaces rate limits and never caches failed initial requests", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ status: "rate_limited", retryAfterSeconds: 4 }, { status: 429 }))
      .mockResolvedValueOnce(response());
    const search = new DictionarySuggestionSearch(fetcher);
    const update = vi.fn();
    await search.search("test", update);
    expect(update.mock.calls[0][0].error).toMatchObject({ rateLimited: true, retryAfterSeconds: 4 });
    expect(search.getCached("test")).toBeUndefined();
    await search.search("test", vi.fn());
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("ignores stale responses even when the fetcher ignores cancellation", async () => {
    const old = deferred<Response>();
    const fetcher = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce(response([spelling]));
    const search = new DictionarySuggestionSearch(fetcher);
    const oldUpdate = vi.fn();
    const first = search.search("old", oldUpdate);
    const nextUpdate = vi.fn();
    await search.search("new", nextUpdate);
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    old.resolve(response([word], true));
    await first;
    expect(oldUpdate).not.toHaveBeenCalled();
    expect(search.getCached("old")).toBeUndefined();
    expect(nextUpdate).toHaveBeenCalledWith({ suggestions: [spelling], isCompleting: false });
  });

  it("cancels background completion after selection or close", async () => {
    const completion = deferred<Response>();
    const fetcher = vi.fn().mockResolvedValueOnce(response([word], true)).mockReturnValueOnce(completion.promise);
    const search = new DictionarySuggestionSearch(fetcher);
    const update = vi.fn();
    const pending = search.search("test", update);
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    search.cancel();
    completion.resolve(response([word, spelling]));
    await pending;
    expect(update).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[1][1].signal.aborted).toBe(true);
    expect(search.getCached("test")?.suggestions).toEqual([word]);
  });
});
