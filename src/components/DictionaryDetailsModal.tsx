"use client";

import { useEffect, useRef, useState } from "react";
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
  return (
    <div>
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
          aria-label="Play"
        >
          <Volume2 size={12} />
        </button>
      )}
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
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!isOpen || !pealimId) {
      return;
    }

    const cached = entryCache.get(pealimId);
    if (cached) {
      return;
    }

    const requestId = ++requestIdRef.current;
    queueMicrotask(() => {
      if (requestId !== requestIdRef.current) return;
      setIsLoading(true);
      setLoadError(false);
      setEntry(null);
    });

    void getDictionaryEntryDetails(pealimId).then((res) => {
      if (requestId !== requestIdRef.current) return;
      if (res.type === "success" && res.entry) {
        entryCache.set(pealimId, res.entry);
        setEntry(res.entry);
        setLoadError(false);
      } else {
        setLoadError(true);
      }
      setIsLoading(false);
    });
  }, [isOpen, pealimId]);

  const cachedEntry = pealimId ? entryCache.get(pealimId) ?? null : null;
  const displayedEntry = entry?.pealim_id === pealimId ? entry : cachedEntry;
  const displayedLoading = cachedEntry ? false : isLoading;
  const displayedLoadError = cachedEntry ? false : loadError;

  if (!isOpen || !pealimId) return null;

  const sections =
    displayedEntry && displayedEntry.conjugation_sections.length > 0
      ? displayedEntry.conjugation_sections
      : displayedEntry
        ? [{ title: "Forms", subtitle: null, form_ids: displayedEntry.forms.map((f) => f.form_id) }]
        : [];

  return (
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
          <button onClick={onClose} className="close-btn" aria-label={t("close")}>
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

              {displayedEntry.notes.length > 0 && (
                <div className="dictionary-details-notes">
                  {displayedEntry.notes.map((note, i) => (
                    <p key={`${note}-${i}`} style={{ margin: i === 0 ? 0 : "8px 0 0" }}>
                      {note}
                    </p>
                  ))}
                </div>
              )}

              {sections.map((section) => {
                const sectionForms = formsInSection(displayedEntry, section);
                if (sectionForms.length === 0) return null;
                return (
                  <div
                    key={`${section.title}-${section.subtitle ?? ""}`}
                    className="dictionary-details-section"
                  >
                    <h4 className="dictionary-details-section-title">{section.title}</h4>
                    {section.subtitle && (
                      <p className="dictionary-details-section-subtitle">{section.subtitle}</p>
                    )}
                    <ConjugationTable forms={sectionForms} />
                  </div>
                );
              })}

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
    </div>
  );
}
