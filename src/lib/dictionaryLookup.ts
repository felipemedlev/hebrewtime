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

export function isVerbPartOfSpeech(partOfSpeech: string): boolean {
  return partOfSpeech.toLowerCase().startsWith("verb");
}
