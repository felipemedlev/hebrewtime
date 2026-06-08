import type { Episode } from "./types";
import type { LangCode } from "./i18n/types";

/** Resolve paragraph translations for the active language, falling back to English. */
export function getTranslationParagraphs(
  episode: Episode,
  lang: LangCode
): string[] {
  const fromMap = episode.translations?.[lang];
  if (fromMap && fromMap.length > 0) return fromMap;
  if (lang === "en" || !episode.translations || Object.keys(episode.translations).length === 0) {
    return episode.english_paragraphs ?? [];
  }
  return [];
}
