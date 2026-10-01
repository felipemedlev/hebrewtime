import type { FlashcardItem } from "@/lib/types";

export const SESSION_SIZE = 20;
export const RECENT_REVIEW_WINDOW_MS = 30 * 60 * 1000;

export type FlashcardOrder = "chronological" | "shuffled";
export type FlashcardDirection = "forward" | "reverse";

export type FlashcardSessionSnapshot = {
  version: 1;
  direction: FlashcardDirection;
  cardIds: string[];
  currentIndex: number;
  isFlipped: boolean;
  showExamples: boolean;
  order: FlashcardOrder;
  sessionLimit?: number;
};

const SESSION_STORAGE_VERSION = 1;
const SESSION_STORAGE_KEY = "hebrewtime-flashcard-session-v1";
const ORDER_STORAGE_KEY = "hebrewtime-flashcard-order-v1";

function scopedKey(base: string, userId?: string | null): string {
  return `${base}:${userId ?? "guest"}`;
}

function sessionKey(direction: FlashcardDirection, userId?: string | null): string {
  return `${scopedKey(SESSION_STORAGE_KEY, userId)}:${direction}`;
}

function isOrder(value: unknown): value is FlashcardOrder {
  return value === "chronological" || value === "shuffled";
}

export function readFlashcardOrder(userId?: string | null): FlashcardOrder {
  if (typeof window === "undefined") return "chronological";
  try {
    const value = window.localStorage.getItem(scopedKey(ORDER_STORAGE_KEY, userId));
    return isOrder(value) ? value : "chronological";
  } catch {
    return "chronological";
  }
}

export function writeFlashcardOrder(order: FlashcardOrder, userId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(scopedKey(ORDER_STORAGE_KEY, userId), order);
  } catch {
    // Restricted storage should not prevent a review session from running.
  }
}

export function readFlashcardSession(
  direction: FlashcardDirection,
  userId?: string | null
): FlashcardSessionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(sessionKey(direction, userId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<FlashcardSessionSnapshot>;
    const savedIndex = value.currentIndex;
    if (
      value.version !== SESSION_STORAGE_VERSION ||
      value.direction !== direction ||
      !Array.isArray(value.cardIds) ||
      value.cardIds.some((id) => typeof id !== "string") ||
      typeof savedIndex !== "number" ||
      !Number.isInteger(savedIndex) ||
      savedIndex < 0 ||
      typeof value.isFlipped !== "boolean" ||
      typeof value.showExamples !== "boolean" ||
      !isOrder(value.order)
    ) {
      return null;
    }
    return {
      version: SESSION_STORAGE_VERSION,
      direction,
      cardIds: value.cardIds,
      currentIndex: Math.min(savedIndex, Math.max(0, value.cardIds.length - 1)),
      isFlipped: value.isFlipped,
      showExamples: value.showExamples,
      order: value.order,
      sessionLimit: typeof value.sessionLimit === "number" ? value.sessionLimit : undefined,
    };
  } catch {
    return null;
  }
}

export function hasFlashcardSession(direction: FlashcardDirection, userId?: string | null): boolean {
  const session = readFlashcardSession(direction, userId);
  return Boolean(session && session.cardIds.length > 0);
}

export function writeFlashcardSession(
  session: FlashcardSessionSnapshot,
  userId?: string | null
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(sessionKey(session.direction, userId), JSON.stringify(session));
  } catch {
    // Restricted storage should not prevent a review session from running.
  }
}

export function clearFlashcardSession(
  direction: FlashcardDirection,
  userId?: string | null
): void {
  if (typeof window === "undefined") return;
  try {
    const current = readFlashcardSession(direction, userId);
    if (current?.direction === direction) window.localStorage.removeItem(sessionKey(direction, userId));
  } catch {
    // Restricted storage should not prevent a completed session.
  }
}

function wasReviewedRecently(card: FlashcardItem, now: Date): boolean {
  const lastReviewed = card.progress?.last_reviewed_at;
  if (!lastReviewed) return false;
  const reviewedAt = new Date(lastReviewed).getTime();
  return now.getTime() - reviewedAt < RECENT_REVIEW_WINDOW_MS;
}

function compareDueCards(a: FlashcardItem, b: FlashcardItem): number {
  const savedDiff = b.vocabWord.savedAt - a.vocabWord.savedAt;
  if (savedDiff !== 0) return savedDiff;

  const aDue = a.progress?.next_review_at ?? "";
  const bDue = b.progress?.next_review_at ?? "";
  if (aDue !== bDue) return aDue.localeCompare(bDue);

  const aNever = a.progress?.last_reviewed_at ? 1 : 0;
  const bNever = b.progress?.last_reviewed_at ? 1 : 0;
  return aNever - bNever;
}

function shuffleCards(cards: FlashcardItem[]): FlashcardItem[] {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

/** Pick up to SESSION_SIZE due cards, keeping recently reviewed cards lower priority. */
export function buildSessionQueue(
  dueCards: FlashcardItem[],
  now: Date = new Date(),
  order: FlashcardOrder = "chronological"
): FlashcardItem[] {
  const sorted = [...dueCards].sort(compareDueCards);

  const fresh: FlashcardItem[] = [];
  const recent: FlashcardItem[] = [];

  for (const card of sorted) {
    if (wasReviewedRecently(card, now)) {
      recent.push(card);
    } else {
      fresh.push(card);
    }
  }

  const orderedFresh = order === "shuffled" ? shuffleCards(fresh) : fresh;
  const orderedRecent = order === "shuffled" ? shuffleCards(recent) : recent;
  const session: FlashcardItem[] = [];
  for (const card of orderedFresh) {
    if (session.length >= SESSION_SIZE) break;
    session.push(card);
  }
  for (const card of orderedRecent) {
    if (session.length >= SESSION_SIZE) break;
    session.push(card);
  }

  return session;
}
