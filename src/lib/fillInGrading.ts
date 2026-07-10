import { stripNiqqud } from "@/lib/dictionaryLookup";

function normalizeAnswer(text: string): string {
  return stripNiqqud(text).trim().replace(/\s+/g, " ");
}

export function gradeFillInAnswer(
  userInput: string,
  answer: string,
  answerWithNekudot?: string
): boolean {
  const normalized = normalizeAnswer(userInput);
  if (!normalized) return false;

  const accepted = new Set<string>();
  accepted.add(normalizeAnswer(answer));
  if (answerWithNekudot) {
    accepted.add(normalizeAnswer(answerWithNekudot));
  }

  return accepted.has(normalized);
}
