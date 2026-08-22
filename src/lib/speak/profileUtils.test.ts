import { describe, expect, it } from "vitest";
import {
  emptySpeakSessionNotes,
  mergeSessionNotes,
  sanitizeSessionNotes,
  sessionNotesToRow,
} from "./profileUtils";

describe("sanitizeSessionNotes", () => {
  it("ignores legacy recent_topics without dropping corrections or phrases", () => {
    const notes = sanitizeSessionNotes({
      last_corrections: ["הלכת"],
      target_phrases: ["מה עשית היום"],
      recent_topics: ["morning_drink", "today_weather"],
    });

    expect(notes).toEqual({
      lastCorrections: ["הלכת"],
      targetPhrases: ["מה עשית היום"],
    });
    expect(notes).not.toHaveProperty("recentTopics");
  });

  it("accepts camelCase keys and empty or invalid input", () => {
    expect(
      sanitizeSessionNotes({
        lastCorrections: ["a"],
        targetPhrases: ["b"],
        recentTopics: ["old_spark"],
      })
    ).toEqual({ lastCorrections: ["a"], targetPhrases: ["b"] });

    expect(sanitizeSessionNotes(null)).toEqual(emptySpeakSessionNotes());
    expect(sanitizeSessionNotes("nope")).toEqual(emptySpeakSessionNotes());
  });
});

describe("mergeSessionNotes", () => {
  it("prepends recap corrections and phrases onto existing lists", () => {
    const merged = mergeSessionNotes(
      { lastCorrections: ["old recast"], targetPhrases: ["שלום"] },
      { lastCorrections: ["new recast"], targetPhrases: ["בוקר טוב"] }
    );

    expect(merged.lastCorrections).toEqual(["new recast", "old recast"]);
    expect(merged.targetPhrases).toEqual(["בוקר טוב", "שלום"]);
  });
});

describe("sessionNotesToRow", () => {
  it("writes only corrections and phrases", () => {
    const row = sessionNotesToRow({
      lastCorrections: ["a"],
      targetPhrases: ["b"],
    });

    expect(row).toEqual({
      last_corrections: ["a"],
      target_phrases: ["b"],
    });
    expect(row).not.toHaveProperty("recent_topics");
  });
});
