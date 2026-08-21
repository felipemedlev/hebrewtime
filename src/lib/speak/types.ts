export type SpeakVoiceGender = "male" | "female";

export type SpeakLevel = "beginner" | "intermediate" | "advanced";

export type SpeakRealtimeModel = "gpt-realtime-2.1" | "gpt-realtime-2.1-mini";

export type SpeakLearnerGender = "male" | "female";

export type SpeakLearnerFacts = {
  name?: string;
  gender?: SpeakLearnerGender;
  city?: string;
  country?: string;
  occupation?: string;
  interests?: string;
};

export type SpeakSessionNotes = {
  lastCorrections: string[];
  targetPhrases: string[];
  recentTopics: string[];
};

export type SpeakTargetWord = {
  word: string;
  translation: string;
};

export type SpeakEpisodeContext = {
  title: string;
  hebrewText: string;
};

export type SpeakRecapPayload = {
  phrases: { hebrew: string; english: string }[];
  recast?: string;
  newWord?: { hebrew: string; english: string };
};

export type SpeakProfile = {
  userId: string;
  voiceGender: SpeakVoiceGender;
  level: SpeakLevel;
  realtimeModel: SpeakRealtimeModel;
  speechSpeed: number;
  learnerFacts: SpeakLearnerFacts;
  conversationSummary: string;
  sessionNotes: SpeakSessionNotes;
  updatedAt?: string;
};

export type SpeakSessionStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "speaking"
  | "error";

export type SpeakTurnDetection = {
  type: "server_vad";
  silenceDurationMs: number;
  prefixPaddingMs: number;
  threshold: number;
  interruptResponse: boolean;
};

export type CreateSpeakSessionResult =
  | {
      type: "success";
      clientSecret: string;
      expiresAt: number;
      instructions: string;
      model: SpeakRealtimeModel;
      voice: string;
      speechSpeed: number;
      turnDetection: SpeakTurnDetection;
      isPremium: boolean;
      sessionLimitSeconds: number | null;
    }
  | { type: "auth_required" }
  | { type: "limit_reached" }
  | { type: "error"; message?: string };

export const SPEAK_VOICE_BY_GENDER: Record<SpeakVoiceGender, string> = {
  female: "marin",
  male: "cedar",
};

export const SPEAK_SPEED_MIN = 0.25;
export const SPEAK_SPEED_MAX = 1.5;
export const SPEAK_SPEED_DEFAULT = 1.0;

export const SPEAK_SPEED_BY_LEVEL: Record<SpeakLevel, number> = {
  beginner: 0.6,
  intermediate: 0.8,
  advanced: 1.0,
};

export const FREE_SPEAK_SESSION_LIMIT_SECONDS = 180;
export const SPEAK_RECAP_WINDOW_SECONDS = 20;
export const SPEAK_END_WAIT_MS = 2500;
export const SPEAK_NOTES_MAX_ITEMS = 5;
export const SPEAK_RECENT_TOPICS_MAX = 8;
export const SPEAK_TARGET_WORDS_MAX = 8;
export const SPEAK_EPISODE_SNIPPET_MAX = 600;

export const SPEAK_LEARNER_FACT_KEYS = [
  "name",
  "city",
  "country",
  "occupation",
  "interests",
] as const;

export type SpeakLearnerFactKey = (typeof SPEAK_LEARNER_FACT_KEYS)[number];

export const SPEAK_SUMMARY_MAX_LENGTH = 500;
export const SPEAK_FACT_MAX_LENGTH = 120;
export const SPEAK_NOTE_MAX_LENGTH = 120;
