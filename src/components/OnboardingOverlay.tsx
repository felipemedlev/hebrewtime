"use client";

import {
  BookOpen,
  Sparkles,
  Brain,
  Headphones,
  ArrowRight,
} from "lucide-react";
import { useModalAccessibility } from "@/hooks/useModalAccessibility";
import { useT } from "@/lib/i18n/LanguageProvider";

type OnboardingOverlayProps = {
  isOpen: boolean;
  onDismiss: () => void;
  onGetStarted: () => void;
};

export default function OnboardingOverlay({
  isOpen,
  onDismiss,
  onGetStarted,
}: OnboardingOverlayProps) {
  const t = useT();
  const { dialogRef, titleId } = useModalAccessibility(isOpen, onDismiss);

  if (!isOpen) return null;

  return (
    <div className="onboarding-overlay">
      <div
        ref={dialogRef}
        className="onboarding-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {/* ── Header ── */}
        <header className="onboarding-header">
          <div className="onboarding-brand">
            <BookOpen size={16} />
            <span>{t("appName")}</span>
          </div>
          <button type="button" className="onboarding-skip-btn" onClick={onDismiss}>
            {t("skipForNow")}
          </button>
        </header>

        {/* ── Hero ── */}
        <section className="onboarding-hero">
          <div className="onboarding-hero-badge">{t("onboardingWelcome")}</div>
          <h1 id={titleId} className="onboarding-headline">
            {t("onboardingWelcome")}
          </h1>
          <p className="onboarding-subhead">{t("onboardingSubtitle")}</p>
          <button
            type="button"
            className="save-btn onboarding-hero-cta"
            onClick={onGetStarted}
          >
            {t("getStarted")}
            <ArrowRight size={16} />
          </button>
        </section>

        {/* ── Features ── */}
        <section className="onboarding-features-section">
          <p className="onboarding-features-label">{t("onboardingFeatures")}</p>

          <div className="onboarding-features">
            {/* Card 1 — Bilingual */}
            <article className="onboarding-feature-card" style={{ "--card-delay": "0ms" } as React.CSSProperties}>
              <div className="onboarding-feature-top">
                <div className="onboarding-feature-icon">
                  <BookOpen size={18} />
                </div>
                <span className="onboarding-feature-num">01</span>
              </div>
              <h2 className="onboarding-feature-title">{t("onboardingBilingualTitle")}</h2>
              <p className="onboarding-feature-description">{t("onboardingBilingualDesc")}</p>
              <div className="onboarding-mockup onboarding-mockup--bilingual">
                <div className="bilingual-row">
                  <span className="bilingual-en">Today we&apos;ll focus on a very important topic</span>
                  <span className="bilingual-he font-serif" dir="rtl">הַיּוֹם נִדְבּוֹק בְּנוֹשֵׂא חָשׁוּב מְאוֹד</span>
                </div>
                <div className="bilingual-row bilingual-row--muted">
                  <span className="bilingual-en">That will change the way you think</span>
                  <span className="bilingual-he font-serif" dir="rtl">שֶׁיְּשַׁנֶּה אֶת הַדֶּרֶךְ שֶׁבָּהּ אַתָּה חוֹשֵׁב</span>
                </div>
              </div>
            </article>

            {/* Card 2 — AI Translation */}
            <article className="onboarding-feature-card" style={{ "--card-delay": "60ms" } as React.CSSProperties}>
              <div className="onboarding-feature-top">
                <div className="onboarding-feature-icon">
                  <Sparkles size={18} />
                </div>
                <span className="onboarding-feature-num">02</span>
              </div>
              <h2 className="onboarding-feature-title">{t("onboardingTranslateTitle")}</h2>
              <p className="onboarding-feature-description">{t("onboardingTranslateDesc")}</p>
              <div className="onboarding-mockup onboarding-mockup--translation">
                <p className="translation-sentence font-serif" dir="rtl">
                  הוּא רָצָה{" "}
                  <span className="translation-word-chip">לְדַמְיֵן</span>{" "}
                  עוֹלָם אַחֵר
                </p>
                <div className="translation-popup">
                  <span className="translation-popup-word font-serif">לְדַמְיֵן</span>
                  <span className="translation-popup-sep">·</span>
                  <span className="translation-popup-meaning">imagine</span>
                  <span className="translation-popup-tag">{t("verbForm")}</span>
                </div>
              </div>
            </article>

            {/* Card 3 — Vocabulary */}
            <article className="onboarding-feature-card" style={{ "--card-delay": "120ms" } as React.CSSProperties}>
              <div className="onboarding-feature-top">
                <div className="onboarding-feature-icon">
                  <Brain size={18} />
                </div>
                <span className="onboarding-feature-num">03</span>
              </div>
              <h2 className="onboarding-feature-title">{t("onboardingVocabTitle")}</h2>
              <p className="onboarding-feature-description">{t("onboardingVocabDesc")}</p>
              <div className="onboarding-mockup onboarding-mockup--vocab">
                <div className="vocab-row">
                  <span className="vocab-he font-serif" dir="rtl">נוֹשֵׂא</span>
                  <span className="vocab-pron">no-SE</span>
                  <span className="vocab-en">topic</span>
                  <span className="vocab-badge vocab-badge--due">{t("due")}</span>
                </div>
                <div className="vocab-row vocab-row--muted">
                  <span className="vocab-he font-serif" dir="rtl">לְדַמְיֵן</span>
                  <span className="vocab-pron">le-da-myen</span>
                  <span className="vocab-en">imagine</span>
                  <span className="vocab-badge vocab-badge--learned">{t("learned")}</span>
                </div>
                <div className="vocab-row vocab-row--muted">
                  <span className="vocab-he font-serif" dir="rtl">שָׁלוֹם</span>
                  <span className="vocab-pron">sha-LOM</span>
                  <span className="vocab-en">peace</span>
                  <span className="vocab-badge vocab-badge--new">{t("newLabel")}</span>
                </div>
              </div>
            </article>

            {/* Card 4 — Audio */}
            <article className="onboarding-feature-card" style={{ "--card-delay": "180ms" } as React.CSSProperties}>
              <div className="onboarding-feature-top">
                <div className="onboarding-feature-icon">
                  <Headphones size={18} />
                </div>
                <span className="onboarding-feature-num">04</span>
              </div>
              <h2 className="onboarding-feature-title">{t("onboardingAudioTitle")}</h2>
              <p className="onboarding-feature-description">{t("onboardingAudioDesc")}</p>
              <div className="onboarding-mockup onboarding-mockup--audio">
                <div className="audio-para audio-para--active font-serif" dir="rtl">
                  הַיּוֹם נִדְבּוֹק בְּנוֹשֵׂא חָשׁוּב
                </div>
                <div className="audio-para audio-para--next font-serif" dir="rtl">
                  שֶׁיְּשַׁנֶּה אֶת הַדֶּרֶךְ שֶׁלָּנוּ
                </div>
                <div className="audio-player-mock">
                  <div className="audio-play-icon">▶</div>
                  <div className="audio-progress-track">
                    <div className="audio-progress-fill" />
                  </div>
                  <span className="audio-time">1:24 / 18:30</span>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="onboarding-footer">
          <button
            type="button"
            className="save-btn onboarding-footer-cta"
            onClick={onGetStarted}
          >
            {t("getStarted")}
            <ArrowRight size={16} />
          </button>
          <p className="onboarding-footer-note">{t("upgradePrice")}</p>
        </footer>
      </div>
    </div>
  );
}
