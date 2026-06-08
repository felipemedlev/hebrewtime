import { DEFAULT_LANG, isLangCode, type LangCode } from "./types";

export const LANG_COOKIE_NAME = "hebrewtime-language";
const LANG_STORAGE_KEY = LANG_COOKIE_NAME;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function parseLangCookie(value: string | undefined | null): LangCode {
  return value && isLangCode(value) ? value : DEFAULT_LANG;
}

export function persistClientLang(lang: LangCode): void {
  window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  document.cookie = `${LANG_COOKIE_NAME}=${lang}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}
