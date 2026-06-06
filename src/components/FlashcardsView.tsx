"use client";

import { useState, useEffect } from "react";
import {
  Brain,
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
} from "lucide-react";
import type {
  VocabWord,
  FlashcardItem,
  FlashcardRating,
  FlashcardStats,
} from "@/lib/types";
import ExamplePhrasesPanel from "./ExamplePhrasesPanel";

function formatNextReview(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return "Soon";
  const mins = Math.ceil(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.ceil(mins / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.ceil(hours / 24);
  return `${days}d`;
}

type FlashcardsViewProps = {
  vocabWords: VocabWord[];
  learnedCards: FlashcardItem[];
  sessionQueue: FlashcardItem[];
  isLoaded: boolean;
  submitReview: (vocabId: string, rating: FlashcardRating) => Promise<void>;
  unlearnWord: (vocabId: string) => Promise<void>;
  stats: FlashcardStats;
  startSignal?: number;
  generateExamples: (word: VocabWord) => Promise<{ ok: boolean; message?: string }>;
  regenerateExample: (word: VocabWord, index: number) => Promise<{ ok: boolean; message?: string }>;
  isPremium?: boolean;
  onRequireSubscription?: () => void;
};

export default function FlashcardsView({
  vocabWords,
  learnedCards,
  sessionQueue,
  isLoaded,
  submitReview,
  unlearnWord,
  stats,
  startSignal = 0,
  generateExamples,
  regenerateExample,
  isPremium = false,
  onRequireSubscription,
}: FlashcardsViewProps) {
  const [sessionActive, setSessionActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [viewTab, setViewTab] = useState<"session" | "learned">("session");
  const [showExamples, setShowExamples] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);

  const currentWord = sessionQueue[currentIndex]?.vocabWord;

  const startSession = () => {
    if (sessionQueue.length > 0) {
      setCurrentIndex(0);
      setIsFlipped(false);
      setShowExamples(false);
      setSessionActive(true);
      setViewTab("session");
    }
  };

  // Launch a session when the sidebar "Start review" CTA bumps the signal.
  useEffect(() => {
    if (startSignal > 0 && sessionQueue.length > 0) {
      setCurrentIndex(0);
      setIsFlipped(false);
      setShowExamples(false);
      setSessionActive(true);
      setViewTab("session");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSignal]);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleRate = (rating: FlashcardRating) => {
    if (!sessionQueue[currentIndex]) return;
    
    // Submit review in the background (runs optimistically)
    submitReview(sessionQueue[currentIndex].vocabWord.id, rating);
    
    // Reset flip state for the next card immediately
    setIsFlipped(false);
    setShowExamples(false);
    
    if (currentIndex + 1 < sessionQueue.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setSessionActive(false);
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

  if (!isLoaded) {
    return (
      <div className="vocab-loading" style={{ height: "400px", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div className="vocab-spinner"></div>
      </div>
    );
  }

  // 1. Empty state: no vocab saved yet
  if (vocabWords.length === 0) {
    return (
      <div className="vocab-empty-container">
        <Brain size={48} className="vocab-empty-icon" />
        <h3 className="vocab-empty-title">Your Flashcard Deck is Empty</h3>
        <p className="vocab-empty-text">
          Save words from episode translations first to build your custom flashcard deck!
        </p>
      </div>
    );
  }

  return (
    <div className="flashcards-container">
      {/* Stats dashboard */}
      <div className="flashcards-stats-dashboard">
        <div className="flashcard-stat-tile highlight-due">
          <Flame size={14} className="flashcard-stat-icon-due" />
          <span className="stat-label">Due</span>
          <span className="stat-value">{stats.due}</span>
        </div>

        <div className="flashcard-stat-tile">
          <PlusCircle size={14} className="flashcard-stat-icon-new" />
          <span className="stat-label">New</span>
          <span className="stat-value">{stats.newCount}</span>
        </div>

        <div className="flashcard-stat-tile">
          <BookOpen size={14} className="flashcard-stat-icon-active" />
          <span className="stat-label">Learning</span>
          <span className="stat-value">{stats.learning}</span>
        </div>

        <div className="flashcard-stat-tile">
          <Check size={14} className="flashcard-stat-icon-learned" />
          <span className="stat-label">Learned</span>
          <span className="stat-value">
            {stats.learned}
            <span className="stat-total">/{stats.total}</span>
          </span>
        </div>

        <div className="flashcard-stat-tile">
          <Clock size={14} className="flashcard-stat-icon-today" />
          <span className="stat-label">Today</span>
          <span className="stat-value">{stats.reviewedToday}</span>
        </div>

        <div className="flashcard-stat-tile">
          <TrendingUp size={14} className="flashcard-stat-icon-recall" />
          <span className="stat-label">Avg Recall</span>
          <span className="stat-value">{stats.avgRecall}%</span>
        </div>

        {stats.due === 0 && stats.nextReviewAt && (
          <div className="flashcard-stat-tile">
            <CalendarClock size={14} className="flashcard-stat-icon-eta" />
            <span className="stat-label">Next Review</span>
            <span className="stat-value">{formatNextReview(stats.nextReviewAt)}</span>
          </div>
        )}

        <div className="flashcard-stat-tile mastery-tile">
          <Sparkles size={14} className="flashcard-stat-icon-progress" />
          <span className="stat-label">Mastery</span>
          <div className="flashcard-compact-progress">
            <div className="flashcard-stat-progress-bg">
              <div
                className="flashcard-stat-progress-fill"
                style={{ width: `${stats.progressPercent}%` }}
              ></div>
            </div>
            <span className="progress-percent">{stats.progressPercent}%</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      {!sessionActive && (
        <div className="vocab-filters-bar">
          <div className="vocab-view-tabs">
            <button 
              className={`vocab-filter-btn ${viewTab === "session" ? "active" : ""}`}
              onClick={() => setViewTab("session")}
            >
              <Brain size={14} className="vocab-filter-icon" />
              Review Session
            </button>
            <button 
              className={`vocab-filter-btn ${viewTab === "learned" ? "active" : ""}`}
              onClick={() => setViewTab("learned")}
            >
              <Check size={14} className="vocab-filter-icon" />
              Learned Words ({stats.learned})
            </button>
          </div>
        </div>
      )}

      {/* 2. Review Session Tab */}
      {viewTab === "session" && (
        <div className="flashcards-session-wrapper">
          {sessionActive ? (
            <div className="flashcard-session-active">
              {/* Session Progress Header */}
              <div className="flashcard-session-progress">
                <span>Card {currentIndex + 1} of {sessionQueue.length}</span>
                <div className="flashcard-session-progress-bar">
                  <div 
                    className="flashcard-session-progress-fill" 
                    style={{ width: `${((currentIndex) / sessionQueue.length) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* 3D Flip Card Container */}
              <div
                className="flashcard-card-scene"
                key={currentIndex}
                onClick={handleFlip}
                role="button"
                tabIndex={0}
                aria-label={isFlipped ? "Flip card back" : "Flip card to see translation"}
                onKeyDown={(e) => e.key === "Enter" || e.key === " " ? handleFlip() : undefined}
              >
                <div className={`flashcard-card-inner ${isFlipped ? "is-flipped" : ""}`}>
                  {/* Front Side (Hebrew word) */}
                  <div className="flashcard-card-front">
                    <span className="flashcard-badge-side">HEBREW</span>
                    <h2 className="font-serif flashcard-hebrew-word" dir="rtl">
                      {sessionQueue[currentIndex].vocabWord.wordWithNekudot || sessionQueue[currentIndex].vocabWord.word}
                    </h2>
                    {sessionQueue[currentIndex].vocabWord.verbFormWithNekudot && (
                      <span className="font-serif flashcard-verb-form" dir="rtl">
                        {sessionQueue[currentIndex].vocabWord.verbFormWithNekudot}
                      </span>
                    )}
                    <p className="flashcard-hint-click">Tap to reveal translation</p>
                  </div>

                  {/* Back Side (Translation & Details) */}
                  <div className="flashcard-card-back" onClick={(e) => e.stopPropagation()}>
                    <span className="flashcard-badge-side back">TRANSLATION</span>
                    <h3 className="flashcard-translation-word">
                      {sessionQueue[currentIndex].vocabWord.translation}
                    </h3>
                    
                    {sessionQueue[currentIndex].vocabWord.pronunciation && (
                      <p className="flashcard-pronunciation">
                        /{sessionQueue[currentIndex].vocabWord.pronunciation}/
                      </p>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", margin: "16px 0" }}>
                      <span className="font-serif flashcard-hebrew-word-small" dir="rtl">
                        {sessionQueue[currentIndex].vocabWord.wordWithNekudot || sessionQueue[currentIndex].vocabWord.word}
                      </span>
                      {sessionQueue[currentIndex].vocabWord.episodeTitle && (
                        <div className="vocab-card-source" style={{ border: "1px solid rgba(0,0,0,0.06)", padding: "4px 10px", borderRadius: "6px" }}>
                          {sessionQueue[currentIndex].vocabWord.episodeUrl ? (
                            <a href={sessionQueue[currentIndex].vocabWord.episodeUrl} target="_blank" rel="noopener noreferrer" className="vocab-source-link">
                              <ExternalLink size={11} className="vocab-source-icon" />
                              <span>{sessionQueue[currentIndex].vocabWord.episodeTitle}</span>
                            </a>
                          ) : (
                            <span>{sessionQueue[currentIndex].vocabWord.episodeTitle}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <p className="flashcard-hint-click" onClick={handleFlip}>Click card to flip back</p>
                  </div>
                </div>
              </div>

              {/* Example phrases panel (below card) */}
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

              {/* FSRS Interactive Rating Panel */}
              <div className={`flashcard-rating-panel ${isFlipped ? "revealed" : ""}`}>
                {!isFlipped ? (
                  <div className="flashcard-pre-reveal-actions">
                    <button className="flashcard-reveal-btn" onClick={handleFlip}>
                      Reveal Translation
                    </button>
                    <button
                      className={`flashcard-examples-toggle-btn${showExamples ? " active" : ""}`}
                      onClick={handleToggleExamples}
                      disabled={isGenerating}
                    >
                      <MessageSquare size={14} />
                      {showExamples ? "Hide examples" : "Show examples"}
                    </button>
                  </div>
                ) : (
                  <div className="flashcard-post-reveal-actions">
                    <div className="flashcard-rating-grid">
                      <button className="rating-btn again" onClick={() => handleRate(0)}>
                        <span className="rating-btn-lbl">Again</span>
                        <span className="rating-btn-desc">Forgot</span>
                      </button>
                      <button className="rating-btn hard" onClick={() => handleRate(1)}>
                        <span className="rating-btn-lbl">Hard</span>
                        <span className="rating-btn-desc">Unsure</span>
                      </button>
                      <button className="rating-btn good" onClick={() => handleRate(3)}>
                        <span className="rating-btn-lbl">Good</span>
                        <span className="rating-btn-desc">Hesitant</span>
                      </button>
                      <button className="rating-btn easy" onClick={() => handleRate(5)}>
                        <span className="rating-btn-lbl">Easy</span>
                        <span className="rating-btn-desc">Instant</span>
                      </button>
                    </div>
                    <button
                      className={`flashcard-examples-toggle-btn compact${showExamples ? " active" : ""}`}
                      onClick={handleToggleExamples}
                      disabled={isGenerating}
                    >
                      <MessageSquare size={14} />
                      {showExamples ? "Hide examples" : "Show examples"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flashcard-start-screen">
              {stats.due > 0 && !isPremium && stats.reviewedToday > 0 ? (
                /* Free user who already did a session today */
                <>
                  <div className="flashcard-illustration-circle fc-session-done">
                    <Sparkles size={28} />
                  </div>
                  <h2>Today&rsquo;s session complete!</h2>
                  <p>
                    You&rsquo;ve completed your free review session for today. Come back tomorrow to keep your streak going!
                  </p>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
                    Upgrade to Premium for unlimited daily review sessions.
                  </p>
                  <button
                    className="flashcard-start-btn fc-upgrade-btn"
                    onClick={onRequireSubscription}
                  >
                    <Sparkles size={15} /> Upgrade to Premium ($9.99)
                  </button>
                </>
              ) : stats.due > 0 ? (
                <>
                  <div className="flashcard-illustration-circle">
                    <Brain size={28} />
                  </div>
                  <h2>Ready to review Hebrew words?</h2>
                  <p>
                    You have <strong>{stats.due}</strong> {stats.due === 1 ? "word" : "words"} waiting for review in this session.
                  </p>
                  <button className="flashcard-start-btn" onClick={startSession}>
                    Start Review Session ({Math.min(stats.due, 20)} cards)
                  </button>
                </>
              ) : (
                <>
                  <div className="flashcard-illustration-circle">
                    <Sparkles size={28} />
                  </div>
                  <h2>All Caught Up!</h2>
                  <p>
                    Excellent! You have reviewed all active flashcards for now. Check back later for your next scheduled reviews.
                  </p>
                  {stats.active > 0 && stats.nextReviewAt && (
                    <p style={{ fontSize: "14px", color: "var(--text-muted)", marginTop: "4px" }}>
                      Next review in <strong>{formatNextReview(stats.nextReviewAt)}</strong> (FSRS scheduling).
                    </p>
                  )}
                  {stats.active > 0 && !stats.nextReviewAt && (
                    <p style={{ fontSize: "14px", color: "var(--text-muted)", marginTop: "4px" }}>
                      Review intervals are scheduled automatically using the FSRS algorithm.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. Learned Words Tab */}
      {viewTab === "learned" && (
        <div className="flashcards-learned-wrapper">
          {learnedCards.length === 0 ? (
            <div className="vocab-empty-container">
              <Sparkles size={36} className="vocab-empty-icon" />
              <h3 className="vocab-empty-title">No Learned Words Yet</h3>
              <p className="vocab-empty-text">
                Keep reviewing words in the Review Session! When your recall interval for a word exceeds 21 days, it will appear here as &ldquo;fully learned.&rdquo;
              </p>
            </div>
          ) : (
            <div className="vocab-words-container">
              <div className="vocab-words-grid">
                {learnedCards.map((card) => {
                  const vw = card.vocabWord;
                  return (
                    <div className="vocab-card" key={vw.id}>
                      <div className="vocab-card-header">
                        <div style={{ display: "flex", gap: "8px" }}>
                          <span className="vocab-learned-badge">
                            <Sparkles size={11} style={{ marginRight: "4px" }} />
                            Learned
                          </span>
                        </div>
                        <button 
                          className="vocab-action-btn delete" 
                          onClick={() => unlearnWord(vw.id)}
                          title="Reset learning progress and place back in active queue"
                        >
                          <RotateCcw size={14} />
                        </button>
                      </div>

                      <div className="vocab-card-body">
                        <div className="vocab-card-hebrew-container">
                          <span className="font-serif vocab-card-hebrew" dir="rtl">
                            {vw.wordWithNekudot || vw.word}
                          </span>
                          {vw.verbFormWithNekudot && (
                            <span className="font-serif vocab-card-verb" dir="rtl">
                              {vw.verbFormWithNekudot}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="vocab-card-translation">
                        <span style={{ display: "block", marginBottom: vw.pronunciation ? "4px" : "0" }}>
                          {vw.translation}
                        </span>
                        {vw.pronunciation && (
                          <span className="vocab-pronunciation-text" style={{ fontStyle: "italic", opacity: 0.8, fontSize: "13px", display: "block" }}>
                            {vw.pronunciation}
                          </span>
                        )}
                      </div>

                      {vw.episodeTitle && (
                        <div className="vocab-card-source">
                          {vw.episodeUrl ? (
                            <a href={vw.episodeUrl} target="_blank" rel="noopener noreferrer" className="vocab-source-link">
                              <ExternalLink size={11} className="vocab-source-icon" />
                              <span>{vw.episodeTitle}</span>
                            </a>
                          ) : (
                            <span>{vw.episodeTitle}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
