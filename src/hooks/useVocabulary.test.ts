import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  order: vi.fn(), eq: vi.fn(), setVocabulary: vi.fn(), loadRef: { current: 0 },
}));
vi.mock("./useUser", () => ({ useUser: () => ({ user: { id: "account-a" } }) }));
vi.mock("@/lib/supabase", () => ({
  supabase: { from: () => ({ select: () => ({ eq: mocks.eq }) }) },
}));
vi.mock("react", () => ({
  useState: (initial: unknown) => [initial, Array.isArray(initial) ? mocks.setVocabulary : vi.fn()],
  useRef: () => mocks.loadRef,
  useEffect: vi.fn(),
  useCallback: (callback: unknown) => callback,
}));

import { useVocabulary } from "./useVocabulary";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.loadRef.current = 0;
  mocks.eq.mockReturnValue({ order: mocks.order });
});

describe("vocabulary refresh after a stale review", () => {
  it("replaces cached entries with the current account's saved vocabulary", async () => {
    mocks.order.mockResolvedValue({ data: [{ id: "remaining", word: "שלום", translation: "Hello" }], error: null });
    await useVocabulary().refreshVocabulary();
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "account-a");
    expect(mocks.setVocabulary).toHaveBeenCalledOnce();
    expect(mocks.setVocabulary.mock.calls[0][0]).toEqual([expect.objectContaining({ id: "remaining" })]);
  });

  it("preserves cached entries if the refresh fails", async () => {
    mocks.order.mockRejectedValue(new Error("offline"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await useVocabulary().refreshVocabulary();
    expect(mocks.setVocabulary).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("ignores a response after the account load changes", async () => {
    let resolve!: (value: { data: []; error: null }) => void;
    mocks.order.mockReturnValue(new Promise((done) => { resolve = done; }));
    const request = useVocabulary().refreshVocabulary();
    mocks.loadRef.current += 1;
    resolve({ data: [], error: null });
    await request;
    expect(mocks.setVocabulary).not.toHaveBeenCalled();
  });
});
