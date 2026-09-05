"use client";

import { ExternalLink, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import type { Episode, ParagraphTiming } from "@/lib/types";
import { translateWord } from "@/app/actions";
import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import TranslationModal from "./TranslationModal";
import DictionaryDetailsModal from "./DictionaryDetailsModal";
import { supabase } from "@/lib/supabase";
import { hasReachedAnonTranslationLimit, incrementAnonTranslations } from "@/lib/anonUsage";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { resolveTranslationParagraphs } from "@/lib/episodeTranslations";

type EpisodeViewerProps = {
  episode: Episode;
  levelDisplayName?: string;
  hasPrev: boolean;
  hasNext: boolean;
  onNavigate: (direction: "prev" | "next") => void;
  onWordSaved: (word: {
    word: string;
    wordWithNekudot?: string;
    verbFormWithNekudot?: string;
    translation: string;
    pronunciation?: string;
    dictionaryPealimId?: number | null;
    partOfSpeech?: string | null;
    episodeTitle: string;
    episodeUrl: string;
  }) => Promise<{ added: boolean; message: string; type?: string }>;
  onToast: (msg: string) => void;
  isPremium: boolean;
  isAuthenticated: boolean;
  onRequireAuth: () => void;
  onRequireSubscription: () => void;
  isLoadingEntitlements: boolean;
  isFinished: boolean;
  onToggleFinished: () => void;
  onLearningInteraction?: () => void;
  progressSaving?: boolean;
};

type ModalState = {
  isOpen: boolean;
  word: string;
  lemmaWord: string | null;
  hebrewContext: string;
  translationContext: string;
  translation: string | null;
  wordWithNekudot: string | null;
  verbFormWithNekudot: string | null;
  pronunciation: string | null;
  partOfSpeech: string | null;
  dictionaryPealimId: number | null;
  isTranslating: boolean;
};

type ActivePosition = {
  paragraphIndex: number;
  sentenceIndex: number | null;
};

function isParagraphTiming(p: string | ParagraphTiming): p is ParagraphTiming {
  return typeof p === "object" && p !== null && "text" in p;
}

function findActivePosition(
  paragraphs: Episode["hebrew_paragraphs"],
  currentTime: number
): ActivePosition | null {
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    if (!isParagraphTiming(para)) continue;

    const inParagraph =
      (i === 0 && currentTime < para.start) ||
      (currentTime >= para.start && currentTime <= para.end);

    if (!inParagraph) continue;

    if (para.sentences && para.sentences.length > 0) {
      for (let j = 0; j < para.sentences.length; j++) {
        const sent = para.sentences[j];
        if (j === 0 && currentTime < sent.start) {
          return { paragraphIndex: i, sentenceIndex: j };
        }
        const nextSent = para.sentences[j + 1];
        const isCurrentOrBetween =
          currentTime >= sent.start && (!nextSent || currentTime < nextSent.start);
        if (isCurrentOrBetween) {
          return { paragraphIndex: i, sentenceIndex: j };
        }
      }
    }

    return { paragraphIndex: i, sentenceIndex: null };
  }
  return null;
}

function renderHebrewTokens(
  text: string,
  translationPara: string | undefined,
  onWordClick: (word: string, heb: string, ctx: string) => void,
  translateLabel: (word: string) => string
) {
  return text.split(/(\s+)/).map((token, idx) => {
    if (token.trim() === "") {
      return <span key={idx}>{token}</span>;
    }
    const cleanWord = token.replace(
      /^[.,;:!?(){}\[\]"'\-]+|[.,;:!?(){}\[\]"'\-]+$/g,
      ""
    );
    return (
      <span
        key={idx}
        className={cleanWord ? "hebrew-word" : ""}
        role={cleanWord ? "button" : undefined}
        tabIndex={cleanWord ? -1 : undefined}
        onClick={() => {
          if (cleanWord) onWordClick(token, text, translationPara || "");
        }}
        onKeyDown={(event) => {
          if (!cleanWord) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onWordClick(token, text, translationPara || "");
            return;
          }
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            const container = event.currentTarget.closest(".text-hebrew");
            const words = container
              ? Array.from(container.querySelectorAll<HTMLElement>(".hebrew-word"))
              : [];
            const currentIndex = words.indexOf(event.currentTarget);
            const nextIndex = event.key === "ArrowLeft" ? currentIndex - 1 : currentIndex + 1;
            if (nextIndex >= 0 && nextIndex < words.length) {
              event.preventDefault();
              words[nextIndex]?.focus();
            }
          }
        }}
        aria-label={cleanWord ? translateLabel(cleanWord) : undefined}
      >
        {token}
      </span>
    );
  });
}

