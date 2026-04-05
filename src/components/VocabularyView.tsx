"use client";

import { Bookmark, Trash2, LogIn } from "lucide-react";
import type { VocabWord } from "@/lib/types";
import { useUser } from "@/hooks/useUser";

type VocabularyViewProps = {
  vocabWords: VocabWord[];
  onDeleteWord: (id: string) => void;
  isPremium: boolean;
};

export default function VocabularyView({
  vocabWords,
  onDeleteWord,
  isPremium,
}: VocabularyViewProps) {
  const { user } = useUser();

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
              <div style={{ flex: "1", paddingLeft: "32px" }}>Translation</div>
              <div style={{ flex: "0 0 200px" }}>Source</div>
              <div style={{ flex: "0 0 40px" }}></div>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column" }}>
              {vocabWords.map((vw, i) => (
                <div 
                  key={vw.id} 
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "16px 20px",
                    borderBottom: i < vocabWords.length - 1 ? "1px solid var(--border)" : "none",
                    transition: "background-color 0.15s",
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "var(--surface-hover)"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <div style={{ flex: "0 0 140px", textAlign: "right" }}>
                    <span className="font-serif" dir="rtl" style={{ fontSize: "22px", color: "var(--accent)", lineHeight: 1.2 }}>
                      {vw.wordWithNekudot || vw.word}
                    </span>
                  </div>
                  <div style={{ flex: "1", paddingLeft: "32px", color: "var(--text-main)", fontSize: "15px", lineHeight: 1.4 }}>
                    {vw.translation}
                  </div>
                  <div style={{ flex: "0 0 200px", fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <a href={vw.episodeUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-muted)", textDecoration: "none", transition: "color 0.2s" }} onMouseOver={(e) => e.currentTarget.style.color = "var(--text-main)"} onMouseOut={(e) => e.currentTarget.style.color = "var(--text-muted)"}>
                      {vw.episodeTitle}
                    </a>
                  </div>
                  <div style={{ flex: "0 0 40px", display: "flex", justifyContent: "flex-end" }}>
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
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
