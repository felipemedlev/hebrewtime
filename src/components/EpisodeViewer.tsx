"use client";

import { ExternalLink, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import type { Episode } from "@/lib/types";
import { translateWord } from "@/app/actions";
import { useState, useEffect, useRef } from "react";
import TranslationModal from "./TranslationModal";
import { supabase } from "@/lib/supabase";

type EpisodeViewerProps = {
  episode: Episode;
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
  isEnglishBlurred: boolean;
  isFinished: boolean;
  onToggleFinished: () => void;
};

type ModalState = {
  isOpen: boolean;
  word: string;
  lemmaWord: string | null;
  hebrewContext: string;
  englishContext: string;
  translation: string | null;
  wordWithNekudot: string | null;
  verbFormWithNekudot: string | null;
  isTranslating: boolean;
};

export default function EpisodeViewer({
  episode,
  hasPrev,
  hasNext,
  onNavigate,
  onWordSaved,
  onToast,
  isPremium,
  isAuthenticated,
  onRequireAuth,
  onRequireSubscription,
  isLoadingEntitlements,
  isEnglishBlurred,
  isFinished,
  onToggleFinished,
}: EpisodeViewerProps) {
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    word: "",
    lemmaWord: null,
    hebrewContext: "",
    englishContext: "",
    translation: null,
    wordWithNekudot: null,
    verbFormWithNekudot: null,
    isTranslating: false,
  });

  const [currentTime, setCurrentTime] = useState(0);
  const paragraphRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lastActiveIndex = useRef<number>(-1);

  // Sync with media player
  useEffect(() => {
    const handleTimeUpdate = (e: any) => {
      setCurrentTime(e.detail);
    };
    window.addEventListener("playerTimeUpdate", handleTimeUpdate);
    return () => window.removeEventListener("playerTimeUpdate", handleTimeUpdate);
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    // Find active index
    const activeIndex = episode.hebrew_paragraphs.findIndex((p, idx) => {
      if (typeof p === "string") return false;
      // Highlight first paragraph even if audio is in intro (before first timestamp)
      if (idx === 0 && currentTime < p.start) return true;
      return currentTime >= p.start && currentTime <= p.end;
    });

    if (activeIndex !== -1 && activeIndex !== lastActiveIndex.current) {
      lastActiveIndex.current = activeIndex;
      const el = paragraphRefs.current[activeIndex];
      if (el) {
        el.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [currentTime, episode.hebrew_paragraphs]);

  const handleWordClick = async (
    word: string,
    hebContext: string,
    engContext: string
  ) => {
    if (isLoadingEntitlements) return;

    if (!isAuthenticated) {
      onToast("Log in to use word translation.");
      onRequireAuth();
      return;
    }
    if (!isPremium) {
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
      englishContext: engContext || "",
      translation: null,
      wordWithNekudot: null,
      verbFormWithNekudot: null,
      isTranslating: true,
    });

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const res = await translateWord(accessToken, cleanWord, hebContext, engContext || "");
      if (res.type === "auth_required") {
        onRequireAuth();
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

    // Use the lemma (base dictionary form) returned by the AI, falling back to the clicked word
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

  return (
    <>
      <div className="main-header">
        <h2 className="main-title font-serif">{episode.title}</h2>
        <div className="main-meta">
          <span>Episode {String(episode.episode).padStart(2, "0")}</span>
          <span>•</span>
          <a href={episode.url} target="_blank" rel="noopener noreferrer">
            Original Post <ExternalLink size={12} />
          </a>
          <span>•</span>
          <button 
            onClick={onToggleFinished}
            style={{
              background: "transparent",
              border: "none",
              color: isFinished ? "#10b981" : "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: 0,
              fontSize: "14px",
              fontFamily: "inherit",
              fontWeight: 500,
            }}
          >
            <CheckCircle size={14} />
            {isFinished ? "Finished" : "Mark as finished"}
          </button>
        </div>
      </div>

      <div className="content-grid">
        {episode.hebrew_paragraphs.map((hebObj, i) => {
          const isSynced = typeof hebObj === "object";
          const heb = isSynced ? hebObj.text : hebObj;
          const isActive = isSynced && (
            (i === 0 && currentTime < hebObj.start) || 
            (currentTime >= hebObj.start && currentTime <= hebObj.end)
          );
          const eng = episode.english_paragraphs?.[i];
          
          return (
            <div 
              key={i} 
              ref={(el) => {
                paragraphRefs.current[i] = el;
              }}
              className={`para-pair ${isActive ? "active-paragraph" : ""}`}
            >
              <div className="text-hebrew font-serif" dir="rtl">
                {heb.split(/(\s+)/).map((token, idx) => {
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
                      onClick={() => {
                        if (cleanWord) handleWordClick(token, heb, eng);
                      }}
                      title={
                        cleanWord ? "Click to translate and save" : undefined
                      }
                    >
                      {token}
                    </span>
                  );
                })}
              </div>
              <div className={`text-english ${isEnglishBlurred ? "blurred" : ""}`}>
                {eng ? (
                  eng
                ) : (
                  <span style={{ color: "#aaa", fontStyle: "italic" }}>
                    No translation
                  </span>
                )}
              </div>
            </div>
          );
        })}

        <div style={{ display: "flex", justifyContent: "center", margin: "2rem 0" }}>
          <button 
            onClick={onToggleFinished}
            style={{
              background: isFinished ? "rgba(16, 185, 129, 0.1)" : "var(--bg-secondary)",
              border: `1px solid ${isFinished ? "rgba(16, 185, 129, 0.3)" : "var(--border-color)"}`,
              color: isFinished ? "#10b981" : "var(--text-primary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 24px",
              borderRadius: "24px",
              fontSize: "16px",
              fontFamily: "inherit",
              fontWeight: 500,
              transition: "all 0.2s ease",
            }}
          >
            <CheckCircle size={20} />
            {isFinished ? "Episode Finished" : "Mark as finished"}
          </button>
        </div>

        <div className="nav-controls">
          <button
            className="nav-btn"
            onClick={() => onNavigate("prev")}
            disabled={!hasPrev}
          >
            <ChevronLeft size={16} />
            Previous Episode
          </button>
          <button
            className="nav-btn"
            onClick={() => onNavigate("next")}
            disabled={!hasNext}
          >
            Next Episode
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
