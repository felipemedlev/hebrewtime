import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { searchDictionaryPrefix } from "./dictionaryLookup";

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

  it("surfaces database failures instead of disguising them as no matches", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error("database offline") });
    const client = { rpc } as unknown as SupabaseClient;

    await expect(searchDictionaryPrefix(client, `offline-fixture-${Date.now()}`))
      .rejects.toThrow("Dictionary search unavailable");
  });
});
