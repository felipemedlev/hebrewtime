const RATE_LIMITS = {
  translateWord: { maxRequests: 30, windowMs: 60_000 },
  generateExamplePhrases: { maxRequests: 20, windowMs: 60_000 },
  searchDictionarySuggestions: { maxRequests: 60, windowMs: 60_000 },
  resolveDictionarySuggestion: { maxRequests: 30, windowMs: 60_000 },
} as const;

type RateLimitAction = keyof typeof RATE_LIMITS;
type RateLimitEntry = { count: number; resetAt: number };

const rateLimitStore = new Map<string, RateLimitEntry>();

export const INPUT_LIMITS = {
  word: 100,
  context: 2_000,
  translation: 200,
  maxPhraseCount: 3,
  maxExistingPhrases: 10,
  phraseText: 500,
} as const;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function clampString(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function checkRateLimit(userId: string, action: RateLimitAction): boolean {
  const config = RATE_LIMITS[action];
  const key = `${userId}:${action}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

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
  return `<${label}>${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</${label}>`;
}
