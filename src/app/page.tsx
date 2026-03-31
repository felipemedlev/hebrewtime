"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Search, ExternalLink, ChevronLeft, ChevronRight, BookOpen, PanelLeftClose, PanelLeft, X, Bookmark, Trash2, Loader2 } from "lucide-react";
// @ts-ignore
import episodesData from "../../episodes_checkpoint.json";
import { translateWord } from "./actions";

type Episode = {
  episode: number;
  url: string;
  title: string;
  hebrew_paragraphs: string[];
  hebrew_text: string;
  english_paragraphs: string[];
};

export type VocabWord = {
  id: string;
  word: string;
  translation: string;
  episodeTitle: string;
  episodeUrl: string;
  savedAt: number;
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
  
  // View mode and vocabulary state
  const [viewMode, setViewMode] = useState<"episodes" | "vocabulary">("episodes");
  const [vocabWords, setVocabWords] = useState<VocabWord[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  type TranslationModalState = {
    isOpen: boolean;
    word: string;
    hebrewContext: string;
    englishContext: string;
    episode: Episode | null;
    translation: string | null;
    isTranslating: boolean;
  };
  const [modalState, setModalState] = useState<TranslationModalState>({
    isOpen: false,
    word: "",
    hebrewContext: "",
    englishContext: "",
    episode: null,
    translation: null,
    isTranslating: false,
  });

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem("hebrewTimeVocab");
    if (saved) {
      try { setVocabWords(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const saveVocab = (vocab: VocabWord[]) => {
    setVocabWords(vocab);
    localStorage.setItem("hebrewTimeVocab", JSON.stringify(vocab));
  };

  const handleWordClick = async (word: string, hebContext: string, engContext: string, ep: Episode) => {
    const cleanWord = word.replace(/^[.,;:!?(){}\[\]"'\-]+|[.,;:!?(){}\[\]"'\-]+$/g, '');
    if (!cleanWord) return;

    if (vocabWords.some(v => v.word === cleanWord)) {
      setToast(`"${cleanWord}" already in vocabulary!`);
      setTimeout(() => setToast(null), 2500);
      return;
    }
    
    setModalState({
      isOpen: true,
      word: cleanWord,
      hebrewContext: hebContext,
      englishContext: engContext || "",
      episode: ep,
      translation: null,
      isTranslating: true,
    });

    const translationRes = await translateWord(cleanWord, hebContext, engContext || "");
    setModalState(prev => ({ ...prev, translation: translationRes, isTranslating: false }));
  };

  const confirmSaveWord = () => {
    if (!modalState.episode || !modalState.translation) return;

    const newWord: VocabWord = {
      id: Date.now().toString() + Math.random().toString(),
      word: modalState.word,
      translation: modalState.translation,
      episodeTitle: modalState.episode.title,
      episodeUrl: modalState.episode.url,
      savedAt: Date.now()
    };
    saveVocab([newWord, ...vocabWords]);
    setToast(`Saved "${modalState.word}" to vocabulary!`);
    setTimeout(() => setToast(null), 2500);
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  const handleDeleteWord = (id: string) => {
    saveVocab(vocabWords.filter(v => v.id !== id));
  };
  
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
          
          <div className="sidebar-tabs">
            <button 
              className={`tab-btn ${viewMode === "episodes" ? "active" : ""}`}
              onClick={() => setViewMode("episodes")}
            >
              Episodes
            </button>
            <button 
              className={`tab-btn ${viewMode === "vocabulary" ? "active" : ""}`}
              onClick={() => setViewMode("vocabulary")}
            >
              <Bookmark size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }}/>
              Vocabulary
            </button>
          </div>

          {viewMode === "episodes" && (
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
          )}
        </div>
        
        {viewMode === "episodes" ? (
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
        ) : (
          <div className="ep-list">
            <div style={{ padding: "16px", color: "var(--text-muted)", fontSize: "13px", lineHeight: "1.6" }}>
              <p>You have <strong>{vocabWords.length}</strong> words saved.</p>
              <p style={{ marginTop: "12px" }}>They are displayed in the main area to the right.</p>
            </div>
          </div>
        )}
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

        {viewMode === "vocabulary" ? (
          <div className="vocabulary-view">
            <div className="main-header">
              <h2 className="main-title font-serif">My Vocabulary</h2>
              <div className="main-meta">
                <span>{vocabWords.length} words saved</span>
              </div>
            </div>
            {vocabWords.length === 0 ? (
              <div className="empty-state" style={{ marginTop: '40px' }}>
                <Bookmark size={48} strokeWidth={1} style={{ marginBottom: '16px', opacity: 0.5 }} />
                <p>You haven't saved any words yet.</p>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>Click on any Hebrew word while reading an episode to save it here!</p>
              </div>
            ) : (
              <div className="vocab-grid">
                {vocabWords.map(vw => (
                  <div key={vw.id} className="vocab-card">
                    <div className="vocab-header">
                      <h3 className="vocab-word font-serif" dir="rtl">{vw.word}</h3>
                      <button onClick={() => handleDeleteWord(vw.id)} className="delete-btn" title="Remove word">
                        <Trash2 size={16}/>
                      </button>
                    </div>
                    <div className="vocab-context">
                      <p className="vocab-english" style={{ fontSize: '18px', color: 'var(--text-main)', marginTop: '4px' }}>{vw.translation}</p>
                    </div>
                    <div className="vocab-meta">
                      Saved from: <a href={vw.episodeUrl} target="_blank" rel="noopener noreferrer">{vw.episodeTitle}</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : !currentEp ? (
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
                    <div className="text-hebrew font-serif" dir="rtl">
                      {heb.split(/(\s+)/).map((token, idx) => {
                        if (token.trim() === "") {
                          return <span key={idx}>{token}</span>;
                        }
                        const cleanWord = token.replace(/^[.,;:!?(){}\[\]"'\-]+|[.,;:!?(){}\[\]"'\-]+$/g, '');
                        return (
                          <span 
                            key={idx} 
                            className={cleanWord ? "hebrew-word" : ""}
                            onClick={() => {
                              if (cleanWord) handleWordClick(token, heb, eng, currentEp);
                            }}
                            title={cleanWord ? "Click to translate and save" : undefined}
                          >
                            {token}
                          </span>
                        );
                      })}
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

      {/* Translation Modal Overlay */}
      {modalState.isOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModalState(prev => ({...prev, isOpen: false})) }}>
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title font-serif" dir="rtl">{modalState.word}</h3>
              <button onClick={() => setModalState(prev => ({...prev, isOpen: false}))} className="close-btn"><X size={18}/></button>
            </div>
            
            <div className="modal-body">
              {modalState.isTranslating ? (
                <div className="translating-state">
                  <Loader2 className="spinner" size={24} />
                  <span>Translating exact word in context...</span>
                </div>
              ) : (
                <div className="translation-result">
                  <p className="translation-text">{modalState.translation}</p>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button 
                className="save-btn" 
                disabled={modalState.isTranslating || !modalState.translation || modalState.translation === "Translation error"}
                onClick={confirmSaveWord}
              >
                Add to Vocabulary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <div className={`toast ${toast ? "visible" : ""}`}>
        {toast}
      </div>
    </div>
  );
}
