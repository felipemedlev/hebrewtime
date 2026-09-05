"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import {
  Mic,
  PhoneOff,
  Loader2,
  MessageCircleQuestion,
  Volume2,
  Clock,
  LogIn,
  Pause,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import { useSpeakProfile } from "@/hooks/useSpeakProfile";
import { useSpeakSession } from "@/hooks/useSpeakSession";
import { clampSpeechSpeed } from "@/lib/speak/profileUtils";
import type {
  SpeakEpisodeContext,
  SpeakLearnerGender,
  SpeakLevel,
  SpeakRealtimeModel,
  SpeakRecapPayload,
  SpeakSessionStatus,
  SpeakVoiceGender,
} from "@/lib/speak/types";
import {
  FREE_SPEAK_SESSION_LIMIT_SECONDS,
  SPEAK_EPISODE_SNIPPET_MAX,
  SPEAK_SPEED_BY_LEVEL,
  SPEAK_SPEED_MAX,
  SPEAK_SPEED_MIN,
} from "@/lib/speak/types";

type SpeakViewProps = {
  isAuthenticated: boolean;
  isPremium: boolean;
  episodeTitle?: string | null;
  episodeHebrewText?: string | null;
  onSavePhrase?: (hebrew: string, translation: string) => Promise<void>;
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

function statusHint(
  status: SpeakSessionStatus,
  isThinking: boolean,
  t: (key: MessageKey) => string
): string | null {
  if (isThinking) return t("speakCallThinkingHint");
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

export default function SpeakView({
  isAuthenticated,
  isPremium,
  episodeTitle,
  episodeHebrewText,
  onSavePhrase,
  onRequireAuth,
  onRequireSubscription,
  onSessionActiveChange,
}: SpeakViewProps) {
  const t = useT();
  const [userId, setUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [voiceGender, setVoiceGender] = useState<SpeakVoiceGender>("female");
  const [learnerGender, setLearnerGender] = useState<SpeakLearnerGender | null>(null);
  const [level, setLevel] = useState<SpeakLevel>("beginner");
  const [realtimeModel, setRealtimeModel] =
    useState<SpeakRealtimeModel>("gpt-realtime-2.1");
  const [speechSpeed, setSpeechSpeed] = useState(SPEAK_SPEED_BY_LEVEL.beginner);
  const [speedTouched, setSpeedTouched] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    profile,
    isLoading,
    savePreferences,
    saveLearnerFacts,
    saveConversationSummary,
    saveSessionNotes,
  } = useSpeakProfile(userId);

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
    const syncTimer = window.setTimeout(() => {
      setVoiceGender(profile.voiceGender);
      setLevel(profile.level);
      setRealtimeModel(profile.realtimeModel);
      setSpeechSpeed(profile.speechSpeed);
      setSpeedTouched(profile.speechSpeed !== SPEAK_SPEED_BY_LEVEL[profile.level]);
      setLearnerGender(profile.learnerFacts.gender ?? null);
    }, 0);
    return () => window.clearTimeout(syncTimer);
  }, [profile]);

  const handleLevelChange = useCallback(
    (next: SpeakLevel) => {
      setLevel(next);
      if (!speedTouched) {
        setSpeechSpeed(SPEAK_SPEED_BY_LEVEL[next]);
      }
    },
    [speedTouched]
  );

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

  const handleSessionRecap = useCallback(
    async (payload: SpeakRecapPayload) => {
      const targetPhrases = payload.phrases.map((item) => item.hebrew).filter(Boolean);
      const lastCorrections = payload.recast ? [payload.recast] : [];
      await saveSessionNotes({ targetPhrases, lastCorrections });

      if (!onSavePhrase) return;
      const items = [
        ...payload.phrases,
        ...(payload.newWord
          ? [{ hebrew: payload.newWord.hebrew, english: payload.newWord.english }]
          : []),
      ];
      for (const item of items) {
        const hebrew = item.hebrew.trim();
        const english = item.english.trim();
        if (!hebrew || !english) continue;
        try {
          await onSavePhrase(hebrew, english);
        } catch {
          // ignore individual vocab save failures
        }
      }
    },
    [onSavePhrase, saveSessionNotes]
  );

  const handleError = useCallback((message: string) => {
    setErrorMessage(message);
  }, []);

  const episodeContext = useMemo<SpeakEpisodeContext | null>(() => {
    if (!episodeTitle && !episodeHebrewText) return null;
    return {
      title: episodeTitle?.trim() || "",
      hebrewText: (episodeHebrewText ?? "").slice(0, SPEAK_EPISODE_SNIPPET_MAX),
    };
  }, [episodeTitle, episodeHebrewText]);

  const {
    status,
    isActive,
    isThinking,
    remainingSeconds,
    startSession,
    stopSession,
    sendDontUnderstand,
    sendRepeatSlower,
    sendSayShorter,
    sendHint,
    sendSkipTopic,
    sendRepeatAfterMe,
    sendTalkMore,
    toggleThinking,
  } = useSpeakSession({
    accessToken,
    voiceGender,
    level,
    realtimeModel,
    speechSpeed,
    learnerGender,
    episodeContext,
    onLearnerFacts: handleLearnerFacts,
    onConversationSummary: handleConversationSummary,
    onSessionRecap: handleSessionRecap,
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
    if (facts.gender) {
      items.push({
        key: "gender",
        label: t("speakFactGender"),
        value: facts.gender === "female" ? t("speakLearnerFemale") : t("speakLearnerMale"),
      });
    }
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
  const helpDisabled = status === "connecting" || isThinking;
  const hint = statusHint(status, isThinking, t);
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
    if (learnerGender) {
      void saveLearnerFacts({ gender: learnerGender });
    }
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
          <div className="speak-rows">
            <div className="speak-row">
              <span className="speak-row-label">{t("speakVoiceLabel")}</span>
              <div className="speak-toggle" role="group" aria-label={t("speakVoiceLabel")}>
                <button
                  type="button"
                  className={voiceGender === "female" ? "is-active" : ""}
                  aria-pressed={voiceGender === "female"}
                  onClick={() => setVoiceGender("female")}
                >
                  {t("speakVoiceFemale")}
                </button>
                <button
                  type="button"
                  className={voiceGender === "male" ? "is-active" : ""}
                  aria-pressed={voiceGender === "male"}
                  onClick={() => setVoiceGender("male")}
                >
                  {t("speakVoiceMale")}
                </button>
              </div>
            </div>

            <div className="speak-row">
              <span className="speak-row-label">{t("speakLearnerGenderLabel")}</span>
              <div className="speak-toggle" role="group" aria-label={t("speakLearnerGenderLabel")}>
                <button
                  type="button"
                  className={learnerGender === "female" ? "is-active" : ""}
                  aria-pressed={learnerGender === "female"}
                  onClick={() => setLearnerGender("female")}
                >
                  {t("speakLearnerFemale")}
                </button>
                <button
                  type="button"
                  className={learnerGender === "male" ? "is-active" : ""}
                  aria-pressed={learnerGender === "male"}
                  onClick={() => setLearnerGender("male")}
                >
                  {t("speakLearnerMale")}
                </button>
              </div>
            </div>

            <div className="speak-row">
              <span className="speak-row-label">{t("speakLevelLabel")}</span>
              <div className="speak-toggle" role="group" aria-label={t("speakLevelLabel")}>
                {LEVELS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={level === value ? "is-active" : ""}
                    aria-pressed={level === value}
                    onClick={() => handleLevelChange(value)}
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

            <div className="speak-row">
              <span className="speak-row-label">{t("speakModelLabel")}</span>
              <div className="speak-toggle" role="group" aria-label={t("speakModelLabel")}>
                <button
                  type="button"
                  className={realtimeModel === "gpt-realtime-2.1" ? "is-active" : ""}
                  aria-pressed={realtimeModel === "gpt-realtime-2.1"}
                  title={t("speakModelQualityDesc")}
                  onClick={() => setRealtimeModel("gpt-realtime-2.1")}
                >
                  {t("speakModelQuality")}
                </button>
                <button
                  type="button"
                  className={realtimeModel === "gpt-realtime-2.1-mini" ? "is-active" : ""}
                  aria-pressed={realtimeModel === "gpt-realtime-2.1-mini"}
                  title={t("speakModelCheaperDesc")}
                  onClick={() => setRealtimeModel("gpt-realtime-2.1-mini")}
                >
                  {t("speakModelCheaper")}
                </button>
              </div>
            </div>

            <div className="speak-row speak-row-speed">
              <div className="speak-row-label-group">
                <label className="speak-row-label" htmlFor="speak-speed">
                  {t("speakSpeedLabel")}
                </label>
                <span className="speak-row-value">{formatSpeed(speechSpeed)}</span>
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
                onChange={(e) => {
                  setSpeedTouched(true);
                  setSpeechSpeed(clampSpeechSpeed(Number(e.target.value)));
                }}
              />
            </div>
          </div>

          {knownFacts.length > 0 && (
            <div className="speak-known-facts">
              <span className="speak-known-facts-label">{t("speakKnownFacts")}</span>
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
          <div className={`speak-orb status-${isThinking ? "thinking" : status}`}>
            {status === "connecting" ? (
              <Loader2 className="speak-spin" size={28} />
            ) : isThinking ? (
              <Pause size={28} />
            ) : status === "speaking" ? (
              <Volume2 size={28} />
            ) : (
              <Mic size={28} />
            )}
          </div>

          <h2 className="speak-call-status">
            {isThinking ? t("speakThinking") : statusLabel(status, t)}
          </h2>
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
            <div className="speak-help-row">
              <button
                type="button"
                className="speak-chip-btn"
                onClick={sendDontUnderstand}
                disabled={helpDisabled}
              >
                <MessageCircleQuestion size={14} />
                {t("speakDontUnderstand")}
              </button>
              <button
                type="button"
                className="speak-chip-btn"
                onClick={sendRepeatSlower}
                disabled={helpDisabled}
              >
                {t("speakRepeatSlower")}
              </button>
              <button
                type="button"
                className="speak-chip-btn"
                onClick={sendSayShorter}
                disabled={helpDisabled}
              >
                {t("speakSayShorter")}
              </button>
              <button
                type="button"
                className="speak-chip-btn"
                onClick={sendHint}
                disabled={helpDisabled}
              >
                {t("speakGiveHint")}
              </button>
              <button
                type="button"
                className="speak-chip-btn"
                onClick={sendSkipTopic}
                disabled={helpDisabled}
              >
                {t("speakSkipTopic")}
              </button>
              <button
                type="button"
                className="speak-chip-btn"
                onClick={sendTalkMore}
                disabled={helpDisabled}
              >
                {t("speakTalkMore")}
              </button>
              <button
                type="button"
                className="speak-chip-btn"
                onClick={sendRepeatAfterMe}
                disabled={helpDisabled}
              >
                {t("speakRepeatAfterMe")}
              </button>
              <button
                type="button"
                className={`speak-chip-btn${isThinking ? " is-active" : ""}`}
                onClick={toggleThinking}
                disabled={status === "connecting"}
                aria-pressed={isThinking}
              >
                <Pause size={14} />
                {t("speakThinking")}
              </button>
            </div>
          </div>
        </section>
      )}

      {!showCall && <p className="speak-footnote">{t("speakFootnote")}</p>}
    </div>
  );
}
