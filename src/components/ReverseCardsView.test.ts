import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FlashcardItem } from "@/lib/types";

const harness = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[],
  setters: [] as ReturnType<typeof vi.fn>[],
}));

vi.mock("react", async () => ({
  ...await vi.importActual<typeof import("react")>("react"),
  useState: (initial: unknown) => {
    const setter = vi.fn();
    harness.setters.push(setter);
    return [typeof initial === "function" ? initial() : initial, setter];
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
vi.mock("@/lib/flashcardSession", () => ({
  readFlashcardOrder: () => "chronological",
  readFlashcardSession: () => ({ cardIds: ["saved-word"], currentIndex: 0, isFlipped: true, showExamples: false, order: "shuffled" }),
  writeFlashcardOrder: vi.fn(), writeFlashcardSession: vi.fn(), clearFlashcardSession: vi.fn(), buildSessionQueue: vi.fn(),
}));

import ReverseCardsView from "./ReverseCardsView";

beforeEach(() => {
  harness.effects = [];
  harness.setters = [];
  vi.useFakeTimers();
  vi.stubGlobal("window", { setTimeout, clearTimeout });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("reverse session recovery", () => {
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
