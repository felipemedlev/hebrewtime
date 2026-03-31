"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Search, ExternalLink, ChevronLeft, ChevronRight, BookOpen, PanelLeftClose, PanelLeft, X } from "lucide-react";
// @ts-ignore
import episodesData from "../../episodes_checkpoint.json";

type Episode = {
  episode: number;
  url: string;
  title: string;
  hebrew_paragraphs: string[];
  hebrew_text: string;
  english_paragraphs: string[];
};

const rawEpisodes = (episodesData || []) as any[];
const episodesMap = new Map<number, Episode>();
rawEpisodes.forEach((ep) => {
  const epNum = Number(ep.episode);
  if (!isNaN(epNum)) {
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
  
  // Responsive sidebar control
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  // Check window size on mount
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 800;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false); // Default closed on mobile initially
      else setIsSidebarOpen(true);
    };
    
    // Initial check
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Top nav blur effect on scroll
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const handleScroll = () => {
      setIsScrolled(el.scrollTop > 10);
    };
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

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

  const navigateToEpisode = (num: number) => {
    setCurrentEpNum(num);
    if (isMobile) {
      setIsSidebarOpen(false);
    }
    setTimeout(() => {
      if (mainRef.current) {
        mainRef.current.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 50);
  };

  const handleNext = () => {
    if (currentIndex > -1 && currentIndex < episodes.length - 1) {
      navigateToEpisode(episodes[currentIndex + 1].episode);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      navigateToEpisode(episodes[currentIndex - 1].episode);
    }
  };

  return (
    <div className="app-container">
      {/* Mobile Overlay */}
      <div 
        className={`sidebar-overlay ${!isSidebarOpen ? "closed" : ""}`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${!isSidebarOpen ? "closed" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-title">
            <div className="sidebar-title-left">
              <BookOpen size={18} className="text-gray-700" />
              <span>Hebrew Time</span>
            </div>
            <button 
              className="close-mobile-btn"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
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
              onClick={() => navigateToEpisode(ep.episode)}
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

      {/* Main Content */}
      <main className="main-content" ref={mainRef}>
        <div className={`top-nav ${isScrolled ? "scrolled" : ""}`}>
          <button 
            className="toggle-sidebar-btn" 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
          </button>
        </div>

        {!currentEp ? (
          <div className="empty-state">
            <BookOpen size={48} strokeWidth={1} />
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
