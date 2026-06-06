"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { PanelLeftClose, PanelLeft, BookOpen, Sparkles, X, Eye, EyeOff, RotateCcw, ListTree } from "lucide-react";
import type { Episode, EpisodeListItem, Level, VocabWord } from "@/lib/types";
import {
  buildLevelTrackMeta,
  readLastEpisodesByLevel,
  resolveResumeEpisode,
  writeLastEpisodeForLevel,
} from "@/lib/levelTracks";
import Sidebar from "./Sidebar";
import EpisodeViewer from "./EpisodeViewer";
import VocabularyView from "./VocabularyView";
import FlashcardsView from "./FlashcardsView";
import MediaPlayer from "./MediaPlayer";
import AuthModal from "./AuthModal";
import { useVocabulary } from "@/hooks/useVocabulary";
import { useFlashcards } from "@/hooks/useFlashcards";
import { useUser } from "@/hooks/useUser";
import { useEntitlements } from "@/hooks/useEntitlements";
import { supabase } from "@/lib/supabase";
import OnboardingOverlay from "./OnboardingOverlay";
import { useFinishedEpisodes } from "@/hooks/useFinishedEpisodes";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { generateExamplePhrases } from "@/app/actions";

type AppShellProps = {
  levels: Level[];
  defaultLevel: string;
  episodeList: EpisodeListItem[];
  initialEpisode: Episode | null;
};

