"use client";

import { useState, useCallback, useMemo } from "react";
import { ArrowLeft, Check, X, Sparkles, PenLine, Loader2 } from "lucide-react";
import type {
  VocabWord,
  FlashcardItem,
  FillInExercise,
  ReviewPracticeStats,
} from "@/lib/types";
import { useT } from "@/lib/i18n/LanguageProvider";
import { gradeFillInAnswer } from "@/lib/fillInGrading";

const SESSION_SIZE = 10;

type FillInViewProps = {
  vocabWords: VocabWord[];
  dueCards: FlashcardItem[];
  practiceStats: ReviewPracticeStats;
  onBack: () => void;
  generateFillIn: (
    words: VocabWord[]
  ) => Promise<{ ok: boolean; exercises?: FillInExercise[]; message?: string }>;
  recordAttempt: (vocabId: string, correct: boolean, modality: "fill_in") => Promise<void>;
  onRequireSubscription?: () => void;
};

function pickSessionWords(
  vocabWords: VocabWord[],
  dueCards: FlashcardItem[],
  practiceStats: ReviewPracticeStats
): VocabWord[] {
  const dueIds = new Set(dueCards.map((c) => c.vocabWord.id));
  const neverPracticed = vocabWords.filter(
    (w) => !practiceStats.practicedVocabIdsByModality.fill_in.has(w.id)
  );
  const dueWords = vocabWords.filter((w) => dueIds.has(w.id));
  const rest = vocabWords.filter(
    (w) =>
      !dueIds.has(w.id) &&
      practiceStats.practicedVocabIdsByModality.fill_in.has(w.id)
  );

  const pool: VocabWord[] = [];
  const seen = new Set<string>();

  const add = (word: VocabWord) => {
    if (!seen.has(word.id) && pool.length < SESSION_SIZE) {
      seen.add(word.id);
      pool.push(word);
    }
  };

  for (const w of dueWords) add(w);
  for (const w of neverPracticed) add(w);
  for (const w of rest) add(w);

  if (pool.length < SESSION_SIZE) {
    const shuffled = [...vocabWords].sort(() => Math.random() - 0.5);
    for (const w of shuffled) add(w);
  }

  return pool.slice(0, SESSION_SIZE);
}

