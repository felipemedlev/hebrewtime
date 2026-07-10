"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X, Loader2, Search } from "lucide-react";
import { resolveDictionarySuggestion, translateWord } from "@/app/actions";
import { supabase } from "@/lib/supabase";
import { stripNiqqud, type DictionarySuggestion } from "@/lib/dictionaryLookup";
import { useModalAccessibility } from "@/hooks/useModalAccessibility";
import { useLanguage, useT } from "@/lib/i18n/LanguageProvider";
import { incrementAnonTranslations } from "@/lib/anonUsage";
import type { VocabWord } from "@/lib/types";

type LookupResult = {
  lemmaWord: string;
  translation: string;
  wordWithNekudot: string;
  verbFormWithNekudot: string | null;
  pronunciation: string | null;
  partOfSpeech: string | null;
  dictionaryPealimId: number | null;
};

type AddVocabWordModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onWordSaved: (
    word: Omit<VocabWord, "id" | "savedAt">
  ) => Promise<{ added: boolean; message: string; type?: string }>;
  onRequireAuth: () => void;
  onRequireSubscription: () => void;
  isAuthenticated: boolean;
};

const DEBOUNCE_MS = 300;
const MIN_QUERY_LEN = 1;

function cleanSearchQuery(value: string) {
  return value
    .trim()
    .replace(/^[.,;:!?(){}\[\]"'\-]+|[.,;:!?(){}\[\]"'\-]+$/g, "");
}

function suggestionsEqual(a: DictionarySuggestion[], b: DictionarySuggestion[]) {
  if (a.length !== b.length) return false;
  return a.every(
    (item, index) =>
      item.pealimId === b[index]?.pealimId &&
      item.word === b[index]?.word &&
      item.meaning === b[index]?.meaning
  );
}

export default function AddVocabWordModal({
  isOpen,
  onClose,
  onWordSaved,
  onRequireAuth,
  onRequireSubscription,
  isAuthenticated,
}: AddVocabWordModalProps) {
  const t = useT();
  const { lang } = useLanguage();
  const listboxId = useId();

  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<DictionarySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const blurCloseTimerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const showSuggestionsRef = useRef(false);
  const skipSuggestRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleRequestClose = () => {
    if (showSuggestionsRef.current) {
      setShowSuggestions(false);
      setActiveIndex(-1);
      inputRef.current?.focus();
      return;
    }
    onClose();
  };

  const { dialogRef, titleId } = useModalAccessibility(isOpen, handleRequestClose);

  useEffect(() => {
    showSuggestionsRef.current = showSuggestions;
  }, [showSuggestions]);

  useEffect(() => {
    if (!isOpen) {
      abortRef.current?.abort();
      setQuery("");
      setIsSearching(false);
      setIsSaving(false);
      setIsSuggesting(false);
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveIndex(-1);
      setResult(null);
      setError(null);
      skipSuggestRef.current = false;
      requestIdRef.current += 1;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (skipSuggestRef.current) {
      skipSuggestRef.current = false;
      return;
    }

    const plain = stripNiqqud(cleanSearchQuery(query));
    if (plain.length < MIN_QUERY_LEN) {
      abortRef.current?.abort();
      requestIdRef.current += 1;
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSuggesting(false);
      setActiveIndex(-1);
      return;
    }

    const timer = window.setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsSuggesting(true);

      try {
        const res = await fetch(
          `/api/dictionary/suggest?q=${encodeURIComponent(plain)}`,
          { signal: controller.signal }
        );
        if (requestId !== requestIdRef.current) return;

        if (!res.ok) {
          setSuggestions([]);
          setShowSuggestions(true);
          setActiveIndex(-1);
          return;
        }

        const data = (await res.json()) as { suggestions?: DictionarySuggestion[] };
        const next = data.suggestions ?? [];

        setSuggestions((prev) => (suggestionsEqual(prev, next) ? prev : next));
        setShowSuggestions(true);
        setActiveIndex(next.length > 0 ? 0 : -1);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (requestId !== requestIdRef.current) return;
        setSuggestions([]);
        setShowSuggestions(true);
        setActiveIndex(-1);
      } finally {
        if (requestId === requestIdRef.current) {
          setIsSuggesting(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query, isOpen]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (blurCloseTimerRef.current !== null) {
        window.clearTimeout(blurCloseTimerRef.current);
      }
    };
  }, []);

  const applyLookupResult = (payload: LookupResult) => {
    setResult(payload);
    setError(null);
    setShowSuggestions(false);
    setSuggestions([]);
    setActiveIndex(-1);
  };

  const handleSelectSuggestion = async (suggestion: DictionarySuggestion) => {
    skipSuggestRef.current = true;
    abortRef.current?.abort();
    requestIdRef.current += 1;
    setQuery(suggestion.word);
    setShowSuggestions(false);
    setSuggestions([]);
    setActiveIndex(-1);
    setIsSuggesting(false);
    setIsSearching(true);
    setResult(null);
    setError(null);

    try {
      const res = await resolveDictionarySuggestion(suggestion.pealimId, lang);
      if (res.type === "error") {
        setError(res.translation || t("translationError"));
        return;
      }
      if ("lemmaWord" in res) {
        applyLookupResult({
          lemmaWord: res.lemmaWord || suggestion.word,
          translation: res.translation || suggestion.meaning,
          wordWithNekudot: res.wordWithNekudot || suggestion.wordWithNekudot,
          verbFormWithNekudot: res.verbFormWithNekudot || null,
          pronunciation: res.pronunciation ?? suggestion.transliteration,
          partOfSpeech: res.partOfSpeech ?? suggestion.partOfSpeech,
          dictionaryPealimId: res.dictionaryPealimId ?? suggestion.pealimId,
        });
      }
    } catch {
      setError(t("translationError"));
    } finally {
      setIsSearching(false);
      inputRef.current?.focus();
    }
  };

  const handleLookup = async (event?: React.FormEvent) => {
    event?.preventDefault();

    if (showSuggestions && activeIndex >= 0 && suggestions[activeIndex]) {
      await handleSelectSuggestion(suggestions[activeIndex]);
      return;
    }

    const cleanWord = cleanSearchQuery(query);
    if (!cleanWord) return;

    const plain = stripNiqqud(cleanWord);
    const isLatin = /^[a-zA-Z'’\-\s]+$/.test(plain);

    // English / Latin lookup: resolve via dictionary suggestions, not AI translate.
    if (isLatin) {
      skipSuggestRef.current = true;
      abortRef.current?.abort();
      requestIdRef.current += 1;
      setIsSearching(true);
      setResult(null);
      setError(null);
      setShowSuggestions(false);
      setIsSuggesting(false);

      try {
        let match: DictionarySuggestion | null = suggestions[0] ?? null;
        if (!match) {
          const res = await fetch(
            `/api/dictionary/suggest?q=${encodeURIComponent(plain)}`
          );
          if (res.ok) {
            const data = (await res.json()) as { suggestions?: DictionarySuggestion[] };
            match = data.suggestions?.[0] ?? null;
          }
        }

        if (!match) {
          setError(t("noDictionaryMatches"));
          return;
        }

        await handleSelectSuggestion(match);
      } catch {
        setError(t("translationError"));
      } finally {
        setIsSearching(false);
        inputRef.current?.focus();
      }
      return;
    }

    skipSuggestRef.current = true;
    abortRef.current?.abort();
    requestIdRef.current += 1;
    setIsSearching(true);
    setResult(null);
    setError(null);
    setShowSuggestions(false);
    setIsSuggesting(false);

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const res = await translateWord(accessToken, cleanWord, "", "", lang);

      if (res.type === "auth_required") {
        onRequireAuth();
        return;
      }
      if (res.type === "limit_reached") {
        onRequireSubscription();
        return;
      }
      if (res.type === "error") {
        setError(res.translation || t("translationError"));
        return;
      }
      if (!isAuthenticated && res.type === "success") {
        incrementAnonTranslations();
      }
      if (res.type === "success" && "lemmaWord" in res) {
        applyLookupResult({
          lemmaWord: res.lemmaWord || cleanWord,
          translation: res.translation || "",
          wordWithNekudot: res.wordWithNekudot || cleanWord,
          verbFormWithNekudot: res.verbFormWithNekudot || null,
          pronunciation: res.pronunciation ?? null,
          partOfSpeech: res.partOfSpeech ?? null,
          dictionaryPealimId: res.dictionaryPealimId ?? null,
        });
      }
    } catch {
      setError(t("translationError"));
    } finally {
      setIsSearching(false);
      inputRef.current?.focus();
    }
  };

  const handleSave = async () => {
    if (!result?.translation) return;

    setIsSaving(true);
    try {
      const saveRes = await onWordSaved({
        word: result.lemmaWord,
        wordWithNekudot: result.wordWithNekudot,
        verbFormWithNekudot: result.verbFormWithNekudot || undefined,
        translation: result.translation,
        pronunciation: result.pronunciation || undefined,
        dictionaryPealimId: result.dictionaryPealimId,
        partOfSpeech: result.partOfSpeech || undefined,
        episodeTitle: "",
        episodeUrl: "",
      });

      if (saveRes.type !== "auth_required") {
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && showSuggestions) {
      event.preventDefault();
      event.stopPropagation();
      setShowSuggestions(false);
      setActiveIndex(-1);
      return;
    }

    if (!showSuggestions || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault();
      void handleSelectSuggestion(suggestions[activeIndex]);
    }
  };

  const handleInputBlur = () => {
    blurCloseTimerRef.current = window.setTimeout(() => {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }, 120);
  };

  const handleInputFocus = () => {
    if (blurCloseTimerRef.current !== null) {
      window.clearTimeout(blurCloseTimerRef.current);
      blurCloseTimerRef.current = null;
    }
    if (suggestions.length > 0 && stripNiqqud(cleanSearchQuery(query)).length >= MIN_QUERY_LEN) {
      setShowSuggestions(true);
    }
  };

  if (!isOpen) return null;

  const listOpen = showSuggestions && !isSearching;
  const showEmptyHint =
    listOpen &&
    !isSuggesting &&
    suggestions.length === 0 &&
    stripNiqqud(cleanSearchQuery(query)).length >= MIN_QUERY_LEN;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal-content translation-modal add-vocab-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-header">
          <h3 id={titleId} className="modal-title" style={{ fontSize: "18px" }}>
            {t("addWordModalTitle")}
          </h3>
          <button onClick={onClose} className="close-btn" aria-label={t("close")}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body add-vocab-modal-body">
          <form className="add-vocab-search-form" onSubmit={handleLookup}>
            <div className="add-vocab-search-field">
              <div className="add-vocab-search-row">
                <input
                  ref={inputRef}
                  type="text"
                  className="add-vocab-search-input"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setResult(null);
                    setError(null);
                  }}
                  onKeyDown={handleInputKeyDown}
                  onBlur={handleInputBlur}
                  onFocus={handleInputFocus}
                  placeholder={t("searchHebrewWordPlaceholder")}
                  dir="auto"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  role="combobox"
                  aria-expanded={listOpen}
                  aria-controls={listboxId}
                  aria-autocomplete="list"
                  aria-activedescendant={
                    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
                  }
                />
                <button
                  type="submit"
                  className="add-vocab-search-btn"
                  disabled={isSearching || !query.trim()}
                  aria-label={t("lookUpWord")}
                >
                  {isSearching ? <Loader2 className="spinner" size={16} /> : <Search size={16} />}
                </button>
              </div>

              {listOpen && (suggestions.length > 0 || isSuggesting || showEmptyHint) && (
                <div
                  id={listboxId}
                  className="add-vocab-suggestions"
                  role="listbox"
                  aria-label={t("dictionarySuggestions")}
                >
                  {isSuggesting && suggestions.length === 0 && (
                    <div className="add-vocab-suggestions-status">
                      <Loader2 className="spinner" size={14} />
                      <span>{t("searchingDictionary")}</span>
                    </div>
                  )}

                  {showEmptyHint && (
                    <div className="add-vocab-suggestions-status">
                      {t("noDictionaryMatches")}
                    </div>
                  )}

                  {suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion.pealimId}
                      id={`${listboxId}-option-${index}`}
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      className={`add-vocab-suggestion${
                        index === activeIndex ? " is-active" : ""
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => void handleSelectSuggestion(suggestion)}
                    >
                      <span className="add-vocab-suggestion-main">
                        <span className="add-vocab-suggestion-hebrew font-serif" dir="rtl">
                          {suggestion.wordWithNekudot || suggestion.word}
                        </span>
                        {suggestion.transliteration && (
                          <span className="add-vocab-suggestion-translit">
                            {suggestion.transliteration}
                          </span>
                        )}
                      </span>
                      <span className="add-vocab-suggestion-meta">
                        <span className="add-vocab-suggestion-meaning">
                          {suggestion.meaning}
                        </span>
                        {suggestion.partOfSpeech && (
                          <span className="add-vocab-suggestion-pos">
                            {suggestion.partOfSpeech}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="add-vocab-search-hint">{t("addWordSearchHint")}</p>
          </form>

          {isSearching && (
            <div className="translating-state" style={{ marginTop: "var(--space-4)" }}>
              <Loader2 className="spinner" size={20} />
              <span>{t("searchingDictionary")}</span>
            </div>
          )}

          {error && !isSearching && <p className="add-vocab-error">{error}</p>}

          {result && !isSearching && (
            <div className="add-vocab-result">
              <div className="add-vocab-result-word-area">
                <p className="add-vocab-result-hebrew font-serif" dir="rtl">
                  {result.wordWithNekudot}
                </p>
                {result.pronunciation && (
                  <p className="add-vocab-result-pronunciation">{result.pronunciation}</p>
                )}
              </div>
              <p className="add-vocab-result-translation">{result.translation}</p>
              {(result.partOfSpeech || result.verbFormWithNekudot) && (
                <div className="add-vocab-result-footer">
                  {result.partOfSpeech && (
                    <span className="add-vocab-result-pos-badge">{result.partOfSpeech}</span>
                  )}
                  {result.verbFormWithNekudot && (
                    <span className="add-vocab-result-verbform">
                      {t("verbForm")}:{" "}
                      <span className="font-serif" dir="rtl">{result.verbFormWithNekudot}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {result && !isSearching && (
          <div className="modal-footer translation-modal-footer">
            <button
              type="button"
              className="translation-modal-save-btn"
              disabled={isSaving || !result.translation}
              onClick={handleSave}
            >
              {isSaving ? <Loader2 className="spinner" size={14} /> : null}
              {t("addToVocabulary")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
