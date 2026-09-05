import fs from "fs";
import path from "path";
import { cache } from "react";
import type {
  Episode,
  EpisodeListItem,
  EpisodeTranslations,
  Level,
  ParagraphTiming,
} from "./types";
import { isLangCode, type LangCode } from "./i18n/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const LEVEL_SLUG_REGEX = /^[a-z0-9-]+$/;
const SUPABASE_FETCH_TIMEOUT_MS = 10_000;

export function isLevelSlugFormatValid(level: string): boolean {
  return LEVEL_SLUG_REGEX.test(level) && level.length > 0 && level.length <= 64;
}

type EpisodeRow = {
  id: string;
  level_slug: string;
  episode_number: number;
  title: string;
  url: string;
  audio_url: string | null;
  hebrew_text: string;
  hebrew_paragraphs: unknown;
  english_paragraphs: unknown;
  translations?: unknown;
  is_published: boolean;
};

type LevelRow = {
  slug: string;
  name: string;
  cefr: string | null;
  sort_order: number;
};

function getServiceHeaders(): HeadersInit | null {
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;
  return {
    "Content-Type": "application/json",
    apikey: supabaseServiceRoleKey,
    Authorization: `Bearer ${supabaseServiceRoleKey}`,
  };
}

async function supabaseFetch<T>(path: string): Promise<T | null> {
  const headers = getServiceHeaders();
  if (!headers || !supabaseUrl) return null;

  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    // Build and request-time fallbacks can still serve the checked-in legacy
    // catalog when Supabase is unavailable. Keep the failure bounded and
    // avoid leaking upstream details to callers.
    console.error(
      `Supabase fetch failed (${path}):`,
      error instanceof Error ? error.message : "unknown error"
    );
    return null;
  }

  if (!res.ok) {
    console.error(`Supabase fetch failed (${path}):`, res.status, await res.text());
    return null;
  }

  return (await res.json()) as T;
}

function normalizeTitle(title: string, episodeNumber: number): string {
  let normalizedTitle = title;
  const bracketMatch = normalizedTitle.match(/^\[(\d+)\]\s*(.*)/);
  if (bracketMatch) {
    normalizedTitle = `Episode ${bracketMatch[1]}: ${bracketMatch[2]}`;
  }
  if (!/^Episode\s/i.test(normalizedTitle)) {
    normalizedTitle = `Episode ${String(episodeNumber).padStart(2, "0")}: ${normalizedTitle}`;
  }
  return normalizedTitle;
}

function mapParagraphs(raw: unknown): Episode["hebrew_paragraphs"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object" && "text" in item) {
      return item as ParagraphTiming;
    }
    return String(item);
  });
}

function mapTranslations(
  raw: unknown,
  englishParagraphs: string[]
): EpisodeTranslations {
  const result: EpisodeTranslations = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (isLangCode(key) && Array.isArray(value)) {
        result[key as LangCode] = value.map(String);
      }
    }
  }
  if (!result.en?.length && englishParagraphs.length > 0) {
    result.en = englishParagraphs;
  }
  return result;
}

function mapEpisodeRow(row: EpisodeRow): Episode {
  const englishParagraphs = Array.isArray(row.english_paragraphs)
    ? (row.english_paragraphs as string[])
    : [];
  const translations = mapTranslations(row.translations, englishParagraphs);
  return {
    id: row.id,
    level: row.level_slug,
    episode: row.episode_number,
    url: row.url ?? "",
    audio_url: row.audio_url ?? undefined,
    title: normalizeTitle(row.title, row.episode_number),
    hebrew_paragraphs: mapParagraphs(row.hebrew_paragraphs),
    hebrew_text: row.hebrew_text ?? "",
    english_paragraphs: englishParagraphs,
    translations,
  };
}

let legacyCache: Episode[] | null = null;

