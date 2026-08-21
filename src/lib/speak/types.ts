export type SpeakVoiceGender = "male" | "female";

export type SpeakLevel = "beginner" | "intermediate" | "advanced";

export type SpeakRealtimeModel = "gpt-realtime-2.1" | "gpt-realtime-2.1-mini";

export type SpeakLearnerFacts = {
  name?: string;
  city?: string;
  country?: string;
  occupation?: string;
  interests?: string;
};

export type SpeakProfile = {
  userId: string;
  voiceGender: SpeakVoiceGender;
  level: SpeakLevel;
  realtimeModel: SpeakRealtimeModel;
  speechSpeed: number;
  learnerFacts: SpeakLearnerFacts;
  conversationSummary: string;
  updatedAt?: string;
};

export type SpeakSessionStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "speaking"
  | "error";

export type CreateSpeakSessionResult =
  | {
      type: "success";
      clientSecret: string;
      expiresAt: number;
      instructions: string;
      model: SpeakRealtimeModel;
      voice: string;
      speechSpeed: number;
      vadEagerness: "low" | "medium";
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

export const FREE_SPEAK_SESSION_LIMIT_SECONDS = 180;

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
