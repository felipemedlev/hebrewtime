import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FlashcardItem } from "@/lib/types";

const harness = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[],
  setters: [] as ReturnType<typeof vi.fn>[],
  overrides: new Map<number, unknown>(),
}));

vi.mock("react", async () => ({
  ...await vi.importActual<typeof import("react")>("react"),
  useState: (initial: unknown) => {
    const index = harness.setters.length;
    const setter = vi.fn();
    harness.setters.push(setter);
    return [harness.overrides.has(index) ? harness.overrides.get(index) : typeof initial === "function" ? initial() : initial, setter];
  },
  useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => void | (() => void)) => harness.effects.push(effect),
}));
vi.mock("@/lib/i18n/LanguageProvider", () => ({ useLanguage: () => ({ t: (key: string) => key, lang: "en" }) }));
vi.mock("./ExamplePhrasesPanel", () => ({ default: () => null }));
vi.mock("./DictionaryDetailsModal", () => ({ default: () => null }));
vi.mock("./FlashcardOrderControl", () => ({ default: () => null }));
vi.mock("@/hooks/useFlashcardRating", () => ({
  useFlashcardRating: () => ({ isSubmitting: false, saveError: false, setSaveError: vi.fn(), submitRating: vi.fn() }),
}));
vi.mock("@/lib/flashcardSession", async () => ({
  ...await vi.importActual<typeof import("@/lib/flashcardSession")>("@/lib/flashcardSession"),
  readFlashcardOrder: () => "chronological",
  readFlashcardSession: () => ({ cardIds: ["saved-word"], currentIndex: 0, isFlipped: true, showExamples: false, order: "shuffled" }),
  writeFlashcardOrder: vi.fn(), writeFlashcardSession: vi.fn(), clearFlashcardSession: vi.fn(), buildSessionQueue: vi.fn(),
}));

import ReverseCardsView from "./ReverseCardsView";
import FlashcardsView from "./FlashcardsView";

beforeEach(() => {
  harness.effects = [];
  harness.setters = [];
  harness.overrides.clear();
  vi.useFakeTimers();
  vi.stubGlobal("window", { setTimeout, clearTimeout });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("reverse session recovery", () => {
  it("also removes a deleted phrase from the forward review session", () => {
    const cards: FlashcardItem[] = ["deleted-phrase", "next-word"].map((id) => ({
      vocabWord: { id, word: id, translation: id, episodeTitle: "", episodeUrl: "", savedAt: 1 },
      progress: null,
    }));
    harness.overrides.set(0, true);
    harness.overrides.set(1, cards);
    harness.overrides.set(3, true);
    FlashcardsView({
      vocabWords: [cards[1].vocabWord], learnedCards: [], allCards: [cards[1]], dueCards: [cards[1]], sessionQueue: [cards[1]],
      isLoaded: true, submitReview: vi.fn(), unlearnWord: vi.fn(), generateExamples: vi.fn(), regenerateExample: vi.fn(),
      stats: { total: 1, learned: 0, active: 1, due: 1, newCount: 1, learning: 0, reviewedToday: 0, nextReviewAt: null, avgRecall: 0, progressPercent: 0 },
    });
    harness.effects[2]();
    expect(harness.setters[1]).toHaveBeenCalledWith([cards[1]]);
    expect(harness.setters[3]).toHaveBeenCalledWith(false);
  });

  it("removes a deleted card from an active session and hides the next answer", () => {
    const cards: FlashcardItem[] = ["deleted-phrase", "next-word"].map((id) => ({
      vocabWord: { id, word: id, translation: id, episodeTitle: "", episodeUrl: "", savedAt: 1 },
      progress: null,
    }));
    harness.overrides.set(0, true);
    harness.overrides.set(1, cards);
    harness.overrides.set(3, true);
    ReverseCardsView({
      vocabWords: [cards[1].vocabWord], learnedCards: [], allCards: [cards[1]], dueCards: [cards[1]], sessionQueue: [cards[1]],
      isLoaded: true, submitReview: vi.fn(), unlearnWord: vi.fn(), generateExamples: vi.fn(), regenerateExample: vi.fn(), onBack: vi.fn(),
      stats: { total: 1, learned: 0, active: 1, due: 1, newCount: 1, learning: 0, reviewedToday: 0, nextReviewAt: null, avgRecall: 0, progressPercent: 0 },
    });
    harness.effects[1]();
    vi.runAllTimers();
    expect(harness.setters[1]).toHaveBeenCalledWith([cards[1]]);
    expect(harness.setters[3]).toHaveBeenCalledWith(false);
  });

  it("retries restoration when React cancels and replays the loading effect", () => {
    const card: FlashcardItem = {
      vocabWord: { id: "saved-word", word: "שלום", translation: "Hello", episodeTitle: "", episodeUrl: "", savedAt: 1 },
      progress: null,
    };
    ReverseCardsView({
      vocabWords: [card.vocabWord], learnedCards: [], allCards: [card], dueCards: [card], sessionQueue: [card],
      isLoaded: true, submitReview: vi.fn(), unlearnWord: vi.fn(), generateExamples: vi.fn(), regenerateExample: vi.fn(), onBack: vi.fn(),
      stats: { total: 1, learned: 0, active: 1, due: 1, newCount: 1, learning: 0, reviewedToday: 0, nextReviewAt: null, avgRecall: 0, progressPercent: 0 },
    });
    const restoreEffect = harness.effects[0];
    const cleanup = restoreEffect();
    if (typeof cleanup === "function") cleanup();
    restoreEffect();
    vi.runAllTimers();
    expect(harness.setters[1]).toHaveBeenCalledExactlyOnceWith([card]);
    expect(harness.setters[0]).toHaveBeenCalledWith(true);
    expect(harness.setters[3]).toHaveBeenCalledWith(true);
    expect(harness.setters[9]).toHaveBeenCalledWith("shuffled");
  });
});
