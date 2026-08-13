import type { FlashcardItem } from "@/lib/types";

export const SESSION_SIZE = 20;
export const RECENT_REVIEW_WINDOW_MS = 30 * 60 * 1000;

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

/** Pick up to SESSION_SIZE due cards: newest first, deprioritize cards reviewed in the last 30 minutes. */
export function buildSessionQueue(
  dueCards: FlashcardItem[],
  now: Date = new Date()
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

  const session: FlashcardItem[] = [];
  for (const card of fresh) {
    if (session.length >= SESSION_SIZE) break;
    session.push(card);
  }
  for (const card of recent) {
    if (session.length >= SESSION_SIZE) break;
    session.push(card);
  }

  return session;
}
