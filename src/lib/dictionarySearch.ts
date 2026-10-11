export type DictionarySearchMode = "direct" | "complete";

// Keep this equivalent to normalize_dictionary_search() in migration 17.
export function normalizeDictionarySearch(value: string): string {
  return value.normalize("NFKC")
    .replace(/[\u0591-\u05c7]/g, "")
    .toLowerCase()
    .replace(/[’‘ʼ＇‐‑‒–—―−﹘﹣⁃־״׳]/g, " ")
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function needsDictionaryCompletion(query: string, resultCount: number, limit = 8): boolean {
  const normalized = normalizeDictionarySearch(query);
  const length = Array.from(normalized).length;
  return resultCount < limit && length >= 3 && length <= 40 && !normalized.includes(" ");
}
