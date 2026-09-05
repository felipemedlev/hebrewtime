import type { Episode } from "./types";
import type { LangCode } from "./i18n/types";

export type TranslationResolution = {
  paragraphs: string[];
  requestedLanguage: LangCode;
  usedLanguage: LangCode;
  isFallback: boolean;
};

/** Resolve paragraph translations for the active language, falling back to English. */
export function resolveTranslationParagraphs(
  episode: Episode,
  lang: LangCode
): TranslationResolution {
  const fromMap = episode.translations?.[lang];
  if (fromMap && fromMap.length > 0) {
    const english = episode.english_paragraphs ?? [];
    const source = english.length > 0 ? english : fromMap;
    const paragraphs = source.map((fallback, index) => fromMap[index]?.trim() || fallback);
    const isFallback = english.length > 0 && paragraphs.some((paragraph, index) => paragraph === english[index] && !fromMap[index]);
    return { paragraphs, requestedLanguage: lang, usedLanguage: lang, isFallback };
  }
  return {
    paragraphs: episode.english_paragraphs ?? [],
    requestedLanguage: lang,
    usedLanguage: "en",
    isFallback: lang !== "en",
  };
}

export function getTranslationParagraphs(episode: Episode, lang: LangCode): string[] {
  return resolveTranslationParagraphs(episode, lang).paragraphs;
}
