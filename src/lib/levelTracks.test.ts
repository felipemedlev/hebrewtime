import { describe, expect, it } from "vitest";
import { resolveResumeEpisode } from "./levelTracks";

describe("lesson resume selection", () => {
  const episodes = [
    { level: "beginner", episode: 1, title: "One" },
    { level: "beginner", episode: 3, title: "Three" },
  ];

  it("restores a valid saved episode", () => {
    expect(resolveResumeEpisode("beginner", episodes, { beginner: 3 })).toBe(3);
  });

  it("falls back to the first published episode for stale progress", () => {
    expect(resolveResumeEpisode("beginner", episodes, { beginner: 2 })).toBe(1);
  });
});
