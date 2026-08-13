"use client";

import {
  Brain,
  PenLine,
  Shuffle,
  ArrowLeftRight,
  BarChart3,
  Flame,
  BookOpen,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import type { FlashcardStats, ReviewPracticeStats } from "@/lib/types";
import { buildReviewStatsSummary } from "@/lib/reviewStatsSummary";
import { useT } from "@/lib/i18n/LanguageProvider";

export type ReviewMode =
  | "hub"
  | "flashcards"
  | "fill-in"
  | "matching"
  | "reverse"
  | "stats";

type ReviewHubProps = {
  flashcardStats: FlashcardStats;
  reverseStats: FlashcardStats;
  practiceStats: ReviewPracticeStats;
  attemptTimestamps?: string[];
  vocabCount: number;
  onSelectMode: (mode: ReviewMode) => void;
};

export default function ReviewHub({
  flashcardStats,
  reverseStats,
  practiceStats,
  attemptTimestamps = [],
  vocabCount,
  onSelectMode,
}: ReviewHubProps) {
  const t = useT();

  const summary = buildReviewStatsSummary(
    flashcardStats,
    reverseStats,
    practiceStats,
    attemptTimestamps
  );

  const reviewedToday =
    flashcardStats.reviewedToday + reverseStats.reviewedToday;

  const statsCardMeta =
    summary.accuracy7d !== null
      ? t("statsHubSummary", {
          reviewed: String(reviewedToday),
          accuracy: String(summary.accuracy7d),
        })
      : t("statsHubSummaryMastery", {
          reviewed: String(reviewedToday),
          mastery: String(flashcardStats.progressPercent),
        });

  const modalities = [
    {
      id: "flashcards" as const,
      icon: Brain,
      title: t("modalityFlashcards"),
      description: t("modalityFlashcardsDesc"),
      meta: t("reviewDueWords", {
        count: flashcardStats.due,
        wordLabel: flashcardStats.due === 1 ? t("word") : t("words"),
      }),
      available: true,
    },
    {
      id: "fill-in" as const,
      icon: PenLine,
      title: t("modalityFillIn"),
      description: t("modalityFillInDesc"),
      meta:
        practiceStats.fillInAttempts7d > 0
          ? t("fillInAccuracy7d", { percent: practiceStats.fillInAccuracy7d })
          : t("modalityFillInNew"),
      available: true,
    },
    {
      id: "matching" as const,
      icon: Shuffle,
      title: t("modalityMatching"),
      description: t("modalityMatchingDesc"),
      meta:
        practiceStats.matchingAttempts7d > 0
          ? t("matchingAccuracy7d", { percent: practiceStats.matchingAccuracy7d })
          : t("modalityMatchingNew"),
      available: true,
    },
    {
      id: "reverse" as const,
      icon: ArrowLeftRight,
      title: t("modalityReverse"),
      description: t("modalityReverseDesc"),
      meta: t("reviewDueWords", {
        count: reverseStats.due,
        wordLabel: reverseStats.due === 1 ? t("word") : t("words"),
      }),
      available: true,
    },
  ];

  return (
    <div className="review-hub">
      <div className="flashcards-stats-dashboard review-hub-stats">
        <div className="flashcard-stat-tile highlight-due">
          <Flame size={14} className="flashcard-stat-icon-due" />
          <span className="stat-label">{t("due")}</span>
          <span className="stat-value">{flashcardStats.due}</span>
        </div>
        <div className="flashcard-stat-tile">
          <BookOpen size={14} className="flashcard-stat-icon-active" />
          <span className="stat-label">{t("savedWords")}</span>
          <span className="stat-value">{vocabCount}</span>
        </div>
        <button
          type="button"
          className="flashcard-stat-tile flashcard-stat-tile-btn"
          onClick={() => onSelectMode("stats")}
        >
          <TrendingUp size={14} className="flashcard-stat-icon-recall" />
          <span className="stat-label">{t("fillInAccuracy")}</span>
          <span className="stat-value">
            {practiceStats.fillInAttempts7d > 0
              ? `${practiceStats.fillInAccuracy7d}%`
              : "—"}
          </span>
        </button>
      </div>

      <div className="review-hub-header">
        <h2>{t("reviewModalityHub")}</h2>
        <p>{t("chooseReviewMode")}</p>
      </div>

      <div className="review-modality-grid">
        {modalities.map((modality) => {
          const Icon = modality.icon;

          return (
            <button
              key={modality.id}
              type="button"
              className={`review-modality-card${modality.available ? "" : " is-disabled"}`}
              disabled={!modality.available}
              onClick={() => onSelectMode(modality.id)}
            >
              <div className="review-modality-top">
                <div className="review-modality-icon">
                  <Icon size={20} />
                </div>
                <ChevronRight size={16} className="review-modality-arrow" />
              </div>
              <h3>{modality.title}</h3>
              <p>{modality.description}</p>
              <span className="review-modality-meta">{modality.meta}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="review-modality-card review-stats-card"
        onClick={() => onSelectMode("stats")}
      >
        <div className="review-modality-top">
          <div className="review-modality-icon review-stats-card-icon">
            <BarChart3 size={20} />
          </div>
          <ChevronRight size={16} className="review-modality-arrow" />
        </div>
        <h3>{t("practiceStats")}</h3>
        <p>{t("viewPracticeStatsDesc")}</p>
        <span className="review-modality-meta">{statsCardMeta}</span>
      </button>
    </div>
  );
}
