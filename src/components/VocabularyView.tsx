"use client";

import { useState, useMemo } from "react";
import { Bookmark, Trash2, LogIn, Edit2, Check, X, ExternalLink, Search } from "lucide-react";
import type { VocabWord } from "@/lib/types";
import { useUser } from "@/hooks/useUser";

type VocabularyViewProps = {
  vocabWords: VocabWord[];
  onDeleteWord: (id: string) => void;
  onEditWord?: (id: string, updates: Partial<VocabWord>) => void;
  isPremium: boolean;
};

export default function VocabularyView({
  vocabWords,
  onDeleteWord,
  onEditWord,
  isPremium,
}: VocabularyViewProps) {
  const { user } = useUser();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    wordWithNekudot: string;
    verbFormWithNekudot: string;
    translation: string;
    pronunciation: string;
  }>({
    wordWithNekudot: "",
    verbFormWithNekudot: "",
    translation: "",
    pronunciation: "",
  });

  const [selectedChapter, setSelectedChapter] = useState<string>("All Chapters");
  const [sortBy, setSortBy] = useState<"date" | "episode" | "translation" | "hebrew">("date");
  const [searchQuery, setSearchQuery] = useState("");

  const chapters = useMemo(() => {
    const list = new Set(vocabWords.map((v) => v.episodeTitle).filter(Boolean));
    return ["All Chapters", ...Array.from(list)];
  }, [vocabWords]);

  const filteredAndSortedWords = useMemo(() => {
    let result = [...vocabWords];

    if (selectedChapter !== "All Chapters") {
      result = result.filter((v) => v.episodeTitle === selectedChapter);
    }

    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      result = result.filter((v) => {
        const transl = (v.translation || "").toLowerCase();
        const hebrew = v.wordWithNekudot || v.word || "";
        const hebrewClean = hebrew.replace(/[\u0591-\u05C7]/g, ""); // Strip nekudot for easier searching
        const pronunc = (v.pronunciation || "").toLowerCase();
        return transl.includes(query) || hebrew.includes(query) || hebrewClean.includes(query) || pronunc.includes(query);
      });
    }

    result.sort((a, b) => {
      if (sortBy === "date") {
        return b.savedAt - a.savedAt;
      } else if (sortBy === "episode") {
        return (a.episodeTitle || "").localeCompare(b.episodeTitle || "");
      } else if (sortBy === "translation") {
        return a.translation.localeCompare(b.translation);
      } else if (sortBy === "hebrew") {
        const wordA = a.wordWithNekudot || a.word || "";
        const wordB = b.wordWithNekudot || b.word || "";
        return wordA.localeCompare(wordB, "he");
      }
      return 0;
    });

    return result;
  }, [vocabWords, selectedChapter, sortBy, searchQuery]);

  const startEdit = (vw: VocabWord) => {
    setEditingId(vw.id);
    setEditValues({
      wordWithNekudot: vw.wordWithNekudot || vw.word || "",
      verbFormWithNekudot: vw.verbFormWithNekudot || "",
      translation: vw.translation || "",
      pronunciation: vw.pronunciation || "",
    });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = (id: string) => {
    if (onEditWord) {
      onEditWord(id, {
        wordWithNekudot: editValues.wordWithNekudot,
        verbFormWithNekudot: editValues.verbFormWithNekudot,
        translation: editValues.translation,
        pronunciation: editValues.pronunciation,
      });
    }
    setEditingId(null);
  };

  return (
    <div className="vocabulary-view">
      {/* Page Header */}
      <div className="vocab-page-header">
        <div className="vocab-page-title-row">
          <h2 className="vocab-page-title">Vocabulary</h2>
          {vocabWords.length > 0 && (
            <span className="vocab-count-badge">{vocabWords.length}</span>
          )}
        </div>

        {vocabWords.length > 0 && (
          <div style={{ display: "flex", gap: "12px", marginTop: "16px", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 200px" }}>
              <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
              <input
                type="text"
                placeholder="Search words..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 12px 6px 32px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  fontSize: "13px",
                  outline: "none",
                  color: "var(--text)"
                }}
              />
            </div>
            <select
              value={selectedChapter}
              onChange={(e) => setSelectedChapter(e.target.value)}
              style={{
                padding: "6px 28px 6px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                fontSize: "13px",
                cursor: "pointer",
                outline: "none",
                appearance: "auto"
              }}
            >
              {chapters.map(ch => <option key={ch} value={ch}>{ch}</option>)}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                padding: "6px 28px 6px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                fontSize: "13px",
                cursor: "pointer",
                outline: "none",
                appearance: "auto"
              }}
            >
              <option value="date">Sort by Date Added</option>
              <option value="episode">Sort by Episode</option>
              <option value="translation">Sort by English (A-Z)</option>
              <option value="hebrew">Sort by Hebrew (א-ת)</option>
            </select>
          </div>
        )}
        {vocabWords.length > 0 && (
          <p className="vocab-page-subtitle">Your saved Hebrew words</p>
        )}
      </div>

      {vocabWords.length === 0 ? (
        /* ── Empty State ── */
        <div className="vocab-empty">
          {!user ? (
            <>
              <div className="vocab-empty-icon"><LogIn size={22} strokeWidth={1.5} /></div>
              <p className="vocab-empty-title">Sign in to save words</p>
              <p className="vocab-empty-sub">Click any Hebrew word while reading to translate &amp; save it.</p>
            </>
          ) : !isPremium ? (
            <>
              <div className="vocab-empty-icon"><Bookmark size={22} strokeWidth={1.5} /></div>
              <p className="vocab-empty-title">Premium feature</p>
              <p className="vocab-empty-sub">Ask an admin to unlock vocabulary access for your account.</p>
            </>
          ) : (
            <>
              <div className="vocab-empty-icon"><Bookmark size={22} strokeWidth={1.5} /></div>
              <p className="vocab-empty-title">No words saved yet</p>
              <p className="vocab-empty-sub">Click any Hebrew word while reading an episode to save it here.</p>
            </>
          )}
        </div>
      ) : (
        <div className="vocab-table-wrap">
          {/* ── Desktop Table ── */}
          <div className="vocab-table">
            {/* Header — columns: Source | Pronunciation | Translation | Verb | Hebrew | Actions */}
            <div className="vocab-table-header">
              <div className="vth-source">Source</div>
              <div className="vth-pronunciation">Pronunc.</div>
              <div className="vth-translation">Translation</div>
              <div className="vth-verb">Verb form</div>
              <div className="vth-hebrew">Hebrew</div>
              <div className="vth-actions" />
            </div>

            {/* Rows */}
            {filteredAndSortedWords.map((vw, i) => {
              const isEditing = editingId === vw.id;
              return (
                <div
                  key={vw.id}
                  className={`vocab-table-row${isEditing ? " editing" : ""}${i === vocabWords.length - 1 ? " last" : ""}`}
                >
                  {/* Source — far left */}
                  <div className="vtd-source">
                    {vw.episodeUrl ? (
                      <a
                        href={vw.episodeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="vocab-source-link"
                        title={vw.episodeTitle}
                      >
                        <ExternalLink size={12} className="vocab-source-icon" />
                        <span>{vw.episodeTitle}</span>
                      </a>
                    ) : (
                      <span className="vocab-dash">{vw.episodeTitle || "—"}</span>
                    )}
                  </div>

                  {/* Pronunciation */}
                  <div className="vtd-pronunciation">
                     {isEditing ? (
                      <input
                        value={editValues.pronunciation}
                        onChange={(e) => setEditValues({ ...editValues, pronunciation: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(vw.id)}
                        className="vocab-edit-input"
                        style={{ fontSize: "14px", width: "100%", maxWidth: "120px" }}
                        placeholder="Pronunciation"
                      />
                    ) : vw.pronunciation ? (
                      <span className="vocab-pronunciation-text" style={{ fontStyle: "italic", opacity: 0.8 }}>
                        {vw.pronunciation}
                      </span>
                    ) : (
                      <span className="vocab-dash">—</span>
                    )}
                  </div>

                  {/* Translation */}
                  <div className="vtd-translation">
                    {isEditing ? (
                      <input
                        value={editValues.translation}
                        onChange={(e) => setEditValues({ ...editValues, translation: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(vw.id)}
                        className="vocab-edit-input"
                        style={{ fontSize: "14px" }}
                      />
                    ) : (
                      <span className="vocab-translation-text">{vw.translation}</span>
                    )}
                  </div>

                  {/* Verb form */}
                  <div className="vtd-verb">
                    {isEditing ? (
                      <input
                        dir="rtl"
                        value={editValues.verbFormWithNekudot}
                        onChange={(e) => setEditValues({ ...editValues, verbFormWithNekudot: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(vw.id)}
                        placeholder="—"
                        className="vocab-edit-input font-serif"
                        style={{ fontSize: "18px", textAlign: "right" }}
                      />
                    ) : vw.verbFormWithNekudot ? (
                      <span className="font-serif vocab-verb-word" dir="rtl">{vw.verbFormWithNekudot}</span>
                    ) : (
                      <span className="vocab-dash">—</span>
                    )}
                  </div>

                  {/* Hebrew word — rightmost data column */}
                  <div className="vtd-hebrew">
                    {isEditing ? (
                      <input
                        dir="rtl"
                        value={editValues.wordWithNekudot}
                        onChange={(e) => setEditValues({ ...editValues, wordWithNekudot: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(vw.id)}
                        className="vocab-edit-input font-serif"
                        style={{ fontSize: "20px", color: "var(--accent)", textAlign: "right" }}
                      />
                    ) : (
                      <span className="font-serif vocab-hebrew-word" dir="rtl">
                        {vw.wordWithNekudot || vw.word}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="vtd-actions">
                    {isEditing ? (
                      <>
                        <button onClick={() => saveEdit(vw.id)} title="Save" className="vocab-action-btn save">
                          <Check size={14} />
                        </button>
                        <button onClick={cancelEdit} title="Cancel" className="vocab-action-btn cancel">
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(vw)} title="Edit" className="vocab-action-btn edit">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => onDeleteWord(vw.id)} title="Delete" className="vocab-action-btn delete">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Mobile Cards ── */}
          <div className="vocab-cards">
            {filteredAndSortedWords.map((vw) => {
              const isEditing = editingId === vw.id;
              return (
                <div key={vw.id} className={`vocab-card-item${isEditing ? " editing" : ""}`}>
                  {/* Card top: Hebrew (right-aligned) + actions */}
                  <div className="vocab-card-top">
                    <div className="vocab-card-actions">
                      {isEditing ? (
                        <>
                          <button onClick={() => saveEdit(vw.id)} title="Save" className="vocab-action-btn save">
                            <Check size={14} />
                          </button>
                          <button onClick={cancelEdit} title="Cancel" className="vocab-action-btn cancel">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(vw)} title="Edit" className="vocab-action-btn edit">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => onDeleteWord(vw.id)} title="Delete" className="vocab-action-btn delete">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                    <div className="vocab-card-words">
                      {isEditing ? (
                        <input
                          dir="rtl"
                          value={editValues.wordWithNekudot}
                          onChange={(e) => setEditValues({ ...editValues, wordWithNekudot: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && saveEdit(vw.id)}
                          className="vocab-edit-input font-serif"
                          style={{ fontSize: "22px", color: "var(--accent)", textAlign: "right", marginBottom: "6px" }}
                        />
                      ) : (
                        <span className="font-serif vocab-card-hebrew" dir="rtl">
                          {vw.wordWithNekudot || vw.word}
                        </span>
                      )}
                      {(vw.verbFormWithNekudot || isEditing) && (
                        isEditing ? (
                          <input
                            dir="rtl"
                            value={editValues.verbFormWithNekudot}
                            onChange={(e) => setEditValues({ ...editValues, verbFormWithNekudot: e.target.value })}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit(vw.id)}
                            placeholder="verb form…"
                            className="vocab-edit-input font-serif"
                            style={{ fontSize: "16px", textAlign: "right" }}
                          />
                        ) : (
                          <span className="font-serif vocab-card-verb" dir="rtl">{vw.verbFormWithNekudot}</span>
                        )
                      )}
                    </div>
                  </div>

                  {/* Translation & Pronunciation */}
                  <div className="vocab-card-translation">
                    {isEditing ? (
                      <input
                        value={editValues.translation}
                        onChange={(e) => setEditValues({ ...editValues, translation: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(vw.id)}
                        className="vocab-edit-input"
                        style={{ fontSize: "14px", width: "100%", marginBottom: "8px" }}
                        placeholder="Translation"
                      />
                    ) : (
                      <span style={{ display: "block", marginBottom: vw.pronunciation ? "4px" : "0" }}>{vw.translation}</span>
                    )}

                    {isEditing ? (
                      <input
                        value={editValues.pronunciation}
                        onChange={(e) => setEditValues({ ...editValues, pronunciation: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(vw.id)}
                        className="vocab-edit-input"
                        style={{ fontSize: "13px" }}
                        placeholder="Pronunciation"
                      />
                    ) : vw.pronunciation ? (
                      <span className="vocab-pronunciation-text" style={{ fontStyle: "italic", opacity: 0.8, fontSize: "13px", display: "block" }}>
                        {vw.pronunciation}
                      </span>
                    ) : null}
                  </div>

                  {/* Source */}
                  {vw.episodeTitle && (
                    <div className="vocab-card-source">
                      {vw.episodeUrl ? (
                        <a href={vw.episodeUrl} target="_blank" rel="noopener noreferrer" className="vocab-source-link">
                          <ExternalLink size={11} className="vocab-source-icon" />
                          <span>{vw.episodeTitle}</span>
                        </a>
                      ) : (
                        <span>{vw.episodeTitle}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
