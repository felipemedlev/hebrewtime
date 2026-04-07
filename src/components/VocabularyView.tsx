"use client";

import { useState } from "react";
import { Bookmark, Trash2, LogIn, Edit2, Check, X, ExternalLink } from "lucide-react";
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
  }>({
    wordWithNekudot: "",
    verbFormWithNekudot: "",
    translation: "",
  });

  const startEdit = (vw: VocabWord) => {
    setEditingId(vw.id);
    setEditValues({
      wordWithNekudot: vw.wordWithNekudot || vw.word || "",
      verbFormWithNekudot: vw.verbFormWithNekudot || "",
      translation: vw.translation || "",
    });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = (id: string) => {
    if (onEditWord) {
      onEditWord(id, {
        wordWithNekudot: editValues.wordWithNekudot,
        verbFormWithNekudot: editValues.verbFormWithNekudot,
        translation: editValues.translation,
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
            {/* Header — columns: Source | Translation | Verb | Hebrew | Actions */}
            <div className="vocab-table-header">
              <div className="vth-source">Source</div>
              <div className="vth-translation">Translation</div>
              <div className="vth-verb">Verb form</div>
              <div className="vth-hebrew">Hebrew</div>
              <div className="vth-actions" />
            </div>

            {/* Rows */}
            {vocabWords.map((vw, i) => {
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
            {vocabWords.map((vw) => {
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

                  {/* Translation */}
                  <div className="vocab-card-translation">
                    {isEditing ? (
                      <input
                        value={editValues.translation}
                        onChange={(e) => setEditValues({ ...editValues, translation: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(vw.id)}
                        className="vocab-edit-input"
                        style={{ fontSize: "14px" }}
                      />
                    ) : (
                      <span>{vw.translation}</span>
                    )}
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
