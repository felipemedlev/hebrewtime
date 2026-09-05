"use client";

import { useState, useMemo, type ReactNode } from "react";
import {
  ArrowLeft,
  Brain,
  PenLine,
  Shuffle,
  ArrowLeftRight,
  Share2,
} from "lucide-react";
import type { FlashcardStats, ReviewPracticeStats, VocabWord } from "@/lib/types";
import { buildReviewStatsSummary } from "@/lib/reviewStatsSummary";
import { shareText } from "@/lib/sharePracticeStats";
import StatRing from "@/components/StatRing";
import { useT } from "@/lib/i18n/LanguageProvider";

type ReviewStatsViewProps = {
  flashcardStats: FlashcardStats;
  reverseStats: FlashcardStats;
  practiceStats: ReviewPracticeStats;
  attemptTimestamps?: string[];
  vocabWords: VocabWord[];
  onBack: () => void;
};

type ModalityStatCardProps = {
  icon: ReactNode;
  title: string;
  primaryLabel: string;
  primaryValue: number;
  secondary: { label: string; value: string }[];
  empty?: boolean;
  emptyText?: string;
};

function ModalityStatCard({
  icon,
  title,
  primaryLabel,
  primaryValue,
  secondary,
  empty,
  emptyText,
}: ModalityStatCardProps) {
  if (empty && emptyText) {
    return (
      <div className="review-stats-modality-card is-empty">
        <div className="review-stats-modality-head">
          {icon}
          <h3>{title}</h3>
        </div>
        <p className="review-stats-empty">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="review-stats-modality-card">
      <div className="review-stats-modality-head">
        {icon}
        <h3>{title}</h3>
      </div>
      <div className="review-stats-modality-primary">
        <span className="review-stats-modality-primary-label">{primaryLabel}</span>
        <span className="review-stats-modality-primary-value">{primaryValue}%</span>
        <div className="review-stats-modality-bar">
          <div
            className="review-stats-modality-bar-fill"
            style={{ width: `${Math.min(100, primaryValue)}%` }}
          />
        </div>
      </div>
      <div className="review-stats-modality-secondary">
        {secondary.map((s) => (
          <div key={s.label} className="review-stats-modality-stat">
            <span className="review-stats-modality-stat-label">{s.label}</span>
            <span className="review-stats-modality-stat-value">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CombinedWeakWordsList({
  fillInWords,
  matchingWords,
  vocabById,
}: {
  fillInWords: { vocabId: string; attempts: number; correct: number }[];
  matchingWords: { vocabId: string; attempts: number; correct: number }[];
  vocabById: Map<string, VocabWord>;
}) {
  const t = useT();

  const combined = useMemo(() => {
    const byId = new Map<
      string,
      {
        vocabId: string;
        attempts: number;
        correct: number;
        modalities: ("fill_in" | "matching")[];
      }
    >();

    for (const w of fillInWords) {
      byId.set(w.vocabId, { ...w, modalities: ["fill_in"] });
    }
    for (const w of matchingWords) {
      const existing = byId.get(w.vocabId);
      if (existing) {
        existing.attempts += w.attempts;
        existing.correct += w.correct;
        existing.modalities.push("matching");
      } else {
        byId.set(w.vocabId, { ...w, modalities: ["matching"] });
      }
    }

    return [...byId.values()]
      .sort((a, b) => a.correct / a.attempts - b.correct / b.attempts)
      .slice(0, 10);
  }, [fillInWords, matchingWords]);

  if (combined.length === 0) return null;

  return (
    <section className="review-stats-weak-section">
      <h3>{t("weakWords")}</h3>
      <ul className="review-weak-words-list">
        {combined.map((w) => {
          const word = vocabById.get(w.vocabId);
          if (!word) return null;
          const pct = Math.round((w.correct / w.attempts) * 100);
          return (
            <li key={w.vocabId} className="review-weak-word-row">
              <div className="review-weak-word-main">
                <span className="font-serif" dir="rtl" lang="he">
                  {word.wordWithNekudot || word.word}
                </span>
                <span className="review-weak-meta">{word.translation}</span>
              </div>
              <div className="review-weak-word-trail">
                <div className="review-weak-accuracy-bar">
                  <div
                    className="review-weak-accuracy-fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="review-weak-pct">{pct}%</span>
                {w.modalities.length === 2 && (
                  <span className="review-weak-tag">{t("bothModalities")}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function ReviewStatsView({
  flashcardStats,
  reverseStats,
  practiceStats,
  attemptTimestamps = [],
  vocabWords,
  onBack,
}: ReviewStatsViewProps) {
  const t = useT();
  const [shareState, setShareState] = useState<"idle" | "shared" | "copied">("idle");
  const vocabById = new Map(vocabWords.map((w) => [w.id, w]));

  const summary = buildReviewStatsSummary(
    flashcardStats,
    reverseStats,
    practiceStats,
    attemptTimestamps
  );

  const subtitle = summary.usePracticeAccuracy
    ? summary.practicedToday > 0
      ? t("statsSubtitleGreat")
      : t("statsSubtitleStart")
    : flashcardStats.total > 0
      ? t("statsSubtitleMastery")
      : t("statsSubtitleStart");

  const headlineLabel = summary.usePracticeAccuracy
    ? t("combinedAccuracy")
    : t("mastery");

  const handleShare = async () => {
    const text = t("shareStatsText", {
      percent: String(summary.headlinePercent),
      today: String(summary.practicedToday),
      learned: String(summary.learned),
    });
    const result = await shareText(text, t("appName"));
    if (result === "shared") {
      setShareState("shared");
      setTimeout(() => setShareState("idle"), 2000);
    } else if (result === "copied") {
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2000);
    }
  };

  const shareLabel =
    shareState === "copied"
      ? t("copied")
      : shareState === "shared"
        ? t("shared")
        : t("shareResults");

  const hasFillInData = practiceStats.fillInAttemptsAll > 0;
  const hasMatchingData = practiceStats.matchingAttemptsAll > 0;

  return (
    <div className="review-stats-view">
      <button type="button" className="review-back-btn" onClick={onBack}>
        <ArrowLeft size={16} />
        {t("backToHub")}
      </button>

      <div className="review-stats-hero">
        <div className="review-stats-hero-top">
          <h2>{t("practiceStats")}</h2>
          <button type="button" className="review-stats-share-btn" onClick={handleShare}>
            <Share2 size={16} />
            {shareLabel}
          </button>
        </div>

        <div className="review-stats-hero-body">
          <StatRing percent={summary.headlinePercent} size={132} strokeWidth={10} />
          <div className="review-stats-hero-text">
            <span className="review-stats-hero-label">{headlineLabel}</span>
            <p className="review-stats-hero-subtitle">{subtitle}</p>
          </div>
        </div>

        <div className="review-stats-hero-metrics">
          <div className="review-stats-hero-metric">
            <span className="review-stats-hero-metric-value">{summary.practicedToday}</span>
            <span className="review-stats-hero-metric-label">{t("practicedToday")}</span>
          </div>
          <div className="review-stats-hero-metric">
            <span className="review-stats-hero-metric-value">
              {summary.accuracy7d !== null ? `${summary.accuracy7d}%` : "—"}
            </span>
            <span className="review-stats-hero-metric-label">{t("accuracy7d")}</span>
          </div>
          <div className="review-stats-hero-metric">
            <span className="review-stats-hero-metric-value">
              {summary.learned}
              <span className="review-stats-hero-metric-total">/{summary.total}</span>
            </span>
            <span className="review-stats-hero-metric-label">{t("learned")}</span>
          </div>
          {summary.practiceDayStreak > 0 && (
            <div className="review-stats-hero-metric highlight">
              <span className="review-stats-hero-metric-value">{summary.practiceDayStreak}</span>
              <span className="review-stats-hero-metric-label">{t("practiceStreak")}</span>
            </div>
          )}
        </div>
      </div>

      <div className="review-stats-modality-grid">
        <ModalityStatCard
          icon={<Brain size={18} />}
          title={t("modalityFlashcards")}
          primaryLabel={t("mastery")}
          primaryValue={flashcardStats.progressPercent}
          secondary={[
            { label: t("avgRecall"), value: `${flashcardStats.avgRecall}%` },
            { label: t("reviewedToday"), value: String(flashcardStats.reviewedToday) },
          ]}
        />
        <ModalityStatCard
          icon={<ArrowLeftRight size={18} />}
          title={t("modalityReverse")}
          primaryLabel={t("mastery")}
          primaryValue={reverseStats.progressPercent}
          secondary={[
            { label: t("due"), value: String(reverseStats.due) },
            { label: t("reviewedToday"), value: String(reverseStats.reviewedToday) },
          ]}
        />
        <ModalityStatCard
          icon={<PenLine size={18} />}
          title={t("modalityFillIn")}
          primaryLabel={t("accuracy7d")}
          primaryValue={
            hasFillInData ? practiceStats.fillInAccuracy7d : 0
          }
          secondary={[
            {
              label: t("accuracyToday"),
              value:
                practiceStats.fillInAttemptsToday > 0
                  ? `${practiceStats.fillInAccuracyToday}%`
                  : "—",
            },
            {
              label: t("fillInAttempts"),
              value: String(practiceStats.fillInAttemptsAll),
            },
          ]}
          empty={!hasFillInData}
          emptyText={t("noPracticeStats")}
        />
        <ModalityStatCard
          icon={<Shuffle size={18} />}
          title={t("modalityMatching")}
          primaryLabel={t("accuracy7d")}
          primaryValue={
            hasMatchingData ? practiceStats.matchingAccuracy7d : 0
          }
          secondary={[
            {
              label: t("accuracyToday"),
              value:
                practiceStats.matchingAttemptsToday > 0
                  ? `${practiceStats.matchingAccuracyToday}%`
                  : "—",
            },
            {
              label: t("matchingAttempts"),
              value: String(practiceStats.matchingAttemptsAll),
            },
          ]}
          empty={!hasMatchingData}
          emptyText={t("noMatchingStats")}
        />
      </div>

      {(practiceStats.weakWords.length > 0 || practiceStats.matchingWeakWords.length > 0) && (
        <CombinedWeakWordsList
          fillInWords={practiceStats.weakWords}
          matchingWords={practiceStats.matchingWeakWords}
          vocabById={vocabById}
        />
      )}

      <button type="button" className="flashcard-start-btn review-stats-cta" onClick={onBack}>
        {t("backToHub")}
      </button>
    </div>
  );
}
