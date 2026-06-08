"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { PanelLeftClose, PanelLeft, BookOpen, Sparkles, X, Eye, EyeOff, RotateCcw, ListTree, Check } from "lucide-react";
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
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import LanguageSelector from "./LanguageSelector";
import type { MessageKey } from "@/lib/i18n/messages";

type AppShellProps = {
  levels: Level[];
  defaultLevel: string;
  episodeList: EpisodeListItem[];
  initialEpisode: Episode | null;
};

type SubscriptionPromptSource =
  | "vocab_limit"
  | "translation_limit"
  | "example_limit"
  | "flashcards";

const FREE_TIER_FEATURE_KEYS = [
  "freeFeature1",
  "freeFeature2",
  "freeFeature3",
  "freeFeature4",
  "freeFeature5",
] as const satisfies readonly MessageKey[];

const PREMIUM_TIER_FEATURE_KEYS = [
  "premiumFeature1",
  "premiumFeature2",
  "premiumFeature3",
  "premiumFeature4",
  "premiumFeature5",
] as const satisfies readonly MessageKey[];

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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { t, lang, isTranslationBlurred, toggleTranslationBlurred } = useLanguage();
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
  const { user } = useUser();
  const { entitlements, isLoading: isLoadingEntitlements } = useEntitlements();
  const { vocabWords, addWord, deleteWord, updateWord } = useVocabulary(entitlements.isPremium);
  const {
    learnedCards,
    sessionQueue,
    isProgressLoaded,
    submitReview,
    unlearnWord,
    stats
  } = useFlashcards(vocabWords);
  const { shouldShow: shouldShowOnboarding, dismiss: dismissOnboarding } = useOnboarding();
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

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const showSubscriptionPrompt = useCallback((source: SubscriptionPromptSource) => {
    if (source === "vocab_limit") {
      setSubscriptionPrompt({
        title: t("vocabLimitTitle"),
        description: t("vocabLimitDesc"),
      });
      return;
    }
    if (source === "translation_limit") {
      setSubscriptionPrompt({
        title: t("translationLimitTitle"),
        description: user
          ? t("translationLimitDescAuth")
          : t("translationLimitDescAnon"),
      });
      return;
    }
    if (source === "example_limit") {
      setSubscriptionPrompt({
        title: t("exampleLimitTitle"),
        description: t("exampleLimitDesc"),
      });
      return;
    }
    setSubscriptionPrompt({
      title: t("flashcardsLimitTitle"),
      description: t("flashcardsLimitDesc"),
    });
  }, [user, t]);

  const handleWordSaved = useCallback(
    async (word: Omit<VocabWord, "id" | "savedAt">) => {
      const res = await addWord(word);
      if (res.type === "auth_required") {
        setAuthInitialMode("login");
        setIsAuthModalOpen(true);
      } else if (res.type === "limit_reached") {
        showSubscriptionPrompt("vocab_limit");
      } else {
        showToast(res.message);
      }
      return res;
    },
    [addWord, showToast, showSubscriptionPrompt]
  );

  const generateExamples = useCallback(
    async (word: VocabWord): Promise<{ ok: boolean; message?: string }> => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const res = await generateExamplePhrases(
        accessToken,
        word.wordWithNekudot || word.word,
        word.translation,
        3,
        undefined,
        lang
      );

      if (res.type === "auth_required") {
        setAuthInitialMode("login");
        setIsAuthModalOpen(true);
        return { ok: false, message: t("pleaseLoginExamples") };
      }
      if (res.type === "limit_reached") {
        showSubscriptionPrompt("example_limit");
        return { ok: false, message: t("dailyExampleLimit") };
      }
      if (res.type === "error" || res.phrases.length === 0) {
        return { ok: false, message: t("failedGenerateExamples") };
      }

      const updateRes = await updateWord(word.id, { examplePhrases: res.phrases });
      if (!updateRes?.updated) {
        return { ok: false, message: updateRes?.message || t("failedSaveExamples") };
      }
      return { ok: true };
    },
    [updateWord, showSubscriptionPrompt, lang, t]
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
        existing,
        lang
      );

      if (res.type === "auth_required") {
        setAuthInitialMode("login");
        setIsAuthModalOpen(true);
        return { ok: false, message: t("pleaseLoginRegenerate") };
      }
      if (res.type === "limit_reached") {
        showSubscriptionPrompt("example_limit");
        return { ok: false, message: t("dailyExampleLimit") };
      }
      if (res.type === "error" || res.phrases.length === 0) {
        return { ok: false, message: t("failedRegenerate") };
      }

      const updatedPhrases = [...existing];
      updatedPhrases[index] = res.phrases[0];

      const updateRes = await updateWord(word.id, { examplePhrases: updatedPhrases });
      if (!updateRes?.updated) {
        return { ok: false, message: updateRes?.message || t("failedSaveExample") };
      }
      return { ok: true };
    },
    [updateWord, showSubscriptionPrompt, lang, t]
  );

  const handleChangeViewMode = useCallback(
    (mode: "episodes" | "vocabulary" | "flashcards") => {
      if (mainRef.current) {
        const currentScroll = mainRef.current.scrollTop;
        setScrollPositions((prev: Record<string, number>) => ({
          ...prev,
          [viewMode]: currentScroll
        }));
      }

      setViewMode(mode);

      // On mobile, close the sidebar after navigating so the content is visible
      if (isMobile) {
        setIsSidebarOpen(false);
      }
    },
    [viewMode, isMobile]
  );

  useEffect(() => {
    if (mainRef.current) {
      // Use a timeout to ensure the new view has rendered its content
      setTimeout(() => {
        if (mainRef.current) {
          mainRef.current.scrollTop = scrollPositions[viewMode] || 0;
        }
      }, 10);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

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
          setEpisodeLoadError(t("episodeLoadError"));
          showToast(t("episodeLoadError"));
        }
      } catch {
        setEpisodeLoadError(t("episodeLoadError"));
        showToast(t("episodeLoadError"));
      } finally {
        setIsEpisodeLoading(false);
      }

      setTimeout(() => {
        mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      }, 50);
    },
    [isMobile, showToast, t]
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
        viewMode={viewMode}
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
            title={isSidebarOpen ? t("closeSidebar") : t("openSidebar")}
          >
            {isSidebarOpen ? (
              <PanelLeftClose size={20} />
            ) : (
              <PanelLeft size={20} />
            )}
          </button>

          <LanguageSelector />

          {viewMode === "episodes" && episode && (
            <button
              className={`translation-toggle-btn ${isTranslationBlurred ? "active" : ""}`}
              onClick={toggleTranslationBlurred}
              aria-pressed={isTranslationBlurred}
              title={
                isTranslationBlurred ? t("showTranslations") : t("hideTranslations")
              }
            >
              {isTranslationBlurred ? <EyeOff size={14} /> : <Eye size={14} />}
              {isTranslationBlurred ? t("translationHidden") : t("translationShown")}
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
                {t("logIn")}
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
                  {t("signOut")}
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
              className="subscription-prompt subscription-prompt--comparison"
              role="dialog"
              aria-modal="true"
              aria-labelledby="subscription-prompt-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="subscription-prompt-close"
                onClick={() => setSubscriptionPrompt(null)}
                title={t("dismiss")}
                aria-label={t("dismissPremium")}
              >
                <X size={16} />
              </button>

              <div className="subscription-prompt-header">
                <div className="subscription-prompt-icon">
                  <Sparkles size={18} />
                </div>
                <div className="subscription-prompt-copy">
                  <p id="subscription-prompt-title" className="subscription-prompt-title">
                    {subscriptionPrompt.title}
                  </p>
                  <p className="subscription-prompt-description">{subscriptionPrompt.description}</p>
                </div>
              </div>

              <div className="tier-comparison">
                <div className="tier-card tier-card--free">
                  <div className="tier-card-header">
                    <span className="tier-card-label">{t("free")}</span>
                    <span className="tier-card-price">$0</span>
                  </div>
                  <ul className="tier-feature-list">
                    {FREE_TIER_FEATURE_KEYS.map((key) => (
                      <li key={key}>
                        <Check size={14} className="tier-feature-icon" aria-hidden="true" />
                        <span>{t(key)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="tier-card tier-card--premium">
                  <div className="tier-card-badge">{t("recommended")}</div>
                  <div className="tier-card-header">
                    <span className="tier-card-label">{t("premium")}</span>
                    <span className="tier-card-price">
                      $9.99<span className="tier-card-price-unit">{t("perMonth")}</span>
                    </span>
                  </div>
                  <ul className="tier-feature-list">
                    {PREMIUM_TIER_FEATURE_KEYS.map((key) => (
                      <li key={key}>
                        <Check size={14} className="tier-feature-icon tier-feature-icon--premium" aria-hidden="true" />
                        <span>{t(key)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
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
                  {t("upgradePrice")}
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
                    {t("alreadyPremiumLogIn")}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {viewMode === "vocabulary" ? (
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
        ) : null}

        {/* Keep mounted while reviewing so in-progress session state survives tab switches */}
        <div hidden={viewMode !== "flashcards"}>
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
            isPremium={entitlements.isPremium}
            onRequireSubscription={() => showSubscriptionPrompt("flashcards")}
          />
        </div>

        {viewMode === "episodes" &&
          (isEpisodeLoading ? (
            <div className="empty-state">
              <div className="empty-state-spinner" aria-hidden="true" />
              <p>{t("loadingEpisode")}</p>
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
                    {t("tryAgain")}
                  </button>
                )}
                <button
                  className="empty-state-btn secondary"
                  onClick={() => setIsSidebarOpen(true)}
                >
                  <ListTree size={16} />
                  {t("browseEpisodes")}
                </button>
              </div>
            </div>
          ) : !episode ? (
            <div className="empty-state">
              <BookOpen size={48} strokeWidth={1} />
              <p>
                {levelEpisodes.length > 0
                  ? t("pickUpWhereLeftOff", { level: currentLevelName })
                  : t("noEpisodesForLevel")}
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
                        ? t("resumeEpisode", { num: String(resumeEpNum).padStart(2, "0") })
                        : t("startReading")}
                    </button>
                  )}
                  <button
                    className="empty-state-btn secondary"
                    onClick={() => setIsSidebarOpen(true)}
                  >
                    <ListTree size={16} />
                    {t("browseEpisodes")}
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
                onRequireSubscription={() => showSubscriptionPrompt("translation_limit")}
                isFinished={episode ? isFinished(episode.level, episode.episode) : false}
                onToggleFinished={() => {
                  if (episode) toggleFinished(episode.level, episode.episode);
                }}
              />
            </div>
          ))}
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
