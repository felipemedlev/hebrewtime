import type { FlashcardStats, ReviewPracticeStats } from "@/lib/types";

export type ReviewStatsSummary = {
  /** Main hero metric (0–100) */
  headlinePercent: number;
  /** True when headline is combined fill-in/matching accuracy; false when flashcard mastery */
  usePracticeAccuracy: boolean;
  practicedToday: number;
  accuracy7d: number | null;
  learned: number;
  total: number;
  practiceDayStreak: number;
};

function localDayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Consecutive calendar days with fill-in or matching activity, ending today or yesterday. */
export function computePracticeDayStreak(attemptTimestamps: string[], now = new Date()): number {
  if (attemptTimestamps.length === 0) return 0;

  const days = new Set(attemptTimestamps.map(localDayKey));
  let streak = 0;
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);

  for (let i = 0; i < 365; i++) {
    const key = localDayKey(cursor.toISOString());
    if (days.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else if (i === 0) {
      // No activity today — allow streak to start from yesterday
      cursor.setDate(cursor.getDate() - 1);
      continue;
    } else {
      break;
    }
  }

  return streak;
}

export function buildReviewStatsSummary(
  flashcardStats: FlashcardStats,
  reverseStats: FlashcardStats,
  practiceStats: ReviewPracticeStats,
  attemptTimestamps: string[] = []
): ReviewStatsSummary {
  const practiceAttempts7d =
    practiceStats.fillInAttempts7d + practiceStats.matchingAttempts7d;
  const practiceCorrect7d =
    practiceStats.fillInCorrect7d + practiceStats.matchingCorrect7d;

  const accuracy7d =
    practiceAttempts7d > 0
      ? Math.round((practiceCorrect7d / practiceAttempts7d) * 100)
      : null;

  const usePracticeAccuracy = practiceAttempts7d > 0;
  const headlinePercent = usePracticeAccuracy
    ? accuracy7d!
    : flashcardStats.progressPercent;

  const practicedToday =
    flashcardStats.reviewedToday +
    reverseStats.reviewedToday +
    practiceStats.fillInAttemptsToday +
    practiceStats.matchingAttemptsToday;

  return {
    headlinePercent,
    usePracticeAccuracy,
    practicedToday,
    accuracy7d,
    learned: flashcardStats.learned,
    total: flashcardStats.total,
    practiceDayStreak: computePracticeDayStreak(attemptTimestamps),
  };
}
