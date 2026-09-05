import { describe, expect, it } from "vitest";
import { resolveTranslationParagraphs } from "./episodeTranslations";
import type { Episode } from "./types";

const episode: Episode = {
  id: "episode-1",
  level: "beginner",
  episode: 1,
  url: "",
  title: "שלום",
  hebrew_paragraphs: ["שלום"],
  hebrew_text: "שלום",
  english_paragraphs: ["Hello"],
  translations: { es: [] },
};

describe("translation resolution", () => {
  it("falls back to the English source with metadata when a translation is missing", () => {
    expect(resolveTranslationParagraphs(episode, "fr")).toEqual({
      paragraphs: ["Hello"],
      requestedLanguage: "fr",
      usedLanguage: "en",
      isFallback: true,
    });
  });

  it("uses the requested language when paragraphs are available", () => {
    expect(
      resolveTranslationParagraphs({ ...episode, translations: { fr: ["Bonjour"] } }, "fr")
    ).toMatchObject({ paragraphs: ["Bonjour"], usedLanguage: "fr", isFallback: false });
  });

  it("fills missing paragraphs individually from English", () => {
    expect(
      resolveTranslationParagraphs({ ...episode, english_paragraphs: ["One", "Two"], translations: { fr: ["Un"] } }, "fr")
    ).toMatchObject({ paragraphs: ["Un", "Two"], isFallback: true, usedLanguage: "fr" });
  });
});
