"use client";

import { useState, useMemo } from "react";
import { Bookmark, Trash2, LogIn, Edit2, Check, X, ExternalLink, Search, MessageSquare, BookOpen, Plus } from "lucide-react";
import type { VocabWord } from "@/lib/types";
import { useUser } from "@/hooks/useUser";
import { useT } from "@/lib/i18n/LanguageProvider";
import { normalizeHebrewInput } from "@/lib/progress";
import ExamplePhrasesPanel from "./ExamplePhrasesPanel";
import DictionaryDetailsModal from "./DictionaryDetailsModal";
import AddVocabWordModal from "./AddVocabWordModal";

const ALL_CHAPTERS_KEY = "__all__";
const CHAPTER_LABEL_MAX = 48;

function truncateLabel(text: string, max = CHAPTER_LABEL_MAX): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

type VocabularyViewProps = {
  vocabWords: VocabWord[];
  onDeleteWord: (id: string) => void;
  onEditWord?: (id: string, updates: Partial<VocabWord>) => void;
  isAuthenticated: boolean;
  onWordSaved: (
    word: Omit<VocabWord, "id" | "savedAt">
  ) => Promise<{ added: boolean; message: string; type?: string }>;
  onRequireAuth: () => void;
  onRequireSubscription: () => void;
  generateExamples: (word: VocabWord) => Promise<{ ok: boolean; message?: string }>;
  regenerateExample: (word: VocabWord, index: number) => Promise<{ ok: boolean; message?: string }>;
  onStartReading?: () => void;
};

