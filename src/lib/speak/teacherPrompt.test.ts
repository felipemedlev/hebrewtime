import { describe, expect, it } from "vitest";
import {
  buildEndSessionSummaryPrompt,
  buildSkipTopicPrompt,
  buildStartSessionPrompt,
  buildTalkMorePrompt,
  buildTeacherInstructions,
} from "./teacherPrompt";
import type { SpeakLearnerFacts, SpeakSessionNotes } from "./types";

const notes: SpeakSessionNotes = {
  lastCorrections: ["הלכת, not הולכת אתמול"],
  targetPhrases: ["מה עשית היום"],
};

const knownLearner: SpeakLearnerFacts = {
  name: "Maya",
  gender: "female",
  city: "Haifa",
  occupation: "student",
  interests: "music",
};

function beginnerPrompt(practice = "") {
  return buildTeacherInstructions(
    "beginner",
    knownLearner,
    "Last time we talked about cooking pasta at home.",
    notes,
    practice,
    180
  );
}

describe("buildTeacherInstructions", () => {
  it("includes level, time, memory, variety, unclear-audio, and no-invent rules", () => {
    const prompt = beginnerPrompt("# Words to weave in\n- קפה");

    expect(prompt).toMatch(/beginner \(A1\)/i);
    expect(prompt).toMatch(/about 3 minutes/i);
    expect(prompt).toContain("Maya");
    expect(prompt).toContain("Haifa");
    expect(prompt).toContain("music");
    expect(prompt).toContain("cooking pasta at home");
    expect(prompt).toContain("מה עשית היום");
    expect(prompt).toContain("הלכת, not הולכת אתמול");
    expect(prompt).toMatch(/Vary your wording/i);
    expect(prompt).toMatch(/# Unclear audio/);
    expect(prompt).toMatch(/Do not invent personal memories/);
    expect(prompt).toMatch(/Most turns need no praise/);
    expect(prompt).toMatch(/Their last words are the only script/);
    expect(prompt).toContain("קפה");
  });

  it("does not inject spark ladders, stock praise, or a fabricated-experience script", () => {
    const prompt = beginnerPrompt();

    expect(prompt).not.toMatch(/spark/i);
    expect(prompt).not.toMatch(/ladder/i);
    expect(prompt).not.toContain("אה נחמד");
    expect(prompt).not.toContain("גם אני");
    expect(prompt).not.toContain("וואו");
    expect(prompt).not.toMatch(/Today's spark/);
    expect(prompt).not.toMatch(/modelLines/);
    expect(prompt).not.toMatch(/Follow-ups/);
    expect(prompt).not.toMatch(/one short callback/i);
    expect(prompt).not.toMatch(/modeled sentence and one OPEN question/i);
  });

  it("uses untimed guidance for premium sessions", () => {
    const prompt = buildTeacherInstructions(
      "advanced",
      knownLearner,
      "",
      { lastCorrections: [], targetPhrases: [] },
      "",
      null
    );

    expect(prompt).toMatch(/advanced \(B2\+\)/i);
    expect(prompt).toMatch(/Untimed call/);
    expect(prompt).not.toMatch(/about \d+ minutes/);
  });

  it("asks new learners for name without a long interview", () => {
    const prompt = buildTeacherInstructions(
      "intermediate",
      {},
      "",
      { lastCorrections: [], targetPhrases: [] },
      "",
      180
    );

    expect(prompt).toMatch(/New learner/);
    expect(prompt).toMatch(/intermediate \(B1\)/i);
    expect(prompt).not.toMatch(/one short callback/i);
  });
});

describe("one-shot prompts", () => {
  it("starts a free conversation, not a scripted unit", () => {
    const start = buildStartSessionPrompt();
    expect(start).not.toMatch(/spark/i);
    expect(start).not.toMatch(/modeled sentence/i);
    expect(start).toMatch(/OPEN question/);
  });

  it("skips without announcing a backup unit", () => {
    const skip = buildSkipTopicPrompt();
    expect(skip).not.toMatch(/spark/i);
    expect(skip).not.toMatch(/backup/i);
    expect(skip).toMatch(/OPEN everyday question/);
  });

  it("lets the learner talk more without changing subject", () => {
    const talkMore = buildTalkMorePrompt();
    expect(talkMore).toMatch(/wait in silence/i);
    expect(talkMore).toMatch(/Do not change subject/);
  });

  it("asks the recap to summarize subjects actually discussed", () => {
    expect(buildEndSessionSummaryPrompt()).toMatch(/subjects actually discussed/);
  });
});
