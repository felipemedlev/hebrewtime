import type { DictionaryForm } from "@/lib/types";

const COLUMN_ORDER: Array<[string, string]> = [
  ["singular", "masculine"],
  ["singular", "feminine"],
  ["plural", "masculine"],
  ["plural", "feminine"],
];

type RowSlot = DictionaryForm | "EMPTY" | "SPAN";

export type TableRenderCell = {
  key: string;
  colspan: number;
  form: DictionaryForm | null;
};

function columnScore(label: string): number {
  const lower = label.toLowerCase();
  for (let i = 0; i < COLUMN_ORDER.length; i++) {
    const [number, gender] = COLUMN_ORDER[i]!;
    if (lower.includes(number) && lower.includes(gender)) return i;
  }
  if (lower.includes("singular")) return 50;
  if (lower.includes("plural")) return 51;
  return 100;
}

export function sortColumnLabels(labels: string[]): string[] {
  return [...labels].sort((a, b) => columnScore(a) - columnScore(b));
}

function matchesColumn(
  columnLabel: string,
  number: string | null,
  gender: string | null
): boolean {
  const col = columnLabel.toLowerCase();
  if (number === "singular" && !col.includes("singular")) return false;
  if (number === "plural" && !col.includes("plural")) return false;
  if (gender === "masculine" && !col.includes("masculine")) return false;
  if (gender === "feminine" && !col.includes("feminine")) return false;
  return true;
}

function indicesMatchingNumber(colLabels: string[], number: string): number[] {
  return colLabels
    .map((col, i) => ({ col, i }))
    .filter(({ col }) => col.toLowerCase().includes(number))
    .map(({ i }) => i);
}

function inferSpanFromFormId(formId: string, colLabels: string[]): number[] {
  const id = formId.replace(/^passive-/, "");
  const match = id.match(/^(?:AP|PERF|IMPF|IMP)-(.+)$/i);
  if (!match) return [];

  const suffix = match[1]!.toLowerCase();

  const oneGender = (number: string, gender: string) =>
    colLabels
      .map((col, i) => ({ col, i }))
      .filter(({ col }) => matchesColumn(col, number, gender))
      .map(({ i }) => i);

  if (suffix === "1s") return indicesMatchingNumber(colLabels, "singular");
  if (suffix === "1p") return indicesMatchingNumber(colLabels, "plural");
  if (suffix === "ms") return oneGender("singular", "masculine");
  if (suffix === "fs") return oneGender("singular", "feminine");
  if (suffix === "mp") return oneGender("plural", "masculine");
  if (suffix === "fp") return oneGender("plural", "feminine");
  if (suffix === "2ms") return oneGender("singular", "masculine");
  if (suffix === "2fs") return oneGender("singular", "feminine");
  if (suffix === "2mp") return oneGender("plural", "masculine");
  if (suffix === "2fp") return oneGender("plural", "feminine");
  if (suffix === "3ms") return oneGender("singular", "masculine");
  if (suffix === "3fs") return oneGender("singular", "feminine");
  if (suffix === "3mp") return oneGender("plural", "masculine");
  if (suffix === "3fp") return oneGender("plural", "feminine");
  if (suffix === "3p") return indicesMatchingNumber(colLabels, "plural");

  return [];
}

export function getSpanColumnIndices(
  form: DictionaryForm,
  colLabels: string[]
): number[] {
  if (
    form.column_label &&
    form.column_label !== "—" &&
    colLabels.includes(form.column_label)
  ) {
    return [colLabels.indexOf(form.column_label)];
  }

  const broadLabel = (form.column_label || "").toLowerCase();
  if (broadLabel && broadLabel !== "—") {
    const matches = colLabels
      .map((col, i) => ({ col, i }))
      .filter(({ col }) => col.toLowerCase().includes(broadLabel))
      .map(({ i }) => i);
    if (matches.length > 0) return matches;
  }

  if (form.gender) {
    const idx = colLabels.findIndex((col) =>
      matchesColumn(col, form.number, form.gender)
    );
    if (idx >= 0) return [idx];
  }

  if (!form.gender && form.number) {
    return indicesMatchingNumber(colLabels, form.number.toLowerCase());
  }

  const fromFormId = inferSpanFromFormId(form.form_id, colLabels);
  if (fromFormId.length > 0) return fromFormId;

  return [];
}

