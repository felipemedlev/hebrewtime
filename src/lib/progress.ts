export const BOOKMARKS_VERSION = 1;
export const BOOKMARKS_KEY = "hebrewtime-bookmarks-v1";
export const LEGACY_PROGRESS_KEY = "finished-episodes";

export type LessonBookmark = {
  version: typeof BOOKMARKS_VERSION;
  level: string;
  episode: number;
  paragraphIndex: number | null;
  audioSeconds: number;
  scrollTop: number;
  updatedAt: string;
};

export type LessonBookmarkWriteResult = {
  bookmark: LessonBookmark;
  persisted: boolean;
};

type BookmarkMap = Record<string, LessonBookmark>;
const LEVEL_SLUG_REGEX = /^[a-z0-9-]{1,64}$/;

function storageKey(userId?: string | null): string {
  return userId ? `${BOOKMARKS_KEY}:${userId}` : BOOKMARKS_KEY;
}

function safeNumber(value: unknown, fallback: number, min = 0): number {
  return typeof value === "number" && Number.isFinite(value) && value >= min ? value : fallback;
}

function parseBookmark(value: unknown): LessonBookmark | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<LessonBookmark>;
  if (
    candidate.version !== BOOKMARKS_VERSION ||
    typeof candidate.level !== "string" ||
    !LEVEL_SLUG_REGEX.test(candidate.level)
  ) return null;
  const episode = candidate.episode;
  if (typeof episode !== "number" || !Number.isSafeInteger(episode) || episode < 1) return null;
  return {
    version: BOOKMARKS_VERSION,
    level: candidate.level,
    episode,
    paragraphIndex:
      candidate.paragraphIndex === null || candidate.paragraphIndex === undefined
        ? null
        : Number.isInteger(candidate.paragraphIndex) && candidate.paragraphIndex >= 0
          ? candidate.paragraphIndex
          : null,
    audioSeconds: safeNumber(candidate.audioSeconds, 0),
    scrollTop: safeNumber(candidate.scrollTop, 0),
    updatedAt:
      typeof candidate.updatedAt === "string" && Number.isFinite(Date.parse(candidate.updatedAt))
        ? candidate.updatedAt
        : new Date(0).toISOString(),
  };
}

export function readLessonBookmarks(userId?: string | null): BookmarkMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .map(([key, value]) => [key, parseBookmark(value)] as const)
        .filter((entry): entry is [string, LessonBookmark] => entry[1] !== null)
    );
  } catch {
    return {};
  }
}

export function bookmarkKey(level: string, episode: number): string {
  return `${level}:${episode}`;
}

export function readLessonBookmark(level: string, episode: number, userId?: string | null): LessonBookmark | null {
  return readLessonBookmarks(userId)[bookmarkKey(level, episode)] ?? null;
}

/** Return the most recently updated bookmarked episode for each learning track. */
export function readLatestBookmarkedEpisodes(userId?: string | null): Record<string, number> {
  const latest: Record<string, { episode: number; updatedAt: string }> = {};
  for (const bookmark of Object.values(readLessonBookmarks(userId))) {
    const current = latest[bookmark.level];
    if (!current || bookmark.updatedAt >= current.updatedAt) {
      latest[bookmark.level] = { episode: bookmark.episode, updatedAt: bookmark.updatedAt };
    }
  }
  return Object.fromEntries(
    Object.entries(latest).map(([level, value]) => [level, value.episode])
  );
}

export function persistLessonBookmark(
  bookmark: Omit<LessonBookmark, "version" | "updatedAt">,
  userId?: string | null
): LessonBookmarkWriteResult {
  const next: LessonBookmark = {
    ...bookmark,
    version: BOOKMARKS_VERSION,
    updatedAt: new Date().toISOString(),
  };
  let persisted = false;
  if (typeof window !== "undefined") {
    try {
      const bookmarks = readLessonBookmarks(userId);
      bookmarks[bookmarkKey(next.level, next.episode)] = next;
      window.localStorage.setItem(storageKey(userId), JSON.stringify(bookmarks));
      persisted = true;
    } catch {
      // A full or restricted storage area must not interrupt reading.
    }
  }
  return { bookmark: next, persisted };
}

/** Backward-compatible bookmark writer for callers that only need the value. */
export function writeLessonBookmark(
  bookmark: Omit<LessonBookmark, "version" | "updatedAt">,
  userId?: string | null
): LessonBookmark {
  return persistLessonBookmark(bookmark, userId).bookmark;
}

export function readLegacyProgress(): unknown[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEGACY_PROGRESS_KEY);
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function normalizeHebrewInput(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
