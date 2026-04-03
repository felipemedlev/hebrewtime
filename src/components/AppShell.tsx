"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { PanelLeftClose, PanelLeft, BookOpen } from "lucide-react";
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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  const mainRef = useRef<HTMLElement>(null);
  const { vocabWords, addWord, deleteWord } = useVocabulary();
  const { user } = useUser();
  const { entitlements, refresh: refreshEntitlements } = useEntitlements();

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

  const handleChangeViewMode = useCallback(
    (mode: "episodes" | "vocabulary") => {
      if (mode === "vocabulary" && !entitlements.isPremium) {
        showToast(
          entitlements.isAuthenticated
            ? "Vocabulary is a premium feature."
            : "Log in with a premium account to access vocabulary."
        );
        if (!entitlements.isAuthenticated) {
          setIsAuthModalOpen(true);
        }
        return;
      }
      setViewMode(mode);
    },
    [entitlements.isAuthenticated, entitlements.isPremium, showToast]
  );
  const effectiveViewMode =
    viewMode === "vocabulary" && !entitlements.isPremium ? "episodes" : viewMode;

  const navigateToEpisode = useCallback(
    async (num: number) => {
      setCurrentEpNum(num);
      if (isMobile) setIsSidebarOpen(false);

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
        isAdmin={entitlements.isAdmin}
        onOpenAdminModal={() => setIsAdminModalOpen(true)}
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

        {effectiveViewMode === "vocabulary" ? (
          <VocabularyView
            vocabWords={vocabWords}
            onDeleteWord={deleteWord}
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
              onRequireAuth={() => setIsAuthModalOpen(true)}
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
