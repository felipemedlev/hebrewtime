"use client";

import { useState, useCallback, useMemo } from "react";
import { ArrowLeft, Check, X, Sparkles, Shuffle } from "lucide-react";
import type {
  VocabWord,
  FlashcardItem,
  ReviewPracticeStats,
  ReviewModality,
} from "@/lib/types";
import { useT } from "@/lib/i18n/LanguageProvider";

const ROUND_SIZE = 6;

type MatchingViewProps = {
  vocabWords: VocabWord[];
  dueCards: FlashcardItem[];
  practiceStats: ReviewPracticeStats;
  onBack: () => void;
  recordAttempt: (
    vocabId: string,
    correct: boolean,
    modality: ReviewModality
  ) => Promise<void>;
};

type MatchingTile = {
  id: string;
  vocabId: string;
  label: string;
  side: "hebrew" | "translation";
};

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function pickRoundWords(
  vocabWords: VocabWord[],
  dueCards: FlashcardItem[],
  practicedIds: Set<string>,
  excludeIds: Set<string> = new Set()
): VocabWord[] {
  const dueIds = new Set(dueCards.map((c) => c.vocabWord.id));

  const prefer = (words: VocabWord[]) =>
    shuffle(words.filter((w) => !excludeIds.has(w.id)));

  const dueWords = prefer(vocabWords.filter((w) => dueIds.has(w.id)));
  const neverPracticed = prefer(
    vocabWords.filter((w) => !practicedIds.has(w.id))
  );
  const rest = prefer(
    vocabWords.filter((w) => !dueIds.has(w.id) && practicedIds.has(w.id))
  );

  const pool: VocabWord[] = [];
  const seen = new Set<string>();

  const add = (word: VocabWord) => {
    if (!seen.has(word.id) && pool.length < ROUND_SIZE) {
      seen.add(word.id);
      pool.push(word);
    }
  };

  for (const w of dueWords) add(w);
  for (const w of neverPracticed) add(w);
  for (const w of rest) add(w);

  if (pool.length < ROUND_SIZE) {
    for (const w of shuffle(vocabWords.filter((w) => excludeIds.has(w.id)))) {
      add(w);
    }
  }

  if (pool.length < ROUND_SIZE) {
    for (const w of shuffle(vocabWords)) add(w);
  }

  return pool.slice(0, ROUND_SIZE);
}

function buildTiles(words: VocabWord[]): {
  hebrewTiles: MatchingTile[];
  translationTiles: MatchingTile[];
} {
  const hebrewTiles: MatchingTile[] = words.map((w) => ({
    id: `he-${w.id}`,
    vocabId: w.id,
    label: w.wordWithNekudot || w.word,
    side: "hebrew",
  }));

  const translationTiles: MatchingTile[] = words
    .map((w) => ({
      id: `tr-${w.id}`,
      vocabId: w.id,
      label: w.translation,
      side: "translation" as const,
    }))
    .sort(() => Math.random() - 0.5);

  return {
    hebrewTiles: hebrewTiles.sort(() => Math.random() - 0.5),
    translationTiles,
  };
}

