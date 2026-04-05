"use client";

import { useState } from "react";
import { Bookmark, Trash2, LogIn, Edit2, Check, X } from "lucide-react";
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

  const cancelEdit = () => {
    setEditingId(null);
  };

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
      <div className="main-header">
        <h2 className="main-title font-serif">My Vocabulary</h2>
        <div className="main-meta">
          <span>{vocabWords.length} words saved</span>
        </div>
      </div>
      {vocabWords.length === 0 ? (
        <div className="empty-state" style={{ marginTop: "40px" }}>
          {!user ? (
            <>
              <LogIn
                size={48}
                strokeWidth={1}
                style={{ marginBottom: "16px", opacity: 0.5 }}
              />
              <p>You need to log in to save vocabulary.</p>
              <p style={{ fontSize: "14px", marginTop: "8px" }}>
                Click on any Hebrew word to get started!
              </p>
            </>
          ) : !isPremium ? (
            <>
              <Bookmark
                size={48}
                strokeWidth={1}
                style={{ marginBottom: "16px", opacity: 0.5 }}
              />
              <p>Vocabulary is a premium feature.</p>
              <p style={{ fontSize: "14px", marginTop: "8px" }}>
                Ask an admin to grant premium access to your account.
              </p>
            </>
          ) : (
            <>
              <Bookmark
                size={48}
                strokeWidth={1}
                style={{ marginBottom: "16px", opacity: 0.5 }}
              />
              <p>You haven&apos;t saved any words yet.</p>
              <p style={{ fontSize: "14px", marginTop: "8px" }}>
                Click on any Hebrew word while reading an episode to save it here!
              </p>
            </>
          )}
        </div>
      ) : (
        <div style={{ maxWidth: "max(900px, 80%)", margin: "0 auto", padding: "0 80px 80px 80px", width: "100%" }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", backgroundColor: "var(--surface)" }}>
            <div style={{ display: "flex", padding: "12px 20px", borderBottom: "1px solid var(--border)", backgroundColor: "var(--surface-hover)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", fontWeight: 500 }}>
              <div style={{ flex: "0 0 140px", textAlign: "right" }}>Hebrew</div>
              <div style={{ flex: "0 0 120px", textAlign: "right", paddingRight: "20px" }}>Verb Form</div>
              <div style={{ flex: "1", paddingLeft: "32px" }}>Translation</div>
              <div style={{ flex: "0 0 200px" }}>Source</div>
              <div style={{ flex: "0 0 70px" }}></div>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column" }}>
              {vocabWords.map((vw, i) => {
                const isEditing = editingId === vw.id;
                
                return (
                <div 
                  key={vw.id} 
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "16px 20px",
                    borderBottom: i < vocabWords.length - 1 ? "1px solid var(--border)" : "none",
                    transition: "background-color 0.15s",
                    backgroundColor: isEditing ? "var(--surface-hover)" : "transparent"
                  }}
                  onMouseOver={(e) => { if (!isEditing) e.currentTarget.style.backgroundColor = "var(--surface-hover)"; }}
                  onMouseOut={(e) => { if (!isEditing) e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <div style={{ flex: "0 0 140px", textAlign: "right", paddingRight: "10px" }}>
                    {isEditing ? (
                      <input
                        dir="rtl"
                        value={editValues.wordWithNekudot}
                        onChange={(e) => setEditValues({ ...editValues, wordWithNekudot: e.target.value })}
                        className="font-serif"
                        style={{
                          width: "100%", fontSize: "20px", padding: "4px",
                          border: "1px solid var(--border)", borderRadius: "4px",
                          background: "var(--surface)", color: "var(--accent)"
                        }}
                      />
                    ) : (
                      <span className="font-serif" dir="rtl" style={{ fontSize: "22px", color: "var(--accent)", lineHeight: 1.2 }}>
                        {vw.wordWithNekudot || vw.word}
                      </span>
                    )}
                  </div>
                  <div style={{ flex: "0 0 120px", textAlign: "right", paddingRight: "20px", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                    {isEditing ? (
                      <input
                        dir="rtl"
                        value={editValues.verbFormWithNekudot}
                        onChange={(e) => setEditValues({ ...editValues, verbFormWithNekudot: e.target.value })}
                        className="font-serif"
                        placeholder="Verb form..."
                        style={{
                          width: "100%", fontSize: "18px", padding: "4px",
                          border: "1px solid var(--border)", borderRadius: "4px",
                          background: "var(--surface)", color: "var(--text-main)"
                        }}
                      />
                    ) : vw.verbFormWithNekudot ? (
                      <span className="font-serif" dir="rtl" style={{ fontSize: "20px", color: "var(--text-main)", lineHeight: 1.2 }}>
                        {vw.verbFormWithNekudot}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>-</span>
                    )}
                  </div>
                  <div style={{ flex: "1", paddingLeft: "32px", color: "var(--text-main)", fontSize: "15px", lineHeight: 1.4 }}>
                    {isEditing ? (
                      <input
                        value={editValues.translation}
                        onChange={(e) => setEditValues({ ...editValues, translation: e.target.value })}
                        style={{
                          width: "100%", fontSize: "15px", padding: "4px",
                          border: "1px solid var(--border)", borderRadius: "4px",
                          background: "var(--surface)", color: "var(--text-main)"
                        }}
                      />
                    ) : (
                      vw.translation
                    )}
                  </div>
                  <div style={{ flex: "0 0 200px", fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <a href={vw.episodeUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-muted)", textDecoration: "none", transition: "color 0.2s" }} onMouseOver={(e) => e.currentTarget.style.color = "var(--text-main)"} onMouseOut={(e) => e.currentTarget.style.color = "var(--text-muted)"}>
                      {vw.episodeTitle}
                    </a>
                  </div>
                  <div style={{ flex: "0 0 70px", display: "flex", justifyContent: "flex-end", gap: "4px" }}>
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => saveEdit(vw.id)}
                          title="Save changes"
                          style={{
                            background: "transparent", border: "none",
                            color: "#4CAF50", cursor: "pointer", padding: "6px",
                            borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.2s"
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#E8F5E9"; }}
                          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={cancelEdit}
                          title="Cancel"
                          style={{
                            background: "transparent", border: "none",
                            color: "#ccc", cursor: "pointer", padding: "6px",
                            borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.2s"
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.color = "#ff4444"; e.currentTarget.style.backgroundColor = "#fff0f0"; }}
                          onMouseOut={(e) => { e.currentTarget.style.color = "#ccc"; e.currentTarget.style.backgroundColor = "transparent"; }}
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(vw)}
                          title="Edit word"
                          style={{
                            background: "transparent", border: "none",
                            color: "#ccc", cursor: "pointer", padding: "6px",
                            borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.2s"
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.color = "var(--text-main)"; e.currentTarget.style.backgroundColor = "var(--surface)"; }}
                          onMouseOut={(e) => { e.currentTarget.style.color = "#ccc"; e.currentTarget.style.backgroundColor = "transparent"; }}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => onDeleteWord(vw.id)}
                          title="Remove word"
                          style={{
                            background: "transparent", border: "none",
                            color: "#ccc", cursor: "pointer", padding: "6px",
                            borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.2s"
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.color = "#ff4444"; e.currentTarget.style.backgroundColor = "#fff0f0"; }}
                          onMouseOut={(e) => { e.currentTarget.style.color = "#ccc"; e.currentTarget.style.backgroundColor = "transparent"; }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
