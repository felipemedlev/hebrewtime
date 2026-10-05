"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { X, Loader2, Search } from "lucide-react";
import { translateDictionarySuggestion, translateWord } from "@/app/actions";
import { supabase } from "@/lib/supabase";
import { stripNiqqud, type DictionarySuggestion } from "@/lib/dictionaryLookup";
import { useModalAccessibility } from "@/hooks/useModalAccessibility";
import { useLanguage, useT } from "@/lib/i18n/LanguageProvider";
import { incrementAnonTranslations } from "@/lib/anonUsage";
import type { VocabWord } from "@/lib/types";
import { normalizeHebrewInput } from "@/lib/progress";

type LookupResult = {
  lemmaWord: string;
  translation: string;
  wordWithNekudot: string;
  verbFormWithNekudot: string | null;
  pronunciation: string | null;
  partOfSpeech: string | null;
  dictionaryPealimId: number | null;
};

type AddMode = "word" | "phrase";

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

const DEBOUNCE_MS = 150;
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
      item.wordWithNekudot === b[index]?.wordWithNekudot &&
      item.meaning === b[index]?.meaning &&
      item.transliteration === b[index]?.transliteration &&
      item.matchType === b[index]?.matchType &&
      item.matchedText === b[index]?.matchedText
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

  const [mode, setMode] = useState<AddMode>("word");
  const [query, setQuery] = useState("");
  const [phraseHebrew, setPhraseHebrew] = useState("");
  const [phraseTranslation, setPhraseTranslation] = useState("");
  const [phrasePronunciation, setPhrasePronunciation] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<DictionarySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionStatus, setSuggestionStatus] = useState<"idle" | "loading" | "empty" | "error" | "rate_limited">("idle");
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [resultSource, setResultSource] = useState<"dictionary" | "ai">("dictionary");
  const [meaningStatus, setMeaningStatus] = useState<"ready" | "translating" | "failed" | "english">("ready");
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const suggestTimerRef = useRef<number | null>(null);
  const blurCloseTimerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const phraseHebrewRef = useRef<HTMLTextAreaElement>(null);
  const showSuggestionsRef = useRef(false);
  const skipSuggestRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const clearSuggestionDebounce = () => {
    if (suggestTimerRef.current !== null) {
      window.clearTimeout(suggestTimerRef.current);
      suggestTimerRef.current = null;
    }
  };

  const executeSuggestionSearch = useCallback(async (rawQuery: string) => {
    const plain = stripNiqqud(cleanSearchQuery(rawQuery));
    if (plain.length < MIN_QUERY_LEN) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSuggesting(false);
      setSuggestionStatus("idle");
      setActiveIndex(-1);
      return;
    }

    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsSuggesting(true);
    setSuggestionStatus("loading");
    setShowSuggestions(true);
    setActiveIndex(-1);

    try {
      const res = await fetch(`/api/dictionary/suggest?q=${encodeURIComponent(plain)}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      const data = await res.json() as {
        suggestions?: DictionarySuggestion[];
        status?: string;
        retryAfterSeconds?: number;
      };
      if (requestId !== requestIdRef.current || controller.signal.aborted || !isOpen) return;

      if (res.status === 429 || data.status === "rate_limited") {
        setSuggestions([]);
        setSuggestionStatus("rate_limited");
        setRetryAfterSeconds(data.retryAfterSeconds ?? (Number(res.headers.get("Retry-After")) || 1));
        return;
      }
      if (!res.ok || data.status === "unavailable") {
        setSuggestions([]);
        setSuggestionStatus("error");
        return;
      }

      const next = data.suggestions ?? [];
      setSuggestions((prev) => (suggestionsEqual(prev, next) ? prev : next));
      setSuggestionStatus(next.length ? "idle" : "empty");
      setRetryAfterSeconds(0);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (requestId !== requestIdRef.current || !isOpen) return;
      setSuggestions([]);
      setSuggestionStatus("error");
    } finally {
      if (requestId === requestIdRef.current) setIsSuggesting(false);
    }
  }, [isOpen]);

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
    if (activeIndex < 0) return;
    listboxRef.current
      ?.querySelector<HTMLElement>(`#${CSS.escape(`${listboxId}-option-${activeIndex}`)}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listboxId]);

  useEffect(() => {
    if (suggestionStatus !== "rate_limited" || retryAfterSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setRetryAfterSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [suggestionStatus, retryAfterSeconds]);

  const closeModal = () => {
    clearSuggestionDebounce();
    abortRef.current?.abort();
    requestIdRef.current += 1;
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      abortRef.current?.abort();
      setMode("word");
      setQuery("");
      setPhraseHebrew("");
      setPhraseTranslation("");
      setPhrasePronunciation("");
      setIsSearching(false);
      setIsSaving(false);
      setIsSuggesting(false);
      setSuggestions([]);
      setShowSuggestions(false);
      setSuggestionStatus("idle");
      setRetryAfterSeconds(0);
      setActiveIndex(-1);
      setResult(null);
      setResultSource("dictionary");
      setMeaningStatus("ready");
      setError(null);
      skipSuggestRef.current = null;
      requestIdRef.current += 1;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (mode !== "word") return;

    if (skipSuggestRef.current === query) {
      skipSuggestRef.current = null;
      return;
    }

    const plain = stripNiqqud(cleanSearchQuery(query));
    if (plain.length < MIN_QUERY_LEN) {
      abortRef.current?.abort();
      requestIdRef.current += 1;
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSuggesting(false);
      setSuggestionStatus("idle");
      setActiveIndex(-1);
      return;
    }

    suggestTimerRef.current = window.setTimeout(() => {
      suggestTimerRef.current = null;
      void executeSuggestionSearch(query);
    }, DEBOUNCE_MS);

    return () => {
      clearSuggestionDebounce();
    };
  }, [query, isOpen, mode, executeSuggestionSearch]);

  const switchToPhraseMode = (hebrewSeed = "") => {
    clearSuggestionDebounce();
    skipSuggestRef.current = null;
    abortRef.current?.abort();
    requestIdRef.current += 1;
    setMode("phrase");
    setQuery("");
    setResult(null);
    setError(null);
    setSuggestions([]);
    setShowSuggestions(false);
    setSuggestionStatus("idle");
    setActiveIndex(-1);
    setIsSuggesting(false);
    setIsSearching(false);
    if (hebrewSeed) {
      setPhraseHebrew(hebrewSeed);
    }
    window.setTimeout(() => phraseHebrewRef.current?.focus(), 0);
  };

  const handleQueryChange = (value: string) => {
    skipSuggestRef.current = null;
    abortRef.current?.abort();
    requestIdRef.current += 1;
    setQuery(value);
    setResult(null);
    setMeaningStatus("ready");
    setError(null);
    setSuggestions([]);
    setActiveIndex(-1);
    setSuggestionStatus(stripNiqqud(cleanSearchQuery(value)).length >= MIN_QUERY_LEN ? "loading" : "idle");
    setIsSuggesting(stripNiqqud(cleanSearchQuery(value)).length >= MIN_QUERY_LEN);
    setShowSuggestions(stripNiqqud(cleanSearchQuery(value)).length >= MIN_QUERY_LEN);
  };

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (blurCloseTimerRef.current !== null) {
        window.clearTimeout(blurCloseTimerRef.current);
      }
    };
  }, []);

  const applyLookupResult = (payload: LookupResult, source: "dictionary" | "ai" = "dictionary") => {
    setResult(payload);
    setResultSource(source);
    setMeaningStatus("ready");
    setError(null);
    setShowSuggestions(false);
    setSuggestions([]);
    setActiveIndex(-1);
  };

  const handleSelectSuggestion = async (suggestion: DictionarySuggestion) => {
    clearSuggestionDebounce();
    skipSuggestRef.current = suggestion.word;
    abortRef.current?.abort();
    const requestId = ++requestIdRef.current;
    setQuery(suggestion.word);
    setShowSuggestions(false);
    setSuggestions([]);
    setActiveIndex(-1);
    setIsSuggesting(false);
    setSuggestionStatus("idle");
    setIsSearching(false);
    setResult(null);
    setError(null);
    setResultSource("dictionary");
    setMeaningStatus(lang === "en" ? "ready" : "translating");
    setResult({
      lemmaWord: suggestion.word,
      translation: suggestion.meaning,
      wordWithNekudot: suggestion.wordWithNekudot || suggestion.word,
      verbFormWithNekudot: suggestion.partOfSpeech.toLowerCase().startsWith("verb")
        ? suggestion.wordWithNekudot || suggestion.word
        : null,
      pronunciation: suggestion.transliteration,
      partOfSpeech: suggestion.partOfSpeech,
      dictionaryPealimId: suggestion.pealimId,
    });

    if (lang !== "en") {
      try {
        const translated = await translateDictionarySuggestion(suggestion.pealimId, lang);
        if (requestId !== requestIdRef.current || !isOpen) return;
        if (translated.type === "success" && translated.translation) {
          setResult((current) => current ? { ...current, translation: translated.translation } : current);
          setMeaningStatus("ready");
        } else {
          setMeaningStatus("failed");
        }
      } catch {
        if (requestId === requestIdRef.current && isOpen) setMeaningStatus("failed");
      }
    }
    if (requestId === requestIdRef.current) inputRef.current?.focus();
  };

  const handleLookup = async (event?: React.FormEvent) => {
    event?.preventDefault();
    clearSuggestionDebounce();

    if (showSuggestions && activeIndex >= 0 && suggestions[activeIndex]) {
      await handleSelectSuggestion(suggestions[activeIndex]);
      return;
    }

    if (!cleanSearchQuery(query)) return;
    setResult(null);
    setError(null);
    setShowSuggestions(true);
    await executeSuggestionSearch(query);
  };

  const handleAiLookup = async () => {
    clearSuggestionDebounce();
    const cleanWord = cleanSearchQuery(query);
    if (!cleanWord || isSearching) return;
    abortRef.current?.abort();
    const requestId = ++requestIdRef.current;
    setIsSearching(true);
    setResult(null);
    setError(null);
    setShowSuggestions(false);
    setActiveIndex(-1);

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const res = await translateWord(accessToken, cleanWord, "", "", lang, true);
      if (requestId !== requestIdRef.current || !isOpen) return;

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
        }, "ai");
      }
    } catch {
      if (requestId === requestIdRef.current && isOpen) setError(t("translationError"));
    } finally {
      if (requestId === requestIdRef.current) {
        setIsSearching(false);
        inputRef.current?.focus();
      }
    }
  };

  const handleRetryMeaningTranslation = async () => {
    if (!result?.dictionaryPealimId) return;
    const requestId = ++requestIdRef.current;
    setMeaningStatus("translating");
    try {
      const translated = await translateDictionarySuggestion(result.dictionaryPealimId, lang);
      if (requestId !== requestIdRef.current || !isOpen) return;
      if (translated.type === "success" && translated.translation) {
        setResult((current) => current ? { ...current, translation: translated.translation } : current);
        setMeaningStatus("ready");
      } else {
        setMeaningStatus("failed");
      }
    } catch {
      if (requestId === requestIdRef.current && isOpen) setMeaningStatus("failed");
    }
  };

  const handleUseEnglishMeaning = () => setMeaningStatus("english");

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
        entryKind: "word",
        episodeTitle: "",
        episodeUrl: "",
      });

      if (saveRes.type !== "auth_required") {
    closeModal();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePhrase = async (event?: React.FormEvent) => {
    event?.preventDefault();

    const hebrewInput = normalizeHebrewInput(phraseHebrew);
    const translationInput = phraseTranslation.trim();
    if (!hebrewInput || !translationInput) return;

    setIsSaving(true);
    try {
      const saveRes = await onWordSaved({
        word: stripNiqqud(hebrewInput),
        wordWithNekudot: hebrewInput,
        translation: translationInput,
        pronunciation: phrasePronunciation.trim() || undefined,
        entryKind: "phrase",
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

  const phraseReady = normalizeHebrewInput(phraseHebrew).length > 0 && phraseTranslation.trim().length > 0;

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
    suggestionStatus === "empty" &&
    suggestions.length === 0 &&
    stripNiqqud(cleanSearchQuery(query)).length >= MIN_QUERY_LEN;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
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
          <button onClick={closeModal} className="close-btn" aria-label={t("close")}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body add-vocab-modal-body">
          <div className="add-vocab-mode-toggle" role="tablist" aria-label={t("addWordModalTitle")}>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "word"}
              className={`add-vocab-mode-btn${mode === "word" ? " is-active" : ""}`}
              onClick={() => {
                clearSuggestionDebounce();
                abortRef.current?.abort();
                requestIdRef.current += 1;
                setMode("word");
                window.setTimeout(() => inputRef.current?.focus(), 0);
              }}
            >
              {t("addVocabModeWord")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "phrase"}
              className={`add-vocab-mode-btn${mode === "phrase" ? " is-active" : ""}`}
              onClick={() => switchToPhraseMode()}
            >
              {t("addVocabModePhrase")}
            </button>
          </div>

          {mode === "word" ? (
          <form className="add-vocab-search-form" onSubmit={handleLookup}>
            <div className="add-vocab-search-field">
              <div className="add-vocab-search-row">
                <label htmlFor="add-vocab-word-search" className="sr-only">{t("dictionarySearchLabel")}</label>
                <input
                  ref={inputRef}
                  id="add-vocab-word-search"
                  type="text"
                  className="add-vocab-search-input"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  onBlur={handleInputBlur}
                  onFocus={handleInputFocus}
                  placeholder={t("searchHebrewWordPlaceholder")}
                  aria-describedby="add-vocab-word-search-hint"
                  dir="auto"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  role="combobox"
                  aria-expanded={listOpen}
                  aria-controls={listboxId}
                  aria-autocomplete="list"
                  aria-activedescendant={
                    listOpen && activeIndex >= 0 && suggestions[activeIndex]
                      ? `${listboxId}-option-${activeIndex}`
                      : undefined
                  }
                />
                {query && (
                  <button
                    type="button"
                    className="add-vocab-search-clear"
                    aria-label={t("clearSearch")}
                    onClick={() => {
                      handleQueryChange("");
                      inputRef.current?.focus();
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
                <button
                  type="submit"
                  className="add-vocab-search-btn"
                  disabled={isSearching || !query.trim()}
                  aria-label={t("lookUpWord")}
                >
                  {isSearching || isSuggesting ? <Loader2 className="spinner" size={16} /> : <Search size={16} />}
                </button>
              </div>

              {listOpen && (suggestions.length > 0 || isSuggesting || showEmptyHint || suggestionStatus === "error" || suggestionStatus === "rate_limited") && (
                <div
                  className="add-vocab-suggestions"
                >
                  {isSuggesting && (
                    <div className="add-vocab-suggestions-status" role="status" aria-live="polite">
                      <Loader2 className="spinner" size={14} />
                      <span>{t("searchingDictionary")}</span>
                    </div>
                  )}

                  {showEmptyHint && (
                    <div className="add-vocab-suggestions-status" role="status" aria-live="polite">
                      {t("noDictionaryMatches")}
                    </div>
                  )}

                  {suggestionStatus === "error" && !isSuggesting && (
                    <div className="add-vocab-suggestions-status add-vocab-search-error" role="status">
                      <span>{t("dictionaryUnavailable")}</span>
                      <button type="button" onClick={() => void executeSuggestionSearch(query)}>{t("tryAgain")}</button>
                    </div>
                  )}

                  {suggestionStatus === "rate_limited" && !isSuggesting && (
                    <div className="add-vocab-suggestions-status" role="status">
                      {retryAfterSeconds > 0
                        ? t("dictionaryRateLimited", { count: retryAfterSeconds })
                        : <><span>{t("dictionaryRateLimitReady")}</span><button type="button" onClick={() => void executeSuggestionSearch(query)}>{t("tryAgain")}</button></>}
                    </div>
                  )}

                  <div ref={listboxRef} id={listboxId} className="add-vocab-suggestion-list" role="listbox" aria-label={t("dictionarySuggestions")}>
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
                      onClick={() => void handleSelectSuggestion(suggestion)}
                    >
                      <span className="add-vocab-suggestion-main">
                        <span className="add-vocab-suggestion-hebrew font-serif" dir="rtl" lang="he">
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
                        {(suggestion.matchType === "fuzzy" || suggestion.matchType === "fuzzy_form") && (
                          <span className="add-vocab-suggestion-match">{t("possibleSpellingMatch")}</span>
                        )}
                        {(suggestion.matchType === "form" || suggestion.matchType === "fuzzy_form") && suggestion.matchedText !== suggestion.word && (
                          <span className="add-vocab-suggestion-match font-serif" dir="rtl" lang="he">
                            {t("matchedForm", { word: suggestion.matchedText })}
                          </span>
                        )}
                        {suggestion.partOfSpeech && (
                          <span className="add-vocab-suggestion-pos">
                            {suggestion.partOfSpeech}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                  </div>
                </div>
              )}
              <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {suggestionStatus === "idle" && suggestions.length > 0
                  ? t("dictionaryResultsCount", { count: suggestions.length })
                  : ""}
              </div>
            </div>
            <p id="add-vocab-word-search-hint" className="add-vocab-search-hint">{t("addWordSearchHint")}</p>
            {query.trim().length >= MIN_QUERY_LEN && (
              <button
                type="button"
                className="add-vocab-ai-lookup-btn"
                disabled={isSearching || isSuggesting}
                onClick={() => void handleAiLookup()}
              >
                {t("tryAiLookup")}
              </button>
            )}
          </form>
          ) : (
          <form className="add-vocab-phrase-form" onSubmit={handleSavePhrase}>
            <label className="add-vocab-field-label" htmlFor="add-vocab-phrase-hebrew">
              {t("phraseHebrewLabel")}
            </label>
            <textarea
              ref={phraseHebrewRef}
              id="add-vocab-phrase-hebrew"
              className="add-vocab-phrase-input font-serif"
              dir="rtl"
              lang="he"
              rows={3}
              value={phraseHebrew}
              onChange={(e) => setPhraseHebrew(e.target.value.normalize("NFC"))}
              placeholder={t("phraseHebrewPlaceholder")}
              autoFocus
            />

            <label className="add-vocab-field-label" htmlFor="add-vocab-phrase-translation">
              {t("phraseTranslationLabel")}
            </label>
            <input
              id="add-vocab-phrase-translation"
              type="text"
              className="add-vocab-search-input"
              value={phraseTranslation}
              onChange={(e) => setPhraseTranslation(e.target.value.normalize("NFC"))}
              placeholder={t("phraseTranslationPlaceholder")}
              dir="auto"
            />

            <label className="add-vocab-field-label" htmlFor="add-vocab-phrase-pronunciation">
              {t("pronunciation")}
            </label>
            <input
              id="add-vocab-phrase-pronunciation"
              type="text"
              className="add-vocab-search-input"
              value={phrasePronunciation}
              onChange={(e) => setPhrasePronunciation(e.target.value)}
              placeholder={t("phrasePronunciationPlaceholder")}
              dir="auto"
            />

            <p className="add-vocab-search-hint">{t("phraseSaveHint")}</p>
          </form>
          )}

          {mode === "word" && isSearching && (
            <div className="translating-state" style={{ marginTop: "var(--space-4)" }}>
              <Loader2 className="spinner" size={20} />
              <span>{t("searchingDictionary")}</span>
            </div>
          )}

          {mode === "word" && error && !isSearching && <p className="add-vocab-error">{error}</p>}

          {mode === "word" && result && !isSearching && (
            <div className="add-vocab-result">
              <div className="add-vocab-result-word-area">
                {resultSource === "ai" && <span className="add-vocab-result-source">{t("aiLookupResult")}</span>}
                <p className="add-vocab-result-hebrew font-serif" dir="rtl" lang="he">
                  {result.wordWithNekudot}
                </p>
                {result.pronunciation && (
                  <p className="add-vocab-result-pronunciation">{result.pronunciation}</p>
                )}
              </div>
              <p className="add-vocab-result-translation">{result.translation}</p>
              {meaningStatus === "translating" && (
                <p className="add-vocab-meaning-status" role="status"><Loader2 className="spinner" size={14} />{t("translatingMeaning")}</p>
              )}
              {meaningStatus === "failed" && (
                <div className="add-vocab-meaning-fallback" role="status">
                  <span>{t("meaningTranslationFailed")}</span>
                  <button type="button" onClick={() => void handleRetryMeaningTranslation()}>{t("retryMeaningTranslation")}</button>
                  <button type="button" onClick={handleUseEnglishMeaning}>{t("useEnglishMeaning")}</button>
                </div>
              )}
              {meaningStatus === "english" && <p className="add-vocab-meaning-status" role="status">{t("usingEnglishMeaning")}</p>}
              {(result.partOfSpeech || result.verbFormWithNekudot) && (
                <div className="add-vocab-result-footer">
                  {result.partOfSpeech && (
                    <span className="add-vocab-result-pos-badge">{result.partOfSpeech}</span>
                  )}
                  {result.verbFormWithNekudot && (
                    <span className="add-vocab-result-verbform">
                      {t("verbForm")}:{" "}
                      <span className="font-serif" dir="rtl" lang="he">{result.verbFormWithNekudot}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {mode === "word" && result && !isSearching && (
          <div className="modal-footer translation-modal-footer">
            <button
              type="button"
              className="translation-modal-save-btn"
              disabled={isSaving || meaningStatus === "translating" || meaningStatus === "failed" || !result.translation}
              onClick={handleSave}
            >
              {isSaving ? <Loader2 className="spinner" size={14} /> : null}
              {t("addToVocabulary")}
            </button>
          </div>
        )}

        {mode === "phrase" && (
          <div className="modal-footer translation-modal-footer">
            <button
              type="button"
              className="translation-modal-save-btn"
              disabled={isSaving || !phraseReady}
              onClick={() => void handleSavePhrase()}
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
