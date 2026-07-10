import type { SupabaseClient } from "@supabase/supabase-js";
import type { DictionaryEntry, DictionaryForm, ConjugationSection } from "@/lib/types";

const NIQQUD_RE = /[\u0591-\u05C7]/g;
const PREFIX_CHARS = new Set(["ה", "ו", "ב", "כ", "ל", "מ", "ש"]);

export function stripNiqqud(text: string): string {
  return text.replace(NIQQUD_RE, "");
}

export function generatePrefixCandidates(word: string): string[] {
  const plain = stripNiqqud(word.trim());
  if (!plain) return [];

  const candidates: string[] = [];
  const seen = new Set<string>();

  const push = (value: string) => {
    if (value && !seen.has(value)) {
      seen.add(value);
      candidates.push(value);
    }
  };

  push(plain);

  let current = plain;
  for (let i = 0; i < 3; i++) {
    if (current.startsWith("מה") && current.length > 2) {
      current = current.slice(2);
      push(current);
      continue;
    }
    if (current.length > 1 && PREFIX_CHARS.has(current[0]!)) {
      current = current.slice(1);
      push(current);
    } else {
      break;
    }
  }

  return candidates;
}

type DictionaryRow = {
  pealim_id: number;
  slug?: string;
  url?: string;
  word: string;
  word_with_nekudot: string;
  transliteration: string | null;
  audio_url: string | null;
  root: string | null;
  part_of_speech: string;
  pos_detail: string | null;
  meaning: string;
  meanings: string[] | null;
  notes: string[] | null;
  conjugation_sections: ConjugationSection[] | null;
  forms: DictionaryForm[] | null;
  see_also_ids?: number[] | null;
  scraped_at?: string;
};

export function mapDictionaryRow(row: DictionaryRow): DictionaryEntry {
  return {
    pealim_id: row.pealim_id,
    slug: row.slug,
    url: row.url,
    word: row.word,
    word_with_nekudot: row.word_with_nekudot,
    transliteration: row.transliteration,
    audio_url: row.audio_url,
    root: row.root,
    part_of_speech: row.part_of_speech,
    pos_detail: row.pos_detail,
    meaning: row.meaning,
    meanings: row.meanings ?? [],
    notes: row.notes ?? [],
    conjugation_sections: row.conjugation_sections ?? [],
    forms: row.forms ?? [],
    see_also_ids: row.see_also_ids ?? [],
    scraped_at: row.scraped_at,
  };
}

function sortByFormRichness(entries: DictionaryEntry[]): DictionaryEntry[] {
  return [...entries].sort((a, b) => (b.forms?.length ?? 0) - (a.forms?.length ?? 0));
}

function uniqueByPealimId(entries: DictionaryEntry[]): DictionaryEntry[] {
  const map = new Map<number, DictionaryEntry>();
  for (const entry of entries) {
    if (!map.has(entry.pealim_id)) {
      map.set(entry.pealim_id, entry);
    }
  }
  return sortByFormRichness([...map.values()]);
}

async function queryByHeadword(
  client: SupabaseClient,
  candidate: string
): Promise<DictionaryEntry[]> {
  const { data, error } = await client
    .from("dictionary_entries")
    .select("*")
    .eq("word", candidate);

  if (error) {
    console.error("Dictionary headword lookup error:", error);
    return [];
  }
  if (!data?.length) return [];
  return uniqueByPealimId(data.map((row) => mapDictionaryRow(row as DictionaryRow)));
}

async function queryByFormPlain(
  client: SupabaseClient,
  candidate: string
): Promise<DictionaryEntry[]> {
  const { data, error } = await client
    .from("dictionary_entries")
    .select("*")
    .filter("forms", "cs", JSON.stringify([{ hebrew_plain: candidate }]));

  if (error) {
    console.error("Dictionary forms lookup error:", error);
    return [];
  }
  if (!data?.length) return [];
  return uniqueByPealimId(data.map((row) => mapDictionaryRow(row as DictionaryRow)));
}

async function queryByFuzzyMatch(
  client: SupabaseClient,
  word: string
): Promise<DictionaryEntry[]> {
  const plain = stripNiqqud(word);
  if (!plain) return [];

  const { data, error } = await client.rpc("match_dictionary_word", {
    search_word: plain,
  });

  if (error) {
    console.error("Dictionary fuzzy lookup error:", error);
    return [];
  }
  if (!data?.length) return [];
  return uniqueByPealimId(data.map((row: DictionaryRow) => mapDictionaryRow(row)));
}

export async function findDictionaryCandidates(
  client: SupabaseClient | null,
  word: string
): Promise<DictionaryEntry[]> {
  if (!client) return [];

  const candidates = generatePrefixCandidates(word);
  if (candidates.length === 0) return [];

  for (const candidate of candidates) {
    const headwordMatches = await queryByHeadword(client, candidate);
    if (headwordMatches.length > 0) {
      return headwordMatches;
    }

    const formMatches = await queryByFormPlain(client, candidate);
    if (formMatches.length > 0) {
      return formMatches;
    }
  }

  return queryByFuzzyMatch(client, word);
}

