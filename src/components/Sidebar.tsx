"use client";

import { useState, useMemo } from "react";
import { Search, BookOpen, Bookmark, X } from "lucide-react";
import type { EpisodeListItem } from "@/lib/types";

type SidebarProps = {
  episodes: EpisodeListItem[];
  currentEpNum: number | null;
  viewMode: "episodes" | "vocabulary";
  vocabCount: number;
  isSidebarOpen: boolean;
  onSelectEpisode: (num: number) => void;
  onChangeViewMode: (mode: "episodes" | "vocabulary") => void;
  onClose: () => void;
};

export default function Sidebar({
  episodes,
  currentEpNum,
  viewMode,
  vocabCount,
  isSidebarOpen,
  onSelectEpisode,
  onChangeViewMode,
  onClose,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEpisodes = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return episodes;
    return episodes.filter((ep) => ep.title.toLowerCase().includes(q));
  }, [searchQuery, episodes]);

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`sidebar-overlay ${!isSidebarOpen ? "closed" : ""}`}
        onClick={onClose}
      />

      <aside className={`sidebar ${!isSidebarOpen ? "closed" : ""}`}>
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

          <div className="sidebar-tabs">
            <button
              className={`tab-btn ${viewMode === "episodes" ? "active" : ""}`}
              onClick={() => onChangeViewMode("episodes")}
            >
              Episodes
            </button>
            <button
              className={`tab-btn ${viewMode === "vocabulary" ? "active" : ""}`}
              onClick={() => onChangeViewMode("vocabulary")}
            >
              <Bookmark
                size={14}
                style={{
                  display: "inline",
                  marginRight: "4px",
                  verticalAlign: "text-bottom",
                }}
              />
              Vocabulary
            </button>
          </div>

          {viewMode === "episodes" && (
            <div className="search-wrapper">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search episodes…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="sidebar-search"
              />
            </div>
          )}
        </div>

        {viewMode === "episodes" ? (
          <div className="ep-list">
            {filteredEpisodes.map((ep) => (
              <button
                key={ep.episode}
                className={`ep-item ${ep.episode === currentEpNum ? "active" : ""}`}
                onClick={() => onSelectEpisode(ep.episode)}
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
              </button>
            ))}
            {filteredEpisodes.length === 0 && (
              <div
                style={{
                  padding: "16px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: "13px",
                }}
              >
                No episodes found.
              </div>
            )}
          </div>
        ) : (
          <div className="ep-list">
            <div
              style={{
                padding: "16px",
                color: "var(--text-muted)",
                fontSize: "13px",
                lineHeight: "1.6",
              }}
            >
              <p>
                You have <strong>{vocabCount}</strong> words saved.
              </p>
              <p style={{ marginTop: "12px" }}>
                They are displayed in the main area to the right.
              </p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