export function buildColumnLabels(forms: DictionaryForm[]): string[] {
  const gendered = forms
    .filter((f) => f.gender && f.column_label && f.column_label !== "—")
    .map((f) => f.column_label!);

  const uniqueGendered = [...new Set(gendered)];
  if (uniqueGendered.length >= 2) {
    return sortColumnLabels(uniqueGendered);
  }

  const all = [
    ...new Set(
      forms
        .map((f) => f.column_label)
        .filter((label): label is string => Boolean(label && label !== "—"))
    ),
  ];

  return sortColumnLabels(all);
}

function placeForm(
  slots: RowSlot[],
  form: DictionaryForm,
  indices: number[]
): boolean {
  const free = indices.filter((i) => slots[i] === "EMPTY");
  if (free.length === 0) return false;

  if (free.length === 1) {
    slots[free[0]!] = form;
    return true;
  }

  const sorted = [...free].sort((a, b) => a - b);
  const isContiguous = sorted.every(
    (value, idx) => idx === 0 || value === sorted[idx - 1]! + 1
  );

  if (!isContiguous) {
    slots[sorted[0]!] = form;
    return true;
  }

  slots[sorted[0]!] = form;
  for (let i = 1; i < sorted.length; i++) {
    slots[sorted[i]!] = "SPAN";
  }
  return true;
}

export function layoutRowCells(
  formsInRow: DictionaryForm[],
  colLabels: string[]
): TableRenderCell[] {
  const slots: RowSlot[] = Array(colLabels.length).fill("EMPTY");
  const placed = new Set<string>();
  const withHebrew = formsInRow.filter((f) => f.hebrew_with_nekudot);

  const place = (form: DictionaryForm, indices: number[]) => {
    if (placed.has(form.form_id)) return;
    if (placeForm(slots, form, indices)) {
      placed.add(form.form_id);
    }
  };

  for (const form of withHebrew) {
    if (
      form.column_label &&
      form.column_label !== "—" &&
      colLabels.includes(form.column_label)
    ) {
      place(form, [colLabels.indexOf(form.column_label)]);
    }
  }

  for (const form of withHebrew) {
    if (placed.has(form.form_id)) continue;
    if (form.gender) {
      const idx = colLabels.findIndex((col) =>
        matchesColumn(col, form.number, form.gender)
      );
      if (idx >= 0) place(form, [idx]);
    }
  }

  for (const form of withHebrew) {
    if (placed.has(form.form_id)) continue;
    const indices = getSpanColumnIndices(form, colLabels);
    if (indices.length > 0) place(form, indices);
  }

  for (const form of withHebrew) {
    if (placed.has(form.form_id)) continue;
    const firstEmpty = slots.findIndex((slot) => slot === "EMPTY");
    if (firstEmpty >= 0) place(form, [firstEmpty]);
  }

  const renderCells: TableRenderCell[] = [];
  let i = 0;
  while (i < colLabels.length) {
    const slot = slots[i]!;
    if (slot === "SPAN") {
      i++;
      continue;
    }
    if (slot === "EMPTY") {
      renderCells.push({ key: `empty-${i}`, colspan: 1, form: null });
      i++;
      continue;
    }

    let colspan = 1;
    while (i + colspan < colLabels.length && slots[i + colspan] === "SPAN") {
      colspan++;
    }
    renderCells.push({
      key: slot.form_id,
      colspan,
      form: slot,
    });
    i += colspan;
  }

  return renderCells;
}
