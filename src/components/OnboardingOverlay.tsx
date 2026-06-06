"use client";

import {
  BookOpen,
  Sparkles,
  Brain,
  Headphones,
  ArrowRight,
} from "lucide-react";
import { useModalAccessibility } from "@/hooks/useModalAccessibility";

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
            <span>Hebrew Time</span>
          </div>
          <button type="button" className="onboarding-skip-btn" onClick={onDismiss}>
            Skip for now
          </button>
        </header>

        {/* ── Hero ── */}
        <section className="onboarding-hero">
          <div className="onboarding-hero-badge">Welcome to Hebrew Time</div>
          <h1 id={titleId} className="onboarding-headline">
            The fastest way to learn Hebrew{" "}
            <span className="onboarding-headline-accent">through real content</span>
          </h1>
          <p className="onboarding-subhead">
            A bilingual podcast reader with AI translations, Nekudot, vocabulary
            tools, and spaced-repetition flashcards — all in one place.
          </p>
          <button
            type="button"
            className="save-btn onboarding-hero-cta"
            onClick={onGetStarted}
          >
            Start reading
            <ArrowRight size={16} />
          </button>
        </section>

        {/* ── Features ── */}
        <section className="onboarding-features-section">
          <p className="onboarding-features-label">What&rsquo;s inside</p>

          <div className="onboarding-features">
            {/* Card 1 — Bilingual */}
            <article className="onboarding-feature-card" style={{ "--card-delay": "0ms" } as React.CSSProperties}>
              <div className="onboarding-feature-top">
                <div className="onboarding-feature-icon">
                  <BookOpen size={18} />
                </div>
                <span className="onboarding-feature-num">01</span>
              </div>
              <h2 className="onboarding-feature-title">Bilingual Reading</h2>
              <p className="onboarding-feature-description">
                Hebrew and English side by side. Blur English on demand to practice reading without a crutch.
              </p>
              <div className="onboarding-mockup onboarding-mockup--bilingual">
                <div className="bilingual-row">
                  <span className="bilingual-en">Today we'll focus on a very important topic</span>
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
              <h2 className="onboarding-feature-title">Click-to-Translate</h2>
              <p className="onboarding-feature-description">
                Tap any Hebrew word for a contextual AI translation with accurate Nekudot and save it instantly.
              </p>
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
                  <span className="translation-popup-tag">verb</span>
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
              <h2 className="onboarding-feature-title">Vocabulary & Flashcards</h2>
              <p className="onboarding-feature-description">
                Words you save sync across devices. Review with FSRS spaced repetition to reach 90% retention.
              </p>
              <div className="onboarding-mockup onboarding-mockup--vocab">
                <div className="vocab-row">
                  <span className="vocab-he font-serif" dir="rtl">נוֹשֵׂא</span>
                  <span className="vocab-pron">no-SE</span>
                  <span className="vocab-en">topic</span>
                  <span className="vocab-badge vocab-badge--due">Due</span>
                </div>
                <div className="vocab-row vocab-row--muted">
                  <span className="vocab-he font-serif" dir="rtl">לְדַמְיֵן</span>
                  <span className="vocab-pron">le-da-myen</span>
                  <span className="vocab-en">imagine</span>
                  <span className="vocab-badge vocab-badge--learned">Learned</span>
                </div>
                <div className="vocab-row vocab-row--muted">
                  <span className="vocab-he font-serif" dir="rtl">שָׁלוֹם</span>
                  <span className="vocab-pron">sha-LOM</span>
                  <span className="vocab-en">peace</span>
                  <span className="vocab-badge vocab-badge--new">New</span>
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
              <h2 className="onboarding-feature-title">Audio-Synced Reading</h2>
              <p className="onboarding-feature-description">
                As the podcast plays, the current paragraph highlights and scrolls into view at 60fps.
              </p>
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
            Start reading
            <ArrowRight size={16} />
          </button>
          <p className="onboarding-footer-note">
            Start free · Upgrade to Premium for $9.99/month
          </p>
        </footer>
      </div>
    </div>
  );
}