type EpisodeParagraphProps = {
  index: number;
  hebObj: string | ParagraphTiming;
  trans: string | undefined;
  isParagraphActive: boolean;
  activeSentenceIndex: number | null;
  isTranslationBlurred: boolean;
  noTranslationLabel: string;
  paragraphLabel: (index: number) => string;
  onWordClick: (word: string, heb: string, ctx: string) => void;
  translateLabel: (word: string) => string;
  onParagraphRef: (index: number, el: HTMLDivElement | null) => void;
  onSentenceRef: (
    paragraphIndex: number,
    sentenceIndex: number,
    el: HTMLSpanElement | null
  ) => void;
};

const EpisodeParagraph = memo(function EpisodeParagraph({
  index,
  hebObj,
  trans,
  isParagraphActive,
  activeSentenceIndex,
  isTranslationBlurred,
  noTranslationLabel,
  paragraphLabel,
  onWordClick,
  translateLabel,
  onParagraphRef,
  onSentenceRef,
}: EpisodeParagraphProps) {
  const isSynced = isParagraphTiming(hebObj);
  const heb = isSynced ? hebObj.text : hebObj;
  const hasSentences = isSynced && hebObj.sentences && hebObj.sentences.length > 0;

  return (
    <div
      ref={(el) => onParagraphRef(index, el)}
      className={`para-pair ${isParagraphActive ? "active-paragraph" : ""}`}
      role="group"
      tabIndex={0}
      aria-label={paragraphLabel(index + 1)}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        const words = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(".hebrew-word"));
        if (words.length === 0) return;
        event.preventDefault();
        (event.key === "ArrowLeft" ? words[words.length - 1] : words[0])?.focus();
      }}
    >
      <div className="text-hebrew font-serif" dir="rtl" lang="he">
        {hasSentences ? (
          hebObj.sentences!.map((sent, j) => {
            const isSentenceActive = activeSentenceIndex === j;
            return (
              <span
                key={j}
                ref={(el) => onSentenceRef(index, j, el)}
                className={`sentence-span ${isSentenceActive ? "active-sentence" : ""}`}
              >
                {renderHebrewTokens(sent.text, trans, onWordClick, translateLabel)}
                {j < hebObj.sentences!.length - 1 ? " " : ""}
              </span>
            );
          })
        ) : (
          renderHebrewTokens(heb, trans, onWordClick, translateLabel)
        )}
      </div>
      <div className={`text-translation ${isTranslationBlurred ? "blurred" : ""}`}>
        {trans ? (
          trans
        ) : (
          <span className="text-translation-empty">{noTranslationLabel}</span>
        )}
      </div>
    </div>
  );
});

