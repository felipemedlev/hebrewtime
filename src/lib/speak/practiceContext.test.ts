import { describe, expect, it } from "vitest";
import { formatPracticeContextBlock, pickSpeakTargetWords } from "./practiceContext";

describe("formatPracticeContextBlock", () => {
  it("marks vocab and episode material as optional and non-steering", () => {
    const block = formatPracticeContextBlock(
      [{ word: "קפה", translation: "coffee" }],
      "Morning in Tel Aviv",
      ["שמש", "ים"]
    );

    expect(block).toMatch(/at most one/i);
    expect(block).toMatch(/Otherwise ignore/);
    expect(block).toMatch(/Never redirect/);
    expect(block).toMatch(/Morning in Tel Aviv/);
    expect(block).toContain("קפה");
  });
});

describe("pickSpeakTargetWords", () => {
  it("prefers due words and dedupes by word", () => {
    const now = "2026-08-22T10:00:00.000Z";
    const picked = pickSpeakTargetWords(
      [
        { id: "1", word: "קפה", translation: "coffee", saved_at: 2 },
        { id: "2", word: "קפה", translation: "coffee dup", saved_at: 1 },
        { id: "3", word: "מים", translation: "water", saved_at: 3 },
      ],
      [
        {
          vocab_id: "3",
          next_review_at: "2026-08-23T10:00:00.000Z",
          is_learned: false,
        },
      ],
      now,
      8
    );

    expect(picked.map((item) => item.word)).toEqual(["קפה", "מים"]);
  });
});
