"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useUser } from "./useUser";
import type { ReviewModality, ReviewPracticeStats } from "@/lib/types";

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
  matchingAttemptsToday: 0,
  matchingCorrectToday: 0,
  matchingAttempts7d: 0,
  matchingCorrect7d: 0,
  matchingAttemptsAll: 0,
  matchingCorrectAll: 0,
  matchingAccuracy7d: 0,
  matchingAccuracyToday: 0,
  practicedVocabIdsByModality: { fill_in: new Set(), matching: new Set() },
  weakWords: [],
  matchingWeakWords: [],
};

type AttemptRow = {
  id: string;
  vocab_id: string;
  modality: ReviewModality;
  correct: boolean;
  created_at: string;
};

function computeWeakWords(
  byVocab: Map<string, { attempts: number; correct: number }>
) {
  return [...byVocab.entries()]
    .map(([vocabId, { attempts: a, correct: c }]) => ({
      vocabId,
      attempts: a,
      correct: c,
    }))
    .filter((w) => w.attempts >= 1 && w.correct / w.attempts < 0.7)
    .sort((a, b) => a.correct / a.attempts - b.correct / b.attempts)
    .slice(0, 10);
}

export function useReviewPracticeStats() {
  const { user } = useUser();
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const loadIdRef = useRef(0);

  const loadAttempts = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    if (!user) {
      setAttempts([]);
      setIsLoaded(true);
      return;
    }

    // Clear the previous account's attempts before requesting the new account.
    setAttempts([]);
    setIsLoaded(false);
    try {
      const { data, error } = await supabase
        .from("review_practice_attempts")
        .select("id, vocab_id, modality, correct, created_at")
        .eq("user_id", user.id)
        .in("modality", ["fill_in", "matching"])
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) {
        console.error("Error fetching review practice attempts:", error);
        if (loadId === loadIdRef.current) setAttempts([]);
      } else {
        if (loadId !== loadIdRef.current) return;
        setAttempts((data ?? []) as AttemptRow[]);
      }
    } catch (err) {
      console.error("Unexpected error loading practice attempts:", err);
      if (loadId === loadIdRef.current) setAttempts([]);
    } finally {
      if (loadId === loadIdRef.current) setIsLoaded(true);
    }
  }, [user]);

  useEffect(() => {
    loadAttempts();
  }, [loadAttempts]);

  const stats = useMemo<ReviewPracticeStats>(() => {
    if (attempts.length === 0) {
      return {
        ...EMPTY_STATS,
        practicedVocabIdsByModality: {
          fill_in: new Set(),
          matching: new Set(),
        },
      };
    }

    const now = new Date();
    let fillInAttemptsToday = 0;
    let fillInCorrectToday = 0;
    let fillInAttempts7d = 0;
    let fillInCorrect7d = 0;
    let fillInAttemptsAll = 0;
    let fillInCorrectAll = 0;
    let matchingAttemptsToday = 0;
    let matchingCorrectToday = 0;
    let matchingAttempts7d = 0;
    let matchingCorrect7d = 0;
    let matchingAttemptsAll = 0;
    let matchingCorrectAll = 0;
    const practicedVocabIdsByModality: Record<ReviewModality, Set<string>> = {
      fill_in: new Set(),
      matching: new Set(),
    };
    const fillInByVocab = new Map<string, { attempts: number; correct: number }>();
    const matchingByVocab = new Map<string, { attempts: number; correct: number }>();

    for (const attempt of attempts) {
      const modality = attempt.modality;
      practicedVocabIdsByModality[modality].add(attempt.vocab_id);

      const byVocab =
        modality === "fill_in" ? fillInByVocab : matchingByVocab;
      const entry = byVocab.get(attempt.vocab_id) ?? { attempts: 0, correct: 0 };
      entry.attempts++;
      if (attempt.correct) entry.correct++;
      byVocab.set(attempt.vocab_id, entry);

      if (modality === "fill_in") {
        fillInAttemptsAll++;
        if (attempt.correct) fillInCorrectAll++;

        if (isSameLocalDay(attempt.created_at, now)) {
          fillInAttemptsToday++;
          if (attempt.correct) fillInCorrectToday++;
        }

        if (isWithinDays(attempt.created_at, 7, now)) {
          fillInAttempts7d++;
          if (attempt.correct) fillInCorrect7d++;
        }
      } else {
        matchingAttemptsAll++;
        if (attempt.correct) matchingCorrectAll++;

        if (isSameLocalDay(attempt.created_at, now)) {
          matchingAttemptsToday++;
          if (attempt.correct) matchingCorrectToday++;
        }

        if (isWithinDays(attempt.created_at, 7, now)) {
          matchingAttempts7d++;
          if (attempt.correct) matchingCorrect7d++;
        }
      }
    }

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
      matchingAttemptsToday,
      matchingCorrectToday,
      matchingAttempts7d,
      matchingCorrect7d,
      matchingAttemptsAll,
      matchingCorrectAll,
      matchingAccuracy7d:
        matchingAttempts7d > 0
          ? Math.round((matchingCorrect7d / matchingAttempts7d) * 100)
          : 0,
      matchingAccuracyToday:
        matchingAttemptsToday > 0
          ? Math.round((matchingCorrectToday / matchingAttemptsToday) * 100)
          : 0,
      practicedVocabIdsByModality,
      weakWords: computeWeakWords(fillInByVocab),
      matchingWeakWords: computeWeakWords(matchingByVocab),
    };
  }, [attempts]);

  const recordAttempt = useCallback(
    async (vocabId: string, correct: boolean, modality: ReviewModality) => {
      if (!user) return;
      const mutationLoadId = loadIdRef.current;

      const optimistic: AttemptRow = {
        id: `temp-${Date.now()}`,
        vocab_id: vocabId,
        modality,
        correct,
        created_at: new Date().toISOString(),
      };

      setAttempts((prev) => [optimistic, ...prev]);

      const { data, error } = await supabase
        .from("review_practice_attempts")
        .insert({
          user_id: user.id,
          vocab_id: vocabId,
          modality,
          correct,
        })
        .select("id, vocab_id, modality, correct, created_at")
        .single();

      if (mutationLoadId !== loadIdRef.current) return;

      if (error) {
        console.error("Failed to record practice attempt:", error);
        loadAttempts();
      } else if (data) {
        setAttempts((prev) =>
          prev.map((a) => (a.id === optimistic.id ? (data as AttemptRow) : a))
        );
      }
    },
    [user, loadAttempts]
  );

  const attemptTimestamps = useMemo(
    () => attempts.map((a) => a.created_at),
    [attempts]
  );

  return {
    stats,
    attemptTimestamps,
    isLoaded,
    recordAttempt,
    refreshAttempts: loadAttempts,
  };
}