export default function EpisodeViewer({
  episode,
  levelDisplayName,
  hasPrev,
  hasNext,
  onNavigate,
  onWordSaved,
  isAuthenticated,
  onRequireAuth,
  onRequireSubscription,
  isLoadingEntitlements,
  isFinished,
  onToggleFinished,
  onLearningInteraction,
  progressSaving = false,
}: EpisodeViewerProps) {
  const { lang, isTranslationBlurred, t } = useLanguage();
  const translationResolution = useMemo(
    () => resolveTranslationParagraphs(episode, lang),
    [episode, lang]
  );
  const translationParagraphs = translationResolution.paragraphs;

  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    word: "",
    lemmaWord: null,
    hebrewContext: "",
    translationContext: "",
    translation: null,
    wordWithNekudot: null,
    verbFormWithNekudot: null,
    pronunciation: null,
    partOfSpeech: null,
    dictionaryPealimId: null,
    isTranslating: false,
  });
  const [detailsPealimId, setDetailsPealimId] = useState<number | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const paragraphRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sentenceRefs = useRef<(HTMLSpanElement | null)[][]>([]);
  const lastActiveKey = useRef<string>("");

  useEffect(() => {
    const handleTimeUpdate = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail;
      setCurrentTime(detail);
    };
    window.addEventListener("playerTimeUpdate", handleTimeUpdate);
    return () => window.removeEventListener("playerTimeUpdate", handleTimeUpdate);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (modal.isOpen) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.defaultPrevented) return;
      if (e.key === "ArrowLeft" && hasPrev) {
        e.preventDefault();
        onNavigate("prev");
      } else if (e.key === "ArrowRight" && hasNext) {
        e.preventDefault();
        onNavigate("next");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasPrev, hasNext, onNavigate, modal.isOpen]);

  const activePosition = useMemo(
    () => findActivePosition(episode.hebrew_paragraphs, currentTime),
    [episode.hebrew_paragraphs, currentTime]
  );

  useEffect(() => {
    if (!activePosition) return;

    const key =
      activePosition.sentenceIndex !== null
        ? `${activePosition.paragraphIndex}:${activePosition.sentenceIndex}`
        : `${activePosition.paragraphIndex}`;

    if (key === lastActiveKey.current) return;
    lastActiveKey.current = key;

    if (activePosition.sentenceIndex !== null) {
      const el =
        sentenceRefs.current[activePosition.paragraphIndex]?.[activePosition.sentenceIndex];
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const el = paragraphRefs.current[activePosition.paragraphIndex];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activePosition]);

  const onParagraphRef = useCallback((index: number, el: HTMLDivElement | null) => {
    paragraphRefs.current[index] = el;
  }, []);

  const onSentenceRef = useCallback(
    (paragraphIndex: number, sentenceIndex: number, el: HTMLSpanElement | null) => {
      if (!sentenceRefs.current[paragraphIndex]) {
        sentenceRefs.current[paragraphIndex] = [];
      }
      sentenceRefs.current[paragraphIndex][sentenceIndex] = el;
    },
    []
  );

  const handleWordClick = useCallback(async (
    word: string,
    hebContext: string,
    transContext: string
  ) => {
    onLearningInteraction?.();
    if (isLoadingEntitlements) return;

    if (!isAuthenticated && hasReachedAnonTranslationLimit()) {
      onRequireSubscription();
      return;
    }

    const cleanWord = word.replace(
      /^[.,;:!?(){}\[\]"'\-]+|[.,;:!?(){}\[\]"'\-]+$/g,
      ""
    );
    if (!cleanWord) return;

    setModal({
      isOpen: true,
      word: cleanWord,
      lemmaWord: null,
      hebrewContext: hebContext,
      translationContext: transContext || "",
      translation: null,
      wordWithNekudot: null,
      verbFormWithNekudot: null,
      pronunciation: null,
      partOfSpeech: null,
      dictionaryPealimId: null,
      isTranslating: true,
    });

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const res = await translateWord(
        accessToken,
        cleanWord,
        hebContext,
        transContext || "",
        lang
      );
      if (res.type === "auth_required") {
        setModal((prev) => ({ ...prev, isOpen: false }));
        onRequireAuth();
        return;
      }
      if (res.type === "limit_reached") {
        setModal((prev) => ({ ...prev, isOpen: false }));
        onRequireSubscription();
        return;
      }
      if (res.type === "error") {
        setModal((prev) => ({
          ...prev,
          translation: res.translation || "Translation error",
          wordWithNekudot: res.wordWithNekudot || cleanWord,
          isTranslating: false,
        }));
        return;
      }
      if (!isAuthenticated && res.type === "success") {
        incrementAnonTranslations();
      }
      if (res.type === "success" && "lemmaWord" in res) {
        setModal((prev) => ({
          ...prev,
          lemmaWord: res.lemmaWord || cleanWord,
          translation: res.translation || "Translation error",
          wordWithNekudot: res.wordWithNekudot || cleanWord,
          verbFormWithNekudot: res.verbFormWithNekudot || null,
          pronunciation: res.pronunciation ?? null,
          partOfSpeech: res.partOfSpeech ?? null,
          dictionaryPealimId: res.dictionaryPealimId ?? null,
          isTranslating: false,
        }));
      }
    } catch {
      setModal((prev) => ({
        ...prev,
        translation: "Translation error",
        isTranslating: false,
      }));
    }
  }, [
    isLoadingEntitlements,
    isAuthenticated,
    onRequireSubscription,
    onRequireAuth,
    lang,
    onLearningInteraction,
  ]);

  const handleSave = async () => {
    if (!modal.translation) return;

    const wordToSave = modal.lemmaWord || modal.word;

    const result = await onWordSaved({
      word: wordToSave,
      wordWithNekudot: modal.wordWithNekudot || wordToSave,
      verbFormWithNekudot: modal.verbFormWithNekudot || undefined,
      translation: modal.translation,
      pronunciation: modal.pronunciation || undefined,
      dictionaryPealimId: modal.dictionaryPealimId,
      partOfSpeech: modal.partOfSpeech || undefined,
      episodeTitle: episode.title,
      episodeUrl: episode.url,
    });

    if (result.type !== "auth_required") {
      setModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const levelLabel =
    levelDisplayName ??
    episode.level.charAt(0).toUpperCase() + episode.level.slice(1);
  const episodeMeta = `${levelLabel} · ${t("episodes")} ${String(episode.episode).padStart(2, "0")}`;
  const translateLabel = useCallback((word: string) => t("translateWord", { word }), [t]);
  const noTranslationLabel = t("noTranslation");
  const paragraphLabel = useCallback((index: number) => t("hebrewParagraph", { count: index }), [t]);

  return (
    <>
      <div className="main-header">
        <h2 className="main-title font-serif"><bdi>{episode.title}</bdi></h2>
        <div className="main-meta">
          <span><bdi>{episodeMeta}</bdi></span>
          {episode.url ? (
            <>
              <span>•</span>
              <a href={episode.url} target="_blank" rel="noopener noreferrer">
                {t("originalPost")} <ExternalLink size={12} />
              </a>
            </>
          ) : null}
          <span>•</span>
          <button
            type="button"
            onClick={onToggleFinished}
            disabled={progressSaving}
            aria-busy={progressSaving}
            className={`finish-inline-btn ${isFinished ? "finished" : ""}`}
            aria-pressed={isFinished}
          >
            <CheckCircle size={14} />
            {progressSaving ? t("savingProgress") : isFinished ? t("finished") : t("markFinished")}
          </button>
          </div>
        {translationResolution.isFallback && (
          <p className="translation-fallback-note" role="status">
            {t("translationFallback")}
          </p>
        )}
      </div>

      <div className="content-grid">
        {episode.hebrew_paragraphs.map((hebObj, i) => {
          const isSynced = isParagraphTiming(hebObj);
          const hasSentences = isSynced && hebObj.sentences && hebObj.sentences.length > 0;
          const isParagraphActive =
            activePosition?.paragraphIndex === i &&
            (activePosition.sentenceIndex === null || !hasSentences);
          const activeSentenceIndex =
            activePosition?.paragraphIndex === i && activePosition.sentenceIndex !== null
              ? activePosition.sentenceIndex
              : null;

          return (
            <EpisodeParagraph
              key={i}
              index={i}
              hebObj={hebObj}
              trans={translationParagraphs[i]}
              isParagraphActive={isParagraphActive}
              activeSentenceIndex={activeSentenceIndex}
              isTranslationBlurred={isTranslationBlurred}
              noTranslationLabel={noTranslationLabel}
              paragraphLabel={paragraphLabel}
              onWordClick={handleWordClick}
              translateLabel={translateLabel}
              onParagraphRef={onParagraphRef}
              onSentenceRef={onSentenceRef}
            />
          );
        })}

        <button
          type="button"
          onClick={onToggleFinished}
          disabled={progressSaving}
          aria-busy={progressSaving}
          className={`finish-episode-btn ${isFinished ? "finished" : ""}`}
          aria-pressed={isFinished}
        >
          <CheckCircle size={20} />
          {progressSaving ? t("savingProgress") : isFinished ? t("episodeFinished") : t("markFinished")}
        </button>

        <div className="nav-controls">
          <button
            className="nav-btn"
            onClick={() => onNavigate("prev")}
            disabled={!hasPrev}
            title={t("previousEpisode")}
          >
            <ChevronLeft size={16} />
            {t("previousEpisode")}
            <kbd className="nav-btn-kbd" aria-hidden="true">←</kbd>
          </button>
          <button
            className="nav-btn"
            onClick={() => onNavigate("next")}
            disabled={!hasNext}
            title={t("nextEpisode")}
          >
            <kbd className="nav-btn-kbd" aria-hidden="true">→</kbd>
            {t("nextEpisode")}
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <TranslationModal
        isOpen={modal.isOpen}
        word={modal.word}
        wordWithNekudot={modal.wordWithNekudot}
        verbFormWithNekudot={modal.verbFormWithNekudot}
        translation={modal.translation}
        pronunciation={modal.pronunciation}
        partOfSpeech={modal.partOfSpeech}
        dictionaryPealimId={modal.dictionaryPealimId}
        isTranslating={modal.isTranslating}
        onClose={() => setModal((prev) => ({ ...prev, isOpen: false }))}
        onSave={handleSave}
        onOpenDetails={() => {
          if (modal.dictionaryPealimId) {
            setDetailsPealimId(modal.dictionaryPealimId);
          }
        }}
      />

      <DictionaryDetailsModal
        isOpen={detailsPealimId !== null}
        pealimId={detailsPealimId}
        onClose={() => setDetailsPealimId(null)}
      />
    </>
  );
}
