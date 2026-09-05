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
import ReviewView from "./ReviewView";
import SpeakView from "./SpeakView";
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
import { useReviewPracticeStats } from "@/hooks/useReviewPracticeStats";
import { generateExamplePhrases, generateFillInExercises } from "@/app/actions";
import type { FillInExercise } from "@/lib/types";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import LanguageSelector from "./LanguageSelector";
import type { MessageKey } from "@/lib/i18n/messages";
import type { ViewMode } from "@/lib/viewMode";
import {
  readLatestBookmarkedEpisodes,
  readLessonBookmark,
  writeLessonBookmark,
  type LessonBookmark,
} from "@/lib/progress";
import { recordLearningEvent } from "@/lib/analytics";

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
  | "flashcards"
  | "fill_in_limit"
  | "speak_limit";

type EpisodeRequestTarget = { level: string; episode: number };

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
  const [viewMode, setViewMode] = useState<ViewMode>("episodes");
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
    speak: 0,
  });
  const [speakSessionActive, setSpeakSessionActive] = useState(false);
  const [lastEpisodesByLevel, setLastEpisodesByLevel] = useState<Record<string, number>>({});
  const [isEpisodeLoading, setIsEpisodeLoading] = useState(false);
  const [episodeLoadError, setEpisodeLoadError] = useState<string | null>(null);
  const [episodeRequestTarget, setEpisodeRequestTarget] = useState<EpisodeRequestTarget | null>(null);
  const [reviewStartSignal, setReviewStartSignal] = useState(0);
  const [reviewStartMode, setReviewStartMode] = useState<"standard" | "quick">("standard");
  const [lessonBookmark, setLessonBookmark] = useState<LessonBookmark | null>(null);

  const mainRef = useRef<HTMLElement>(null);
  const episodeRequestRef = useRef<AbortController | null>(null);
  const episodeRequestIdRef = useRef(0);
  const bookmarkWriteTimerRef = useRef<number | null>(null);
  const latestAudioTimeRef = useRef(0);
  const lessonInteractionKeyRef = useRef<string | null>(null);
  const { user } = useUser();
  const activeUserIdRef = useRef<string | null>(null);
  const accountScopeRef = useRef<string | null | undefined>(undefined);
  activeUserIdRef.current = user?.id ?? null;
  const { entitlements, isLoading: isLoadingEntitlements } = useEntitlements();
  const { vocabWords, addWord, deleteWord, updateWord } = useVocabulary(entitlements.isPremium);
  const {
    reverse,
    learnedCards,
    dueCards,
    sessionQueue,
    isProgressLoaded,
    submitReview,
    unlearnWord,
    stats,
  } = useFlashcards(vocabWords);
  const { stats: practiceStats, recordAttempt, attemptTimestamps } = useReviewPracticeStats();
  const {
    shouldShow: shouldShowOnboarding,
    dismiss: dismissOnboarding,
    reopen: reopenOnboarding,
  } = useOnboarding();
  const {
    finishedEpisodes,
    isFinished,
    toggleFinished,
    importLegacyProgress,
    legacyProgressAvailable,
    saveError: progressSaveError,
    savingKey: progressSavingKey,
  } = useFinishedEpisodes();
  useUsageTracking();

  useEffect(() => {
    if (shouldShowOnboarding) {
      recordLearningEvent("setup_viewed", { language: lang, track: currentLevel });
    }
  }, [shouldShowOnboarding, lang, currentLevel]);

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
    // Bookmarks are the source of truth for a returning guest. Keep the
    // older last-episode map as a compatibility fallback for pre-bookmark
    // sessions.
    const storedLastEpisodes = user?.id
      ? readLatestBookmarkedEpisodes(user.id)
      : {
          ...readLastEpisodesByLevel(),
          ...readLatestBookmarkedEpisodes(null),
        };
    setLastEpisodesByLevel(storedLastEpisodes);

    let storedLevel: string | null = null;
    try {
      storedLevel = window.localStorage.getItem("hebrewtime-level");
    } catch {
      // A blocked storage area should not prevent the initial lesson from rendering.
    }
    if (storedLevel && levels.some((l) => l.slug === storedLevel)) {
      const resumeEpisode = resolveResumeEpisode(storedLevel, episodeList, storedLastEpisodes);
      if (
        resumeEpisode != null &&
        (!initialEpisode || storedLevel !== initialEpisode.level || resumeEpisode !== initialEpisode.episode)
      ) {
        void navigateToEpisode(storedLevel, resumeEpisode);
      } else if (storedLevel !== initialEpisode?.level) {
        setCurrentLevel(storedLevel);
        setEpisode(null);
        setCurrentEpNum(null);
      } else {
        setCurrentLevel(storedLevel);
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
    const episodeLevel = episode?.level;
    const episodeNumber = episode?.episode;
    if (!episodeLevel || episodeNumber == null) {
      setLessonBookmark(null);
      return;
    }
    const bookmark = readLessonBookmark(episodeLevel, episodeNumber, user?.id);
    setLessonBookmark(bookmark);
    latestAudioTimeRef.current = bookmark?.audioSeconds ?? 0;
    if (bookmark) {
      window.setTimeout(() => mainRef.current?.scrollTo({ top: bookmark.scrollTop, behavior: "auto" }), 0);
    }
  }, [episode?.level, episode?.episode, user?.id]);

  useEffect(() => {
    const main = mainRef.current;
    if (!main || !episode || viewMode !== "episodes") return;
    const save = () => {
      if (bookmarkWriteTimerRef.current !== null) return;
      bookmarkWriteTimerRef.current = window.setTimeout(() => {
        bookmarkWriteTimerRef.current = null;
        const timedParagraph =
          episode.hebrew_paragraphs.findIndex(
                (paragraph) =>
                typeof paragraph === "object" &&
                  paragraph !== null &&
                  latestAudioTimeRef.current >= paragraph.start &&
                  latestAudioTimeRef.current <= paragraph.end
              );
        writeLessonBookmark(
          {
            level: episode.level,
            episode: episode.episode,
            paragraphIndex: timedParagraph >= 0 ? timedParagraph : lessonBookmark?.paragraphIndex ?? null,
            audioSeconds: latestAudioTimeRef.current,
            scrollTop: main.scrollTop,
          },
          user?.id
        );
      }, 250);
    };
    const onPlayerTime = (event: Event) => {
      const value = (event as CustomEvent<number>).detail;
      if (typeof value === "number" && Number.isFinite(value)) latestAudioTimeRef.current = value;
      save();
    };
    const onScroll = () => save();
    main.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("playerTimeUpdate", onPlayerTime);
    return () => {
      main.removeEventListener("scroll", onScroll);
      window.removeEventListener("playerTimeUpdate", onPlayerTime);
      if (bookmarkWriteTimerRef.current !== null) {
        window.clearTimeout(bookmarkWriteTimerRef.current);
        bookmarkWriteTimerRef.current = null;
        writeLessonBookmark(
          {
            level: episode.level,
            episode: episode.episode,
            paragraphIndex: lessonBookmark?.paragraphIndex ?? null,
            audioSeconds: latestAudioTimeRef.current,
            scrollTop: main.scrollTop,
          },
          user?.id
        );
      }
    };
  }, [episode, lessonBookmark?.audioSeconds, lessonBookmark?.paragraphIndex, user?.id, viewMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem("hebrewtime-level", currentLevel);
    } catch {
      // The selected track is a convenience; navigation remains functional.
    }
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
    if (source === "fill_in_limit") {
      setSubscriptionPrompt({
        title: t("fillInLimitTitle"),
        description: t("fillInLimitDesc"),
      });
      return;
    }
    if (source === "speak_limit") {
      setSubscriptionPrompt({
        title: t("speakLimitTitle"),
        description: t("speakLimitDesc"),
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
        if (res.added) {
          recordLearningEvent("vocabulary_saved", { language: lang, count: 1 });
        }
      }
      return res;
    },
    [addWord, showToast, showSubscriptionPrompt, lang]
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

  const generateFillIn = useCallback(
    async (
      words: VocabWord[]
    ): Promise<{ ok: boolean; exercises?: FillInExercise[]; message?: string }> => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const items = words.map((word, index) => ({
        index,
        word: word.word,
        translation: word.translation,
        wordWithNekudot: word.wordWithNekudot,
        entryKind: word.entryKind ?? "word",
      }));

      const res = await generateFillInExercises(accessToken, items, lang);

      if (res.type === "auth_required") {
        setAuthInitialMode("login");
        setIsAuthModalOpen(true);
        return { ok: false, message: t("pleaseLoginFillIn") };
      }
      if (res.type === "limit_reached") {
        showSubscriptionPrompt("fill_in_limit");
        return { ok: false, message: t("fillInLimitDesc") };
      }
      if (res.type === "error" || res.exercises.length === 0) {
        return { ok: false, message: t("failedGenerateFillIn") };
      }

      const exercises: FillInExercise[] = res.exercises
        .map((ex) => {
          const word = words[ex.index];
          if (!word) return null;
          return { ...ex, vocabId: word.id };
        })
        .filter((ex): ex is FillInExercise => ex !== null);

      if (exercises.length === 0) {
        return { ok: false, message: t("failedGenerateFillIn") };
      }

      return { ok: true, exercises };
    },
    [lang, showSubscriptionPrompt, t]
  );

  const handleChangeViewMode = useCallback(
    (mode: ViewMode) => {
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
      episodeRequestRef.current?.abort();
      const requestId = ++episodeRequestIdRef.current;
      const requestUserId = activeUserIdRef.current;
      const controller = new AbortController();
      episodeRequestRef.current = controller;
      setEpisodeRequestTarget({ level, episode: num });
      setEpisodeLoadError(null);
      setIsEpisodeLoading(true);
      if (isMobile) setIsSidebarOpen(false);

      setScrollPositions((prev: Record<string, number>) => ({ ...prev, episodes: 0 }));

      let didLoad = false;
      let bookmarkToRestore: LessonBookmark | null = null;
      try {
        const res = await fetch(`/api/episode/${level}/${num}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (requestId !== episodeRequestIdRef.current || requestUserId !== activeUserIdRef.current) return;
        if (res.ok) {
          const data = await res.json();
          setCurrentLevel(level);
          setCurrentEpNum(num);
          setEpisode(data);
          if (!requestUserId) writeLastEpisodeForLevel(level, num);
          setLastEpisodesByLevel((prev) => ({ ...prev, [level]: num }));
          bookmarkToRestore = readLessonBookmark(level, num, requestUserId);
          if (!bookmarkToRestore) {
            bookmarkToRestore = writeLessonBookmark(
              {
                level,
                episode: num,
                paragraphIndex: null,
                audioSeconds: 0,
                scrollTop: 0,
              },
              requestUserId
            );
          }
          setLessonBookmark(bookmarkToRestore);
          setEpisodeRequestTarget(null);
          didLoad = true;
        } else {
          setEpisodeLoadError(t("episodeLoadError"));
          showToast(t("episodeLoadError"));
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (requestId !== episodeRequestIdRef.current || requestUserId !== activeUserIdRef.current) return;
        setEpisodeLoadError(t("episodeLoadError"));
        showToast(t("episodeLoadError"));
      } finally {
        if (requestId === episodeRequestIdRef.current && requestUserId === activeUserIdRef.current) setIsEpisodeLoading(false);
      }

      if (didLoad && requestId === episodeRequestIdRef.current && requestUserId === activeUserIdRef.current && !bookmarkToRestore) {
        setTimeout(() => {
          if (requestId === episodeRequestIdRef.current && requestUserId === activeUserIdRef.current) {
            mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
          }
        }, 50);
      }
    },
    [isMobile, showToast, t]
  );

  useEffect(() => {
    const scopedUserId = user?.id ?? null;
    if (accountScopeRef.current === undefined) {
      accountScopeRef.current = scopedUserId;
      // The initial guest render is handled by the startup effect above. An
      // already available authenticated user still needs account bookmarks.
      if (!scopedUserId) return;
    } else if (accountScopeRef.current === scopedUserId) {
      return;
    }

    accountScopeRef.current = scopedUserId;
    const scopedLastEpisodes = scopedUserId
      ? readLatestBookmarkedEpisodes(scopedUserId)
      : {
          ...readLastEpisodesByLevel(),
          ...readLatestBookmarkedEpisodes(null),
        };
    setLastEpisodesByLevel(scopedLastEpisodes);
    const currentBookmark = episode
      ? readLessonBookmark(episode.level, episode.episode, scopedUserId)
      : null;
    setLessonBookmark(currentBookmark);
    latestAudioTimeRef.current = currentBookmark?.audioSeconds ?? 0;

    let storedLevel: string | null = null;
    try {
      storedLevel = window.localStorage.getItem("hebrewtime-level");
    } catch {
      // The account switch remains safe when storage is blocked.
    }
    const savedEpisode = storedLevel ? scopedLastEpisodes[storedLevel] : undefined;
    if (
      storedLevel &&
      savedEpisode != null &&
      levels.some((level) => level.slug === storedLevel) &&
      (!episode || episode.level !== storedLevel || episode.episode !== savedEpisode)
    ) {
      void navigateToEpisode(storedLevel, savedEpisode);
    }
  }, [episode, levels, navigateToEpisode, user?.id]);

  const handleChangeLevel = useCallback(
    async (level: string) => {
      const resumeEpisode = resolveResumeEpisode(
        level,
        episodeList,
        lastEpisodesByLevel
      );
      if (resumeEpisode != null) {
        await navigateToEpisode(level, resumeEpisode);
      } else {
        episodeRequestRef.current?.abort();
        ++episodeRequestIdRef.current;
        setIsEpisodeLoading(false);
        setEpisodeRequestTarget(null);
        setCurrentLevel(level);
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

  const nextUnfinishedEpisode = episode
    ? levelEpisodes.find(
        (candidate) => candidate.episode > episode.episode && !finishedEpisodes.has(`${currentLevel}:${candidate.episode}`)
      ) ?? null
    : null;

  const handleLearningInteraction = useCallback(() => {
    if (!episode) return;
    const key = `${user?.id ?? "guest"}:${episode.level}:${episode.episode}`;
    if (lessonInteractionKeyRef.current === key) return;
    lessonInteractionKeyRef.current = key;
    const bookmark = readLessonBookmark(episode.level, episode.episode, user?.id);
    const hasSavedLearningPosition = Boolean(
      bookmark &&
      (bookmark.paragraphIndex !== null || bookmark.audioSeconds > 0 || bookmark.scrollTop > 0)
    );
    recordLearningEvent(hasSavedLearningPosition ? "lesson_resumed" : "lesson_started", {
      language: lang,
      track: episode.level,
      episode: episode.episode,
    });
  }, [episode, lang, user?.id]);

  const handleOnboardingSkip = useCallback(() => {
    recordLearningEvent("setup_skipped", { language: lang, track: currentLevel });
    void dismissOnboarding();
  }, [currentLevel, dismissOnboarding, lang]);

  const handleOnboardingStart = useCallback(() => {
    recordLearningEvent("setup_completed", { language: lang, track: currentLevel });
    void dismissOnboarding();
  }, [currentLevel, dismissOnboarding, lang]);

  const handleCloseSidebar = useCallback(() => setIsSidebarOpen(false), []);

  return (
    <div className={`app-container ${isMobile && isSidebarOpen ? "mobile-sidebar-open" : ""}`}>
      <a className="skip-link" href="#main-content">{t("skipToContent")}</a>
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
          setReviewStartMode("standard");
          setReviewStartSignal((s) => s + 1);
        }}
        isSidebarOpen={isSidebarOpen}
        onSelectEpisode={navigateToEpisode}
        onChangeViewMode={handleChangeViewMode}
        onClose={handleCloseSidebar}
        onOpenAuthModal={() => {
          setAuthInitialMode("login");
          setIsAuthModalOpen(true);
        }}
        isPremium={entitlements.isPremium}
        isAdmin={entitlements.isAdmin}
        onOpenAdminModal={() => window.open("/admin", "_blank", "noopener,noreferrer")}
        onOpenOnboarding={reopenOnboarding}
        finishedEpisodes={finishedEpisodes}
      />

      <main
        id="main-content"
        tabIndex={-1}
        className={`main-content ${
          !episode?.audio_url
            ? "player-pad-none"
            : viewMode === "vocabulary" || viewMode === "flashcards" || viewMode === "speak"
              ? isMobile
                ? "player-pad-none"
                : "player-pad-mini"
              : "player-pad-full"
        }`}
        ref={mainRef}
      >
        <div className={`top-nav ${isScrolled ? "scrolled" : ""}`}>
          <button
            className="toggle-sidebar-btn"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title={isSidebarOpen ? t("closeSidebar") : t("openSidebar")}
            aria-label={isSidebarOpen ? t("closeSidebar") : t("openSidebar")}
            aria-expanded={isSidebarOpen}
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
              aria-label={
                isTranslationBlurred ? t("showTranslations") : t("hideTranslations")
              }
              title={
                isTranslationBlurred ? t("showTranslations") : t("hideTranslations")
              }
            >
              {isTranslationBlurred ? <EyeOff size={14} /> : <Eye size={14} />}
              <span className="translation-toggle-label">
                {isTranslationBlurred ? t("translationHidden") : t("translationShown")}
              </span>
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

        {legacyProgressAvailable && (
          <aside className="legacy-progress-banner" role="status">
            <div>
              <strong>{t("legacyProgressTitle")}</strong>
              <p>{t("legacyProgressDesc")}</p>
            </div>
            <button
              type="button"
              className="empty-state-btn secondary"
              onClick={() => {
                void importLegacyProgress().then((ok) =>
                  showToast(ok ? t("progressImported") : t("progressImportFailed"))
                );
              }}
            >
              {t("importProgress")}
            </button>
          </aside>
        )}
        {progressSaveError && (
          <p className="progress-save-error" role="alert">
            {progressSaveError === "sync" ? t("progressSyncError") : t("progressSaveError")}
          </p>
        )}

        {viewMode === "episodes" && episodeLoadError && episode && (
          <div className="episode-error-banner" role="alert">
            <span>{episodeLoadError}</span>
            {episodeRequestTarget && (
              <button type="button" className="empty-state-btn secondary" onClick={() => navigateToEpisode(episodeRequestTarget.level, episodeRequestTarget.episode)}>
                {t("tryAgain")}
              </button>
            )}
          </div>
        )}

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
            isAuthenticated={entitlements.isAuthenticated}
            onWordSaved={handleWordSaved}
            onRequireAuth={() => {
              setAuthInitialMode("login");
              setIsAuthModalOpen(true);
            }}
            onRequireSubscription={() => showSubscriptionPrompt("translation_limit")}
            generateExamples={generateExamples}
            regenerateExample={regenerateExample}
            onStartReading={() => handleChangeViewMode("episodes")}
          />
        ) : null}

        <div hidden={viewMode !== "flashcards"}>
          <ReviewView
            key={`review-${reviewStartSignal}-${reviewStartMode}`}
            vocabWords={vocabWords}
            learnedCards={learnedCards}
            dueCards={dueCards}
            sessionQueue={sessionQueue}
            reverseLearnedCards={reverse.learnedCards}
            reverseSessionQueue={reverse.sessionQueue}
            reverseStats={reverse.stats}
            isLoaded={isProgressLoaded}
            submitReview={submitReview}
            unlearnWord={unlearnWord}
            stats={stats}
            practiceStats={practiceStats}
            attemptTimestamps={attemptTimestamps}
            startSignal={reviewStartSignal}
            startMode={reviewStartMode}
            generateExamples={generateExamples}
            regenerateExample={regenerateExample}
            generateFillIn={generateFillIn}
            recordAttempt={recordAttempt}
            isPremium={entitlements.isPremium}
            onRequireSubscription={() => showSubscriptionPrompt("flashcards")}
            onStartReading={() => handleChangeViewMode("episodes")}
          />
        </div>

        <div hidden={viewMode !== "speak"}>
          <SpeakView
            isAuthenticated={entitlements.isAuthenticated}
            isPremium={entitlements.isPremium}
            episodeTitle={episode?.title ?? null}
            episodeHebrewText={episode?.hebrew_text?.slice(0, 600) ?? null}
            onSavePhrase={async (hebrew, translation) => {
              await addWord({
                word: hebrew,
                translation,
                episodeTitle: t("speakTitle"),
                episodeUrl: "",
                entryKind: "phrase",
              });
            }}
            onRequireAuth={() => {
              setAuthInitialMode("login");
              setIsAuthModalOpen(true);
            }}
            onRequireSubscription={() => showSubscriptionPrompt("speak_limit")}
            onSessionActiveChange={setSpeakSessionActive}
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
                {episodeRequestTarget && (
                  <button
                    className="empty-state-btn primary"
                    onClick={() => navigateToEpisode(episodeRequestTarget.level, episodeRequestTarget.episode)}
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
                  if (episode) {
                    void toggleFinished(episode.level, episode.episode).then((saved) => {
                      if (saved && !isFinished(episode.level, episode.episode)) {
                        recordLearningEvent("lesson_completed", {
                          language: lang,
                          track: episode.level,
                          episode: episode.episode,
                        });
                      }
                    });
                  }
                }}
                onLearningInteraction={handleLearningInteraction}
                progressSaving={progressSavingKey === `${episode.level}:${episode.episode}`}
              />
              {episode && isFinished(episode.level, episode.episode) && (
                <section className="continuation-panel" aria-label={t("continueAfterLesson")}>
                  <div>
                    <p className="continuation-eyebrow">{t("episodeFinished")}</p>
                    <h3>{t("continueAfterLesson")}</h3>
                    <p>{t("continueAfterLessonDesc", { count: vocabWords.length })}</p>
                  </div>
                  <div className="continuation-actions">
                    {stats.due > 0 && (
                      <button type="button" className="empty-state-btn primary" onClick={() => {
                        handleChangeViewMode("flashcards");
                        setReviewStartMode("quick");
                        setReviewStartSignal((s) => s + 1);
                      }}>{t("quickReview")}</button>
                    )}
                    {nextUnfinishedEpisode ? (
                      <button type="button" className="empty-state-btn secondary" onClick={() => navigateToEpisode(currentLevel, nextUnfinishedEpisode.episode)}>
                        {t("nextLesson")}
                      </button>
                    ) : (
                      <span className="continuation-complete">{t("trackComplete")}</span>
                    )}
                  </div>
                </section>
              )}
            </div>
          ))}
      </main>

      {/* Toast Notification */}
      <div className={`toast ${toast ? "visible" : ""}`}>{toast}</div>

      {/* Sticky Media Player */}
      <MediaPlayer
        key={`${user?.id ?? "guest"}:${episode?.level ?? currentLevel}:${episode?.episode ?? "none"}`}
        audioUrl={episode?.audio_url ?? null}
        episodeTitle={episode?.title ?? null}
        episodeNum={episode?.episode ?? null}
        episodeLevel={episode?.level ?? currentLevel}
        isSidebarOpen={isSidebarOpen}
        viewMode={viewMode}
        isMobile={isMobile}
        pauseForSpeak={speakSessionActive}
        initialTime={lessonBookmark?.audioSeconds ?? 0}
        onLearningInteraction={handleLearningInteraction}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authInitialMode}
        onClose={() => setIsAuthModalOpen(false)}
      />
      <OnboardingOverlay
        isOpen={shouldShowOnboarding}
        levels={levels}
        selectedLevel={currentLevel}
        onSelectLevel={handleChangeLevel}
        onDismiss={handleOnboardingSkip}
        onGetStarted={handleOnboardingStart}
      />
      <div className="sr-only" aria-live="polite">{episodeLoadError ?? ""}</div>
    </div>
  );
}
