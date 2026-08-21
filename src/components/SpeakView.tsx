"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Mic,
  PhoneOff,
  Loader2,
  MessageCircleQuestion,
  Volume2,
  Sparkles,
  Zap,
  Clock,
  UserRound,
  User,
  LogIn,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import { useSpeakProfile } from "@/hooks/useSpeakProfile";
import { useSpeakSession } from "@/hooks/useSpeakSession";
import { clampSpeechSpeed } from "@/lib/speak/profileUtils";
import type {
  SpeakLevel,
  SpeakRealtimeModel,
  SpeakSessionStatus,
  SpeakVoiceGender,
} from "@/lib/speak/types";
import {
  FREE_SPEAK_SESSION_LIMIT_SECONDS,
  SPEAK_SPEED_DEFAULT,
  SPEAK_SPEED_MAX,
  SPEAK_SPEED_MIN,
} from "@/lib/speak/types";

type SpeakViewProps = {
  isAuthenticated: boolean;
  isPremium: boolean;
  onRequireAuth: () => void;
  onRequireSubscription: () => void;
  onSessionActiveChange?: (active: boolean) => void;
};

const LEVELS: SpeakLevel[] = ["beginner", "intermediate", "advanced"];

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatSpeed(speed: number): string {
  return `${speed.toFixed(2).replace(/\.?0+$/, "")}×`;
}

function speedPercent(speed: number): number {
  return ((speed - SPEAK_SPEED_MIN) / (SPEAK_SPEED_MAX - SPEAK_SPEED_MIN)) * 100;
}

function statusLabel(status: SpeakSessionStatus, t: (key: MessageKey) => string): string {
  switch (status) {
    case "connecting":
      return t("speakStatusConnecting");
    case "listening":
      return t("speakStatusListening");
    case "speaking":
      return t("speakStatusSpeaking");
    case "error":
      return t("speakStatusError");
    default:
      return t("speakStatusIdle");
  }
}

function statusHint(status: SpeakSessionStatus, t: (key: MessageKey) => string): string | null {
  switch (status) {
    case "connecting":
      return t("speakCallConnectingHint");
    case "listening":
      return t("speakCallListeningHint");
    case "speaking":
      return t("speakCallSpeakingHint");
    default:
      return null;
  }
}

function ChoiceCard({
  active,
  onClick,
  icon,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      className={`speak-choice-card${active ? " is-active" : ""}`}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="speak-choice-icon">{icon}</span>
      <span className="speak-choice-copy">
        <span className="speak-choice-title">{title}</span>
        {description ? <span className="speak-choice-desc">{description}</span> : null}
      </span>
    </button>
  );
}

