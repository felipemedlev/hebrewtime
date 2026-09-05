import { track } from "@vercel/analytics";

export type LearningEvent =
  | "setup_viewed"
  | "setup_completed"
  | "setup_skipped"
  | "lesson_started"
  | "lesson_resumed"
  | "lesson_completed"
  | "vocabulary_saved"
  | "review_started"
  | "review_completed";

type LearningEventProperties = {
  language?: string;
  track?: string;
  episode?: number;
  modality?: "flashcards" | "fill-in" | "matching" | "reverse";
  count?: number;
};

const LIFECYCLE_KEY = "hebrewtime-learning-lifecycle-v1";
const ALLOWED_PROPERTY_KEYS = new Set(["language", "track", "episode", "modality", "count"]);

function isAllowedProperty(value: unknown): value is string | number {
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value));
}

function localDayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isMeaningfulLearning(event: LearningEvent): boolean {
  return event === "lesson_started" || event === "lesson_resumed" || event === "lesson_completed" ||
    event === "vocabulary_saved" || event === "review_started" || event === "review_completed";
}

export function recordLearningEvent(
  event: LearningEvent,
  properties: LearningEventProperties = {}
): void {
  if (typeof window === "undefined") return;
  try {
    const allowed = Object.fromEntries(
      Object.entries(properties)
        .filter(([key, value]) => ALLOWED_PROPERTY_KEYS.has(key) && isAllowedProperty(value))
        .map(([key, value]) => [
          key,
          typeof value === "string" ? value.slice(0, 80) : Math.max(0, Math.min(1000, value)),
        ])
    );
    const day = localDayKey();
    track(`learning_${event}`, allowed);

    // Activation and daily return are lifecycle signals, so deduplicate only
    // those derived signals. Raw learning events remain countable (for example,
    // multiple vocabulary saves or premium review sessions on one day).
    if (!isMeaningfulLearning(event)) return;
    const raw = window.localStorage.getItem(LIFECYCLE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    const lifecycle = parsed && typeof parsed === "object" ? parsed as {
      activationDay?: string;
      lastMeaningfulDay?: string;
      returnDays?: string[];
    } : {};
    const returnDays = Array.isArray(lifecycle.returnDays)
      ? lifecycle.returnDays.filter((value): value is string => typeof value === "string").slice(-200)
      : [];

    if ((event === "lesson_completed" || event === "review_completed") && !lifecycle.activationDay) {
      track("learning_activation", allowed);
      lifecycle.activationDay = day;
    } else if (
      lifecycle.activationDay &&
      lifecycle.lastMeaningfulDay &&
      lifecycle.lastMeaningfulDay !== day &&
      !returnDays.includes(day)
    ) {
      track("learning_return_usage", allowed);
      returnDays.push(day);
    }

    lifecycle.lastMeaningfulDay = day;
    lifecycle.returnDays = returnDays;
    window.localStorage.setItem(LIFECYCLE_KEY, JSON.stringify(lifecycle));
  } catch {
    // Analytics must never interrupt learning.
  }
}
