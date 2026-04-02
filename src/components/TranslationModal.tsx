"use client";

import { X, Loader2 } from "lucide-react";

type TranslationModalProps = {
  isOpen: boolean;
  word: string;
  wordWithNekudot: string | null;
  translation: string | null;
  isTranslating: boolean;
  onClose: () => void;
  onSave: () => void;
};

export default function TranslationModal({
  isOpen,
  word,
  wordWithNekudot,
  translation,
  isTranslating,
  onClose,
  onSave,
}: TranslationModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="modal-title font-serif" dir="rtl">
            {wordWithNekudot || word}
          </h3>
          <button onClick={onClose} className="close-btn">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {isTranslating ? (
            <div className="translating-state">
              <Loader2 className="spinner" size={24} />
              <span>Translating exact word in context...</span>
            </div>
          ) : (
            <div className="translation-result">
              <p className="translation-text">{translation}</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="save-btn"
            disabled={
              isTranslating ||
              !translation ||
              translation === "Translation error"
            }
            onClick={onSave}
          >
            Add to Vocabulary
          </button>
        </div>
      </div>
    </div>
  );
}
