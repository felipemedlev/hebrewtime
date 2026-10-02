import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FlashcardProgress, VocabWord } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  single: vi.fn(),
  abortSignal: vi.fn(),
  select: vi.fn(),
  useUser: vi.fn(),
  setProgresses: vi.fn(),
  progresses: [] as FlashcardProgress[],
  loadRef: { current: 0 },
}));

vi.mock("./useUser", () => ({ useUser: mocks.useUser }));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      upsert: mocks.upsert,
      select: () => ({ eq: async () => ({ data: [], error: null }) }),
    }),
  },
}));
vi.mock("react", () => ({
  useState: (initial: unknown) => Array.isArray(initial)
    ? [mocks.progresses, mocks.setProgresses]
    : [initial, vi.fn()],
  useRef: () => mocks.loadRef,
  useEffect: vi.fn(),
  useCallback: (callback: unknown) => callback,
  useMemo: (factory: () => unknown) => factory(),
}));

import { useFlashcards } from "./useFlashcards";

const word: VocabWord = {
  id: "word-a", word: "שלום", translation: "Hello",
  episodeTitle: "Example", episodeUrl: "", savedAt: 1,
};
const progress: FlashcardProgress = {
  id: "progress-a", user_id: "account-a", vocab_id: word.id, direction: "forward",
  ease_factor: 2.5, interval_days: 1, repetitions: 1,
  next_review_at: "2026-01-01T00:00:00.000Z", is_learned: false,
  last_reviewed_at: null, created_at: "2026-01-01T00:00:00.000Z",
  stability: null, difficulty: null, state: 1, lapses: 0,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.progresses = [];
  mocks.loadRef.current = 0;
  mocks.useUser.mockReturnValue({ user: { id: "account-a" } });
  mocks.upsert.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ abortSignal: mocks.abortSignal });
  mocks.abortSignal.mockReturnValue({ single: mocks.single });
});

describe("flashcard progress persistence", () => {
  it("matches progress separately for each review direction", () => {
    const reverseProgress = { ...progress, id: "progress-b", direction: "reverse" as const };
    mocks.progresses = [progress, reverseProgress];
    const hook = useFlashcards([word]);
    expect(hook.forward.flashcards[0].progress).toBe(progress);
    expect(hook.reverse.flashcards[0].progress).toBe(reverseProgress);
  });

  it("updates progress only after a confirmed save and bounds the request", async () => {
    let resolve!: (value: { data: FlashcardProgress; error: null }) => void;
    mocks.single.mockReturnValue(new Promise((done) => { resolve = done; }));
    const request = useFlashcards([word]).submitReview(word.id, 3, "reverse");
    expect(mocks.setProgresses).not.toHaveBeenCalled();
    expect(mocks.abortSignal.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
    expect(mocks.upsert.mock.calls[0][0].direction).toBe("reverse");
    resolve({ data: { ...progress, direction: "reverse" }, error: null });
    expect(await request).toBe(true);
    expect(mocks.setProgresses).toHaveBeenCalledOnce();
    const update = mocks.setProgresses.mock.calls[0][0];
    expect(update([])[0].direction).toBe("reverse");
  });

  it("does not apply a late save from a previous account load", async () => {
    let resolve!: (value: { data: FlashcardProgress; error: null }) => void;
    mocks.single.mockReturnValue(new Promise((done) => { resolve = done; }));
    const request = useFlashcards([word]).submitReview(word.id, 3);
    mocks.loadRef.current += 1;
    resolve({ data: progress, error: null });
    expect(await request).toBe(false);
    expect(mocks.setProgresses).not.toHaveBeenCalled();
  });

  it("returns a retryable failure when the request rejects", async () => {
    mocks.single.mockRejectedValue(new Error("Connection interrupted"));
    expect(await useFlashcards([word]).submitReview(word.id, 3)).toBe(false);
    // Only reconciliation with the server can update progress after failure.
    expect(mocks.upsert).toHaveBeenCalledOnce();
  });

  it("does not report success without a returned progress row", async () => {
    mocks.single.mockResolvedValue({ data: null, error: null });
    expect(await useFlashcards([word]).submitReview(word.id, 3)).toBe(false);
    expect(mocks.setProgresses).not.toHaveBeenCalled();
  });
});
