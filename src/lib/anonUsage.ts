"use client";

// Client-side daily usage tracking for logged-out (anonymous) visitors.
// Logged-in users are tracked server-side in `user_activity_daily`; anonymous
// users have no user id, so we keep a best-effort per-device counter in
// localStorage. This is intentionally bypassable — it gates UX, while the
// server-side rate limiter guards against OpenAI cost abuse.

const ANON_USAGE_KEY = "hebrewtime-anon-usage";

export const ANON_DAILY_TRANSLATION_LIMIT = 30;

type AnonUsage = {
  date: string;
  translations: number;
};

function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

function readUsage(): AnonUsage {
  const fallback: AnonUsage = { date: todayKey(), translations: 0 };
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(ANON_USAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AnonUsage>;
    // Reset when the day rolls over.
    if (parsed.date !== fallback.date) return fallback;
    return {
      date: fallback.date,
      translations: Math.max(0, Number(parsed.translations) || 0),
    };
  } catch {
    return fallback;
  }
}

function writeUsage(usage: AnonUsage): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANON_USAGE_KEY, JSON.stringify(usage));
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}

export function getAnonTranslationsToday(): number {
  return readUsage().translations;
}

export function hasReachedAnonTranslationLimit(): boolean {
  return getAnonTranslationsToday() >= ANON_DAILY_TRANSLATION_LIMIT;
}

export function incrementAnonTranslations(): number {
  const usage = readUsage();
  const next: AnonUsage = { date: usage.date, translations: usage.translations + 1 };
  writeUsage(next);
  return next.translations;
}
