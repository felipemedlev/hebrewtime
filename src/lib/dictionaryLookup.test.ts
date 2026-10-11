import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { searchDictionaryPrefix } from "./dictionaryLookup";

afterEach(() => vi.useRealTimers());

function suggestionRow(overrides: Record<string, unknown> = {}) {
  return {
    pealim_id: 987654321,
    word: "מבחן",
    word_with_nekudot: "מִבְחָן",
    transliteration: "mivhan",
    part_of_speech: "Noun",
    meaning: "test, examination",
    match_type: "fuzzy",
    matched_text: "מבחנים",
    ...overrides,
  };
}

describe("dictionary suggestion RPC", () => {
  it("keeps direct and complete server caches separate", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: [suggestionRow({ match_type: "headword" })], error: null })
      .mockResolvedValueOnce({ data: [suggestionRow()], error: null });
    const client = { rpc } as unknown as SupabaseClient;
    expect((await searchDictionaryPrefix(client, "test", 8, "direct"))[0].matchType).toBe("headword");
    expect((await searchDictionaryPrefix(client, "test"))[0].matchType).toBe("fuzzy");
    await searchDictionaryPrefix(client, "test", 8, "direct");
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0][0]).toBe("search_dictionary_suggestions_direct");
  });

  it("expires successful server results and never caches failures", async () => {
    vi.useFakeTimers();
    const rpc = vi.fn().mockResolvedValueOnce({ data: [suggestionRow()], error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "57014", message: "search_dictionary_suggestions timed out" } })
      .mockResolvedValueOnce({ data: [suggestionRow()], error: null });
    const client = { rpc } as unknown as SupabaseClient;
    await searchDictionaryPrefix(client, "cache fixture");
    vi.advanceTimersByTime(5 * 60_000);
    await expect(searchDictionaryPrefix(client, "cache fixture")).rejects.toThrow("Dictionary search unavailable");
    await searchDictionaryPrefix(client, "cache fixture");
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it("normalizes input and maps spelling match details to the client shape", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [suggestionRow()], error: null });
    const client = { rpc } as unknown as SupabaseClient;

    const result = await searchDictionaryPrefix(client, "  מִבְחָן  ");

    expect(rpc).toHaveBeenCalledWith("search_dictionary_suggestions", {
      search_query: "מבחן",
      result_limit: 8,
    });
    expect(result[0]).toMatchObject({
      pealimId: 987654321,
      wordWithNekudot: "מִבְחָן",
      matchType: "fuzzy",
      matchedText: "מבחנים",
    });
  });

  it("shares concurrent identical searches and caches successful results", async () => {
    let resolveRpc!: (value: { data: ReturnType<typeof suggestionRow>[]; error: null }) => void;
    const rpc = vi.fn(() => new Promise((resolve) => { resolveRpc = resolve; }));
    const client = { rpc } as unknown as SupabaseClient;
    const query = `pending-fixture-${Date.now()}`;

    const first = searchDictionaryPrefix(client, query);
    const second = searchDictionaryPrefix(client, query);
    expect(rpc).toHaveBeenCalledTimes(1);
    resolveRpc({ data: [suggestionRow()], error: null });

    const [firstResult, secondResult] = await Promise.all([first, second]);
    const cachedResult = await searchDictionaryPrefix(client, query);
    expect(firstResult).toEqual(secondResult);
    expect(cachedResult).toEqual(firstResult);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("uses dictionary entries when the suggestion function is not installed", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function public.search_dictionary_suggestions" },
    });
    const row = {
      pealim_id: 42,
      word: "מבחן",
      word_with_nekudot: "מִבְחָן",
      transliteration: "mivhan",
      part_of_speech: "Noun",
      meaning: "test, examination",
    };
    const builder = {
      select: () => builder,
      ilike: () => builder,
      order: () => builder,
      limit: () => Promise.resolve({ data: [row], error: null }),
    };
    const from = vi.fn(() => builder);
    const client = { rpc, from } as unknown as SupabaseClient;

    const result = await searchDictionaryPrefix(client, `missing-fn-${Date.now()}`);

    expect(from).toHaveBeenCalledWith("dictionary_entries");
    expect(result[0]).toMatchObject({ pealimId: 42, matchType: "headword", word: "מבחן" });
  });

  it("surfaces database failures instead of disguising them as no matches", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error("database offline") });
    const client = { rpc } as unknown as SupabaseClient;

    await expect(searchDictionaryPrefix(client, `offline-fixture-${Date.now()}`))
      .rejects.toThrow("Dictionary search unavailable");
  });
});
