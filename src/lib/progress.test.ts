import { afterEach, describe, expect, it } from "vitest";
import {
  normalizeHebrewInput,
  bookmarkKey,
  readLatestBookmarkedEpisodes,
  readLessonBookmark,
  persistLessonBookmark,
  writeLessonBookmark,
} from "./progress";

function installStorage() {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("progress helpers", () => {
  it("normalizes Hebrew input without removing niqqud", () => {
    expect(normalizeHebrewInput("\u200f שָׁלוֹם   ")).toBe("שָׁלוֹם");
  });

  it("uses level and episode as a stable bookmark key", () => {
    expect(bookmarkKey("beginner", 3)).toBe("beginner:3");
  });

  it("keeps guest and account bookmarks isolated", () => {
    installStorage();
    writeLessonBookmark(
      { level: "beginner", episode: 2, paragraphIndex: 1, audioSeconds: 12, scrollTop: 40 },
      "account-a"
    );
    expect(readLessonBookmark("beginner", 2, "account-a")?.audioSeconds).toBe(12);
    expect(readLessonBookmark("beginner", 2, "account-b")).toBeNull();
    expect(readLessonBookmark("beginner", 2)).toBeNull();
  });

  it("selects the newest bookmark per track", () => {
    installStorage();
    writeLessonBookmark(
      { level: "beginner", episode: 2, paragraphIndex: 0, audioSeconds: 1, scrollTop: 0 },
      "account-a"
    );
    writeLessonBookmark(
      { level: "beginner", episode: 4, paragraphIndex: 0, audioSeconds: 2, scrollTop: 0 },
      "account-a"
    );
    expect(readLatestBookmarkedEpisodes("account-a")).toEqual({ beginner: 4 });
  });

  it("reports when bookmark persistence is unavailable", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: () => { throw new Error("blocked"); },
          setItem: () => { throw new Error("blocked"); },
        },
      },
    });
    const result = persistLessonBookmark(
      { level: "beginner", episode: 1, paragraphIndex: null, audioSeconds: 0, scrollTop: 0 },
      "account-a"
    );
    expect(result.bookmark.version).toBe(1);
    expect(result.persisted).toBe(false);
  });
});