export default function MatchingView({
  vocabWords,
  dueCards,
  practiceStats,
  onBack,
  recordAttempt,
}: MatchingViewProps) {
  const t = useT();
  const [phase, setPhase] = useState<"start" | "active" | "complete">("start");
  const [roundWords, setRoundWords] = useState<VocabWord[]>([]);
  const [hebrewTiles, setHebrewTiles] = useState<MatchingTile[]>([]);
  const [translationTiles, setTranslationTiles] = useState<MatchingTile[]>([]);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [selectedHebrew, setSelectedHebrew] = useState<string | null>(null);
  const [selectedTranslation, setSelectedTranslation] = useState<string | null>(null);
  const [wrongPair, setWrongPair] = useState(false);
  const [results, setResults] = useState<{ vocabId: string; correct: boolean }[]>([]);
  const [bestStreak, setBestStreak] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [usedThisSession, setUsedThisSession] = useState<Set<string>>(
    () => new Set()
  );

  const practicedIds = practiceStats.practicedVocabIdsByModality.matching;

  const sessionWords = useMemo(
    () => pickRoundWords(vocabWords, dueCards, practicedIds, usedThisSession),
    [vocabWords, dueCards, practicedIds, usedThisSession]
  );

  const startRound = useCallback(() => {
    const words = pickRoundWords(
      vocabWords,
      dueCards,
      practicedIds,
      usedThisSession
    );
    const { hebrewTiles: h, translationTiles: tr } = buildTiles(words);
    setUsedThisSession((prev) => {
      const next = new Set(prev);
      for (const word of words) next.add(word.id);
      return next;
    });
    setRoundWords(words);
    setHebrewTiles(h);
    setTranslationTiles(tr);
    setMatchedIds(new Set());
    setSelectedHebrew(null);
    setSelectedTranslation(null);
    setWrongPair(false);
    setResults([]);
    setBestStreak(0);
    setCurrentStreak(0);
    setPhase("active");
  }, [vocabWords, dueCards, practicedIds, usedThisSession]);

  const completeRound = useCallback(
    (finalResults: { vocabId: string; correct: boolean }[]) => {
      setResults(finalResults);
      setPhase("complete");
    },
    []
  );

  const handleSelectHebrew = (tile: MatchingTile) => {
    if (matchedIds.has(tile.vocabId) || wrongPair) return;
    setSelectedHebrew(tile.id);
    if (selectedTranslation) {
      tryMatch(tile.id, selectedTranslation);
    }
  };

  const handleSelectTranslation = (tile: MatchingTile) => {
    if (matchedIds.has(tile.vocabId) || wrongPair) return;
    setSelectedTranslation(tile.id);
    if (selectedHebrew) {
      tryMatch(selectedHebrew, tile.id);
    }
  };

  const tryMatch = (hebrewId: string, translationId: string) => {
    const hebrewTile = hebrewTiles.find((t) => t.id === hebrewId);
    const translationTile = translationTiles.find((t) => t.id === translationId);
    if (!hebrewTile || !translationTile) return;

    const isCorrect = hebrewTile.vocabId === translationTile.vocabId;
    void recordAttempt(hebrewTile.vocabId, isCorrect, "matching");

    const nextResults = [...results, { vocabId: hebrewTile.vocabId, correct: isCorrect }];
    setResults(nextResults);

    if (isCorrect) {
      const nextStreak = currentStreak + 1;
      setCurrentStreak(nextStreak);
      setBestStreak((prev) => Math.max(prev, nextStreak));

      const nextMatched = new Set(matchedIds);
      nextMatched.add(hebrewTile.vocabId);
      setMatchedIds(nextMatched);
      setSelectedHebrew(null);
      setSelectedTranslation(null);

      if (nextMatched.size >= roundWords.length) {
        completeRound(nextResults);
      }
    } else {
      setCurrentStreak(0);
      setWrongPair(true);
      window.setTimeout(() => {
        setWrongPair(false);
        setSelectedHebrew(null);
        setSelectedTranslation(null);
      }, 600);
    }
  };

  if (vocabWords.length < 2) {
    return (
      <div className="matching-view">
        <button type="button" className="review-back-btn" onClick={onBack}>
          <ArrowLeft size={16} />
          {t("backToHub")}
        </button>
        <div className="flashcard-start-screen">
          <div className="flashcard-illustration-circle">
            <Shuffle size={28} />
          </div>
          <h2>{t("matchingStart")}</h2>
          <p>{t("matchingTooFewWords")}</p>
        </div>
      </div>
    );
  }

  if (phase === "start") {
    return (
      <div className="matching-view">
        <button type="button" className="review-back-btn" onClick={onBack}>
          <ArrowLeft size={16} />
          {t("backToHub")}
        </button>
        <div className="flashcard-start-screen">
          <div className="flashcard-illustration-circle">
            <Shuffle size={28} />
          </div>
          <h2>{t("matchingStart")}</h2>
          <p>
            {t("matchingStartDesc", {
              count: String(Math.min(sessionWords.length, ROUND_SIZE)),
            })}
          </p>
          <button type="button" className="flashcard-start-btn" onClick={startRound}>
            {t("startMatching")}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "complete") {
    const total = results.length;
    const finalCorrect = results.filter((r) => r.correct).length;
    const finalPercent = total > 0 ? Math.round((finalCorrect / total) * 100) : 0;

    return (
      <div className="matching-view">
        <button type="button" className="review-back-btn" onClick={onBack}>
          <ArrowLeft size={16} />
          {t("backToHub")}
        </button>
        <div className="flashcard-start-screen">
          <div className="flashcard-illustration-circle fc-session-done">
            <Sparkles size={28} />
          </div>
          <h2>{t("matchingComplete")}</h2>
          <p>
            {t("matchingScore", {
              correct: String(finalCorrect),
              total: String(total),
              percent: String(finalPercent),
            })}
          </p>
          {bestStreak > 1 && (
            <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
              {t("matchingStreak", { count: String(bestStreak) })}
            </p>
          )}
          <div className="fill-in-complete-actions">
            <button type="button" className="flashcard-start-btn" onClick={startRound}>
              {t("tryAgainMatching")}
            </button>
            <button type="button" className="review-stats-link inline" onClick={onBack}>
              {t("backToHub")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const matchedCount = matchedIds.size;
  const totalPairs = roundWords.length;

  return (
    <div className="matching-view">
      <button type="button" className="review-back-btn" onClick={onBack}>
        <ArrowLeft size={16} />
        {t("backToHub")}
      </button>

      <div className="matching-session">
        <span className="flashcard-session-label">
          {t("matchingProgress", {
            current: String(matchedCount + 1),
            total: String(totalPairs),
          })}
        </span>

        <div
          className="flashcard-review-progress"
          role="progressbar"
          aria-valuenow={matchedCount}
          aria-valuemin={0}
          aria-valuemax={totalPairs}
        >
          <div
            className="flashcard-review-progress-fill"
            style={{ width: `${(matchedCount / totalPairs) * 100}%` }}
          />
        </div>

        {wrongPair && (
          <div className="matching-feedback incorrect" role="status">
            <X size={16} />
            {t("matchingWrong")}
          </div>
        )}

        <div className="matching-board">
          <div className="matching-column">
            <h3 className="matching-column-label">{t("hebrew")}</h3>
            <div className="matching-tiles">
              {hebrewTiles.map((tile) => {
                const isMatched = matchedIds.has(tile.vocabId);
                const isSelected = selectedHebrew === tile.id;
                const isWrong =
                  wrongPair &&
                  (selectedHebrew === tile.id || selectedTranslation?.endsWith(tile.vocabId));

                return (
                  <button
                    key={tile.id}
                    type="button"
                    className={`matching-tile font-serif${isMatched ? " is-matched" : ""}${isSelected ? " is-selected" : ""}${isWrong ? " is-wrong" : ""}`}
                    dir="rtl"
                    disabled={isMatched || wrongPair}
                    onClick={() => handleSelectHebrew(tile)}
                  >
                    {isMatched ? <Check size={14} /> : null}
                    {tile.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="matching-column">
            <h3 className="matching-column-label">{t("translation")}</h3>
            <div className="matching-tiles">
              {translationTiles.map((tile) => {
                const isMatched = matchedIds.has(tile.vocabId);
                const isSelected = selectedTranslation === tile.id;
                const isWrong =
                  wrongPair &&
                  (selectedTranslation === tile.id || selectedHebrew?.endsWith(tile.vocabId));

                return (
                  <button
                    key={tile.id}
                    type="button"
                    className={`matching-tile${isMatched ? " is-matched" : ""}${isSelected ? " is-selected" : ""}${isWrong ? " is-wrong" : ""}`}
                    disabled={isMatched || wrongPair}
                    onClick={() => handleSelectTranslation(tile)}
                  >
                    {isMatched ? <Check size={14} /> : null}
                    {tile.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
