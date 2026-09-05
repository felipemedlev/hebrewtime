"use client";

import { useState } from "react";
import {
  ArrowLeftRight,
  RotateCcw,
  Check,
  Sparkles,
  ExternalLink,
  Flame,
  BookOpen,
  MessageSquare,
  Clock,
  PlusCircle,
  TrendingUp,
  CalendarClock,
  ArrowLeft,
} from "lucide-react";
import type {
  VocabWord,
  FlashcardItem,
  FlashcardRating,
  FlashcardStats,
} from "@/lib/types";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import ExamplePhrasesPanel from "./ExamplePhrasesPanel";
import DictionaryDetailsModal from "./DictionaryDetailsModal";
import { recordLearningEvent } from "@/lib/analytics";

function formatNextReview(iso: string | null, soonLabel: string): string {
  if (!iso) return "—";
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return soonLabel;
  const mins = Math.ceil(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.ceil(mins / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.ceil(hours / 24);
  return `${days}d`;
}

type ReverseCardsViewProps = {
  vocabWords: VocabWord[];
  learnedCards: FlashcardItem[];
  sessionQueue: FlashcardItem[];
  isLoaded: boolean;
  submitReview: (vocabId: string, rating: FlashcardRating) => Promise<void>;
  unlearnWord: (vocabId: string) => Promise<void>;
  stats: FlashcardStats;
  generateExamples: (word: VocabWord) => Promise<{ ok: boolean; message?: string }>;
  regenerateExample: (word: VocabWord, index: number) => Promise<{ ok: boolean; message?: string }>;
  isPremium?: boolean;
  onRequireSubscription?: () => void;
  onBack: () => void;
};

export default function ReverseCardsView({
  vocabWords,
  learnedCards,
  sessionQueue,
  isLoaded,
  submitReview,
  unlearnWord,
  stats,
  generateExamples,
  regenerateExample,
  isPremium = false,
  onRequireSubscription,
  onBack,
}: ReverseCardsViewProps) {
  const { t, lang } = useLanguage();
  const [sessionActive, setSessionActive] = useState(false);
  const [activeSessionCards, setActiveSessionCards] = useState<FlashcardItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [viewTab, setViewTab] = useState<"session" | "learned">("session");
  const [showExamples, setShowExamples] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [detailsPealimId, setDetailsPealimId] = useState<number | null>(null);
  const reviewQueue = sessionActive ? activeSessionCards : sessionQueue;
  const currentWord = reviewQueue[currentIndex]?.vocabWord;

  const beginSession = (cards: FlashcardItem[]) => {
    if (cards.length === 0) return;
    recordLearningEvent("review_started", { language: lang, modality: "reverse", count: cards.length });
    setActiveSessionCards(cards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowExamples(false);
    setDetailsPealimId(null);
    setSessionActive(true);
    setViewTab("session");
  };

  const startSession = () => {
    beginSession(sessionQueue);
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleRate = (rating: FlashcardRating) => {
    if (!reviewQueue[currentIndex]) return;

    submitReview(reviewQueue[currentIndex].vocabWord.id, rating);
    setIsFlipped(false);
    setShowExamples(false);
    setDetailsPealimId(null);

    if (currentIndex + 1 < reviewQueue.length) {
      setCurrentIndex((index) => index + 1);
    } else {
      recordLearningEvent("review_completed", {
        language: lang,
        modality: "reverse",
        count: reviewQueue.length,
      });
      setSessionActive(false);
      setActiveSessionCards([]);
    }
  };

  const handleToggleExamples = async () => {
    if (!currentWord) return;

    if (!showExamples) {
      setShowExamples(true);
      if (!currentWord.examplePhrases?.length) {
        setIsGenerating(true);
        await generateExamples(currentWord);
        setIsGenerating(false);
      }
      return;
    }

    setShowExamples(false);
  };

  const handleGenerate = async (word: VocabWord) => {
    setIsGenerating(true);
    const result = await generateExamples(word);
    setIsGenerating(false);
    return result;
  };

  const handleRegenerate = async (word: VocabWord, index: number) => {
    setRegeneratingIndex(index);
    const result = await regenerateExample(word, index);
    setRegeneratingIndex(null);
    return result;
  };

  if (!isLoaded && vocabWords.length === 0) {
    return (
      <div
        className="vocab-loading"
        style={{ height: "400px", display: "flex", justifyContent: "center", alignItems: "center" }}
      >
        <div className="vocab-spinner" />
      </div>
    );
  }

  return (
    <div className="flashcards-container reverse-cards-container">
      <button type="button" className="review-back-btn" onClick={onBack}>
        <ArrowLeft size={16} />
        {t("backToHub")}
      </button>

      <div className="flashcards-stats-dashboard">
        <div className="flashcard-stat-tile highlight-due">
          <Flame size={14} className="flashcard-stat-icon-due" />
          <span className="stat-label">{t("due")}</span>
          <span className="stat-value">{stats.due}</span>
        </div>
        <div className="flashcard-stat-tile">
          <PlusCircle size={14} className="flashcard-stat-icon-new" />
          <span className="stat-label">{t("newLabel")}</span>
          <span className="stat-value">{stats.newCount}</span>
        </div>
        <div className="flashcard-stat-tile">
          <BookOpen size={14} className="flashcard-stat-icon-active" />
          <span className="stat-label">{t("learning")}</span>
          <span className="stat-value">{stats.learning}</span>
        </div>
        <div className="flashcard-stat-tile">
          <Check size={14} className="flashcard-stat-icon-learned" />
          <span className="stat-label">{t("learned")}</span>
          <span className="stat-value">
            {stats.learned}
            <span className="stat-total">/{stats.total}</span>
          </span>
        </div>
        <div className="flashcard-stat-tile">
          <Clock size={14} className="flashcard-stat-icon-today" />
          <span className="stat-label">{t("reviewedToday")}</span>
          <span className="stat-value">{stats.reviewedToday}</span>
        </div>
        <div className="flashcard-stat-tile">
          <TrendingUp size={14} className="flashcard-stat-icon-recall" />
          <span className="stat-label">{t("avgRecall")}</span>
          <span className="stat-value">{stats.avgRecall}%</span>
        </div>
        {stats.due === 0 && stats.nextReviewAt && (
          <div className="flashcard-stat-tile">
            <CalendarClock size={14} className="flashcard-stat-icon-eta" />
            <span className="stat-label">{t("nextReview")}</span>
            <span className="stat-value">{formatNextReview(stats.nextReviewAt, t("soon"))}</span>
          </div>
        )}
        <div className="flashcard-stat-tile mastery-tile">
          <Sparkles size={14} className="flashcard-stat-icon-progress" />
          <span className="stat-label">{t("mastery")}</span>
          <div className="flashcard-compact-progress">
            <div className="flashcard-stat-progress-bg">
              <div
                className="flashcard-stat-progress-fill"
                style={{ width: `${stats.progressPercent}%` }}
              />
            </div>
            <span className="progress-percent">{stats.progressPercent}%</span>
          </div>
        </div>
      </div>

      {!sessionActive && (
        <div className="vocab-filters-bar">
          <div className="vocab-view-tabs">
            <button
              className={`vocab-filter-btn ${viewTab === "session" ? "active" : ""}`}
              onClick={() => setViewTab("session")}
            >
              <ArrowLeftRight size={14} className="vocab-filter-icon" />
              {t("reverseSession")}
            </button>
            <button
              className={`vocab-filter-btn ${viewTab === "learned" ? "active" : ""}`}
              onClick={() => setViewTab("learned")}
            >
              <Check size={14} className="vocab-filter-icon" />
              {t("learnedWords")} ({stats.learned})
            </button>
          </div>
        </div>
      )}

      {viewTab === "session" && (
        <div className="flashcards-session-wrapper">
          {sessionActive ? (
            <div className="flashcard-session-active">
              <span className="flashcard-session-label">
                {t("cardsInSession", { current: currentIndex + 1, total: reviewQueue.length })}
              </span>

              <div className="flashcard-card-stack">
                <div
                  className="flashcard-review-progress"
                  role="progressbar"
                  aria-valuenow={currentIndex + 1}
                  aria-valuemin={1}
                  aria-valuemax={reviewQueue.length}
                >
                  <div
                    className="flashcard-review-progress-fill"
                    style={{
                      width: `${((currentIndex + 1) / reviewQueue.length) * 100}%`,
                    }}
                  />
                </div>

                <div
                  className="flashcard-card-scene"
                  key={currentIndex}
                  onClick={handleFlip}
                  role="button"
                  tabIndex={0}
                  aria-label={t("tapToFlip")}
                  onKeyDown={(e) =>
                    e.key === "Enter" || e.key === " " ? handleFlip() : undefined
                  }
                >
                  <div className={`flashcard-card-inner ${isFlipped ? "is-flipped" : ""}`}>
                    <div className="flashcard-card-front reverse-card-front">
                      <span className="flashcard-badge-side">{t("translation")}</span>
                      <h2 className="flashcard-translation-word">
                        {reviewQueue[currentIndex].vocabWord.translation}
                      </h2>
                      <p className="flashcard-hint-click">{t("tapToFlip")}</p>
                    </div>

                    <div
                      className="flashcard-card-back reverse-card-back"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="flashcard-badge-side back">{t("hebrew")}</span>
                      <h2 className="font-serif flashcard-hebrew-word" dir="rtl" lang="he">
                        {reviewQueue[currentIndex].vocabWord.wordWithNekudot ||
                          reviewQueue[currentIndex].vocabWord.word}
                      </h2>
                      {reviewQueue[currentIndex].vocabWord.verbFormWithNekudot && (
                        <span className="font-serif flashcard-verb-form" dir="rtl" lang="he">
                          {reviewQueue[currentIndex].vocabWord.verbFormWithNekudot}
                        </span>
                      )}
                      {reviewQueue[currentIndex].vocabWord.pronunciation && (
                        <p className="flashcard-pronunciation">
                          /{reviewQueue[currentIndex].vocabWord.pronunciation}/
                        </p>
                      )}
                      {reviewQueue[currentIndex].vocabWord.episodeTitle && (
                        <div
                          className="vocab-card-source"
                          style={{
                            border: "1px solid rgba(0,0,0,0.06)",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            marginTop: "12px",
                          }}
                        >
                          {reviewQueue[currentIndex].vocabWord.episodeUrl ? (
                            <a
                              href={reviewQueue[currentIndex].vocabWord.episodeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="vocab-source-link"
                            >
                              <ExternalLink size={11} className="vocab-source-icon" />
                              <span>{reviewQueue[currentIndex].vocabWord.episodeTitle}</span>
                            </a>
                          ) : (
                            <span>{reviewQueue[currentIndex].vocabWord.episodeTitle}</span>
                          )}
                        </div>
                      )}
                      <p className="flashcard-hint-click" onClick={handleFlip}>
                        {t("tapToFlip")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {showExamples && currentWord && (
                <ExamplePhrasesPanel
                  word={currentWord}
                  variant="flashcard"
                  onGenerate={handleGenerate}
                  onRegenerate={handleRegenerate}
                  isGenerating={isGenerating}
                  regeneratingIndex={regeneratingIndex}
                />
              )}

              <div className={`flashcard-rating-panel ${isFlipped ? "revealed" : ""}`}>
                {!isFlipped ? (
                  <div className="flashcard-pre-reveal-actions">
                    <button className="flashcard-reveal-btn" onClick={handleFlip}>
                      {t("showAnswer")}
                    </button>
                    <button
                      className={`flashcard-examples-toggle-btn${showExamples ? " active" : ""}`}
                      onClick={handleToggleExamples}
                      disabled={isGenerating}
                    >
                      <MessageSquare size={14} />
                      {showExamples ? t("hideExamples") : t("showExamples")}
                    </button>
                  </div>
                ) : (
                  <div className="flashcard-post-reveal-actions">
                    <div className="flashcard-rating-grid">
                      <button className="rating-btn again" onClick={() => handleRate(0)}>
                        <span className="rating-btn-lbl">{t("again")}</span>
                      </button>
                      <button className="rating-btn hard" onClick={() => handleRate(1)}>
                        <span className="rating-btn-lbl">{t("hard")}</span>
                      </button>
                      <button className="rating-btn good" onClick={() => handleRate(3)}>
                        <span className="rating-btn-lbl">{t("good")}</span>
                      </button>
                      <button className="rating-btn easy" onClick={() => handleRate(5)}>
                        <span className="rating-btn-lbl">{t("easy")}</span>
                      </button>
                    </div>
                    <div className="flashcard-pre-reveal-actions" style={{ marginTop: 0 }}>
                      {currentWord?.dictionaryPealimId && (
                        <button
                          type="button"
                          className="flashcard-examples-toggle-btn compact"
                          onClick={() => setDetailsPealimId(currentWord.dictionaryPealimId!)}
                        >
                          <BookOpen size={14} />
                          {t("viewConjugations")}
                        </button>
                      )}
                      <button
                        className={`flashcard-examples-toggle-btn compact${showExamples ? " active" : ""}`}
                        onClick={handleToggleExamples}
                        disabled={isGenerating}
                      >
                        <MessageSquare size={14} />
                        {showExamples ? t("hideExamples") : t("showExamples")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flashcard-start-screen">
              {stats.due > 0 && !isPremium && stats.reviewedToday > 0 ? (
                <>
                  <div className="flashcard-illustration-circle fc-session-done">
                    <Sparkles size={28} />
                  </div>
                  <h2>{t("sessionComplete")}</h2>
                  <p>{t("sessionCompleteSub")}</p>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
                    {t("flashcardsLimitDesc")}
                  </p>
                  <button
                    className="flashcard-start-btn fc-upgrade-btn"
                    onClick={onRequireSubscription}
                  >
                    <Sparkles size={15} /> {t("upgradePrice")}
                  </button>
                </>
              ) : stats.due > 0 ? (
                <>
                  <div className="flashcard-illustration-circle">
                    <ArrowLeftRight size={28} />
                  </div>
                  <h2>{t("reverseSession")}</h2>
                  <p>
                    {t("reviewDueWords", {
                      count: stats.due,
                      wordLabel: stats.due === 1 ? t("word") : t("words"),
                    })}
                  </p>
                  <button className="flashcard-start-btn" onClick={startSession}>
                    {t("startReverseSession")} ({Math.min(stats.due, 20)})
                  </button>
                </>
              ) : (
                <>
                  <div className="flashcard-illustration-circle">
                    <Sparkles size={28} />
                  </div>
                  <h2>{t("allCaughtUp")}</h2>
                  <p>{t("noCardsDue")}</p>
                  {stats.active > 0 && stats.nextReviewAt && (
                    <p style={{ fontSize: "14px", color: "var(--text-muted)", marginTop: "4px" }}>
                      {t("nextReview")}:{" "}
                      <strong>{formatNextReview(stats.nextReviewAt, t("soon"))}</strong>
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {viewTab === "learned" && (
        <div className="flashcards-learned-wrapper">
          {learnedCards.length === 0 ? (
            <div className="vocab-empty-container">
              <Sparkles size={36} className="vocab-empty-icon" />
              <h3 className="vocab-empty-title">{t("noLearnedWords")}</h3>
              <p className="vocab-empty-text">{t("noLearnedWordsSub")}</p>
            </div>
          ) : (
            <div className="vocab-words-container">
              <div className="vocab-words-grid">
                {learnedCards.map((card) => {
                  const vw = card.vocabWord;
                  return (
                    <div className="vocab-card" key={vw.id}>
                      <div className="vocab-card-header">
                        <span className="vocab-learned-badge">
                          <Sparkles size={11} style={{ marginRight: "4px" }} />
                          {t("learned")}
                        </span>
                        <button
                          className="vocab-action-btn delete"
                          onClick={() => unlearnWord(vw.id)}
                          title={t("unlearn")}
                        >
                          <RotateCcw size={14} />
                        </button>
                      </div>
                      <div className="vocab-card-body">
                        <div className="vocab-card-hebrew-container">
                          <span className="font-serif vocab-card-hebrew" dir="rtl" lang="he">
                            {vw.wordWithNekudot || vw.word}
                          </span>
                        </div>
                      </div>
                      <div className="vocab-card-translation">{vw.translation}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <DictionaryDetailsModal
        isOpen={detailsPealimId !== null}
        pealimId={detailsPealimId}
        onClose={() => setDetailsPealimId(null)}
      />
    </div>
  );
}
