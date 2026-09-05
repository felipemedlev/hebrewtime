"use client";

import { RotateCcw, Sparkles } from "lucide-react";
import type { ExamplePhrase, VocabWord } from "@/lib/types";
import { useT } from "@/lib/i18n/LanguageProvider";

type ExamplePhrasesPanelProps = {
  word: VocabWord;
  variant?: "vocab" | "flashcard";
  onGenerate: (word: VocabWord) => Promise<{ ok: boolean; message?: string }>;
  onRegenerate: (word: VocabWord, index: number) => Promise<{ ok: boolean; message?: string }>;
  isGenerating?: boolean;
  regeneratingIndex?: number | null;
};

export default function ExamplePhrasesPanel({
  word,
  variant = "vocab",
  onGenerate,
  onRegenerate,
  isGenerating = false,
  regeneratingIndex = null,
}: ExamplePhrasesPanelProps) {
  const t = useT();
  const phrases = word.examplePhrases || [];
  const panelClass = variant === "flashcard" ? "flashcard-examples-panel" : "vocab-examples-panel";

  if (phrases.length === 0) {
    return (
      <div className={panelClass}>
        <button
          className="example-phrases-generate-btn"
          onClick={() => onGenerate(word)}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <span className="example-phrases-spinner" />
              {t("generatingExamples")}
            </>
          ) : (
            <>
              <Sparkles size={14} />
              {t("showExamples")}
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className={panelClass}>
      <div className="example-phrases-header">
        <Sparkles size={13} className="example-phrases-header-icon" />
        <span>{t("examples")}</span>
      </div>
      <ul className="example-phrases-list">
        {phrases.map((phrase: ExamplePhrase, index: number) => (
          <li key={`${word.id}-phrase-${index}`} className="example-phrase">
            <div className="example-phrase-content">
              <p className="example-phrase-hebrew font-serif" dir="rtl" lang="he">
                {phrase.hebrew}
              </p>
              <p className="example-phrase-english">{phrase.english}</p>
            </div>
            <button
              className="example-phrase-regenerate-btn"
              onClick={() => onRegenerate(word, index)}
              disabled={regeneratingIndex === index || isGenerating}
              title={t("regenerate")}
            >
              {regeneratingIndex === index ? (
                <span className="example-phrases-spinner small" />
              ) : (
                <RotateCcw size={13} />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
