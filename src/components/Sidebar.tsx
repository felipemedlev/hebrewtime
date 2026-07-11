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
import { useT } from "@/lib/i18n/LanguageProvider";

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
  const t = useT();
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
              <span>{t("appName")}</span>
            </div>
            <button className="close-mobile-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          <div className="sidebar-tabs" role="tablist" aria-label={t("mainNav")}>
            <button
              className={`tab-btn ${viewMode === "episodes" ? "active" : ""}`}
              onClick={() => onChangeViewMode("episodes")}
              role="tab"
              aria-selected={viewMode === "episodes"}
              id="sidebar-tab-episodes"
              aria-controls="sidebar-panel"
            >
              {t("episodes")}
            </button>
            <button
              className={`tab-btn ${viewMode === "vocabulary" ? "active" : ""}`}
              onClick={() => onChangeViewMode("vocabulary")}
              role="tab"
              aria-selected={viewMode === "vocabulary"}
              id="sidebar-tab-vocabulary"
              aria-controls="sidebar-panel"
            >
              <Bookmark size={14} />
              {t("vocab")}
            </button>
            <button
              className={`tab-btn ${viewMode === "flashcards" ? "active" : ""}`}
              onClick={() => onChangeViewMode("flashcards")}
              role="tab"
              aria-selected={viewMode === "flashcards"}
              id="sidebar-tab-flashcards"
              aria-controls="sidebar-panel"
            >
              <Brain size={14} />
              {t("review")}
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
                {t("searchEpisodes")}
              </label>
              <Search size={14} className="search-icon" aria-hidden="true" />
              <input
                id="sidebar-episode-search"
                type="search"
                placeholder={t("searchEpisodesPlaceholder")}
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
              <div className="ep-empty">{t("noEpisodesFound")}</div>
            )}
          </div>
        ) : viewMode === "vocabulary" ? (
          <div className="ep-list" id="sidebar-panel" role="tabpanel" aria-labelledby="sidebar-tab-vocabulary">
            <div className="sidebar-info">
              <p className="sidebar-info-heading">{t("vocabulary")}</p>
              <div className="sidebar-stats">
                <div className="sidebar-stat">
                  <span className="sidebar-stat-label">
                    <Bookmark size={14} /> {t("savedWords")}
                  </span>
                  <span className="sidebar-stat-value">{vocabCount}</span>
                </div>
                <div className={`sidebar-stat ${dueFlashcardsCount > 0 ? "highlight" : ""}`}>
                  <span className="sidebar-stat-label">
                    <Clock size={14} /> {t("dueForReview")}
                  </span>
                  <span className="sidebar-stat-value">{dueFlashcardsCount}</span>
                </div>
                <div className="sidebar-stat">
                  <span className="sidebar-stat-label">
                    <GraduationCap size={14} /> {t("learned")}
                  </span>
                  <span className="sidebar-stat-value">{flashcardStats?.learned ?? 0}</span>
                </div>
              </div>
              {dueFlashcardsCount > 0 ? (
                <button className="sidebar-cta" onClick={startReview}>
                  <Play size={14} />{" "}
                  {t("reviewDueWords", {
                    count: dueFlashcardsCount,
                    wordLabel: dueFlashcardsCount === 1 ? t("word") : t("words"),
                  })}
                </button>
              ) : (
                <p className="sidebar-info-note">
                  {vocabCount > 0 ? t("clickToAddMore") : t("clickToSaveFirst")}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="ep-list" id="sidebar-panel" role="tabpanel" aria-labelledby="sidebar-tab-flashcards">
            <div className="sidebar-info">
              <p className="sidebar-info-heading">{t("spacedRepetition")}</p>
              <div className="sidebar-stats">
                <div className={`sidebar-stat ${dueFlashcardsCount > 0 ? "highlight" : ""}`}>
                  <span className="sidebar-stat-label">
                    <Clock size={14} /> {t("dueNow")}
                  </span>
                  <span className="sidebar-stat-value">{dueFlashcardsCount}</span>
                </div>
                <div className="sidebar-stat">
                  <span className="sidebar-stat-label">
                    <Sparkles size={14} /> {t("newCards")}
                  </span>
                  <span className="sidebar-stat-value">{flashcardStats?.newCount ?? 0}</span>
                </div>
                <div className="sidebar-stat">
                  <span className="sidebar-stat-label">
                    <GraduationCap size={14} /> {t("learned")}
                  </span>
                  <span className="sidebar-stat-value">{flashcardStats?.learned ?? 0}</span>
                </div>
              </div>
              {dueFlashcardsCount === 0 && (
                <p className="sidebar-info-note">
                  {vocabCount > 0 ? t("allCaughtUp") : t("saveWordsToBuildDeck")}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="sidebar-footer">
          {isAdmin && (
            <button className="sidebar-admin-btn" onClick={onOpenAdminModal}>
              {t("openAdminPanel")}
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
                title={t("signOut")}
                aria-label={t("signOut")}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button className="sidebar-login-btn" onClick={onOpenAuthModal}>
              <LogIn size={15} />
              {t("logInSignUp")}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
