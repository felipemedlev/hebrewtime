"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Search,
  BookOpen,
  Bookmark,
  X,
  LogOut,
  LogIn,
  CheckCircle,
  Brain,
  Lock,
  Play,
  GraduationCap,
  Clock,
  Sparkles,
} from "lucide-react";
import type { EpisodeListItem, LevelTrackMeta, FlashcardStats } from "@/lib/types";
import LearningTrackSelector from "./LearningTrackSelector";
import { finishedKey } from "@/lib/levelTracks";
import { useUser } from "@/hooks/useUser";
import { supabase } from "@/lib/supabase";

type SidebarProps = {
  levelTracks: LevelTrackMeta[];
  onChangeLevel: (level: string) => void;
  episodes: EpisodeListItem[];
  currentLevel: string;
  currentEpNum: number | null;
  viewMode: "episodes" | "vocabulary" | "flashcards";
  vocabCount: number;
  dueFlashcardsCount?: number;
  flashcardStats?: FlashcardStats;
  isSidebarOpen: boolean;
  onSelectEpisode: (level: string, num: number) => void;
  onChangeViewMode: (mode: "episodes" | "vocabulary" | "flashcards") => void;
  onClose: () => void;
  onStartReview?: () => void;
  onOpenAuthModal?: () => void;
  isPremium?: boolean;
  isAdmin?: boolean;
  isLoadingEntitlements?: boolean;
  onOpenAdminModal?: () => void;
  finishedEpisodes: Set<string>;
};

