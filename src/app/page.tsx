"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Search, ExternalLink, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
// @ts-ignore - Assuming episodes_checkpoint.json is present after scraping
import episodesData from "../../episodes_checkpoint.json";

type Episode = {
  episode: number;
  url: string;
  title: string;
  hebrew_paragraphs: string[];
  hebrew_text: string;
  english_paragraphs: string[];
};

// Ensure episodes are unique, sorted, and IDs are strictly numbers.
const rawEpisodes = (episodesData || []) as any[];
const episodesMap = new Map<number, Episode>();
rawEpisodes.forEach((ep) => {
  const epNum = Number(ep.episode);
  if (!isNaN(epNum)) {
    // Normalize format like "[20] Title" to "Episode 20: Title"
    let normalizedTitle = ep.title;
    const bracketMatch = normalizedTitle.match(/^\[(\d+)\]\s*(.*)/);
    if (bracketMatch) {
      normalizedTitle = `Episode ${bracketMatch[1]}: ${bracketMatch[2]}`;
    }

    episodesMap.set(epNum, {
      ...ep,
      episode: epNum,
      title: normalizedTitle
    });
  }
});
const episodes: Episode[] = Array.from(episodesMap.values()).sort((a, b) => a.episode - b.episode);

export default function Home() {
  const [currentEpNum, setCurrentEpNum] = useState<number | null>(
    episodes.length > 0 ? episodes[0].episode : null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const mainRef = useRef<HTMLElement>(null);

  const filteredEpisodes = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return episodes;
    return episodes.filter(
      (ep) =>
        ep.title.toLowerCase().includes(q) ||
        (ep.hebrew_text && ep.hebrew_text.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const currentIndex = episodes.findIndex((e) => e.episode === currentEpNum);
  const currentEp = currentIndex !== -1 ? episodes[currentIndex] : null;

  const handleNext = () => {
    if (currentIndex > -1 && currentIndex < episodes.length - 1) {
      setCurrentEpNum(episodes[currentIndex + 1].episode);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentEpNum(episodes[currentIndex - 1].episode);
    }
  };

  const setEpisode = (num: number) => {
    setCurrentEpNum(num);
    // Use timeout to ensure DOM update is flushed before scrolling
    setTimeout(() => {
      if (mainRef.current) {
        mainRef.current.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 50);
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-title">
            <BookOpen size={18} />
            Hebrew Time
          </h1>
          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search episodes…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="sidebar-search pl-8"
            />
          </div>
        </div>
        
        <div className="ep-list">
          {filteredEpisodes.map((ep) => (
            <button
              key={ep.episode}
              className={`ep-item ${ep.episode === currentEpNum ? "active" : ""}`}
              onClick={() => setEpisode(ep.episode)}
            >
              <span className="ep-num">
                {String(ep.episode).padStart(2, "0")}
              </span>
              <span className="ep-title">
                {ep.title.replace(/Episode \d+:?\s*/i, "").split("–")[0].split("-")[0].trim()}
              </span>
            </button>
          ))}
          {filteredEpisodes.length === 0 && (
            <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              No episodes found.
            </div>
          )}
        </div>
      </aside>

      {/* Main Content container needed key block! */}
      <main className="main-content" ref={mainRef}>
        {!currentEp ? (
          <div className="empty-state">
            <BookOpen size={64} strokeWidth={1} />
            <p>Select an episode from the sidebar to start reading.</p>
          </div>
        ) : (
          <div key={`episode-${currentEp.episode}`}>
            <div className="main-header">
              <h2 className="main-title font-serif">{currentEp.title}</h2>
              <div className="main-meta">
                <span>Episode {String(currentEp.episode).padStart(2, '0')}</span>
                <span>•</span>
                <a href={currentEp.url} target="_blank" rel="noopener noreferrer">
                  Original Post <ExternalLink size={12} />
                </a>
              </div>
            </div>

            <div className="content-grid">
              {currentEp.hebrew_paragraphs.map((heb, i) => {
                const eng = currentEp.english_paragraphs?.[i];
                return (
                  <div key={i} className="para-pair">
                    <div className="text-hebrew font-serif">
                      {heb}
                    </div>
                    <div className="text-english">
                      {eng ? eng : <span style={{ color: "#aaa", fontStyle: "italic" }}>No translation</span>}
                    </div>
                  </div>
                );
              })}

              {/* Navigation Controls */}
              <div className="nav-controls">
                <button 
                  className="nav-btn" 
                  onClick={handlePrev} 
                  disabled={currentIndex <= 0}
                >
                  <ChevronLeft size={16} />
                  Previous Episode
                </button>
                <button 
                  className="nav-btn" 
                  onClick={handleNext} 
                  disabled={currentIndex === -1 || currentIndex >= episodes.length - 1}
                >
                  Next Episode
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
