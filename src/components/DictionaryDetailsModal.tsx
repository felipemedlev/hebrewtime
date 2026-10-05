"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Volume2 } from "lucide-react";
import { getDictionaryEntryDetails } from "@/app/actions";
import { useModalAccessibility } from "@/hooks/useModalAccessibility";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { ConjugationSection, DictionaryEntryDetails, DictionaryForm } from "@/lib/types";
import {
  buildColumnLabels,
  layoutRowCells,
} from "@/lib/dictionaryTableLayout";

type DictionaryDetailsModalProps = {
  isOpen: boolean;
  pealimId: number | null;
  onClose: () => void;
};

const entryCache = new Map<number, DictionaryEntryDetails>();

function playAudio(url: string) {
  const audio = new Audio(url);
  void audio.play().catch(() => undefined);
}

function formsInSection(entry: DictionaryEntryDetails, section: ConjugationSection): DictionaryForm[] {
  const byId = new Map(entry.forms.map((form) => [form.form_id, form]));
  return section.form_ids
    .map((id) => byId.get(id))
    .filter((form): form is DictionaryForm => Boolean(form));
}

function ConjugationTable({ forms }: { forms: DictionaryForm[] }) {
  if (forms.length === 0) return null;

  const colLabels = buildColumnLabels(forms);
  const hasColumns =
    colLabels.length > 1 ||
    (colLabels.length === 1 && forms.some((f) => f.column_label && f.column_label !== "—"));

  if (!hasColumns) {
    return (
      <div className="dictionary-details-table-wrap">
        <table className="dictionary-details-table">
          <tbody>
            {forms.map((form) => (
              <tr key={form.form_id}>
                <td className="row-header">{form.row_label || form.form_id}</td>
                <td>
                  <FormCell form={form} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const rowLabels: string[] = [];
  const formsByRow = new Map<string, DictionaryForm[]>();

  for (const form of forms) {
    const row = form.row_label || "—";
    if (!rowLabels.includes(row)) rowLabels.push(row);
    const bucket = formsByRow.get(row) ?? [];
    bucket.push(form);
    formsByRow.set(row, bucket);
  }

  return (
    <div className="dictionary-details-table-wrap">
      <table className="dictionary-details-table">
        <thead>
          <tr>
            <th className="row-header" />
            {colLabels.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map((row) => {
            const rowForms = formsByRow.get(row) ?? [];
            const cells = layoutRowCells(rowForms, colLabels);
            return (
              <tr key={row}>
                <td className="row-header">{row}</td>
                {cells.map((cell) => (
                  <td key={cell.key} colSpan={cell.colspan}>
                    {cell.form ? (
                      <FormCell form={cell.form} />
                    ) : (
                      <span className="vocab-dash">—</span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FormCell({ form }: { form: DictionaryForm }) {
  const t = useT();
  return (
    <div className="dictionary-details-form-cell">
      <div className="dictionary-details-cell-hebrew font-serif" dir="rtl" lang="he">
        {form.hebrew_with_nekudot}
      </div>
      {form.transliteration && (
        <div className="dictionary-details-cell-translit">{form.transliteration}</div>
      )}
      {form.meaning && <div className="dictionary-details-cell-meaning">{form.meaning}</div>}
      {form.audio_url && (
        <button
          type="button"
          className="dictionary-details-cell-audio"
          onClick={() => playAudio(form.audio_url!)}
          aria-label={t("playAudio")}
        >
          <Volume2 size={12} />
        </button>
      )}
    </div>
  );
}

function ConjugationSections({ entry }: { entry: DictionaryEntryDetails }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const sectionId = useId();
  const t = useT();
  const sections = (entry.conjugation_sections.length > 0
    ? entry.conjugation_sections
    : [{ title: "Forms", subtitle: null, form_ids: entry.forms.map((form) => form.form_id) }]
  ).filter((section) => formsInSection(entry, section).length > 0);
  const selectedSection = sections[selectedIndex];
  if (!selectedSection) return null;
  const forms = formsInSection(entry, selectedSection);

  return (
    <div className="dictionary-details-conjugations">
      {sections.length > 1 && (
        <nav className="dictionary-details-section-nav" aria-label={t("viewConjugations")}>
          {sections.map((section, index) => (
            <button
              key={`${section.title}-${section.subtitle ?? ""}`}
              type="button"
              aria-pressed={index === selectedIndex}
              aria-controls={sectionId}
              onClick={() => setSelectedIndex(index)}
            >
              {section.title}
            </button>
          ))}
        </nav>
      )}
      <section id={sectionId} className="dictionary-details-section" aria-labelledby={`${sectionId}-title`}>
        <h4 id={`${sectionId}-title`} className="dictionary-details-section-title">{selectedSection.title}</h4>
        {selectedSection.subtitle && (
          <p className="dictionary-details-section-subtitle">{selectedSection.subtitle}</p>
        )}
        <div className="dictionary-details-desktop-forms">
          <ConjugationTable forms={forms} />
        </div>
        <ul className="dictionary-details-mobile-forms">
          {forms.map((form) => (
            <li key={form.form_id}>
              <span className="dictionary-details-form-label">
                {[form.row_label, form.column_label].filter((label) => label && label !== "—").join(" · ") || form.form_id}
              </span>
              <FormCell form={form} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function DictionaryDetailsModal({
  isOpen,
  pealimId,
  onClose,
}: DictionaryDetailsModalProps) {
  const t = useT();
  const { dialogRef, titleId } = useModalAccessibility(isOpen, onClose);
  const [entry, setEntry] = useState<DictionaryEntryDetails | null>(null);
  const [loadState, setLoadState] = useState<{ pealimId: number | null; status: "loading" | "loaded" | "error" }>({ pealimId: null, status: "loading" });

  useEffect(() => {
    if (!isOpen || !pealimId) {
      return;
    }

    const cached = entryCache.get(pealimId);
    if (cached) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoadState({ pealimId, status: "loading" });
      setEntry(null);
    });

    void getDictionaryEntryDetails(pealimId).then((res) => {
      if (cancelled) return;
      if (res.type === "success" && res.entry) {
        entryCache.set(pealimId, res.entry);
        setEntry(res.entry);
        setLoadState({ pealimId, status: "loaded" });
      } else {
        setLoadState({ pealimId, status: "error" });
      }
    }).catch(() => {
      if (cancelled) return;
      setLoadState({ pealimId, status: "error" });
    });

    return () => { cancelled = true; };
  }, [isOpen, pealimId]);

  const cachedEntry = pealimId ? entryCache.get(pealimId) ?? null : null;
  const displayedEntry = entry?.pealim_id === pealimId ? entry : cachedEntry;
  const displayedLoading = !cachedEntry && (loadState.pealimId !== pealimId || loadState.status === "loading");
  const displayedLoadError = !cachedEntry && loadState.pealimId === pealimId && loadState.status === "error";

  if (!isOpen || !pealimId) return null;

  return createPortal(
    <div
      className="modal-overlay dictionary-details-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-header">
          <div>
            <p className="dictionary-details-eyebrow">{t("viewConjugations")}</p>
            <h3 id={titleId} className="modal-title font-serif" dir="rtl" lang="he">
              {displayedEntry?.word_with_nekudot || "…"}
            </h3>
            {displayedEntry && (
              <div className="dictionary-details-meta">
                {displayedEntry.transliteration && (
                  <p className="dictionary-details-translit">{displayedEntry.transliteration}</p>
                )}
                <span className="dictionary-details-pill">{displayedEntry.part_of_speech}</span>
                {displayedEntry.root && <span className="dictionary-details-pill">{displayedEntry.root}</span>}
                {displayedEntry.audio_url && (
                  <button
                    type="button"
                    className="dictionary-details-audio-btn"
                    onClick={() => playAudio(displayedEntry.audio_url!)}
                    aria-label={t("playAudio")}
                  >
                    <Volume2 size={16} />
                  </button>
                )}
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} className="close-btn" aria-label={t("close")}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body dictionary-details-body">
          {displayedLoading ? (
            <div className="translating-state">
              <Loader2 className="spinner" size={24} />
              <span>{t("loadingDetails")}</span>
            </div>
          ) : displayedLoadError || !displayedEntry ? (
            <p className="dictionary-details-empty">{t("dictionaryLoadError")}</p>
          ) : (
            <>
              {displayedEntry.meanings.length > 0 ? (
                <ul className="dictionary-details-meanings">
                  {displayedEntry.meanings.map((meaning, i) => (
                    <li key={`${meaning}-${i}`}>{meaning}</li>
                  ))}
                </ul>
              ) : (
                <p className="dictionary-details-meanings" style={{ listStyle: "none", padding: 0 }}>
                  {displayedEntry.meaning}
                </p>
              )}

              <ConjugationSections key={displayedEntry.pealim_id} entry={displayedEntry} />

              {displayedEntry.notes.length > 0 && (
                <div className="dictionary-details-notes">
                  {displayedEntry.notes.map((note, i) => (
                    <p key={`${note}-${i}`} style={{ margin: i === 0 ? 0 : "8px 0 0" }}>
                      {note}
                    </p>
                  ))}
                </div>
              )}

              {displayedEntry.forms.length === 0 && (
                <p className="dictionary-details-empty">{t("noConjugationForms")}</p>
              )}
            </>
          )}
        </div>

        <div className="modal-footer dictionary-details-footer">
          <button type="button" className="dictionary-details-secondary-btn" onClick={onClose}>
            {t("close")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
