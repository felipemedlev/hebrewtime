export const LANG_CODES = ["en", "ru", "uk", "pt", "es", "fr"] as const;
export type LangCode = (typeof LANG_CODES)[number];

export const DEFAULT_LANG: LangCode = "en";

export const LANG_LABELS: Record<LangCode, string> = {
  en: "English",
  ru: "Русский",
  uk: "Українська",
  pt: "Português",
  es: "Español",
  fr: "Français",
};

export const LANG_NATIVE_LABELS: Record<LangCode, string> = {
  en: "English",
  ru: "Русский",
  uk: "Українська",
  pt: "Português",
  es: "Español",
  fr: "Français",
};

export function isLangCode(value: string): value is LangCode {
  return (LANG_CODES as readonly string[]).includes(value);
}

export const LANGUAGE_NAMES_FOR_AI: Record<LangCode, string> = {
  en: "English",
  ru: "Russian",
  uk: "Ukrainian",
  pt: "Portuguese",
  es: "Spanish",
  fr: "French",
};
