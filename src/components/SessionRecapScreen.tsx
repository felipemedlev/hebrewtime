"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import StatRing from "@/components/StatRing";
import { shareText } from "@/lib/sharePracticeStats";
import { useT } from "@/lib/i18n/LanguageProvider";

type SessionRecapScreenProps = {
  title: string;
  percent: number;
  correct: number;
  total: number;
  bestStreak: number;
  shareTextContent: string;
  onTryAgain: () => void;
  onBack: () => void;
  tryAgainLabel: string;
};

export default function SessionRecapScreen({
  title,
  percent,
  correct,
  total,
  bestStreak,
  shareTextContent,
  onTryAgain,
  onBack,
  tryAgainLabel,
}: SessionRecapScreenProps) {
  const t = useT();
  const [shareState, setShareState] = useState<"idle" | "shared" | "copied">("idle");

  const handleShare = async () => {
    const result = await shareText(shareTextContent, t("appName"));
    if (result === "shared") {
      setShareState("shared");
      setTimeout(() => setShareState("idle"), 2000);
    } else if (result === "copied") {
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2000);
    }
  };

  const shareLabel =
    shareState === "copied"
      ? t("copied")
      : shareState === "shared"
        ? t("shared")
        : t("shareResults");

  return (
    <div className="flashcard-start-screen session-recap-screen">
      <StatRing percent={percent} size={128} strokeWidth={9} />
      <h2>{title}</h2>
      <div className="session-recap-tiles">
        <div className="session-recap-tile">
          <span className="session-recap-tile-label">{t("sessionScore")}</span>
          <span className="session-recap-tile-value">
            {correct}/{total}
          </span>
        </div>
        {bestStreak > 1 && (
          <div className="session-recap-tile">
            <span className="session-recap-tile-label">{t("bestStreak")}</span>
            <span className="session-recap-tile-value">{bestStreak}</span>
          </div>
        )}
      </div>
      <div className="fill-in-complete-actions">
        <button type="button" className="flashcard-start-btn" onClick={onTryAgain}>
          {tryAgainLabel}
        </button>
        <button type="button" className="session-recap-share-btn" onClick={handleShare}>
          <Share2 size={16} />
          {shareLabel}
        </button>
        <button type="button" className="review-stats-link inline" onClick={onBack}>
          {t("backToHub")}
        </button>
      </div>
    </div>
  );
}
