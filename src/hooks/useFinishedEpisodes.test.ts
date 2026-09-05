import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { upsert, useUser } = vi.hoisted(() => ({ upsert: vi.fn(), useUser: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { from: () => ({ upsert }) } }));
vi.mock("./useUser", () => ({ useUser }));
// Exercise the hook's mutations without mounting its independent loading effect.
vi.mock("react", () => ({
  useState: (initial: unknown) => [initial, vi.fn()],
  useRef: (current: unknown) => ({ current }),
  useEffect: vi.fn(),
  useCallback: (callback: unknown) => callback,
}));

import { useFinishedEpisodes } from "./useFinishedEpisodes";
import { LEGACY_PROGRESS_KEY } from "@/lib/progress";

let storage: Map<string, string>;
const accountKey = "hebrewtime-finished-episodes:account-a";

beforeEach(() => {
  vi.resetAllMocks();
  useUser.mockReturnValue({ user: { id: "account-a" } });
  storage = new Map([
    [LEGACY_PROGRESS_KEY, JSON.stringify([1, 2, 2])],
    [accountKey, JSON.stringify([{ level: "intermediate", episode: 1 }, { level: "beginner", episode: 3 }])],
  ]);
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("legacy progress import", () => {
  it("merges overlapping completions without requiring update permission", async () => {
    upsert.mockImplementation(async (_rows, options) => ({
      error: options.ignoreDuplicates ? null : { message: "row-level security violation" },
    }));
    expect(await useFinishedEpisodes().importLegacyProgress()).toBe(true);
    expect(upsert.mock.calls[0][0]).toEqual([
      { user_id: "account-a", level_slug: "intermediate", episode_number: 1 },
      { user_id: "account-a", level_slug: "intermediate", episode_number: 2 },
    ]);
    expect(JSON.parse(storage.get(accountKey)!)).toEqual([
      { level: "intermediate", episode: 1 },
      { level: "beginner", episode: 3 },
      { level: "intermediate", episode: 2 },
    ]);
    expect(storage.has(LEGACY_PROGRESS_KEY)).toBe(false);
    expect(await useFinishedEpisodes().importLegacyProgress()).toBe(true);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it.each(["error", "rejection"])("keeps saved progress for retry after a server %s", async (failure) => {
    const before = new Map(storage);
    if (failure === "error") upsert.mockResolvedValue({ error: { message: "unavailable" } });
    else upsert.mockRejectedValue(new Error("offline"));
    expect(await useFinishedEpisodes().importLegacyProgress()).toBe(false);
    expect(storage).toEqual(before);
  });

  it("does not import into an unsigned account", async () => {
    useUser.mockReturnValue({ user: null });
    expect(await useFinishedEpisodes().importLegacyProgress()).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
    expect(storage.has(LEGACY_PROGRESS_KEY)).toBe(true);
  });

  it("also skips existing completions when marking a lesson finished", async () => {
    upsert.mockImplementation(async (_rows, options) => ({
      error: options.ignoreDuplicates ? null : { message: "row-level security violation" },
    }));
    expect(await useFinishedEpisodes().toggleFinished("intermediate", 1)).toBe(true);
  });
});
