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
        <div className="vocab-grid">
          {vocabWords.map((vw) => (
            <div key={vw.id} className="vocab-card">
              <div className="vocab-header">
                <h3 className="vocab-word font-serif" dir="rtl">
                  {vw.wordWithNekudot || vw.word}
                </h3>
                <button
                  onClick={() => onDeleteWord(vw.id)}
                  className="delete-btn"
                  title="Remove word"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="vocab-context">
                <p
                  className="vocab-english"
                  style={{
                    fontSize: "18px",
                    color: "var(--text-main)",
                    marginTop: "4px",
                  }}
                >
                  {vw.translation}
                </p>
              </div>
              <div className="vocab-meta">
                Saved from:{" "}
                <a href={vw.episodeUrl} target="_blank" rel="noopener noreferrer">
                  {vw.episodeTitle}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