export default function FillInView({
  vocabWords,
  dueCards,
  practiceStats,
  onBack,
  generateFillIn,
  recordAttempt,
  onRequireSubscription,
}: FillInViewProps) {
  const t = useT();
  const [phase, setPhase] = useState<"start" | "loading" | "active" | "complete">("start");
  const [exercises, setExercises] = useState<FillInExercise[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [feedback, setFeedback] = useState<"idle" | "correct" | "incorrect" | "revealed">("idle");
  const [results, setResults] = useState<{ vocabId: string; correct: boolean }[]>([]);
  const [bestStreak, setBestStreak] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sessionWords = useMemo(
    () => pickSessionWords(vocabWords, dueCards, practiceStats),
    [vocabWords, dueCards, practiceStats]
  );

  const currentExercise = exercises[currentIndex];

  const startSession = useCallback(async () => {
    setPhase("loading");
    setErrorMessage(null);
    const res = await generateFillIn(sessionWords);
    if (!res.ok || !res.exercises?.length) {
      setPhase("start");
      setErrorMessage(res.message ?? t("failedGenerateFillIn"));
      if (res.message?.includes("limit") || res.message?.includes("Upgrade")) {
        onRequireSubscription?.();
      }
      return;
    }
    setExercises(res.exercises);
    setCurrentIndex(0);
    setUserInput("");
    setFeedback("idle");
    setResults([]);
    setBestStreak(0);
    setCurrentStreak(0);
    setPhase("active");
  }, [generateFillIn, sessionWords, t, onRequireSubscription]);

  const advance = useCallback(
    (correct: boolean, vocabId: string) => {
      void recordAttempt(vocabId, correct, "fill_in");
      const nextResults = [...results, { vocabId, correct }];
      setResults(nextResults);

      const nextStreak = correct ? currentStreak + 1 : 0;
      setCurrentStreak(nextStreak);
      setBestStreak((prev) => Math.max(prev, nextStreak));

      if (currentIndex + 1 >= exercises.length) {
        setPhase("complete");
        return;
      }

      setCurrentIndex((i) => i + 1);
      setUserInput("");
      setFeedback("idle");
    },
    [currentIndex, exercises.length, results, recordAttempt, currentStreak]
  );

  const handleCheck = () => {
    if (!currentExercise || feedback !== "idle") return;
    const correct = gradeFillInAnswer(
      userInput,
      currentExercise.answer,
      currentExercise.answerWithNekudot
    );
    setFeedback(correct ? "correct" : "incorrect");
  };

  const handleSkip = () => {
    if (!currentExercise) return;
    advance(false, currentExercise.vocabId);
  };

  const handleReveal = () => {
    if (!currentExercise) return;
    setFeedback("revealed");
  };

  const handleContinue = () => {
    if (!currentExercise) return;
    const wasCorrect =
      feedback === "correct" ||
      (feedback === "revealed" &&
        gradeFillInAnswer(
          userInput,
          currentExercise.answer,
          currentExercise.answerWithNekudot
        ));
    advance(wasCorrect, currentExercise.vocabId);
  };

  if (phase === "start") {
    return (
      <div className="fill-in-view">
        <button type="button" className="review-back-btn" onClick={onBack}>
          <ArrowLeft size={16} />
          {t("backToHub")}
        </button>
        <div className="flashcard-start-screen">
          <div className="flashcard-illustration-circle">
            <PenLine size={28} />
          </div>
          <h2>{t("fillInStart")}</h2>
          <p>
            {t("fillInStartDesc", {
              count: String(Math.min(sessionWords.length, SESSION_SIZE)),
            })}
          </p>
          {errorMessage && (
            <p className="fill-in-error" role="alert">
              {errorMessage}
            </p>
          )}
          <button type="button" className="flashcard-start-btn" onClick={startSession}>
            {t("startFillIn")}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="fill-in-view">
        <div className="fill-in-loading">
          <Loader2 size={28} className="fill-in-spinner" />
          <p>{t("generatingExercises")}</p>
        </div>
      </div>
    );
  }

  if (phase === "complete") {
    const total = results.length;
    const finalCorrect = results.filter((r) => r.correct).length;
    const finalPercent = total > 0 ? Math.round((finalCorrect / total) * 100) : 0;

    return (
      <div className="fill-in-view">
        <button type="button" className="review-back-btn" onClick={onBack}>
          <ArrowLeft size={16} />
          {t("backToHub")}
        </button>
        <div className="flashcard-start-screen">
          <div className="flashcard-illustration-circle fc-session-done">
            <Sparkles size={28} />
          </div>
          <h2>{t("fillInComplete")}</h2>
          <p>
            {t("fillInScore", {
              correct: String(finalCorrect),
              total: String(total),
              percent: String(finalPercent),
            })}
          </p>
          {bestStreak > 1 && (
            <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
              {t("fillInStreak", { count: String(bestStreak) })}
            </p>
          )}
          <div className="fill-in-complete-actions">
            <button type="button" className="flashcard-start-btn" onClick={startSession}>
              {t("tryAgainFillIn")}
            </button>
            <button type="button" className="review-stats-link inline" onClick={onBack}>
              {t("backToHub")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fill-in-view">
      <button type="button" className="review-back-btn" onClick={onBack}>
        <ArrowLeft size={16} />
        {t("backToHub")}
      </button>

      <div className="fill-in-session">
        <span className="flashcard-session-label">
          {t("exerciseProgress", {
            current: String(currentIndex + 1),
            total: String(exercises.length),
          })}
        </span>

        <div
          className="flashcard-review-progress"
          role="progressbar"
          aria-valuenow={currentIndex + 1}
          aria-valuemin={1}
          aria-valuemax={exercises.length}
        >
          <div
            className="flashcard-review-progress-fill"
            style={{ width: `${((currentIndex + 1) / exercises.length) * 100}%` }}
          />
        </div>

        {currentExercise && (
          <>
            <div className="fill-in-prompt">
              <span className="fill-in-meaning-label">{t("meaningHint")}</span>
              <p className="fill-in-meaning">{currentExercise.sentenceMeaning}</p>
              <p className="font-serif fill-in-sentence" dir="rtl">
                {currentExercise.maskedHebrew}
              </p>
            </div>

            <label className="fill-in-input-label" htmlFor="fill-in-answer">
              {t("typeTheWord")}
            </label>
            <input
              id="fill-in-answer"
              type="text"
              className="fill-in-input font-serif"
              dir="rtl"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (feedback === "idle") handleCheck();
                  else handleContinue();
                }
              }}
              disabled={feedback !== "idle"}
              autoComplete="off"
              autoFocus
            />

            {feedback === "correct" && (
              <div className="fill-in-feedback correct" role="status">
                <Check size={16} />
                {t("correctAnswer")}
              </div>
            )}

            {(feedback === "incorrect" || feedback === "revealed") && (
              <div className="fill-in-feedback incorrect" role="status">
                <X size={16} />
                {t("incorrectAnswer", {
                  answer:
                    currentExercise.answerWithNekudot || currentExercise.answer,
                })}
                <p className="font-serif fill-in-reveal" dir="rtl">
                  {currentExercise.fullHebrew}
                </p>
              </div>
            )}

            <div className="fill-in-actions">
              {feedback === "idle" ? (
                <>
                  <button type="button" className="flashcard-reveal-btn" onClick={handleCheck}>
                    {t("checkAnswer")}
                  </button>
                  <button type="button" className="flashcard-examples-toggle-btn" onClick={handleReveal}>
                    {t("revealAnswer")}
                  </button>
                  <button type="button" className="flashcard-examples-toggle-btn" onClick={handleSkip}>
                    {t("skipExercise")}
                  </button>
                </>
              ) : (
                <button type="button" className="flashcard-reveal-btn" onClick={handleContinue}>
                  {t("continueBtn")}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
