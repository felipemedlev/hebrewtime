"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useUser } from "./useUser";
import type { ReviewPracticeStats } from "@/lib/types";

function isWithinDays(iso: string, days: number, now: Date): boolean {
  const d = new Date(iso);
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  return d >= cutoff;
}

function isSameLocalDay(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

const EMPTY_STATS: ReviewPracticeStats = {
  fillInAttemptsToday: 0,
  fillInCorrectToday: 0,
  fillInAttempts7d: 0,
  fillInCorrect7d: 0,
  fillInAttemptsAll: 0,
  fillInCorrectAll: 0,
  fillInAccuracy7d: 0,
  fillInAccuracyToday: 0,
  practicedVocabIds: new Set(),
  weakWords: [],
};

export function useReviewPracticeStats() {
  const { user } = useUser();
  const [attempts, setAttempts] = useState<
    { id: string; vocab_id: string; correct: boolean; created_at: string }[]
  >([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadAttempts = useCallback(async () => {
    if (!user) {
      setAttempts([]);
      setIsLoaded(true);
      return;
    }

    setIsLoaded(false);
    try {
      const { data, error } = await supabase
        .from("review_practice_attempts")
        .select("id, vocab_id, correct, created_at")
        .eq("user_id", user.id)
        .eq("modality", "fill_in")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) {
        console.error("Error fetching review practice attempts:", error);
        setAttempts([]);
      } else {
        setAttempts(data ?? []);
      }
    } catch (err) {
      console.error("Unexpected error loading practice attempts:", err);
      setAttempts([]);
    } finally {
      setIsLoaded(true);
    }
  }, [user]);

  useEffect(() => {
    loadAttempts();
  }, [loadAttempts]);

  const stats = useMemo<ReviewPracticeStats>(() => {
    if (attempts.length === 0) return { ...EMPTY_STATS, practicedVocabIds: new Set() };

    const now = new Date();
    let fillInAttemptsToday = 0;
    let fillInCorrectToday = 0;
    let fillInAttempts7d = 0;
    let fillInCorrect7d = 0;
    let fillInAttemptsAll = attempts.length;
    let fillInCorrectAll = 0;
    const practicedVocabIds = new Set<string>();
    const byVocab = new Map<string, { attempts: number; correct: number }>();

    for (const attempt of attempts) {
      practicedVocabIds.add(attempt.vocab_id);
      if (attempt.correct) fillInCorrectAll++;

      const entry = byVocab.get(attempt.vocab_id) ?? { attempts: 0, correct: 0 };
      entry.attempts++;
      if (attempt.correct) entry.correct++;
      byVocab.set(attempt.vocab_id, entry);

      if (isSameLocalDay(attempt.created_at, now)) {
        fillInAttemptsToday++;
        if (attempt.correct) fillInCorrectToday++;
      }

      if (isWithinDays(attempt.created_at, 7, now)) {
        fillInAttempts7d++;
        if (attempt.correct) fillInCorrect7d++;
      }
    }

    const weakWords = [...byVocab.entries()]
      .map(([vocabId, { attempts: a, correct: c }]) => ({
        vocabId,
        attempts: a,
        correct: c,
      }))
      .filter((w) => w.attempts >= 1 && w.correct / w.attempts < 0.7)
      .sort((a, b) => a.correct / a.attempts - b.correct / b.attempts)
      .slice(0, 10);

    return {
      fillInAttemptsToday,
      fillInCorrectToday,
      fillInAttempts7d,
      fillInCorrect7d,
      fillInAttemptsAll,
      fillInCorrectAll,
      fillInAccuracy7d:
        fillInAttempts7d > 0 ? Math.round((fillInCorrect7d / fillInAttempts7d) * 100) : 0,
      fillInAccuracyToday:
        fillInAttemptsToday > 0
          ? Math.round((fillInCorrectToday / fillInAttemptsToday) * 100)
          : 0,
      practicedVocabIds,
      weakWords,
    };
  }, [attempts]);

  const recordAttempt = useCallback(
    async (vocabId: string, correct: boolean) => {
      if (!user) return;

      const optimistic = {
        id: `temp-${Date.now()}`,
        vocab_id: vocabId,
        correct,
        created_at: new Date().toISOString(),
      };

      setAttempts((prev) => [optimistic, ...prev]);

      const { data, error } = await supabase
        .from("review_practice_attempts")
        .insert({
          user_id: user.id,
          vocab_id: vocabId,
          modality: "fill_in",
          correct,
        })
        .select("id, vocab_id, correct, created_at")
        .single();

      if (error) {
        console.error("Failed to record practice attempt:", error);
        loadAttempts();
      } else if (data) {
        setAttempts((prev) =>
          prev.map((a) => (a.id === optimistic.id ? data : a))
        );
      }
    },
    [user, loadAttempts]
  );

  return {
    stats,
    isLoaded,
    recordAttempt,
    refreshAttempts: loadAttempts,
  };
}
