import type { DictionarySuggestion } from "./dictionaryLookup";
import { normalizeDictionarySearch, type DictionarySearchMode } from "./dictionarySearch";

const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX_QUERIES = 128;

type SearchResponse = {
  suggestions: DictionarySuggestion[];
  needsCompletion?: boolean;
};

type CachedResponse = { expiresAt: number; value: SearchResponse };
type CacheEntry = Partial<Record<DictionarySearchMode, CachedResponse>>;

export class DictionarySearchError extends Error {
  constructor(public readonly retryAfterSeconds = 0, public readonly rateLimited = false) {
    super("Dictionary search unavailable");
  }
}

export type SuggestionSearchUpdate = {
  suggestions: DictionarySuggestion[];
  isCompleting: boolean;
  completionFailed?: boolean;
  error?: DictionarySearchError;
};

/** One instance per modal, retained across closes. It never stores failed requests. */
export class DictionarySuggestionSearch {
  private cache = new Map<string, CacheEntry>();
  private controller: AbortController | null = null;
  private version = 0;
  private active: { query: string; promise: Promise<void> } | null = null;

  constructor(private readonly fetcher: typeof fetch = (input, init) => fetch(input, init)) {}

  getCached(query: string): SearchResponse | undefined {
    const key = normalizeDictionarySearch(query);
    return this.readCache(key, "complete") ?? this.readCache(key, "direct");
  }

  cancel(): void {
    this.version += 1;
    this.controller?.abort();
    this.controller = null;
    this.active = null;
  }

  search(query: string, onUpdate: (update: SuggestionSearchUpdate) => void): Promise<void> {
    const key = normalizeDictionarySearch(query);
    if (this.active?.query === key) return this.active.promise;
    this.cancel();
    const version = this.version;
    const controller = new AbortController();
    this.controller = controller;
    const current = () => version === this.version && !controller.signal.aborted;

    const promise = (async () => {
      let suggestions: DictionarySuggestion[] = [];
      let completing = false;
      try {
        const cachedComplete = this.readCache(key, "complete");
        if (cachedComplete) {
          onUpdate({ suggestions: cachedComplete.suggestions, isCompleting: false });
          return;
        }
        const direct = await this.load(key, "direct", controller);
        if (!current()) return;
        suggestions = direct.suggestions;
        completing = direct.needsCompletion === true;
        onUpdate({ suggestions, isCompleting: completing });
        if (!completing) return;

        const complete = await this.load(key, "complete", controller);
        if (!current()) return;
        onUpdate({ suggestions: complete.suggestions, isCompleting: false });
      } catch (error) {
        if (!current()) return;
        onUpdate({
          suggestions,
          isCompleting: false,
          completionFailed: completing,
          error: error instanceof DictionarySearchError ? error : new DictionarySearchError(),
        });
      }
    })();
    this.active = { query: key, promise };
    void promise.finally(() => {
      if (this.active?.promise === promise) this.active = null;
    });
    return promise;
  }

  private readCache(key: string, mode: DictionarySearchMode): SearchResponse | undefined {
    const entry = this.cache.get(key);
    const cached = entry?.[mode];
    if (!cached) return undefined;
    if (cached.expiresAt > Date.now()) return cached.value;
    delete entry![mode];
    if (!entry!.direct && !entry!.complete) this.cache.delete(key);
    return undefined;
  }

  private async load(key: string, mode: DictionarySearchMode, controller: AbortController): Promise<SearchResponse> {
    const cached = this.readCache(key, mode);
    if (cached) return cached;
    const response = await this.fetcher(`/api/dictionary/suggest?q=${encodeURIComponent(key)}&mode=${mode}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    const data = await response.json();
    if (response.status === 429 || data.status === "rate_limited") {
      throw new DictionarySearchError(data.retryAfterSeconds ?? (Number(response.headers.get("Retry-After")) || 1), true);
    }
    if (!response.ok || !["success", "empty"].includes(data.status) || !Array.isArray(data.suggestions)) {
      throw new DictionarySearchError();
    }
    const value: SearchResponse = { suggestions: data.suggestions, needsCompletion: data.needsCompletion === true };
    if (!controller.signal.aborted) {
      const entry = this.cache.get(key) ?? {};
      entry[mode] = { expiresAt: Date.now() + CACHE_TTL_MS, value };
      this.cache.set(key, entry);
      while (this.cache.size > CACHE_MAX_QUERIES) this.cache.delete(this.cache.keys().next().value!);
    }
    return value;
  }
}
