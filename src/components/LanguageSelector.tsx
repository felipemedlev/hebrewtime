"use client";

import { Globe } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { LangCode } from "@/lib/i18n/types";

export default function LanguageSelector() {
  const { lang, setLang, langOptions, t } = useLanguage();

  return (
    <label className="language-selector">
      <Globe size={14} aria-hidden="true" />
      <span className="sr-only">{t("language")}</span>
      <select
        className="language-select"
        value={lang}
        onChange={(e) => setLang(e.target.value as LangCode)}
        aria-label={t("language")}
      >
        {langOptions.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