export default function Sidebar({
  levelTracks,
  onChangeLevel,
  episodes,
  currentLevel,
  currentEpNum,
  viewMode,
  vocabCount,
  dueFlashcardsCount = 0,
  flashcardStats,
  isSidebarOpen,
  onSelectEpisode,
  onChangeViewMode,
  onClose,
  onStartReview,
  onOpenAuthModal,
  isPremium = false,
  isAdmin = false,
  isLoadingEntitlements = false,
  onOpenAdminModal,
  finishedEpisodes,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useUser();
  const sidebarRef = useRef<HTMLElement>(null);
  const isDragging = useRef(false);


  // Initialize from local storage
  useEffect(() => {
    const savedWidth = localStorage.getItem("sidebarWidth");
    if (savedWidth) {
      document.documentElement.style.setProperty("--sidebar-width", `${savedWidth}px`);
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      let newWidth = e.clientX;
      if (newWidth < 200) newWidth = 200; // min width
      if (newWidth > 600) newWidth = 600; // max width
      document.documentElement.style.setProperty("--sidebar-width", `${newWidth}px`);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        const currentWidth = document.documentElement.style.getPropertyValue("--sidebar-width");
        if (currentWidth) {
          localStorage.setItem("sidebarWidth", currentWidth.replace("px", ""));
        }
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const filteredEpisodes = useMemo(() => {
    const levelEpisodes = episodes.filter((ep) => ep.level === currentLevel);
    const q = searchQuery.toLowerCase();
    if (!q) return levelEpisodes;
    return levelEpisodes.filter((ep) => ep.title.toLowerCase().includes(q));
  }, [searchQuery, episodes, currentLevel]);

  const handleChangeLevel = (level: string) => {
    setSearchQuery("");
    onChangeLevel(level);
  };

  const isLocked = !isPremium && !isLoadingEntitlements;

  const startReview = () => {
    if (onStartReview) {
      onStartReview();
    } else {
      onChangeViewMode("flashcards");
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`sidebar-overlay ${!isSidebarOpen ? "closed" : ""}`}
        onClick={onClose}
      />

      <aside className={`sidebar ${!isSidebarOpen ? "closed" : ""}`} ref={sidebarRef}>
        <div className="sidebar-resizer" onMouseDown={handleMouseDown} />
        <div className="sidebar-header">
          <div className="sidebar-title">
            <div className="sidebar-title-left">
              <BookOpen size={18} />
              <span>Hebrew Time</span>
            </div>
            <button className="close-mobile-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          <div className="sidebar-tabs" role="tablist" aria-label="Main navigation">
            <button
              className={`tab-btn ${viewMode === "episodes" ? "active" : ""}`}
              onClick={() => onChangeViewMode("episodes")}
              role="tab"
              aria-selected={viewMode === "episodes"}
              id="sidebar-tab-episodes"
              aria-controls="sidebar-panel"
            >
              Episodes
            </button>
            <button
              className={`tab-btn ${viewMode === "vocabulary" ? "active" : ""} ${isLocked ? "locked" : ""}`}
              onClick={() => onChangeViewMode("vocabulary")}
              title={isLocked ? "Join subscription to unlock vocabulary" : undefined}
              role="tab"
              aria-selected={viewMode === "vocabulary"}
              id="sidebar-tab-vocabulary"
              aria-controls="sidebar-panel"
            >
              <Bookmark size={14} />
              Vocab
              {isLocked && <Lock size={11} className="tab-lock-icon" aria-label="Premium" />}
            </button>
            <button
              className={`tab-btn ${viewMode === "flashcards" ? "active" : ""} ${isLocked ? "locked" : ""}`}
              onClick={() => onChangeViewMode("flashcards")}
              title={isLocked ? "Join subscription to unlock flashcards" : undefined}
              role="tab"
              aria-selected={viewMode === "flashcards"}
              id="sidebar-tab-flashcards"
              aria-controls="sidebar-panel"
            >
              <Brain size={14} />
              Review
              {isLocked && <Lock size={11} className="tab-lock-icon" aria-label="Premium" />}
            </button>
          </div>

          {viewMode === "episodes" && levelTracks.length > 0 && (
            <LearningTrackSelector
              tracks={levelTracks}
              onSelectLevel={handleChangeLevel}
            />
          )}

          {viewMode === "episodes" && (
            <div className="search-wrapper">
              <label htmlFor="sidebar-episode-search" className="sr-only">
                Search episodes
              </label>
              <Search size={14} className="search-icon" aria-hidden="true" />
              <input
                id="sidebar-episode-search"
                type="search"
                placeholder="Search episodes…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="sidebar-search"
              />
            </div>
          )}
        </div>

        {viewMode === "episodes" ? (
          <div className="ep-list" id="sidebar-panel" role="tabpanel" aria-labelledby="sidebar-tab-episodes">
            {filteredEpisodes.map((ep) => (
              <button
                key={ep.episode}
                className={`ep-item ${ep.episode === currentEpNum ? "active" : ""}`}
                onClick={() => onSelectEpisode(currentLevel, ep.episode)}
              >
                <span className="ep-num">
                  {String(ep.episode).padStart(2, "0")}
                </span>
                <span className="ep-title">
                  {ep.title
                    .replace(/Episode \d+:?\s*/i, "")
                    .split("–")[0]
                    .split("-")[0]
                    .trim()}
                </span>
                {finishedEpisodes.has(finishedKey(currentLevel, ep.episode)) && (
                  <CheckCircle size={14} className="ep-check" />
                )}
              </button>
            ))}
            {filteredEpisodes.length === 0 && (
              <div className="ep-empty">No episodes found.</div>
            )}
          </div>
        ) : viewMode === "vocabulary" ? (
          <div className="ep-list" id="sidebar-panel" role="tabpanel" aria-labelledby="sidebar-tab-vocabulary">
            <div className="sidebar-info">
              <p className="sidebar-info-heading">Vocabulary</p>
              <div className="sidebar-stats">
                <div className="sidebar-stat">
                  <span className="sidebar-stat-label">
                    <Bookmark size={14} /> Saved words
                  </span>
                  <span className="sidebar-stat-value">{vocabCount}</span>
                </div>
                <div className={`sidebar-stat ${dueFlashcardsCount > 0 ? "highlight" : ""}`}>
                  <span className="sidebar-stat-label">
                    <Clock size={14} /> Due for review
                  </span>
                  <span className="sidebar-stat-value">{dueFlashcardsCount}</span>
                </div>
                <div className="sidebar-stat">
                  <span className="sidebar-stat-label">
                    <GraduationCap size={14} /> Learned
                  </span>
                  <span className="sidebar-stat-value">{flashcardStats?.learned ?? 0}</span>
                </div>
              </div>
              {dueFlashcardsCount > 0 ? (
                <button className="sidebar-cta" onClick={startReview}>
                  <Play size={14} /> Review {dueFlashcardsCount} due {dueFlashcardsCount === 1 ? "word" : "words"}
                </button>
              ) : (
                <p className="sidebar-info-note">
                  {vocabCount > 0
                    ? "Click any Hebrew word while reading to add more to your list."
                    : "Click any Hebrew word while reading to save your first word."}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="ep-list" id="sidebar-panel" role="tabpanel" aria-labelledby="sidebar-tab-flashcards">
            <div className="sidebar-info">
              <p className="sidebar-info-heading">Spaced repetition</p>
              <div className="sidebar-stats">
                <div className={`sidebar-stat ${dueFlashcardsCount > 0 ? "highlight" : ""}`}>
                  <span className="sidebar-stat-label">
                    <Clock size={14} /> Due now
                  </span>
                  <span className="sidebar-stat-value">{dueFlashcardsCount}</span>
                </div>
                <div className="sidebar-stat">
                  <span className="sidebar-stat-label">
                    <Sparkles size={14} /> New
                  </span>
                  <span className="sidebar-stat-value">{flashcardStats?.newCount ?? 0}</span>
                </div>
                <div className="sidebar-stat">
                  <span className="sidebar-stat-label">
                    <GraduationCap size={14} /> Learned
                  </span>
                  <span className="sidebar-stat-value">{flashcardStats?.learned ?? 0}</span>
                </div>
              </div>
              {dueFlashcardsCount > 0 ? (
                <button className="sidebar-cta" onClick={startReview}>
                  <Play size={14} /> Start review
                </button>
              ) : (
                <p className="sidebar-info-note">
                  {vocabCount > 0
                    ? "All caught up — no cards are due right now."
                    : "Save words while reading to build your review deck."}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="sidebar-footer">
          {isAdmin && (
            <button className="sidebar-admin-btn" onClick={onOpenAdminModal}>
              Open Admin Panel
            </button>
          )}
          {user ? (
            <div className="sidebar-account">
              <span className="sidebar-email" title={user.email}>
                {user.email}
              </span>
              <button
                className="sidebar-signout-btn"
                onClick={handleSignOut}
                title="Sign Out"
                aria-label="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button className="sidebar-login-btn" onClick={onOpenAuthModal}>
              <LogIn size={15} />
              Log In / Sign Up
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
