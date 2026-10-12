import { describe, expect, it } from "vitest";
import type { FlashcardItem } from "./types";
import { reconcileFlashcardSession } from "./flashcardSession";

const cards: FlashcardItem[] = ["reviewed", "phrase", "next"].map((id) => ({
  vocabWord: {
    id, word: id, translation: id, entryKind: id === "phrase" ? "phrase" : "word",
    episodeTitle: "", episodeUrl: "", savedAt: 1,
  },
  progress: null,
}));
const ids = cards.map((card) => card.vocabWord.id);

describe("session vocabulary reconciliation", () => {
  it("removes a deleted phrase and continues with the next unreviewed card", () => {
    const result = reconcileFlashcardSession(ids, 1, [cards[0], cards[2]]);
    expect(result.cards).toEqual([cards[0], cards[2]]);
    expect(result.cards[result.currentIndex]).toBe(cards[2]);
    expect(result.currentCardRemoved).toBe(true);
  });

  it("keeps the current card when an earlier entry was deleted", () => {
    const result = reconcileFlashcardSession(ids, 1, cards.slice(1));
    expect(result.currentIndex).toBe(0);
    expect(result.cards[result.currentIndex]).toBe(cards[1]);
    expect(result.currentCardRemoved).toBe(false);
  });

  it("ends when only reviewed cards remain instead of reviewing them again", () => {
    const result = reconcileFlashcardSession(ids, 2, cards.slice(0, 2));
    expect(result.currentIndex).toBe(result.cards.length);
    expect(result.currentCardRemoved).toBe(true);
  });

  it("keeps session order and updated content without adding new vocabulary", () => {
    const updatedPhrase = { ...cards[1], vocabWord: { ...cards[1].vocabWord, translation: "Updated" } };
    const result = reconcileFlashcardSession(["phrase", "reviewed"], 0, [cards[2], cards[0], updatedPhrase]);
    expect(result.cards).toEqual([updatedPhrase, cards[0]]);
    expect(result.currentIndex).toBe(0);
    expect(result.currentCardRemoved).toBe(false);
  });
});
