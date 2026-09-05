"use client";

import { ArrowRight, BookOpen, Headphones, Languages } from "lucide-react";
import { useModalAccessibility } from "@/hooks/useModalAccessibility";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Level } from "@/lib/types";

type OnboardingOverlayProps = {
  isOpen: boolean;
  levels: Level[];
  selectedLevel: string;
  onSelectLevel: (level: string) => void;
  onDismiss: () => void;
  onGetStarted: () => void;
};

export default function OnboardingOverlay({
  isOpen,
  levels,
  selectedLevel,
  onSelectLevel,
  onDismiss,
  onGetStarted,
}: OnboardingOverlayProps) {
  const { lang, setLang, langOptions, t } = useLanguage();
  const { dialogRef, titleId } = useModalAccessibility(isOpen, onDismiss);

  if (!isOpen) return null;

  const descriptionKey = selectedLevel === "beginner"
    ? "trackBeginnerDescription"
    : selectedLevel === "intermediate"
      ? "trackIntermediateDescription"
      : selectedLevel === "intermediate-2"
        ? "trackIntermediate2Description"
        : selectedLevel === "advanced"
          ? "trackAdvancedDescription"
          : "trackGenericDescription";

  return (
    <div className="onboarding-overlay">
      <div ref={dialogRef} className="onboarding-container onboarding-container--quick" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="onboarding-header">
          <div className="onboarding-brand"><BookOpen size={16} /><span>{t("appName")}</span></div>
          <button type="button" className="onboarding-skip-btn" onClick={onDismiss}>{t("skipForNow")}</button>
        </header>

        <section className="onboarding-hero onboarding-hero--quick">
          <div className="onboarding-hero-badge">{t("onboardingWelcome")}</div>
          <h1 id={titleId} className="onboarding-headline">{t("onboardingQuickTitle")}</h1>
          <p className="onboarding-subhead">{t("onboardingQuickSubtitle")}</p>
        </section>

        <section className="onboarding-setup" aria-label={t("onboardingSetupLabel")}>
          <div className="onboarding-setup-field">
            <label htmlFor="onboarding-language"><Languages size={16} />{t("language")}</label>
            <select id="onboarding-language" value={lang} onChange={(event) => setLang(event.target.value as typeof lang)}>
              {langOptions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
            </select>
          </div>
          <div className="onboarding-setup-field">
            <label htmlFor="onboarding-level"><BookOpen size={16} />{t("learningTrack")}</label>
            <select id="onboarding-level" value={selectedLevel} onChange={(event) => onSelectLevel(event.target.value)}>
              {levels.map((level) => <option key={level.slug} value={level.slug}>{level.name}{level.cefr ? ` · ${level.cefr}` : ""}</option>)}
            </select>
            <p className="onboarding-track-description">{t(descriptionKey)}</p>
          </div>
        </section>

        <section className="onboarding-first-step">
          <div className="onboarding-first-step-icon"><Headphones size={19} /></div>
          <div>
            <h2>{t("onboardingFirstStepTitle")}</h2>
            <p>{t("onboardingFirstStepDesc")}</p>
          </div>
        </section>

        <footer className="onboarding-footer onboarding-footer--quick">
          <button type="button" className="save-btn onboarding-footer-cta" onClick={onGetStarted}>
            {t("onboardingStartLesson")} <ArrowRight size={16} />
          </button>
          <p className="onboarding-footer-note">{t("onboardingSkipHint")}</p>
        </footer>
      </div>
    </div>
  );
}