export default function SpeakView({
  isAuthenticated,
  isPremium,
  onRequireAuth,
  onRequireSubscription,
  onSessionActiveChange,
}: SpeakViewProps) {
  const t = useT();
  const [userId, setUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [voiceGender, setVoiceGender] = useState<SpeakVoiceGender>("female");
  const [level, setLevel] = useState<SpeakLevel>("beginner");
  const [realtimeModel, setRealtimeModel] =
    useState<SpeakRealtimeModel>("gpt-realtime-2.1");
  const [speechSpeed, setSpeechSpeed] = useState(SPEAK_SPEED_DEFAULT);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { profile, isLoading, savePreferences, saveLearnerFacts, saveConversationSummary } =
    useSpeakProfile(userId);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUserId(data.session?.user?.id ?? null);
      setAccessToken(data.session?.access_token ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setAccessToken(session?.access_token ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!profile) return;
    setVoiceGender(profile.voiceGender);
    setLevel(profile.level);
    setRealtimeModel(profile.realtimeModel);
    setSpeechSpeed(profile.speechSpeed);
  }, [profile]);

  const handleLearnerFacts = useCallback(
    async (facts: Parameters<typeof saveLearnerFacts>[0]) => {
      await saveLearnerFacts(facts);
    },
    [saveLearnerFacts]
  );

  const handleConversationSummary = useCallback(
    async (summary: string) => {
      await saveConversationSummary(summary);
    },
    [saveConversationSummary]
  );

  const handleError = useCallback((message: string) => {
    setErrorMessage(message);
  }, []);

  const {
    status,
    isActive,
    remainingSeconds,
    startSession,
    stopSession,
    sendDontUnderstand,
  } = useSpeakSession({
    accessToken,
    voiceGender,
    level,
    realtimeModel,
    speechSpeed,
    onLearnerFacts: handleLearnerFacts,
    onConversationSummary: handleConversationSummary,
    onLimitReached: onRequireSubscription,
    onAuthRequired: onRequireAuth,
    onError: handleError,
  });

  useEffect(() => {
    onSessionActiveChange?.(isActive || status === "connecting");
  }, [isActive, status, onSessionActiveChange]);

  const knownFacts = useMemo(() => {
    const facts = profile?.learnerFacts ?? {};
    const items: { key: string; label: string; value: string }[] = [];
    if (facts.name) items.push({ key: "name", label: t("speakFactName"), value: facts.name });
    if (facts.city) items.push({ key: "city", label: t("speakFactCity"), value: facts.city });
    if (facts.country) {
      items.push({ key: "country", label: t("speakFactCountry"), value: facts.country });
    }
    if (facts.occupation) {
      items.push({
        key: "occupation",
        label: t("speakFactOccupation"),
        value: facts.occupation,
      });
    }
    if (facts.interests) {
      items.push({
        key: "interests",
        label: t("speakFactInterests"),
        value: facts.interests,
      });
    }
    return items;
  }, [profile?.learnerFacts, t]);

  const showCall = isActive || status === "connecting";
  const isStarting = status === "connecting";
  const hint = statusHint(status, t);
  const timerPct =
    remainingSeconds == null
      ? null
      : Math.max(0, Math.min(100, (remainingSeconds / FREE_SPEAK_SESSION_LIMIT_SECONDS) * 100));

  const handleStart = async () => {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    if (isStarting || isActive) return;

    setErrorMessage(null);
    void savePreferences({ voiceGender, level, realtimeModel, speechSpeed });
    await startSession();
  };

  const handleEnd = async () => {
    await stopSession(true);
  };

  const header = (
    <header className="speak-header">
      <div>
        <h1>{t("speakTitle")}</h1>
        <p className="speak-subtitle">{t("speakSubtitle")}</p>
      </div>
      {!isPremium && (
        <span className="speak-free-badge">{t("speakFreeDailyBadge")}</span>
      )}
    </header>
  );

  if (!isAuthenticated) {
    return (
      <div className="speak-view">
        {header}
        <div className="speak-empty">
          <div className="speak-empty-icon">
            <Mic size={22} strokeWidth={1.5} />
          </div>
          <p>{t("speakLoginPrompt")}</p>
          <button type="button" className="speak-start-btn" onClick={onRequireAuth}>
            <LogIn size={16} />
            {t("logInSignUp")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="speak-view">
      {header}

      {!showCall ? (
        <section className="speak-setup" aria-label={t("speakSetupTitle")}>
          <h2>{t("speakSetupTitle")}</h2>

          <div className="speak-field">
            <span className="speak-label">{t("speakVoiceLabel")}</span>
            <div className="speak-choice-grid" role="group" aria-label={t("speakVoiceLabel")}>
              <ChoiceCard
                active={voiceGender === "female"}
                onClick={() => setVoiceGender("female")}
                icon={<UserRound size={18} />}
                title={t("speakVoiceFemale")}
              />
              <ChoiceCard
                active={voiceGender === "male"}
                onClick={() => setVoiceGender("male")}
                icon={<User size={18} />}
                title={t("speakVoiceMale")}
              />
            </div>
          </div>

          <div className="speak-field">
            <span className="speak-label">{t("speakLevelLabel")}</span>
            <div className="speak-segmented" role="group" aria-label={t("speakLevelLabel")}>
              {LEVELS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={level === value ? "is-active" : ""}
                  aria-pressed={level === value}
                  onClick={() => setLevel(value)}
                >
                  {t(
                    value === "beginner"
                      ? "speakLevelBeginner"
                      : value === "intermediate"
                        ? "speakLevelIntermediate"
                        : "speakLevelAdvanced"
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="speak-field">
            <span className="speak-label">{t("speakModelLabel")}</span>
            <div className="speak-choice-grid" role="group" aria-label={t("speakModelLabel")}>
              <ChoiceCard
                active={realtimeModel === "gpt-realtime-2.1"}
                onClick={() => setRealtimeModel("gpt-realtime-2.1")}
                icon={<Sparkles size={18} />}
                title={t("speakModelQuality")}
                description={t("speakModelQualityDesc")}
              />
              <ChoiceCard
                active={realtimeModel === "gpt-realtime-2.1-mini"}
                onClick={() => setRealtimeModel("gpt-realtime-2.1-mini")}
                icon={<Zap size={18} />}
                title={t("speakModelCheaper")}
                description={t("speakModelCheaperDesc")}
              />
            </div>
          </div>

          <div className="speak-field">
            <div className="speak-speed-head">
              <label className="speak-label" htmlFor="speak-speed">
                {t("speakSpeedLabel")}
              </label>
              <span className="speak-speed-value">{formatSpeed(speechSpeed)}</span>
            </div>
            <input
              id="speak-speed"
              className="speak-speed-slider"
              type="range"
              min={SPEAK_SPEED_MIN}
              max={SPEAK_SPEED_MAX}
              step={0.05}
              value={speechSpeed}
              style={{ "--speed-pct": `${speedPercent(speechSpeed)}%` } as CSSProperties}
              onChange={(e) => setSpeechSpeed(clampSpeechSpeed(Number(e.target.value)))}
            />
            <div className="speak-speed-ticks">
              <span>{t("speakSpeedSlow")}</span>
              <span>{t("speakSpeedNormal")}</span>
              <span>{t("speakSpeedFast")}</span>
            </div>
          </div>

          {knownFacts.length > 0 && (
            <div className="speak-known-facts">
              <h3>{t("speakKnownFacts")}</h3>
              <ul>
                {knownFacts.map((item) => (
                  <li key={item.key}>
                    <span className="speak-fact-label">{item.label}</span>
                    {item.value}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {errorMessage && <p className="speak-error">{errorMessage}</p>}

          <button
            type="button"
            className="speak-start-btn"
            onClick={() => void handleStart()}
            disabled={isLoading || isStarting}
          >
            {isLoading ? <Loader2 className="speak-spin" size={18} /> : <Mic size={18} />}
            {t("speakStartCall")}
          </button>
        </section>
      ) : (
        <section className="speak-call" aria-live="polite">
          <div className={`speak-orb status-${status}`}>
            {status === "connecting" ? (
              <Loader2 className="speak-spin" size={32} />
            ) : status === "speaking" ? (
              <Volume2 size={32} />
            ) : (
              <Mic size={32} />
            )}
          </div>

          <h2 className="speak-call-status">{statusLabel(status, t)}</h2>
          {hint && <p className="speak-call-hint">{hint}</p>}

          {remainingSeconds != null && timerPct != null && (
            <div className="speak-timer">
              <div className="speak-timer-label">
                <Clock size={14} />
                <span>{t("speakTimeRemaining", { time: formatCountdown(remainingSeconds) })}</span>
              </div>
              <div className="speak-timer-bar" aria-hidden="true">
                <div className="speak-timer-fill" style={{ width: `${timerPct}%` }} />
              </div>
            </div>
          )}

          {errorMessage && <p className="speak-error">{errorMessage}</p>}

          <div className="speak-call-actions">
            <button
              type="button"
              className="speak-end-btn"
              onClick={() => void handleEnd()}
            >
              <PhoneOff size={18} />
              {t("speakEndCall")}
            </button>
            <button
              type="button"
              className="speak-secondary-btn"
              onClick={sendDontUnderstand}
              disabled={status === "connecting"}
            >
              <MessageCircleQuestion size={16} />
              {t("speakDontUnderstand")}
            </button>
          </div>
        </section>
      )}

      {!showCall && <p className="speak-footnote">{t("speakFootnote")}</p>}
    </div>
  );
}