export default function VocabularyView({
  vocabWords,
  onDeleteWord,
  onEditWord,
  isAuthenticated,
  onWordSaved,
  onRequireAuth,
  onRequireSubscription,
  generateExamples,
  regenerateExample,
  onStartReading,
}: VocabularyViewProps) {
  const t = useT();
  const { user } = useUser();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailsPealimId, setDetailsPealimId] = useState<number | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [regeneratingSlot, setRegeneratingSlot] = useState<{ wordId: string; index: number } | null>(null);
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

  const [selectedChapter, setSelectedChapter] = useState<string>(ALL_CHAPTERS_KEY);
  const [sortBy, setSortBy] = useState<"date" | "episode" | "translation" | "hebrew">("date");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const chapters = useMemo(() => {
    const list = new Set(vocabWords.map((v) => v.episodeTitle).filter(Boolean));
    return [ALL_CHAPTERS_KEY, ...Array.from(list)];
  }, [vocabWords]);

  const filteredAndSortedWords = useMemo(() => {
    let result = [...vocabWords];

    if (selectedChapter !== ALL_CHAPTERS_KEY) {
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
        wordWithNekudot: normalizeHebrewInput(editValues.wordWithNekudot),
        verbFormWithNekudot: normalizeHebrewInput(editValues.verbFormWithNekudot),
        translation: editValues.translation,
        pronunciation: editValues.pronunciation,
      });
    }
    setEditingId(null);
  };

  const toggleExamples = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleGenerate = async (word: VocabWord) => {
    setGeneratingId(word.id);
    const result = await generateExamples(word);
    setGeneratingId(null);
    return result;
  };

  const handleRegenerate = async (word: VocabWord, index: number) => {
    setRegeneratingSlot({ wordId: word.id, index });
    const result = await regenerateExample(word, index);
    setRegeneratingSlot(null);
    return result;
  };

  return (
    <div className="vocabulary-view">
      {/* Page Header */}
      <div className="vocab-page-header">
        <div className="vocab-page-title-row">
          <h2 className="vocab-page-title">{t("myVocabulary")}</h2>
          {vocabWords.length > 0 && (
            <span className="vocab-count-badge">{vocabWords.length}</span>
          )}
          {onStartReading && (
            <button type="button" className="empty-state-btn primary" onClick={onStartReading}>
              <BookOpen size={16} />
              {t("startReading")}
            </button>
          )}
        </div>

        {vocabWords.length > 0 && (
          <div className="vocab-filter-toolbar">
            <div className="vocab-filter-search">
              <label htmlFor="vocab-search" className="sr-only">{t("searchVocabulary")}</label>
              <Search size={14} className="vocab-filter-search-icon" aria-hidden="true" />
              <input
                id="vocab-search"
                type="search"
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="vocab-filter-search-input"
              />
            </div>
            <select
              className="vocab-filter-select"
              value={selectedChapter}
              onChange={(e) => setSelectedChapter(e.target.value)}
              aria-label={t("filterByChapter")}
            >
              {chapters.map((ch) => (
                <option key={ch} value={ch}>
                  {ch === ALL_CHAPTERS_KEY ? t("allChapters") : truncateLabel(ch)}
                </option>
              ))}
            </select>
            <select
              className="vocab-filter-select"
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "date" | "episode" | "translation" | "hebrew")
              }
              aria-label={t("sortBy")}
            >
              <option value="date">{t("sortByDate")}</option>
              <option value="episode">{t("sortByEpisode")}</option>
              <option value="translation">{t("sortByTranslation")}</option>
              <option value="hebrew">{t("sortByHebrew")}</option>
            </select>
          </div>
        )}
        {vocabWords.length > 0 && (
          <p className="vocab-page-subtitle">{t("savedWords")}</p>
        )}
      </div>

      {vocabWords.length === 0 ? (
        /* ── Empty State ── */
        <div className="vocab-empty">
          {!user ? (
            <>
              <div className="vocab-empty-icon"><LogIn size={22} strokeWidth={1.5} /></div>
              <p className="vocab-empty-title">{t("logInToSave")}</p>
              <p className="vocab-empty-sub">{t("noVocabSub")}</p>
            </>
          ) : (
            <>
              <div className="vocab-empty-icon"><Bookmark size={22} strokeWidth={1.5} /></div>
              <p className="vocab-empty-title">{t("noVocabYet")}</p>
              <p className="vocab-empty-sub">{t("vocabEmptyHint")}</p>
            </>
          )}
        </div>
      ) : (
        <div className="vocab-table-wrap">
          {/* ── Desktop Table ── */}
          <div className="vocab-table" role="table" aria-label={t("myVocabulary")}>
            {/* Header — columns: Source | Pronunciation | Translation | Verb | Hebrew | Actions */}
            <div className="vocab-table-header" role="row">
              <div className="vth-source" role="columnheader">{t("source")}</div>
              <div className="vth-pronunciation" role="columnheader">{t("pronunciation")}</div>
              <div className="vth-translation" role="columnheader">{t("translation")}</div>
              <div className="vth-verb" role="columnheader">{t("verbFormCol")}</div>
              <div className="vth-hebrew" role="columnheader">{t("hebrew")}</div>
              <div className="vth-actions" role="columnheader" aria-label={t("actions")} />
            </div>

            {/* Rows */}
            {filteredAndSortedWords.map((vw, i) => {
              const isEditing = editingId === vw.id;
              const isExpanded = expandedId === vw.id;
              const isPhrase = vw.entryKind === "phrase";
              return (
                <div key={vw.id} className="vocab-table-row-group">
                <div
                  className={`vocab-table-row${isEditing ? " editing" : ""}${i === vocabWords.length - 1 && !isExpanded ? " last" : ""}`}
                  role="row"
                >
                  {/* Source — far left */}
                  <div className="vtd-source" role="cell">
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
                  <div className="vtd-pronunciation" role="cell">
                     {isEditing ? (
                      <input
                        value={editValues.pronunciation}
                        onChange={(e) => setEditValues({ ...editValues, pronunciation: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(vw.id)}
                        className="vocab-edit-input"
                        style={{ fontSize: "14px", width: "100%", maxWidth: "120px" }}
                        placeholder={t("pronunciation")}
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
                  <div className="vtd-translation" role="cell">
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
                  <div className="vtd-verb" role="cell">
                    {!isPhrase && (isEditing ? (
                      <input
                        dir="rtl"
                        lang="he"
                        value={editValues.verbFormWithNekudot}
                        onChange={(e) => setEditValues({ ...editValues, verbFormWithNekudot: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(vw.id)}
                        placeholder="—"
                        className="vocab-edit-input font-serif"
                        style={{ fontSize: "18px", textAlign: "right" }}
                      />
                    ) : vw.verbFormWithNekudot ? (
                      <span className="font-serif vocab-verb-word" dir="rtl" lang="he">{vw.verbFormWithNekudot}</span>
                    ) : (
                      <span className="vocab-dash">—</span>
                    ))}
                    {isPhrase && !isEditing && <span className="vocab-dash">—</span>}
                  </div>

                  {/* Hebrew word — rightmost data column */}
                  <div className="vtd-hebrew" role="cell">
                    {isEditing ? (
                      <input
                        dir="rtl"
                        lang="he"
                        value={editValues.wordWithNekudot}
                        onChange={(e) => setEditValues({ ...editValues, wordWithNekudot: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(vw.id)}
                        className="vocab-edit-input font-serif"
                        style={{ fontSize: "20px", color: "var(--accent)", textAlign: "right" }}
                      />
                    ) : (
                      <>
                        {isPhrase && (
                          <span className="vocab-entry-phrase-badge">{t("vocabEntryPhraseBadge")}</span>
                        )}
                        <span className="font-serif vocab-hebrew-word" dir="rtl" lang="he">
                          {vw.wordWithNekudot || vw.word}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="vtd-actions" role="cell">
                    {isEditing ? (
                      <>
                        <button onClick={() => saveEdit(vw.id)} title={t("save")} className="vocab-action-btn save">
                          <Check size={14} />
                        </button>
                        <button onClick={cancelEdit} title={t("cancel")} className="vocab-action-btn cancel">
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        {vw.dictionaryPealimId && !isPhrase && (
                          <button
                            onClick={() => setDetailsPealimId(vw.dictionaryPealimId!)}
                            title={t("viewConjugations")}
                            className="vocab-action-btn details"
                          >
                            <BookOpen size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => toggleExamples(vw.id)}
                          title={t("examples")}
                          className={`vocab-action-btn examples${isExpanded ? " active" : ""}`}
                        >
                          <MessageSquare size={14} />
                        </button>
                        <button onClick={() => startEdit(vw)} title={t("edit")} className="vocab-action-btn edit">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => onDeleteWord(vw.id)} title={t("delete")} className="vocab-action-btn delete">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isExpanded && !isEditing && (
                  <div className="vocab-table-examples-row">
                    <ExamplePhrasesPanel
                      word={vw}
                      variant="vocab"
                      onGenerate={handleGenerate}
                      onRegenerate={handleRegenerate}
                      isGenerating={generatingId === vw.id}
                      regeneratingIndex={
                        regeneratingSlot?.wordId === vw.id ? regeneratingSlot.index : null
                      }
                    />
                  </div>
                )}
                </div>
              );
            })}
          </div>

          {/* ── Mobile Cards ── */}
          <div className="vocab-cards">
            {filteredAndSortedWords.map((vw) => {
              const isEditing = editingId === vw.id;
              const isExpanded = expandedId === vw.id;
              const isPhrase = vw.entryKind === "phrase";
              return (
                <div key={vw.id} className={`vocab-card-item${isEditing ? " editing" : ""}`}>
                  {/* Card top: Hebrew (right-aligned) + actions */}
                  <div className="vocab-card-top">
                    <div className="vocab-card-actions">
                      {isEditing ? (
                        <>
                          <button onClick={() => saveEdit(vw.id)} title={t("save")} className="vocab-action-btn save">
                            <Check size={14} />
                          </button>
                          <button onClick={cancelEdit} title={t("cancel")} className="vocab-action-btn cancel">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          {vw.dictionaryPealimId && !isPhrase && (
                            <button
                              onClick={() => setDetailsPealimId(vw.dictionaryPealimId!)}
                              title={t("viewConjugations")}
                              className="vocab-action-btn details"
                            >
                              <BookOpen size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => toggleExamples(vw.id)}
                            title={t("examples")}
                            className={`vocab-action-btn examples${isExpanded ? " active" : ""}`}
                          >
                            <MessageSquare size={14} />
                          </button>
                          <button onClick={() => startEdit(vw)} title={t("edit")} className="vocab-action-btn edit">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => onDeleteWord(vw.id)} title={t("delete")} className="vocab-action-btn delete">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                    <div className="vocab-card-words">
                      {isEditing ? (
                        <input
                          dir="rtl"
                          lang="he"
                          value={editValues.wordWithNekudot}
                          onChange={(e) => setEditValues({ ...editValues, wordWithNekudot: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && saveEdit(vw.id)}
                          className="vocab-edit-input font-serif"
                          style={{ fontSize: "22px", color: "var(--accent)", textAlign: "right", marginBottom: "6px" }}
                        />
                      ) : (
                        <>
                          {isPhrase && (
                            <span className="vocab-entry-phrase-badge">{t("vocabEntryPhraseBadge")}</span>
                          )}
                          <span className="font-serif vocab-card-hebrew" dir="rtl" lang="he">
                            {vw.wordWithNekudot || vw.word}
                          </span>
                        </>
                      )}
                      {!isPhrase && (vw.verbFormWithNekudot || isEditing) && (
                        isEditing ? (
                          <input
                            dir="rtl"
                            lang="he"
                            value={editValues.verbFormWithNekudot}
                            onChange={(e) => setEditValues({ ...editValues, verbFormWithNekudot: e.target.value })}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit(vw.id)}
                            placeholder={t("verbForm")}
                            className="vocab-edit-input font-serif"
                            style={{ fontSize: "16px", textAlign: "right" }}
                          />
                        ) : (
                          <span className="font-serif vocab-card-verb" dir="rtl" lang="he">{vw.verbFormWithNekudot}</span>
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
                        placeholder={t("translation")}
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
                        placeholder={t("pronunciation")}
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

                  {isExpanded && !isEditing && (
                    <ExamplePhrasesPanel
                      word={vw}
                      variant="vocab"
                      onGenerate={handleGenerate}
                      onRegenerate={handleRegenerate}
                      isGenerating={generatingId === vw.id}
                      regeneratingIndex={
                        regeneratingSlot?.wordId === vw.id ? regeneratingSlot.index : null
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <DictionaryDetailsModal
        isOpen={detailsPealimId !== null}
        pealimId={detailsPealimId}
        onClose={() => setDetailsPealimId(null)}
      />

      {user && (
        <button
          type="button"
          className="vocab-add-fab"
          onClick={() => setIsAddModalOpen(true)}
          aria-label={t("addVocabEntry")}
          title={t("addVocabEntry")}
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>
      )}

      <AddVocabWordModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onWordSaved={onWordSaved}
        onRequireAuth={onRequireAuth}
        onRequireSubscription={onRequireSubscription}
        isAuthenticated={isAuthenticated}
      />
    </div>
  );
}
