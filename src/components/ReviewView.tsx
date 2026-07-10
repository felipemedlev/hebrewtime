"use client";

import { useState, useEffect } from "react";
import { Brain } from "lucide-react";
import type {
  VocabWord,
  FlashcardItem,
  FlashcardRating,
  FlashcardStats,
  ReviewPracticeStats,
  FillInExercise,
} from "@/lib/types";
import { useT } from "@/lib/i18n/LanguageProvider";
import FlashcardsView from "./FlashcardsView";
import ReviewHub, { type ReviewMode } from "./ReviewHub";
import FillInView from "./FillInView";
import ReviewStatsView from "./ReviewStatsView";

type ReviewViewProps = {
  vocabWords: VocabWord[];
  learnedCards: FlashcardItem[];
  dueCards: FlashcardItem[];
  sessionQueue: FlashcardItem[];
  isLoaded: boolean;
  submitReview: (vocabId: string, rating: FlashcardRating) => Promise<void>;
  unlearnWord: (vocabId: string) => Promise<void>;
  stats: FlashcardStats;
  practiceStats: ReviewPracticeStats;
  startSignal?: number;
  generateExamples: (word: VocabWord) => Promise<{ ok: boolean; message?: string }>;
  regenerateExample: (word: VocabWord, index: number) => Promise<{ ok: boolean; message?: string }>;
  generateFillIn: (
    words: VocabWord[]
  ) => Promise<{ ok: boolean; exercises?: FillInExercise[]; message?: string }>;
  recordAttempt: (vocabId: string, correct: boolean) => Promise<void>;
  isPremium?: boolean;
  onRequireSubscription?: () => void;
};

export default function ReviewView({
  vocabWords,
  learnedCards,
  dueCards,
  sessionQueue,
  isLoaded,
  submitReview,
  unlearnWord,
  stats,
  practiceStats,
  startSignal = 0,
  generateExamples,
  regenerateExample,
  generateFillIn,
  recordAttempt,
  isPremium = false,
  onRequireSubscription,
}: ReviewViewProps) {
  const t = useT();
  const [reviewMode, setReviewMode] = useState<ReviewMode>("hub");
  const [flashcardStartSignal, setFlashcardStartSignal] = useState(0);

  useEffect(() => {
    if (startSignal > 0) {
      setReviewMode("flashcards");
      setFlashcardStartSignal((s) => s + 1);
    }
  }, [startSignal]);

  if (!isLoaded) {
    return (
      <div
        className="vocab-loading"
        style={{ height: "400px", display: "flex", justifyContent: "center", alignItems: "center" }}
      >
        <div className="vocab-spinner" />
      </div>
    );
  }

  if (vocabWords.length === 0) {
    return (
      <div className="vocab-empty-container">
        <Brain size={48} className="vocab-empty-icon" />
        <h3 className="vocab-empty-title">{t("noWordsToReview")}</h3>
        <p className="vocab-empty-text">{t("noWordsToReviewSub")}</p>
      </div>
    );
  }

  if (reviewMode === "flashcards") {
    return (
      <FlashcardsView
        vocabWords={vocabWords}
        learnedCards={learnedCards}
        sessionQueue={sessionQueue}
        isLoaded={isLoaded}
        submitReview={submitReview}
        unlearnWord={unlearnWord}
        stats={stats}
        startSignal={flashcardStartSignal}
        generateExamples={generateExamples}
        regenerateExample={regenerateExample}
        isPremium={isPremium}
        onRequireSubscription={onRequireSubscription}
        onBackToHub={() => setReviewMode("hub")}
        showBackToHub
      />
    );
  }

  if (reviewMode === "fill-in") {
    return (
      <FillInView
        vocabWords={vocabWords}
        dueCards={dueCards}
        practiceStats={practiceStats}
        onBack={() => setReviewMode("hub")}
        generateFillIn={generateFillIn}
        recordAttempt={recordAttempt}
        onRequireSubscription={onRequireSubscription}
      />
    );
  }

  if (reviewMode === "stats") {
    return (
      <ReviewStatsView
        flashcardStats={stats}
        practiceStats={practiceStats}
        vocabWords={vocabWords}
        onBack={() => setReviewMode("hub")}
      />
    );
  }

  return (
    <ReviewHub
      flashcardStats={stats}
      practiceStats={practiceStats}
      vocabCount={vocabWords.length}
      onSelectMode={setReviewMode}
    />
  );
}
