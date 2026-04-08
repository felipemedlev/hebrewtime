"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { PanelLeftClose, PanelLeft, BookOpen, Sparkles, X } from "lucide-react";
import type { Episode, EpisodeListItem, VocabWord } from "@/lib/types";
import Sidebar from "./Sidebar";
import EpisodeViewer from "./EpisodeViewer";
import VocabularyView from "./VocabularyView";
import MediaPlayer from "./MediaPlayer";
import AuthModal from "./AuthModal";
import { useVocabulary } from "@/hooks/useVocabulary";
import { useUser } from "@/hooks/useUser";
import { useEntitlements } from "@/hooks/useEntitlements";
import { supabase } from "@/lib/supabase";
import AdminPremiumModal from "./AdminPremiumModal";
import { useFinishedEpisodes } from "@/hooks/useFinishedEpisodes";

type AppShellProps = {
  episodeList: EpisodeListItem[];
  initialEpisode: Episode | null;
};

export default function AppShell({ episodeList, initialEpisode }: AppShellProps) {
  const [episode, setEpisode] = useState<Episode | null>(initialEpisode);
  const [currentEpNum, setCurrentEpNum] = useState<number | null>(
    initialEpisode?.episode ?? null
  );
  const [viewMode, setViewMode] = useState<"episodes" | "vocabulary">("episodes");
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
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({
    episodes: 0,
    vocabulary: 0,
  });

  const mainRef = useRef<HTMLElement>(null);
  const { vocabWords, addWord, deleteWord, updateWord } = useVocabulary();
  const { user } = useUser();
  const { entitlements, isLoading: isLoadingEntitlements, refresh: refreshEntitlements } = useEntitlements();
  const { finishedEpisodes, toggleFinished } = useFinishedEpisodes();

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
        setIsAuthModalOpen(true);
      } else {
        showToast(res.message);
      }
      return res;
    },
    [addWord, showToast]
  );

  const showSubscriptionPrompt = useCallback(
    (source: "vocabulary" | "translation") => {
      if (source === "vocabulary") {
        setSubscriptionPrompt({
          title: "Unlock Vocabulary",
          description:
            "Join the subscription for $10/month to access your synced vocabulary list across devices.",
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

  const effectiveViewMode =
    viewMode === "vocabulary" && !entitlements.isPremium && !isLoadingEntitlements ? "episodes" : viewMode;

  const handleChangeViewMode = useCallback(
    (mode: "episodes" | "vocabulary") => {
      if (mode === "vocabulary" && !entitlements.isPremium && !isLoadingEntitlements) {
        showSubscriptionPrompt("vocabulary");
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
    async (num: number) => {
      setCurrentEpNum(num);
      if (isMobile) setIsSidebarOpen(false);

      // Reset scroll position for episodes when navigating to a new episode
      setScrollPositions((prev: Record<string, number>) => ({ ...prev, episodes: 0 }));

      // Fetch episode data dynamically
      try {
        const res = await fetch(`/api/episode/${num}`);
        if (res.ok) {
          const data = await res.json();
          setEpisode(data);
        }
      } catch {
        // fall back silently
      }

      setTimeout(() => {
        mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      }, 50);
    },
    [isMobile]
  );

  // Find current index for prev/next navigation
  const currentIndex = episodeList.findIndex((e) => e.episode === currentEpNum);

  const handleNavigate = useCallback(
    (direction: "prev" | "next") => {
      const newIndex =
        direction === "prev" ? currentIndex - 1 : currentIndex + 1;
      if (newIndex >= 0 && newIndex < episodeList.length) {
        navigateToEpisode(episodeList[newIndex].episode);
      }
    },
    [currentIndex, episodeList, navigateToEpisode]
  );

  return (
    <div className="app-container">
      <Sidebar
        episodes={episodeList}
        currentEpNum={currentEpNum}
        viewMode={effectiveViewMode}
        vocabCount={vocabWords.length}
        isSidebarOpen={isSidebarOpen}
        onSelectEpisode={navigateToEpisode}
        onChangeViewMode={handleChangeViewMode}
        onClose={() => setIsSidebarOpen(false)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        isPremium={entitlements.isPremium}
        isLoadingEntitlements={isLoadingEntitlements}
        isAdmin={entitlements.isAdmin}
        onOpenAdminModal={() => setIsAdminModalOpen(true)}
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

          <button
            className={`english-toggle-btn ${isEnglishBlurred ? "active" : ""}`}
            onClick={() => setIsEnglishBlurred((prev) => !prev)}
            title={
              isEnglishBlurred
                ? "Show English translations"
                : "Blur English translations"
            }
          >
            {isEnglishBlurred ? "English Blurred" : "English Visible"}
          </button>

          <div style={{ marginLeft: "auto" }}>
            {!user ? (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                style={{
                  background: "var(--text-main)",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  padding: "6px 12px",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Log In
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: 500 }}>
                  {user.email}
                </span>
                <button
                  onClick={() => supabase.auth.signOut()}
                  style={{
                    background: "transparent",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    padding: "4px 10px",
                    fontSize: "12px",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.color = "var(--text-main)"; e.currentTarget.style.borderColor = "#ccc"; }}
                  onMouseOut={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>

        {subscriptionPrompt && (
          <div className="subscription-prompt">
            <div className="subscription-prompt-icon">
              <Sparkles size={18} />
            </div>
            <div className="subscription-prompt-copy">
              <p className="subscription-prompt-title">{subscriptionPrompt.title}</p>
              <p className="subscription-prompt-description">{subscriptionPrompt.description}</p>
            </div>
            <button
              className="subscription-prompt-cta"
              onClick={() => setIsAuthModalOpen(true)}
            >
              Start for $10/month
            </button>
            <button
              className="subscription-prompt-close"
              onClick={() => setSubscriptionPrompt(null)}
              title="Dismiss"
            >
              <X size={16} />
            </button>
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
          />
        ) : !episode ? (
          <div className="empty-state">
            <BookOpen size={48} strokeWidth={1} />
            <p>Select an episode from the sidebar to start reading.</p>
          </div>
        ) : (
          <div key={`episode-${episode.episode}`}>
            <EpisodeViewer
              episode={episode}
              hasPrev={currentIndex > 0}
              hasNext={
                currentIndex !== -1 &&
                currentIndex < episodeList.length - 1
              }
              onNavigate={handleNavigate}
              onWordSaved={handleWordSaved}
              onToast={showToast}
              isPremium={entitlements.isPremium}
              isAuthenticated={entitlements.isAuthenticated}
              isLoadingEntitlements={isLoadingEntitlements}
              onRequireAuth={() => setIsAuthModalOpen(true)}
              onRequireSubscription={() => showSubscriptionPrompt("translation")}
              isEnglishBlurred={isEnglishBlurred}
              isFinished={finishedEpisodes.has(episode.episode)}
              onToggleFinished={() => toggleFinished(episode.episode)}
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
      />

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <AdminPremiumModal
        isOpen={isAdminModalOpen}
        onClose={async () => {
          setIsAdminModalOpen(false);
          await refreshEntitlements();
        }}
      />
    </div>
  );
}
