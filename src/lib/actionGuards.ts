const RATE_LIMITS = {
  translateWord: { maxRequests: 30, windowMs: 60_000 },
  translateWordAnonDaily: { maxRequests: 30, windowMs: 86_400_000 },
  generateExamplePhrases: { maxRequests: 20, windowMs: 60_000 },
  generateFillInExercises: { maxRequests: 20, windowMs: 60_000 },
  createSpeakSession: { maxRequests: 10, windowMs: 60_000 },
  searchDictionarySuggestions: { maxRequests: 60, windowMs: 60_000 },
  resolveDictionarySuggestion: { maxRequests: 30, windowMs: 60_000 },
} as const;

type RateLimitAction = keyof typeof RATE_LIMITS;
type RateLimitEntry = { count: number; resetAt: number };

const rateLimitStore = new Map<string, RateLimitEntry>();
const MAX_RATE_LIMIT_ENTRIES = 5_000;

export const INPUT_LIMITS = {
  word: 100,
  context: 2_000,
  translation: 200,
  maxPhraseCount: 3,
  maxExistingPhrases: 10,
  maxFillInItems: 10,
  phraseText: 500,
} as const;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function clampString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function isValidEmail(email: unknown): boolean {
  return typeof email === "string" && EMAIL_REGEX.test(email);
}

export function checkRateLimit(userId: unknown, action: unknown): boolean {
  if (typeof userId !== "string" || !userId || typeof action !== "string" || !(action in RATE_LIMITS)) return false;
  const config = RATE_LIMITS[action as RateLimitAction];
  const key = `${userId}:${action}`;
  const now = Date.now();
  let entry = rateLimitStore.get(key);

  // Keep this process-local guard bounded. Expired entries are cheap to prune;
  // if an attacker fills the map with active keys, fail closed for new keys.
  if (rateLimitStore.size >= MAX_RATE_LIMIT_ENTRIES) {
    for (const [storedKey, storedEntry] of rateLimitStore) {
      if (now >= storedEntry.resetAt) rateLimitStore.delete(storedKey);
    }
    entry = rateLimitStore.get(key);
    if (!entry && rateLimitStore.size >= MAX_RATE_LIMIT_ENTRIES) return false;
  }

  if (!entry || now >= entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return true;
  }

  if (entry.count >= config.maxRequests) {
    return false;
  }

  entry.count += 1;
  return true;
}

export function wrapUserContent(label: string, content: string): string {
  return `<${label}>${content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</${label}>`;
}