export default function AppShell({
  levels,
  defaultLevel,
  episodeList,
  initialEpisode,
}: AppShellProps) {
  const [currentLevel, setCurrentLevel] = useState(defaultLevel);
  const [episode, setEpisode] = useState<Episode | null>(initialEpisode);
  const [currentEpNum, setCurrentEpNum] = useState<number | null>(
    initialEpisode?.episode ?? null
  );
  const [viewMode, setViewMode] = useState<"episodes" | "vocabulary" | "flashcards">("episodes");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [subscriptionPrompt, setSubscriptionPrompt] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const [isEnglishBlurred, setIsEnglishBlurred] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<"login" | "signup">("login");
  const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({
    episodes: 0,
    vocabulary: 0,
    flashcards: 0,
  });
  const [lastEpisodesByLevel, setLastEpisodesByLevel] = useState<Record<string, number>>({});
  const [isEpisodeLoading, setIsEpisodeLoading] = useState(false);
  const [episodeLoadError, setEpisodeLoadError] = useState<string | null>(null);
  const [reviewStartSignal, setReviewStartSignal] = useState(0);

  const mainRef = useRef<HTMLElement>(null);
  const { vocabWords, addWord, deleteWord, updateWord } = useVocabulary();
  const { 
    learnedCards, 
    sessionQueue, 
    isProgressLoaded, 
    submitReview, 
    unlearnWord, 
    stats 
  } = useFlashcards(vocabWords);
  const { user } = useUser();
  const { shouldShow: shouldShowOnboarding, dismiss: dismissOnboarding } = useOnboarding();
  const { entitlements, isLoading: isLoadingEntitlements } = useEntitlements();
  const { finishedEpisodes, isFinished, toggleFinished } = useFinishedEpisodes();
  useUsageTracking();

  const levelEpisodes = episodeList.filter((ep) => ep.level === currentLevel);

  const levelTrackMeta = useMemo(
    () =>
      buildLevelTrackMeta(
        levels,
        episodeList,
        finishedEpisodes,
        currentLevel,
        lastEpisodesByLevel
      ),
    [levels, episodeList, finishedEpisodes, currentLevel, lastEpisodesByLevel]
  );

  const currentLevelName =
    levels.find((l) => l.slug === currentLevel)?.name ??
    currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1);

  useEffect(() => {
    const storedLastEpisodes = readLastEpisodesByLevel();
    setLastEpisodesByLevel(storedLastEpisodes);

    const storedLevel = window.localStorage.getItem("hebrewtime-level");
    if (storedLevel && levels.some((l) => l.slug === storedLevel)) {
      setCurrentLevel(storedLevel);
      if (initialEpisode && storedLevel !== initialEpisode.level) {
        const resumeEpisode = resolveResumeEpisode(
          storedLevel,
          episodeList,
          storedLastEpisodes
        );
        if (resumeEpisode != null) {
          void navigateToEpisode(storedLevel, resumeEpisode);
        }
      }
    } else if (initialEpisode) {
      writeLastEpisodeForLevel(initialEpisode.level, initialEpisode.episode);
      setLastEpisodesByLevel((prev) => ({
        ...prev,
        [initialEpisode.level]: initialEpisode.episode,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.localStorage.setItem("hebrewtime-level", currentLevel);
  }, [currentLevel]);

  // Responsive
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 800;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Scroll detection for top nav
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const handleScroll = () => setIsScrolled(el.scrollTop > 10);
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Persist English blur preference across sessions.
  useEffect(() => {
    const stored = window.localStorage.getItem("blur-english-translations");
    if (stored === "1") {
      setIsEnglishBlurred(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "blur-english-translations",
      isEnglishBlurred ? "1" : "0"
    );
  }, [isEnglishBlurred]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const handleWordSaved = useCallback(
    async (word: Omit<VocabWord, "id" | "savedAt">) => {
      const res = await addWord(word);
      if (res.type === "auth_required") {
        setAuthInitialMode("login");
        setIsAuthModalOpen(true);
      } else {
        showToast(res.message);
      }
      return res;
    },
    [addWord, showToast]
  );

  const showSubscriptionPrompt = useCallback(
    (source: "vocabulary" | "translation" | "flashcards") => {
      if (source === "vocabulary") {
        setSubscriptionPrompt({
          title: "Unlock Vocabulary",
          description:
            "Join the subscription for $10/month to access your synced vocabulary list across devices.",
        });
        return;
      }
      if (source === "flashcards") {
        setSubscriptionPrompt({
          title: "Unlock Flashcards",
          description:
            "Join the subscription for $10/month to unlock the spaced repetition review system.",
        });
        return;
      }
      setSubscriptionPrompt({
        title: "Unlock Word Tools",
        description:
          "Join the subscription for $10/month to translate words in context and save them to vocabulary.",
      });
    },
    []
  );

  const generateExamples = useCallback(
    async (word: VocabWord): Promise<{ ok: boolean; message?: string }> => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const res = await generateExamplePhrases(
        accessToken,
        word.wordWithNekudot || word.word,
        word.translation,
        3
      );

      if (res.type === "auth_required") {
        setAuthInitialMode("login");
        setIsAuthModalOpen(true);
        return { ok: false, message: "Please log in to generate examples." };
      }
      if (res.type === "premium_required") {
        showSubscriptionPrompt("vocabulary");
        return { ok: false, message: "Premium subscription required." };
      }
      if (res.type === "error" || res.phrases.length === 0) {
        return { ok: false, message: "Failed to generate examples. Please try again." };
      }

      const updateRes = await updateWord(word.id, { examplePhrases: res.phrases });
      if (!updateRes?.updated) {
        return { ok: false, message: updateRes?.message || "Failed to save examples." };
      }
      return { ok: true };
    },
    [updateWord, showSubscriptionPrompt]
  );

  const regenerateExample = useCallback(
    async (word: VocabWord, index: number): Promise<{ ok: boolean; message?: string }> => {
      const existing = word.examplePhrases || [];
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const res = await generateExamplePhrases(
        accessToken,
        word.wordWithNekudot || word.word,
        word.translation,
        1,
        existing
      );

      if (res.type === "auth_required") {
        setAuthInitialMode("login");
        setIsAuthModalOpen(true);
        return { ok: false, message: "Please log in to regenerate examples." };
      }
      if (res.type === "premium_required") {
        showSubscriptionPrompt("vocabulary");
        return { ok: false, message: "Premium subscription required." };
      }
      if (res.type === "error" || res.phrases.length === 0) {
        return { ok: false, message: "Failed to regenerate example. Please try again." };
      }

      const updatedPhrases = [...existing];
      updatedPhrases[index] = res.phrases[0];

      const updateRes = await updateWord(word.id, { examplePhrases: updatedPhrases });
      if (!updateRes?.updated) {
        return { ok: false, message: updateRes?.message || "Failed to save example." };
      }
      return { ok: true };
    },
    [updateWord, showSubscriptionPrompt]
  );

  const effectiveViewMode =
    (viewMode === "vocabulary" || viewMode === "flashcards") && !entitlements.isPremium && !isLoadingEntitlements 
      ? "episodes" 
      : viewMode;

  const handleChangeViewMode = useCallback(
    (mode: "episodes" | "vocabulary" | "flashcards") => {
      if (mode === "vocabulary" && !entitlements.isPremium && !isLoadingEntitlements) {
        showSubscriptionPrompt("vocabulary");
        return;
      }
      if (mode === "flashcards" && !entitlements.isPremium && !isLoadingEntitlements) {
        showSubscriptionPrompt("flashcards");
        return;
      }
      
      if (mainRef.current) {
        const currentScroll = mainRef.current.scrollTop;
        setScrollPositions((prev: Record<string, number>) => ({
          ...prev,
          [effectiveViewMode]: currentScroll
        }));
      }

      setViewMode(mode);
    },
    [entitlements.isPremium, isLoadingEntitlements, showSubscriptionPrompt, effectiveViewMode]
  );

  useEffect(() => {
    if (mainRef.current) {
      // Use a timeout to ensure the new view has rendered its content
      setTimeout(() => {
        if (mainRef.current) {
          mainRef.current.scrollTop = scrollPositions[effectiveViewMode] || 0;
        }
      }, 10);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveViewMode]);

  const navigateToEpisode = useCallback(
    async (level: string, num: number) => {
      setCurrentLevel(level);
      setCurrentEpNum(num);
      setEpisodeLoadError(null);
      setIsEpisodeLoading(true);
      if (isMobile) setIsSidebarOpen(false);

      setScrollPositions((prev: Record<string, number>) => ({ ...prev, episodes: 0 }));

      try {
        const res = await fetch(`/api/episode/${level}/${num}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          setEpisode(data);
          writeLastEpisodeForLevel(level, num);
          setLastEpisodesByLevel((prev) => ({ ...prev, [level]: num }));
        } else {
          setEpisodeLoadError("Could not load this episode. Please try again.");
          showToast("Could not load this episode. Please try again.");
        }
      } catch {
        setEpisodeLoadError("Could not load this episode. Please try again.");
        showToast("Could not load this episode. Please try again.");
      } finally {
        setIsEpisodeLoading(false);
      }

      setTimeout(() => {
        mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      }, 50);
    },
    [isMobile, showToast]
  );

  const handleChangeLevel = useCallback(
    async (level: string) => {
      setCurrentLevel(level);
      const resumeEpisode = resolveResumeEpisode(
        level,
        episodeList,
        lastEpisodesByLevel
      );
      if (resumeEpisode != null) {
        await navigateToEpisode(level, resumeEpisode);
      } else {
        setEpisode(null);
        setCurrentEpNum(null);
        setEpisodeLoadError(null);
      }
    },
    [episodeList, navigateToEpisode, lastEpisodesByLevel]
  );

  const currentIndex = levelEpisodes.findIndex((e) => e.episode === currentEpNum);

  const resumeEpNum = resolveResumeEpisode(
    currentLevel,
    episodeList,
    lastEpisodesByLevel
  );
  const hasResumeProgress =
    lastEpisodesByLevel[currentLevel] != null &&
    levelEpisodes.some((e) => e.episode === lastEpisodesByLevel[currentLevel]);

  const handleNavigate = useCallback(
    (direction: "prev" | "next") => {
      const newIndex =
        direction === "prev" ? currentIndex - 1 : currentIndex + 1;
      if (newIndex >= 0 && newIndex < levelEpisodes.length) {
        navigateToEpisode(currentLevel, levelEpisodes[newIndex].episode);
      }
    },
    [currentIndex, levelEpisodes, navigateToEpisode, currentLevel]
  );

  return (
    <div className={`app-container ${isMobile && isSidebarOpen ? "mobile-sidebar-open" : ""}`}>
      <Sidebar
        levelTracks={levelTrackMeta}
        onChangeLevel={handleChangeLevel}
        episodes={episodeList}
        currentLevel={currentLevel}
        currentEpNum={currentEpNum}
        viewMode={effectiveViewMode}
        vocabCount={vocabWords.length}
        dueFlashcardsCount={stats.due}
        flashcardStats={stats}
        onStartReview={() => {
          handleChangeViewMode("flashcards");
          setReviewStartSignal((s) => s + 1);
        }}
        isSidebarOpen={isSidebarOpen}
        onSelectEpisode={navigateToEpisode}
        onChangeViewMode={handleChangeViewMode}
        onClose={() => setIsSidebarOpen(false)}
        onOpenAuthModal={() => {
          setAuthInitialMode("login");
          setIsAuthModalOpen(true);
        }}
        isPremium={entitlements.isPremium}
        isLoadingEntitlements={isLoadingEntitlements}
        isAdmin={entitlements.isAdmin}
        onOpenAdminModal={() => window.open("/admin", "_blank", "noopener,noreferrer")}
        finishedEpisodes={finishedEpisodes}
      />

      <main className="main-content" ref={mainRef}>
        <div className={`top-nav ${isScrolled ? "scrolled" : ""}`}>
          <button
            className="toggle-sidebar-btn"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {isSidebarOpen ? (
              <PanelLeftClose size={20} />
            ) : (
              <PanelLeft size={20} />
            )}
          </button>

          {effectiveViewMode === "episodes" && episode && (
            <button
              className={`english-toggle-btn ${isEnglishBlurred ? "active" : ""}`}
              onClick={() => setIsEnglishBlurred((prev) => !prev)}
              aria-pressed={isEnglishBlurred}
              title={
                isEnglishBlurred
                  ? "Show English translations"
                  : "Hide English translations"
              }
            >
              {isEnglishBlurred ? <EyeOff size={14} /> : <Eye size={14} />}
              {isEnglishBlurred ? "English hidden" : "English shown"}
            </button>
          )}

          <div className="topnav-actions">
            {!user ? (
              <button
                className="topnav-login-btn"
                onClick={() => {
                  setAuthInitialMode("login");
                  setIsAuthModalOpen(true);
                }}
              >
                Log In
              </button>
            ) : (
              <>
                <span className="topnav-email" title={user.email}>
                  {user.email}
                </span>
                <button
                  className="topnav-signout-btn"
                  onClick={() => supabase.auth.signOut()}
                >
                  Sign Out
                </button>
              </>
            )}
          </div>
        </div>

        {subscriptionPrompt && (
          <div
            className="subscription-prompt-overlay"
            role="presentation"
            onClick={() => setSubscriptionPrompt(null)}
          >
            <div
              className="subscription-prompt"
              role="dialog"
              aria-modal="true"
              aria-labelledby="subscription-prompt-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="subscription-prompt-icon">
                <Sparkles size={18} />
              </div>
              <div className="subscription-prompt-copy">
                <p id="subscription-prompt-title" className="subscription-prompt-title">
                  {subscriptionPrompt.title}
                </p>
                <p className="subscription-prompt-description">{subscriptionPrompt.description}</p>
              </div>
              <div className="subscription-prompt-actions">
                <button
                  className="subscription-prompt-cta"
                  onClick={() => {
                    setSubscriptionPrompt(null);
                    setAuthInitialMode("signup");
                    setIsAuthModalOpen(true);
                  }}
                >
                  Start for $10/month
                </button>
                {!user && (
                  <button
                    className="subscription-prompt-login"
                    onClick={() => {
                      setSubscriptionPrompt(null);
                      setAuthInitialMode("login");
                      setIsAuthModalOpen(true);
                    }}
                  >
                    Already premium? Log in
                  </button>
                )}
              </div>
              <button
                className="subscription-prompt-close"
                onClick={() => setSubscriptionPrompt(null)}
                title="Dismiss"
                aria-label="Dismiss premium prompt"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {effectiveViewMode === "vocabulary" ? (
          <VocabularyView
            vocabWords={vocabWords}
            onDeleteWord={deleteWord}
            onEditWord={async (id, updates) => {
              const res = await updateWord(id, updates);
              if (res) showToast(res.message);
            }}
            isPremium={entitlements.isPremium}
            generateExamples={generateExamples}
            regenerateExample={regenerateExample}
          />
        ) : effectiveViewMode === "flashcards" ? (
          <FlashcardsView
            vocabWords={vocabWords}
            learnedCards={learnedCards}
            sessionQueue={sessionQueue}
            isLoaded={isProgressLoaded}
            submitReview={submitReview}
            unlearnWord={unlearnWord}
            stats={stats}
            startSignal={reviewStartSignal}
            generateExamples={generateExamples}
            regenerateExample={regenerateExample}
          />
        ) : isEpisodeLoading ? (
          <div className="empty-state">
            <div className="empty-state-spinner" aria-hidden="true" />
            <p>Loading episode…</p>
          </div>
        ) : episodeLoadError && !episode ? (
          <div className="empty-state">
            <BookOpen size={48} strokeWidth={1} />
            <p>{episodeLoadError}</p>
            <div className="empty-state-actions">
              {currentEpNum != null && (
                <button
                  className="empty-state-btn primary"
                  onClick={() => navigateToEpisode(currentLevel, currentEpNum)}
                >
                  <RotateCcw size={16} />
                  Try again
                </button>
              )}
              <button
                className="empty-state-btn secondary"
                onClick={() => setIsSidebarOpen(true)}
              >
                <ListTree size={16} />
                Browse episodes
              </button>
            </div>
          </div>
        ) : !episode ? (
          <div className="empty-state">
            <BookOpen size={48} strokeWidth={1} />
            <p>
              {levelEpisodes.length > 0
                ? `Pick up where you left off in ${currentLevelName}, or browse the full list.`
                : "No episodes are available for this level yet."}
            </p>
            {levelEpisodes.length > 0 && (
              <div className="empty-state-actions">
                {resumeEpNum != null && (
                  <button
                    className="empty-state-btn primary"
                    onClick={() => navigateToEpisode(currentLevel, resumeEpNum)}
                  >
                    <BookOpen size={16} />
                    {hasResumeProgress
                      ? `Resume Episode ${String(resumeEpNum).padStart(2, "0")}`
                      : "Start reading"}
                  </button>
                )}
                <button
                  className="empty-state-btn secondary"
                  onClick={() => setIsSidebarOpen(true)}
                >
                  <ListTree size={16} />
                  Browse episodes
                </button>
              </div>
            )}
          </div>
        ) : (
          <div key={`episode-${episode.level}-${episode.episode}`}>
            <EpisodeViewer
              episode={episode}
              levelDisplayName={
                levels.find((l) => l.slug === episode.level)?.name ?? currentLevelName
              }
              hasPrev={currentIndex > 0}
              hasNext={
                currentIndex !== -1 &&
                currentIndex < levelEpisodes.length - 1
              }
              onNavigate={handleNavigate}
              onWordSaved={handleWordSaved}
              onToast={showToast}
              isPremium={entitlements.isPremium}
              isAuthenticated={entitlements.isAuthenticated}
              isLoadingEntitlements={isLoadingEntitlements}
              onRequireAuth={() => {
                setAuthInitialMode("login");
                setIsAuthModalOpen(true);
              }}
              onRequireSubscription={() => showSubscriptionPrompt("translation")}
              isEnglishBlurred={isEnglishBlurred}
              isFinished={episode ? isFinished(episode.level, episode.episode) : false}
              onToggleFinished={() => {
                if (episode) toggleFinished(episode.level, episode.episode);
              }}
            />
          </div>
        )}
      </main>

      {/* Toast Notification */}
      <div className={`toast ${toast ? "visible" : ""}`}>{toast}</div>

      {/* Sticky Media Player */}
      <MediaPlayer
        audioUrl={episode?.audio_url ?? null}
        episodeTitle={episode?.title ?? null}
        episodeNum={episode?.episode ?? null}
        episodeLevel={episode?.level ?? currentLevel}
        isSidebarOpen={isSidebarOpen}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authInitialMode}
        onClose={() => setIsAuthModalOpen(false)}
      />
      <OnboardingOverlay
        isOpen={shouldShowOnboarding}
        onDismiss={dismissOnboarding}
        onGetStarted={dismissOnboarding}
      />
    </div>
  );
}
