"use client";

import { ArrowLeft, Brain, PenLine, TrendingUp, Target } from "lucide-react";
import type { FlashcardStats, ReviewPracticeStats, VocabWord } from "@/lib/types";
import { useT } from "@/lib/i18n/LanguageProvider";

type ReviewStatsViewProps = {
  flashcardStats: FlashcardStats;
  practiceStats: ReviewPracticeStats;
  vocabWords: VocabWord[];
  onBack: () => void;
};

export default function ReviewStatsView({
  flashcardStats,
  practiceStats,
  vocabWords,
  onBack,
}: ReviewStatsViewProps) {
  const t = useT();
  const vocabById = new Map(vocabWords.map((w) => [w.id, w]));

  const hasFillInData = practiceStats.fillInAttemptsAll > 0;

  return (
    <div className="review-stats-view">
      <button type="button" className="review-back-btn" onClick={onBack}>
        <ArrowLeft size={16} />
        {t("backToHub")}
      </button>

      <div className="review-hub-header">
        <h2>{t("practiceStats")}</h2>
      </div>

      <div className="review-stats-sections">
        <section className="review-stats-section">
          <div className="review-stats-section-head">
            <Brain size={18} />
            <h3>{t("modalityFlashcards")}</h3>
          </div>
          <div className="flashcards-stats-dashboard review-stats-tiles">
            <div className="flashcard-stat-tile">
              <Target size={14} />
              <span className="stat-label">{t("mastery")}</span>
              <span className="stat-value">{flashcardStats.progressPercent}%</span>
            </div>
            <div className="flashcard-stat-tile">
              <TrendingUp size={14} />
              <span className="stat-label">{t("avgRecall")}</span>
              <span className="stat-value">{flashcardStats.avgRecall}%</span>
            </div>
            <div className="flashcard-stat-tile">
              <span className="stat-label">{t("reviewedToday")}</span>
              <span className="stat-value">{flashcardStats.reviewedToday}</span>
            </div>
            <div className="flashcard-stat-tile">
              <span className="stat-label">{t("learned")}</span>
              <span className="stat-value">
                {flashcardStats.learned}
                <span className="stat-total">/{flashcardStats.total}</span>
              </span>
            </div>
          </div>
        </section>

        <section className="review-stats-section">
          <div className="review-stats-section-head">
            <PenLine size={18} />
            <h3>{t("modalityFillIn")}</h3>
          </div>
          {!hasFillInData ? (
            <p className="review-stats-empty">{t("noPracticeStats")}</p>
          ) : (
            <>
              <div className="flashcards-stats-dashboard review-stats-tiles">
                <div className="flashcard-stat-tile">
                  <span className="stat-label">{t("accuracyToday")}</span>
                  <span className="stat-value">
                    {practiceStats.fillInAttemptsToday > 0
                      ? `${practiceStats.fillInAccuracyToday}%`
                      : "—"}
                  </span>
                </div>
                <div className="flashcard-stat-tile">
                  <span className="stat-label">{t("accuracy7d")}</span>
                  <span className="stat-value">{practiceStats.fillInAccuracy7d}%</span>
                </div>
                <div className="flashcard-stat-tile">
                  <span className="stat-label">{t("fillInAttempts")}</span>
                  <span className="stat-value">{practiceStats.fillInAttemptsAll}</span>
                </div>
              </div>

              {practiceStats.weakWords.length > 0 && (
                <div className="review-weak-words">
                  <h4>{t("weakWords")}</h4>
                  <ul>
                    {practiceStats.weakWords.map((w) => {
                      const word = vocabById.get(w.vocabId);
                      if (!word) return null;
                      const pct = Math.round((w.correct / w.attempts) * 100);
                      return (
                        <li key={w.vocabId}>
                          <span className="font-serif" dir="rtl">
                            {word.wordWithNekudot || word.word}
                          </span>
                          <span className="review-weak-meta">
                            {word.translation} · {pct}%
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
