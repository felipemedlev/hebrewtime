"use client";

import { ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import type { Episode } from "@/lib/types";
import { translateWord } from "@/app/actions";
import { useState } from "react";
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
        </div>
      </div>

      <div className="content-grid">
        {episode.hebrew_paragraphs.map((heb, i) => {
          const eng = episode.english_paragraphs?.[i];
          return (
            <div key={i} className="para-pair">
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
