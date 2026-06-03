import {
  createEmptyCard,
  dateDiffInDays,
  fsrs,
  Rating,
  State,
  type Card,
  type Grade,
} from "ts-fsrs";
import type { FlashcardProgress, FlashcardRating } from "./types";

const scheduler = fsrs({
  request_retention: 0.9,
  enable_fuzz: true,
});

const LEARNED_INTERVAL_DAYS = 21;

/** Map app ratings (0/1/3/5) to ts-fsrs Grade (1/2/3/4). */
export function ratingToFsrs(rating: FlashcardRating): Grade {
  switch (rating) {
    case 0:
      return Rating.Again;
    case 1:
      return Rating.Hard;
    case 3:
      return Rating.Good;
    case 5:
      return Rating.Easy;
    default:
      return Rating.Good;
  }
}

/** Build a ts-fsrs Card from stored progress (or empty card for new words). */
export function progressToCard(
  prog: FlashcardProgress | null,
  now: Date = new Date()
): Card {
  if (!prog) {
    return createEmptyCard(now);
  }

  if (prog.stability == null || prog.difficulty == null) {
    const due = new Date(prog.next_review_at);
    const lastReview = prog.last_reviewed_at
      ? new Date(prog.last_reviewed_at)
      : undefined;
    const state =
      prog.is_learned || prog.interval_days >= LEARNED_INTERVAL_DAYS
        ? State.Review
        : prog.repetitions > 0
          ? State.Learning
          : State.New;

    return {
      due,
      stability: Math.max(prog.interval_days, 0.1),
      difficulty: 5,
      elapsed_days: lastReview ? dateDiffInDays(lastReview, now) : 0,
      scheduled_days: prog.interval_days,
      learning_steps: 0,
      reps: prog.repetitions,
      lapses: prog.lapses ?? 0,
      state,
      last_review: lastReview,
    };
  }

  const lastReview = prog.last_reviewed_at
    ? new Date(prog.last_reviewed_at)
    : undefined;

  return {
    due: new Date(prog.next_review_at),
    stability: prog.stability,
    difficulty: prog.difficulty,
    elapsed_days: lastReview ? dateDiffInDays(lastReview, now) : 0,
    scheduled_days: prog.interval_days,
    learning_steps: 0,
    reps: prog.repetitions,
    lapses: prog.lapses,
    state: prog.state as State,
    last_review: lastReview,
  };
}

export type FsrsProgressUpdate = {
  stability: number;
  difficulty: number;
  state: number;
  lapses: number;
  repetitions: number;
  interval_days: number;
  next_review_at: string;
  is_learned: boolean;
  last_reviewed_at: string;
};

/** Apply one review rating and return fields to persist. */
export function computeNextProgress(
  prog: FlashcardProgress | null,
  rating: FlashcardRating,
  now: Date = new Date()
): FsrsProgressUpdate {
  const card = progressToCard(prog, now);
  const { card: nextCard } = scheduler.next(card, now, ratingToFsrs(rating));

  const isLearned =
    nextCard.state === State.Review &&
    nextCard.scheduled_days >= LEARNED_INTERVAL_DAYS;

  return {
    stability: nextCard.stability,
    difficulty: nextCard.difficulty,
    state: nextCard.state,
    lapses: nextCard.lapses,
    repetitions: nextCard.reps,
    interval_days: nextCard.scheduled_days,
    next_review_at: nextCard.due.toISOString(),
    is_learned: isLearned,
    last_reviewed_at: now.toISOString(),
  };
}

/** FSRS predicted recall probability (0–1) for dashboard stats. */
export function cardRetrievability(
  prog: FlashcardProgress | null,
  now: Date = new Date()
): number {
  const card = progressToCard(prog, now);
  if (card.state === State.New && !prog?.last_reviewed_at) {
    return 0;
  }
  return scheduler.get_retrievability(card, now, false);
}