export type DictionarySuggestion = {
  pealimId: number;
  word: string;
  wordWithNekudot: string;
  transliteration: string | null;
  partOfSpeech: string;
  meaning: string;
};

const SUGGESTION_SELECT =
  "pealim_id, word, word_with_nekudot, transliteration, part_of_speech, meaning";

function mapSuggestionRow(row: {
  pealim_id: number;
  word: string;
  word_with_nekudot: string;
  transliteration: string | null;
  part_of_speech: string;
  meaning: string;
}): DictionarySuggestion {
  return {
    pealimId: row.pealim_id,
    word: row.word,
    wordWithNekudot: row.word_with_nekudot,
    transliteration: row.transliteration,
    partOfSpeech: row.part_of_speech,
    meaning: row.meaning,
  };
}

function meaningMatchRank(meaning: string, query: string): number {
  const parts = meaning
    .toLowerCase()
    .split(/[,;/|]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.some((part) => part === query)) return 0;
  if (parts.some((part) => part.startsWith(query))) return 1;
  if (parts.some((part) => part.split(/\s+/).includes(query))) return 2;
  if (meaning.toLowerCase().includes(query)) return 3;
  return 4;
}

function rankSuggestions(
  rows: DictionarySuggestion[],
  query: string
): DictionarySuggestion[] {
  const plain = stripNiqqud(query).toLowerCase();
  const isLatin = /^[a-z'’\-\s]+$/.test(plain);
  const seen = new Set<number>();
  const unique = rows.filter((row) => {
    if (seen.has(row.pealimId)) return false;
    seen.add(row.pealimId);
    return true;
  });

  return unique.sort((a, b) => {
    if (isLatin) {
      const aTranslit = (a.transliteration ?? "").toLowerCase();
      const bTranslit = (b.transliteration ?? "").toLowerCase();
      const aTranslitRank =
        aTranslit === plain ? 0 : aTranslit.startsWith(plain) ? 1 : 2;
      const bTranslitRank =
        bTranslit === plain ? 0 : bTranslit.startsWith(plain) ? 1 : 2;
      const aMeaningRank = meaningMatchRank(a.meaning, plain);
      const bMeaningRank = meaningMatchRank(b.meaning, plain);
      const aRank = Math.min(aTranslitRank, aMeaningRank + 0.5);
      const bRank = Math.min(bTranslitRank, bMeaningRank + 0.5);
      if (aRank !== bRank) return aRank - bRank;
      if (aMeaningRank !== bMeaningRank) return aMeaningRank - bMeaningRank;
      return a.word.localeCompare(b.word, "he");
    }

    const aWord = a.word.toLowerCase();
    const bWord = b.word.toLowerCase();
    const aExact = aWord === plain ? 0 : aWord.startsWith(plain) ? 1 : 2;
    const bExact = bWord === plain ? 0 : bWord.startsWith(plain) ? 1 : 2;
    if (aExact !== bExact) return aExact - bExact;
    if (a.word.length !== b.word.length) return a.word.length - b.word.length;
    return a.word.localeCompare(b.word, "he");
  });
}

export async function searchDictionaryPrefix(
  client: SupabaseClient | null,
  query: string,
  limit = 8
): Promise<DictionarySuggestion[]> {
  if (!client) return [];

  const plain = stripNiqqud(query.trim());
  if (!plain) return [];

  const pattern = `${plain}%`;
  const isLatin = /^[a-zA-Z'’\-\s]+$/.test(plain);
  const meaningPattern = `%${plain}%`;

  const wordQuery = client
    .from("dictionary_entries")
    .select(SUGGESTION_SELECT)
    .ilike("word", pattern)
    .order("word")
    .limit(limit);

  const translitQuery = isLatin
    ? client
        .from("dictionary_entries")
        .select(SUGGESTION_SELECT)
        .ilike("transliteration", pattern)
        .order("transliteration")
        .limit(limit)
    : null;

  // English (and other Latin) gloss lookup — meaning is often "moist, damp, humid".
  const meaningQuery =
    isLatin && plain.length >= 2
      ? client
          .from("dictionary_entries")
          .select(SUGGESTION_SELECT)
          .ilike("meaning", meaningPattern)
          .limit(limit * 2)
      : null;

  const [wordRes, translitRes, meaningRes] = await Promise.all([
    wordQuery,
    translitQuery ?? Promise.resolve({ data: null, error: null }),
    meaningQuery ?? Promise.resolve({ data: null, error: null }),
  ]);

  if (wordRes.error) {
    console.error("Dictionary prefix search error:", wordRes.error);
  }
  if (translitRes.error) {
    console.error("Dictionary transliteration search error:", translitRes.error);
  }
  if (meaningRes.error) {
    console.error("Dictionary meaning search error:", meaningRes.error);
  }

  const rows = [
    ...(wordRes.data ?? []),
    ...(translitRes.data ?? []),
    ...(meaningRes.data ?? []),
  ].map((row) => mapSuggestionRow(row as Parameters<typeof mapSuggestionRow>[0]));

  return rankSuggestions(rows, plain).slice(0, limit);
}

export function isVerbPartOfSpeech(partOfSpeech: string): boolean {
  return partOfSpeech.toLowerCase().startsWith("verb");
}
