"use client";

import { X, Loader2 } from "lucide-react";
import { useModalAccessibility } from "@/hooks/useModalAccessibility";
import { useT } from "@/lib/i18n/LanguageProvider";

type TranslationModalProps = {
  isOpen: boolean;
  word: string;
  wordWithNekudot: string | null;
  verbFormWithNekudot: string | null;
  translation: string | null;
  isTranslating: boolean;
  onClose: () => void;
  onSave: () => void;
};

export default function TranslationModal({
  isOpen,
  word,
  wordWithNekudot,
  verbFormWithNekudot,
  translation,
  isTranslating,
  onClose,
  onSave,
}: TranslationModalProps) {
  const t = useT();
  const { dialogRef, titleId } = useModalAccessibility(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-header">
          <h3 id={titleId} className="modal-title font-serif" dir="rtl">
            {wordWithNekudot || word}
          </h3>
          <button onClick={onClose} className="close-btn" aria-label={t("close")}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {isTranslating ? (
            <div className="translating-state">
              <Loader2 className="spinner" size={24} />
              <span>{t("translating")}</span>
            </div>
          ) : (
            <div className="translation-result">
              <p className="translation-text">{translation}</p>
              {verbFormWithNekudot && (
                <p className="verb-form-text" style={{ marginTop: "8px", fontSize: "14px", color: "var(--text-muted)" }}>
                  {t("verbForm")}: <span className="font-serif" dir="rtl" style={{ fontSize: "18px", color: "var(--accent)" }}>{verbFormWithNekudot}</span>
                </p>
              )}
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
            {t("addToVocabulary")}
          </button>
        </div>
      </div>
    </div>
  );
}
