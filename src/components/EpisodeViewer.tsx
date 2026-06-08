"use client";

import { ExternalLink, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import type { Episode, ParagraphTiming } from "@/lib/types";
import { translateWord } from "@/app/actions";
import { useState, useEffect, useRef, useMemo } from "react";
import TranslationModal from "./TranslationModal";
import { supabase } from "@/lib/supabase";
import { hasReachedAnonTranslationLimit, incrementAnonTranslations } from "@/lib/anonUsage";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { getTranslationParagraphs } from "@/lib/episodeTranslations";

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
        tabIndex={cleanWord ? 0 : undefined}
        onClick={() => {
          if (cleanWord) onWordClick(token, text, translationPara || "");
        }}
        onKeyDown={(event) => {
          if (!cleanWord) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onWordClick(token, text, translationPara || "");
          }
        }}
        aria-label={cleanWord ? translateLabel(cleanWord) : undefined}
      >
        {token}
      </span>
    );
  });
}

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
}: EpisodeViewerProps) {
  const { lang, isTranslationBlurred, t } = useLanguage();
  const translationParagraphs = useMemo(
    () => getTranslationParagraphs(episode, lang),
    [episode, lang]
  );

  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    word: "",
    lemmaWord: null,
    hebrewContext: "",
    translationContext: "",
    translation: null,
    wordWithNekudot: null,
    verbFormWithNekudot: null,
    isTranslating: false,
  });

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

  const handleWordClick = async (
    word: string,
    hebContext: string,
    transContext: string
  ) => {
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
      if (!isAuthenticated && res.type === "success") {
        incrementAnonTranslations();
      }
      setModal((prev) => ({
        ...prev,
        lemmaWord: res?.lemmaWord || cleanWord,
        translation: res?.translation || "Translation error",
        wordWithNekudot: res?.wordWithNekudot || cleanWord,
        verbFormWithNekudot: res?.verbFormWithNekudot || null,
        isTranslating: false,
      }));
    } catch {
      setModal((prev) => ({
        ...prev,
        translation: "Translation error",
        isTranslating: false,
      }));
    }
  };

  const handleSave = async () => {
    if (!modal.translation) return;

    const wordToSave = modal.lemmaWord || modal.word;

    const result = await onWordSaved({
      word: wordToSave,
      wordWithNekudot: modal.wordWithNekudot || wordToSave,
      verbFormWithNekudot: modal.verbFormWithNekudot || undefined,
      translation: modal.translation,
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
  const translateLabel = (word: string) => t("translateWord", { word });

  return (
    <>
      <div className="main-header">
        <h2 className="main-title font-serif">{episode.title}</h2>
        <div className="main-meta">
          <span>{episodeMeta}</span>
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
            className={`finish-inline-btn ${isFinished ? "finished" : ""}`}
            aria-pressed={isFinished}
          >
            <CheckCircle size={14} />
            {isFinished ? t("finished") : t("markFinished")}
          </button>
        </div>
      </div>

      <div className="content-grid">
        {/* eslint-disable-next-line react-hooks/refs -- sentence ref arrays initialized per paragraph during render */}
        {episode.hebrew_paragraphs.map((hebObj, i) => {
          const isSynced = isParagraphTiming(hebObj);
          const heb = isSynced ? hebObj.text : hebObj;
          const trans = translationParagraphs[i];
          const hasSentences = isSynced && hebObj.sentences && hebObj.sentences.length > 0;

          const isParagraphActive =
            activePosition?.paragraphIndex === i &&
            (activePosition.sentenceIndex === null || !hasSentences);

          if (!sentenceRefs.current[i]) {
            sentenceRefs.current[i] = [];
          }

          return (
            <div
              key={i}
              ref={(el) => {
                paragraphRefs.current[i] = el;
              }}
              className={`para-pair ${isParagraphActive ? "active-paragraph" : ""}`}
            >
              <div className="text-hebrew font-serif" dir="rtl">
                {hasSentences ? (
                  hebObj.sentences!.map((sent, j) => {
                    const isSentenceActive =
                      activePosition?.paragraphIndex === i &&
                      activePosition.sentenceIndex === j;
                    return (
                      <span
                        key={j}
                        ref={(el) => {
                          sentenceRefs.current[i][j] = el;
                        }}
                        className={`sentence-span ${isSentenceActive ? "active-sentence" : ""}`}
                      >
                        {renderHebrewTokens(sent.text, trans, handleWordClick, translateLabel)}
                        {j < hebObj.sentences!.length - 1 ? " " : ""}
                      </span>
                    );
                  })
                ) : (
                  renderHebrewTokens(heb, trans, handleWordClick, translateLabel)
                )}
              </div>
              <div className={`text-translation ${isTranslationBlurred ? "blurred" : ""}`}>
                {trans ? (
                  trans
                ) : (
                  <span className="text-translation-empty">{t("noTranslation")}</span>
                )}
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={onToggleFinished}
          className={`finish-episode-btn ${isFinished ? "finished" : ""}`}
          aria-pressed={isFinished}
        >
          <CheckCircle size={20} />
          {isFinished ? t("episodeFinished") : t("markFinished")}
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
        isTranslating={modal.isTranslating}
        onClose={() => setModal((prev) => ({ ...prev, isOpen: false }))}
        onSave={handleSave}
      />
    </>
  );
}