function loadLegacyEpisodes(): Episode[] {
  if (legacyCache) return legacyCache;

  try {
    const filePath = path.join(process.cwd(), "pipeline", "data", "episodes.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as Array<Record<string, unknown>>;

    const mapped = data
      .map((ep) => {
        const episodeNumber = Number(ep.episode);
        if (Number.isNaN(episodeNumber)) return null;
        const englishParagraphs = Array.isArray(ep.english_paragraphs)
          ? (ep.english_paragraphs as string[])
          : [];
        return {
          id: `legacy-intermediate-${episodeNumber}`,
          level: "intermediate",
          episode: episodeNumber,
          url: String(ep.url ?? ""),
          audio_url: ep.audio_url ? String(ep.audio_url) : undefined,
          title: normalizeTitle(String(ep.title ?? ""), episodeNumber),
          hebrew_paragraphs: mapParagraphs(ep.hebrew_paragraphs),
          hebrew_text: String(ep.hebrew_text ?? ""),
          english_paragraphs: englishParagraphs,
          translations: mapTranslations(ep.translations, englishParagraphs),
        } satisfies Episode;
      })
      .filter((ep) => ep !== null) as Episode[];

    legacyCache = mapped.sort((a, b) => a.episode - b.episode);
  } catch {
    legacyCache = [];
  }

  return legacyCache ?? [];
}

function legacyEpisodesForLevel(level: string): Episode[] {
  return loadLegacyEpisodes().filter((ep) => ep.level === level);
}

export const getLevels = cache(async function getLevels(): Promise<Level[]> {
  const rows = await supabaseFetch<LevelRow[]>(
    "levels?select=slug,name,cefr,sort_order&order=sort_order.asc"
  );

  if (!rows || rows.length === 0) {
    return [
      { slug: "beginner", name: "Beginner", cefr: "A1", sortOrder: 0 },
      { slug: "intermediate", name: "Intermediate", cefr: "B1", sortOrder: 1 },
    ];
  }

  const episodeParams = await getAllPublishedEpisodeParams();
  const levelsWithEpisodes = new Set(episodeParams.map((param) => param.level));
  const visibleRows = rows.filter((row) => levelsWithEpisodes.has(row.slug));

  return visibleRows.map((row) => ({
    slug: row.slug,
    name: row.name,
    cefr: row.cefr,
    sortOrder: row.sort_order,
  }));
});

export async function isKnownLevelSlug(level: string): Promise<boolean> {
  if (!isLevelSlugFormatValid(level)) return false;
  const levels = await getLevels();
  return levels.some((entry) => entry.slug === level);
}

export async function getDefaultLevel(): Promise<string> {
  const levels = await getLevels();
  const hasBeginner = levels.some((l) => l.slug === "beginner");
  const beginnerList = await getEpisodesList("beginner");
  if (hasBeginner && beginnerList.length > 0) return "beginner";
  return levels[0]?.slug ?? "intermediate";
}

export const getEpisodesList = cache(async function getEpisodesList(
  level: string
): Promise<EpisodeListItem[]> {
  const rows = await supabaseFetch<EpisodeRow[]>(
    `episodes?select=id,level_slug,episode_number,title&level_slug=eq.${encodeURIComponent(level)}&is_published=eq.true&order=episode_number.asc`
  );

  if (rows && rows.length > 0) {
    return rows.map((row) => ({
      level: row.level_slug,
      episode: row.episode_number,
      title: normalizeTitle(row.title, row.episode_number),
    }));
  }

  return legacyEpisodesForLevel(level).map((ep) => ({
    level: ep.level,
    episode: ep.episode,
    title: ep.title,
  }));
});

export async function getAllPublishedEpisodeParams(): Promise<
  { level: string; id: string }[]
> {
  const rows = await supabaseFetch<Pick<EpisodeRow, "level_slug" | "episode_number">[]>(
    "episodes?select=level_slug,episode_number&is_published=eq.true&order=level_slug.asc,episode_number.asc"
  );

  if (rows && rows.length > 0) {
    return rows.map((row) => ({
      level: row.level_slug,
      id: String(row.episode_number),
    }));
  }

  return loadLegacyEpisodes().map((ep) => ({
    level: ep.level,
    id: String(ep.episode),
  }));
}

export async function getEpisode(level: string, num: number): Promise<Episode | null> {
  const rows = await supabaseFetch<EpisodeRow[]>(
    `episodes?select=*&level_slug=eq.${encodeURIComponent(level)}&episode_number=eq.${num}&is_published=eq.true&limit=1`
  );

  if (rows && rows.length > 0) return mapEpisodeRow(rows[0]);

  return legacyEpisodesForLevel(level).find((ep) => ep.episode === num) ?? null;
}

/** Load only a published database episode. This intentionally does not use the legacy fallback. */
export async function getPublishedEpisode(level: string, num: number): Promise<Episode | null> {
  const rows = await supabaseFetch<EpisodeRow[]>(
    `episodes?select=*&level_slug=eq.${encodeURIComponent(level)}&episode_number=eq.${num}&is_published=eq.true&limit=1`
  );
  return rows && rows.length > 0 ? mapEpisodeRow(rows[0]) : null;
}

export async function getFirstEpisodeNum(level: string): Promise<number | null> {
  const list = await getEpisodesList(level);
  return list.length > 0 ? list[0].episode : null;
}

export async function getAllEpisodesList(): Promise<EpisodeListItem[]> {
  const levels = await getLevels();
  const lists = await Promise.all(levels.map((l) => getEpisodesList(l.slug)));
  return lists.flat();
}
