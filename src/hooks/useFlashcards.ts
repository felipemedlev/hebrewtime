"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useUser } from "./useUser";
import type { VocabWord, FlashcardItem, FlashcardProgress, FlashcardRating } from "@/lib/types";
import { calculateSM2 } from "@/lib/sm2";

export function useFlashcards(vocabWords: VocabWord[]) {
  const { user } = useUser();
  const [progresses, setProgresses] = useState<FlashcardProgress[]>([]);
  const [isProgressLoaded, setIsProgressLoaded] = useState(false);

  // Load flashcard progress data from Supabase
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
        setProgresses(data);
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

  // Combine vocab list and their review progress
  const flashcards = useMemo<FlashcardItem[]>(() => {
    return vocabWords.map((word) => {
      const prog = progresses.find((p) => p.vocab_id === word.id) || null;
      return {
        vocabWord: word,
        progress: prog,
      };
    });
  }, [vocabWords, progresses]);

  // Separate cards into sections
  const learnedCards = useMemo<FlashcardItem[]>(() => {
    return flashcards.filter((card) => card.progress?.is_learned === true);
  }, [flashcards]);

  const activeCards = useMemo<FlashcardItem[]>(() => {
    return flashcards.filter((card) => !card.progress?.is_learned);
  }, [flashcards]);

  // Identify due cards
  const dueCards = useMemo<FlashcardItem[]>(() => {
    const nowStr = new Date().toISOString();
    return activeCards.filter((card) => {
      // If never reviewed, it's due (considered a "new" card)
      if (!card.progress) return true;
      return card.progress.next_review_at <= nowStr;
    });
  }, [activeCards]);

  // Build the review session queue (max 20 cards: due/new first)
  const sessionQueue = useMemo<FlashcardItem[]>(() => {
    return dueCards.slice(0, 20);
  }, [dueCards]);

  // Submit a card review
  const submitReview = useCallback(
    async (vocabId: string, rating: FlashcardRating) => {
      if (!user) return;

      const currentItem = flashcards.find((c) => c.vocabWord.id === vocabId);
      if (!currentItem) return;

      const prevProg = currentItem.progress;
      const prevInterval = prevProg ? prevProg.interval_days : 0;
      const prevRepetitions = prevProg ? prevProg.repetitions : 0;
      const prevEase = prevProg ? prevProg.ease_factor : 2.5;

      const sm2 = calculateSM2(rating, prevInterval, prevRepetitions, prevEase);

      const now = new Date();
      const nextReview = new Date();
      // If rating is 0 (Again), review in 10 minutes (0.007 days)
      if (rating === 0) {
        nextReview.setMinutes(now.getMinutes() + 10);
      } else {
        nextReview.setDate(now.getDate() + sm2.intervalDays);
      }

      const nextReviewAtStr = nextReview.toISOString();
      const lastReviewedAtStr = now.toISOString();

      // Optimistically update progress state
      const updatedProgress: FlashcardProgress = {
        id: prevProg?.id || `temp-${vocabId}`,
        user_id: user.id,
        vocab_id: vocabId,
        ease_factor: sm2.easeFactor,
        interval_days: sm2.intervalDays,
        repetitions: sm2.repetitions,
        next_review_at: nextReviewAtStr,
        is_learned: sm2.isLearned,
        last_reviewed_at: lastReviewedAtStr,
        created_at: prevProg?.created_at || lastReviewedAtStr,
      };

      setProgresses((prev) => {
        const index = prev.findIndex((p) => p.vocab_id === vocabId);
        if (index >= 0) {
          const next = [...prev];
          next[index] = updatedProgress;
          return next;
        } else {
          return [...prev, updatedProgress];
        }
      });

      // Persist to database (upsert by unique composite index [user_id, vocab_id])
      const { data, error } = await supabase
        .from("flashcard_progress")
        .upsert(
          {
            user_id: user.id,
            vocab_id: vocabId,
            ease_factor: sm2.easeFactor,
            interval_days: sm2.intervalDays,
            repetitions: sm2.repetitions,
            next_review_at: nextReviewAtStr,
            is_learned: sm2.isLearned,
            last_reviewed_at: lastReviewedAtStr,
          },
          { onConflict: "user_id,vocab_id" }
        )
        .select()
        .single();

      if (error) {
        console.error("Failed to save flashcard review progress:", error);
        // Rollback on database error
        loadProgress();
      } else if (data) {
        setProgresses((prev) =>
          prev.map((p) => (p.vocab_id === vocabId ? data : p))
        );
      }
    },
    [user, flashcards, loadProgress]
  );

  // Unlearn / reset learning progress for a card
  const unlearnWord = useCallback(
    async (vocabId: string) => {
      if (!user) return;

      // Optimistically delete or reset progress to trigger "new card" state
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

  // Calculate learning statistics
  const stats = useMemo(() => {
    const total = flashcards.length;
    const learned = learnedCards.length;
    const active = activeCards.length;
    const due = dueCards.length;
    const progressPercent = total > 0 ? Math.round((learned / total) * 100) : 0;

    return {
      total,
      learned,
      active,
      due,
      progressPercent,
    };
  }, [flashcards, learnedCards, activeCards, dueCards]);

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
