"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";
import { translate, type MessageKey, type TranslationParams } from "./messages";
import { persistClientLang } from "./languagePreference";
import {
  DEFAULT_LANG,
  isLangCode,
  LANG_CODES,
  LANG_NATIVE_LABELS,
  type LangCode,
} from "./types";

const LANG_STORAGE_KEY = "hebrewtime-language";
const BLUR_STORAGE_KEY = "blur-translations";

type LanguageContextValue = {
  lang: LangCode;
  setLang: (lang: LangCode) => void;
  t: (key: MessageKey, params?: TranslationParams) => string;
  langOptions: { code: LangCode; label: string }[];
  isTranslationBlurred: boolean;
  setTranslationBlurred: (blurred: boolean) => void;
  toggleTranslationBlurred: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredBlur(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(BLUR_STORAGE_KEY) === "1") return true;
    return window.localStorage.getItem("blur-english-translations") === "1";
  } catch {
    return false;
  }
}

export function LanguageProvider({
  children,
  initialLang = DEFAULT_LANG,
}: {
  children: ReactNode;
  initialLang?: LangCode;
}) {
  const { user } = useUser();
  const [lang, setLangState] = useState<LangCode>(initialLang);
  const [isTranslationBlurred, setIsTranslationBlurred] = useState(readStoredBlur);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored && isLangCode(stored) && stored !== lang) {
      setLangState(stored);
      persistClientLang(stored);
      return;
    }
    persistClientLang(lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync storage/cookie once after hydration
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    const metaLang = user?.user_metadata?.preferred_language;
    if (metaLang && isLangCode(metaLang) && metaLang !== lang) {
      setLangState(metaLang);
      persistClientLang(metaLang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from auth metadata on login only
  }, [user?.user_metadata?.preferred_language]);

  const setLang = useCallback(
    (next: LangCode) => {
      setLangState(next);
      persistClientLang(next);
      if (user) {
        void supabase.auth.updateUser({ data: { preferred_language: next } });
      }
    },
    [user]
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(BLUR_STORAGE_KEY, isTranslationBlurred ? "1" : "0");
    } catch {
      // Translation display preference is optional and must not block reading.
    }
  }, [isTranslationBlurred]);

  const t = useCallback(
    (key: MessageKey, params?: TranslationParams) => translate(lang, key, params),
    [lang]
  );

  const langOptions = useMemo(
    () => LANG_CODES.map((code) => ({ code, label: LANG_NATIVE_LABELS[code] })),
    []
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      setLang,
      t,
      langOptions,
      isTranslationBlurred,
      setTranslationBlurred: setIsTranslationBlurred,
      toggleTranslationBlurred: () => setIsTranslationBlurred((prev) => !prev),
    }),
    [lang, setLang, t, langOptions, isTranslationBlurred]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}

export function useT() {
  return useLanguage().t;
}
