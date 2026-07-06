"use client";

import { X, Loader2, BookOpen } from "lucide-react";
import { useModalAccessibility } from "@/hooks/useModalAccessibility";
import { useT } from "@/lib/i18n/LanguageProvider";

type TranslationModalProps = {
  isOpen: boolean;
  word: string;
  wordWithNekudot: string | null;
  verbFormWithNekudot: string | null;
  translation: string | null;
  pronunciation: string | null;
  partOfSpeech: string | null;
  dictionaryPealimId: number | null;
  isTranslating: boolean;
  onClose: () => void;
  onSave: () => void;
  onOpenDetails: () => void;
};

export default function TranslationModal({
  isOpen,
  word,
  wordWithNekudot,
  verbFormWithNekudot,
  translation,
  pronunciation,
  partOfSpeech,
  dictionaryPealimId,
  isTranslating,
  onClose,
  onSave,
  onOpenDetails,
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
              {pronunciation && (
                <p
                  className="verb-form-text"
                  style={{ marginTop: "8px", fontSize: "14px", color: "var(--text-muted)" }}
                >
                  {t("transliteration")}:{" "}
                  <span style={{ fontStyle: "italic" }}>{pronunciation}</span>
                </p>
              )}
              {partOfSpeech && (
                <p style={{ marginTop: "6px", fontSize: "13px", color: "var(--text-muted)" }}>
                  {partOfSpeech}
                </p>
              )}
              {verbFormWithNekudot && (
                <p className="verb-form-text" style={{ marginTop: "8px", fontSize: "14px", color: "var(--text-muted)" }}>
                  {t("verbForm")}: <span className="font-serif" dir="rtl" style={{ fontSize: "18px", color: "var(--accent)" }}>{verbFormWithNekudot}</span>
                </p>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer dictionary-details-footer">
          {dictionaryPealimId && !isTranslating && (
            <button
              type="button"
              className="dictionary-details-secondary-btn"
              onClick={onOpenDetails}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <BookOpen size={16} />
              {t("viewConjugations")}
            </button>
          )}
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
