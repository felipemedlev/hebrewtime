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
} from "@/lib/types";
import { computeNextProgress, cardRetrievability } from "@/lib/fsrs";

function isSameLocalDay(isoDate: string, now: Date): boolean {
  const d = new Date(isoDate);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function useFlashcards(vocabWords: VocabWord[]) {
  const { user } = useUser();
  const [progresses, setProgresses] = useState<FlashcardProgress[]>([]);
  const [isProgressLoaded, setIsProgressLoaded] = useState(false);

  const loadProgress = useCallback(async () => {
    if (!user) {
      setProgresses([]);
      setIsProgressLoaded(true);
      return;
    }

    setIsProgressLoaded(false);
    try {
      const { data, error } = await supabase
        .from("flashcard_progress")
        .select("*")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching flashcard progress:", error);
      } else if (data) {
        setProgresses(
          data.map((row) => ({
            ...row,
            state: row.state ?? 0,
            lapses: row.lapses ?? 0,
          }))
        );
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

  const flashcards = useMemo<FlashcardItem[]>(() => {
    return vocabWords.map((word) => {
      const prog = progresses.find((p) => p.vocab_id === word.id) || null;
      return {
        vocabWord: word,
        progress: prog,
      };
    });
  }, [vocabWords, progresses]);

  const learnedCards = useMemo<FlashcardItem[]>(() => {
    return flashcards.filter((card) => card.progress?.is_learned === true);
  }, [flashcards]);

  const activeCards = useMemo<FlashcardItem[]>(() => {
    return flashcards.filter((card) => !card.progress?.is_learned);
  }, [flashcards]);

  const dueCards = useMemo<FlashcardItem[]>(() => {
    const nowStr = new Date().toISOString();
    return activeCards.filter((card) => {
      if (!card.progress) return true;
      return card.progress.next_review_at <= nowStr;
    });
  }, [activeCards]);

  const sessionQueue = useMemo<FlashcardItem[]>(() => {
    return dueCards.slice(0, 20);
  }, [dueCards]);

  const submitReview = useCallback(
    async (vocabId: string, rating: FlashcardRating) => {
      if (!user) return;

      const currentItem = flashcards.find((c) => c.vocabWord.id === vocabId);
      if (!currentItem) return;

      const prevProg = currentItem.progress;
      const now = new Date();
      const fsrsUpdate = computeNextProgress(prevProg, rating, now);

      const updatedProgress: FlashcardProgress = {
        id: prevProg?.id || `temp-${vocabId}`,
        user_id: user.id,
        vocab_id: vocabId,
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
        const index = prev.findIndex((p) => p.vocab_id === vocabId);
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
          { onConflict: "user_id,vocab_id" }
        )
        .select()
        .single();

      if (error) {
        console.error("Failed to save flashcard review progress:", error);
        loadProgress();
      } else if (data) {
        setProgresses((prev) =>
          prev.map((p) =>
            p.vocab_id === vocabId
              ? { ...data, state: data.state ?? 0, lapses: data.lapses ?? 0 }
              : p
          )
        );
      }
    },
    [user, flashcards, loadProgress]
  );

  const unlearnWord = useCallback(
    async (vocabId: string) => {
      if (!user) return;

      setProgresses((prev) => prev.filter((p) => p.vocab_id !== vocabId));

      const { error } = await supabase
        .from("flashcard_progress")
        .delete()
        .eq("user_id", user.id)
        .eq("vocab_id", vocabId);

      if (error) {
        console.error("Failed to unlearn word:", error);
        loadProgress();
      }
    },
    [user, loadProgress]
  );

  const stats = useMemo<FlashcardStats>(() => {
    const now = new Date();
    const nowStr = now.toISOString();
    const total = flashcards.length;
    const learned = learnedCards.length;
    const active = activeCards.length;
    const due = dueCards.length;
    const newCount = flashcards.filter((c) => !c.progress).length;
    const learning = active - due - newCount;

    const reviewedToday = progresses.filter(
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

    return {
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
  }, [flashcards, learnedCards, activeCards, dueCards, progresses]);

  return {
    flashcards,
    learnedCards,
    activeCards,
    dueCards,
    sessionQueue,
    isProgressLoaded,
    submitReview,
    unlearnWord,
    stats,
    refreshProgress: loadProgress,
  };
}
