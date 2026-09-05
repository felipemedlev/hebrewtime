import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { trackMock } = vi.hoisted(() => ({ trackMock: vi.fn() }));
vi.mock("@vercel/analytics", () => ({ track: trackMock }));

import { recordLearningEvent } from "./analytics";

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

describe("learning analytics", () => {
  beforeEach(() => {
    trackMock.mockClear();
    installStorage();
  });
  afterEach(() => Reflect.deleteProperty(globalThis, "window"));

  it("keeps raw events countable and deduplicates the first activation signal", () => {
    recordLearningEvent("lesson_completed", {
      language: "fr",
      track: "beginner",
      episode: 2,
      count: 1,
      // @ts-expect-error runtime allowlist check
      email: "learner@example.com",
    });
    recordLearningEvent("lesson_completed", {
      language: "fr",
      track: "beginner",
      episode: 2,
      count: 1,
    });
    expect(trackMock).toHaveBeenCalledTimes(3);
    expect(trackMock).toHaveBeenNthCalledWith(1, "learning_lesson_completed", {
      language: "fr",
      track: "beginner",
      episode: 2,
      count: 1,
    });
    expect(trackMock).toHaveBeenNthCalledWith(2, "learning_activation", {
      language: "fr",
      track: "beginner",
      episode: 2,
      count: 1,
    });
    expect(trackMock).toHaveBeenNthCalledWith(3, "learning_lesson_completed", {
      language: "fr",
      track: "beginner",
      episode: 2,
      count: 1,
    });
  });
});
