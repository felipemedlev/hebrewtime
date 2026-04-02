"use client";

import { ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import type { Episode } from "@/lib/types";
import { translateWord } from "@/app/actions";
import { useState } from "react";
import TranslationModal from "./TranslationModal";

type EpisodeViewerProps = {
  episode: Episode;
  hasPrev: boolean;
  hasNext: boolean;
  onNavigate: (direction: "prev" | "next") => void;
  onWordSaved: (word: {
    word: string;
    wordWithNekudot?: string;
    translation: string;
    episodeTitle: string;
    episodeUrl: string;
  }) => { added: boolean; message: string };
  onToast: (msg: string) => void;
};

type ModalState = {
  isOpen: boolean;
  word: string;
  hebrewContext: string;
  englishContext: string;
  translation: string | null;
  wordWithNekudot: string | null;
  isTranslating: boolean;
};

export default function EpisodeViewer({
  episode,
  hasPrev,
  hasNext,
  onNavigate,
  onWordSaved,
  onToast,
}: EpisodeViewerProps) {
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    word: "",
    hebrewContext: "",
    englishContext: "",
    translation: null,
    wordWithNekudot: null,
    isTranslating: false,
  });

  const handleWordClick = async (
    word: string,
    hebContext: string,
    engContext: string
  ) => {
    const cleanWord = word.replace(
      /^[.,;:!?(){}\[\]"'\-]+|[.,;:!?(){}\[\]"'\-]+$/g,
      ""
    );
    if (!cleanWord) return;

    setModal({
      isOpen: true,
      word: cleanWord,
      hebrewContext: hebContext,
      englishContext: engContext || "",
      translation: null,
      wordWithNekudot: null,
      isTranslating: true,
    });

    try {
      const res = await translateWord(cleanWord, hebContext, engContext || "");
      setModal((prev) => ({
        ...prev,
        translation: res?.translation || "Translation error",
        wordWithNekudot: res?.wordWithNekudot || cleanWord,
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

  const handleSave = () => {
    if (!modal.translation) return;

    const result = onWordSaved({
      word: modal.word,
      wordWithNekudot: modal.wordWithNekudot || modal.word,
      translation: modal.translation,
      episodeTitle: episode.title,
      episodeUrl: episode.url,
    });

    onToast(result.message);
    setModal((prev) => ({ ...prev, isOpen: false }));
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
              <div className="text-english">
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
        translation={modal.translation}
        isTranslating={modal.isTranslating}
        onClose={() => setModal((prev) => ({ ...prev, isOpen: false }))}
        onSave={handleSave}
      />
    </>
  );
}
