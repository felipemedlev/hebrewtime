"use client";

import { useState, useMemo } from "react";
import { Search, BookOpen, Bookmark, X, LogOut, LogIn } from "lucide-react";
import type { EpisodeListItem } from "@/lib/types";
import { useUser } from "@/hooks/useUser";
import { supabase } from "@/lib/supabase";

type SidebarProps = {
  episodes: EpisodeListItem[];
  currentEpNum: number | null;
  viewMode: "episodes" | "vocabulary";
  vocabCount: number;
  isSidebarOpen: boolean;
  onSelectEpisode: (num: number) => void;
  onChangeViewMode: (mode: "episodes" | "vocabulary") => void;
  onClose: () => void;
  onOpenAuthModal?: () => void;
  isPremium?: boolean;
  isAdmin?: boolean;
  isLoadingEntitlements?: boolean;
  onOpenAdminModal?: () => void;
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
  onOpenAuthModal,
  isPremium = false,
  isAdmin = false,
  isLoadingEntitlements = false,
  onOpenAdminModal,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useUser();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

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
              title={!isPremium && !isLoadingEntitlements ? "Join subscription to unlock vocabulary" : undefined}
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

        <div style={{ marginTop: "auto", borderTop: "1px solid var(--border)", padding: "12px 16px" }}>
          {isAdmin && (
            <button
              onClick={onOpenAdminModal}
              style={{
                width: "100%",
                marginBottom: "10px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "8px",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-main)",
                cursor: "pointer",
              }}
            >
              Open Admin Panel
            </button>
          )}
          {user ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>
                {user.email}
              </span>
              <button 
                onClick={handleSignOut}
                title="Sign Out"
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", padding: "4px", borderRadius: "6px" }}
                onMouseOver={(e) => { e.currentTarget.style.color = "var(--text-main)"; e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
                onMouseOut={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px", fontSize: "13px", fontWeight: 500, color: "var(--text-main)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all 0.2s" }}
              onMouseOver={(e) => { e.currentTarget.style.background = "var(--surface-hover)"; e.currentTarget.style.borderColor = "#d1d1d1"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <LogIn size={15} />
              Log In / Sign Up
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
