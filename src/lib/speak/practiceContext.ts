import type { SpeakTargetWord } from "./types";
import { SPEAK_TARGET_WORDS_MAX } from "./types";

export type SpeakVocabRow = {
  id: string;
  word: string;
  translation: string;
  saved_at: number | string;
};

export type SpeakProgressRow = {
  vocab_id: string;
  next_review_at: string | null;
  is_learned: boolean | null;
};

const HEBREW_TOKEN = /[\u0590-\u05FF]{2,}/g;

export function extractHebrewTokens(text: string, max = 5): string[] {
  const tokens = text.match(HEBREW_TOKEN) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= max) break;
  }
  return out;
}

export function pickSpeakTargetWords(
  vocab: SpeakVocabRow[],
  progress: SpeakProgressRow[],
  nowIso: string,
  max = SPEAK_TARGET_WORDS_MAX
): SpeakTargetWord[] {
  const progressByVocab = new Map(progress.map((row) => [row.vocab_id, row]));
  const due: SpeakVocabRow[] = [];
  const rest: SpeakVocabRow[] = [];

  const sorted = [...vocab].sort(
    (a, b) => Number(b.saved_at) - Number(a.saved_at)
  );

  for (const row of sorted) {
    const prog = progressByVocab.get(row.id);
    const isDue =
      !prog ||
      (!prog.is_learned && (prog.next_review_at == null || prog.next_review_at <= nowIso));
    if (isDue) due.push(row);
    else rest.push(row);
  }

  const picked: SpeakTargetWord[] = [];
  const seen = new Set<string>();
  for (const row of [...due, ...rest]) {
    const word = row.word.trim();
    if (!word || seen.has(word)) continue;
    seen.add(word);
    picked.push({
      word,
      translation: row.translation.trim().slice(0, 80),
    });
    if (picked.length >= max) break;
  }
  return picked;
}

export function formatPracticeContextBlock(
  targetWords: SpeakTargetWord[],
  episodeTitle: string | null,
  episodeWords: string[]
): string {
  const lines: string[] = [];
  if (targetWords.length > 0) {
    lines.push("# Words to weave in");
    lines.push(
      "Use 2–3 of these naturally if they fit. Recast once if the learner misses them. Do not quiz."
    );
    for (const item of targetWords) {
      lines.push(`- ${item.word}${item.translation ? ` (${item.translation})` : ""}`);
    }
  }
  if (episodeTitle || episodeWords.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("# Current episode");
    if (episodeTitle) lines.push(`Title: ${episodeTitle}`);
    if (episodeWords.length > 0) {
      lines.push(`Hebrew from the episode: ${episodeWords.join(", ")}`);
    }
    lines.push(
      "You may mention the episode once if it fits the talk. Do not lecture about it."
    );
  }
  return lines.join("\n");
}
