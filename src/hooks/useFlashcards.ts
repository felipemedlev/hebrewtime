"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useUser } from "./useUser";
import type {
  VocabWord,
  FlashcardItem,
  FlashcardProgress,
  FlashcardRating,
  FlashcardStats,
  FlashcardDirection,
} from "@/lib/types";
import { computeNextProgress, cardRetrievability } from "@/lib/fsrs";
import { buildSessionQueue } from "@/lib/flashcardSession";

function isSameLocalDay(isoDate: string, now: Date): boolean {
  const d = new Date(isoDate);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function normalizeProgress(row: FlashcardProgress): FlashcardProgress {
  return {
    ...row,
    direction: row.direction ?? "forward",
    state: row.state ?? 0,
    lapses: row.lapses ?? 0,
  };
}

function buildFlashcardSets(
  vocabWords: VocabWord[],
  progresses: FlashcardProgress[],
  direction: FlashcardDirection
) {
  const directionProgresses = progresses.filter(
    (p) => (p.direction ?? "forward") === direction
  );

  const flashcards: FlashcardItem[] = vocabWords.map((word) => {
    const prog =
      directionProgresses.find((p) => p.vocab_id === word.id) || null;
    return { vocabWord: word, progress: prog };
  });

  const learnedCards = flashcards.filter(
    (card) => card.progress?.is_learned === true
  );
  const activeCards = flashcards.filter((card) => !card.progress?.is_learned);

  const now = new Date();
  const nowStr = now.toISOString();
  const dueCards = activeCards.filter((card) => {
    if (!card.progress) return true;
    return card.progress.next_review_at <= nowStr;
  });

  const sessionQueue = buildSessionQueue(dueCards, now);
  const total = flashcards.length;
  const learned = learnedCards.length;
  const active = activeCards.length;
  const due = dueCards.length;
  const newCount = flashcards.filter((c) => !c.progress).length;
  const learning = active - due - newCount;

  const reviewedToday = directionProgresses.filter(
    (p) => p.last_reviewed_at && isSameLocalDay(p.last_reviewed_at, now)
  ).length;

  const futureReviews = activeCards
    .filter(
      (c) =>
        c.progress &&
        c.progress.next_review_at > nowStr &&
        !c.progress.is_learned
    )
    .map((c) => c.progress!.next_review_at)
    .sort();

  const retrievabilities = activeCards
    .filter((c) => c.progress?.last_reviewed_at)
    .map((c) => cardRetrievability(c.progress, now));

  const avgRecall =
    retrievabilities.length > 0
      ? Math.round(
          (retrievabilities.reduce((a, b) => a + b, 0) /
            retrievabilities.length) *
            100
        )
      : 0;

  const progressPercent = total > 0 ? Math.round((learned / total) * 100) : 0;

  const stats: FlashcardStats = {
    total,
    learned,
    active,
    due,
    newCount: Math.max(0, newCount),
    learning: Math.max(0, learning),
    reviewedToday,
    nextReviewAt: futureReviews[0] ?? null,
    avgRecall,
    progressPercent,
  };

  return {
    flashcards,
    learnedCards,
    activeCards,
    dueCards,
    sessionQueue,
    stats,
  };
}

export type FlashcardDirectionState = ReturnType<typeof buildFlashcardSets>;

export function useFlashcards(vocabWords: VocabWord[]) {
  const { user } = useUser();
  const [progresses, setProgresses] = useState<FlashcardProgress[]>([]);
  const [isProgressLoaded, setIsProgressLoaded] = useState(false);

  const loadProgress = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) {
      setProgresses([]);
      setIsProgressLoaded(true);
      return;
    }

    if (!options?.silent) {
      setIsProgressLoaded(false);
    }
    try {
      const { data, error } = await supabase
        .from("flashcard_progress")
        .select("*")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching flashcard progress:", error);
      } else if (data) {
        setProgresses(data.map((row) => normalizeProgress(row as FlashcardProgress)));
      }
    } catch (err) {
      console.error("Unexpected error loading flashcard progress:", err);
    } finally {
      setIsProgressLoaded(true);
    }
  }, [user]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const forward = useMemo(
    () => buildFlashcardSets(vocabWords, progresses, "forward"),
    [vocabWords, progresses]
  );

  const reverse = useMemo(
    () => buildFlashcardSets(vocabWords, progresses, "reverse"),
    [vocabWords, progresses]
  );

  const submitReview = useCallback(
    async (
      vocabId: string,
      rating: FlashcardRating,
      direction: FlashcardDirection = "forward"
    ) => {
      if (!user) return;

      const directionSet =
        direction === "reverse" ? reverse.flashcards : forward.flashcards;
      const currentItem = directionSet.find((c) => c.vocabWord.id === vocabId);
      if (!currentItem) return;

      const prevProg = currentItem.progress;
      const now = new Date();
      const fsrsUpdate = computeNextProgress(prevProg, rating, now);

      const updatedProgress: FlashcardProgress = {
        id: prevProg?.id || `temp-${direction}-${vocabId}`,
        user_id: user.id,
        vocab_id: vocabId,
        direction,
        ease_factor: prevProg?.ease_factor ?? 2.5,
        interval_days: fsrsUpdate.interval_days,
        repetitions: fsrsUpdate.repetitions,
        next_review_at: fsrsUpdate.next_review_at,
        is_learned: fsrsUpdate.is_learned,
        last_reviewed_at: fsrsUpdate.last_reviewed_at,
        created_at: prevProg?.created_at || fsrsUpdate.last_reviewed_at,
        stability: fsrsUpdate.stability,
        difficulty: fsrsUpdate.difficulty,
        state: fsrsUpdate.state,
        lapses: fsrsUpdate.lapses,
      };

      setProgresses((prev) => {
        const index = prev.findIndex(
          (p) => p.vocab_id === vocabId && (p.direction ?? "forward") === direction
        );
        if (index >= 0) {
          const next = [...prev];
          next[index] = updatedProgress;
          return next;
        }
        return [...prev, updatedProgress];
      });

      const { data, error } = await supabase
        .from("flashcard_progress")
        .upsert(
          {
            user_id: user.id,
            vocab_id: vocabId,
            direction,
            ease_factor: prevProg?.ease_factor ?? 2.5,
            interval_days: fsrsUpdate.interval_days,
            repetitions: fsrsUpdate.repetitions,
            next_review_at: fsrsUpdate.next_review_at,
            is_learned: fsrsUpdate.is_learned,
            last_reviewed_at: fsrsUpdate.last_reviewed_at,
            stability: fsrsUpdate.stability,
            difficulty: fsrsUpdate.difficulty,
            state: fsrsUpdate.state,
            lapses: fsrsUpdate.lapses,
          },
          { onConflict: "user_id,vocab_id,direction" }
        )
        .select()
        .single();

      if (error) {
        console.error("Failed to save flashcard review progress:", error);
        loadProgress({ silent: true });
      } else if (data) {
        setProgresses((prev) => {
          const normalized = normalizeProgress(data as FlashcardProgress);
          const index = prev.findIndex(
            (p) =>
              p.vocab_id === vocabId &&
              (p.direction ?? "forward") === direction
          );
          if (index >= 0) {
            const next = [...prev];
            next[index] = normalized;
            return next;
          }
          return [...prev, normalized];
        });
      }
    },
    [user, forward.flashcards, reverse.flashcards, loadProgress]
  );

  const unlearnWord = useCallback(
    async (vocabId: string, direction: FlashcardDirection = "forward") => {
      if (!user) return;

      setProgresses((prev) =>
        prev.filter(
          (p) =>
            !(
              p.vocab_id === vocabId &&
              (p.direction ?? "forward") === direction
            )
        )
      );

      const { error } = await supabase
        .from("flashcard_progress")
        .delete()
        .eq("user_id", user.id)
        .eq("vocab_id", vocabId)
        .eq("direction", direction);

      if (error) {
        console.error("Failed to unlearn word:", error);
        loadProgress({ silent: true });
      }
    },
    [user, loadProgress]
  );

  return {
    forward,
    reverse,
    isProgressLoaded,
    submitReview,
    unlearnWord,
    refreshProgress: loadProgress,
    // Backward-compatible flat aliases for forward direction
    flashcards: forward.flashcards,
    learnedCards: forward.learnedCards,
    activeCards: forward.activeCards,
    dueCards: forward.dueCards,
    sessionQueue: forward.sessionQueue,
    stats: forward.stats,
  };
}
