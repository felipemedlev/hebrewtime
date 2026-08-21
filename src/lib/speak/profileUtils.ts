import type {
  SpeakLearnerFacts,
  SpeakLearnerFactKey,
  SpeakLearnerGender,
  SpeakLevel,
  SpeakRealtimeModel,
  SpeakScene,
  SpeakSessionNotes,
  SpeakTurnDetection,
  SpeakVoiceGender,
} from "./types";
import {
  SPEAK_FACT_MAX_LENGTH,
  SPEAK_LEARNER_FACT_KEYS,
  SPEAK_NOTE_MAX_LENGTH,
  SPEAK_NOTES_MAX_ITEMS,
  SPEAK_SCENE_DEFAULT,
  SPEAK_SCENES,
  SPEAK_SPEED_BY_LEVEL,
  SPEAK_SPEED_DEFAULT,
  SPEAK_SPEED_MAX,
  SPEAK_SPEED_MIN,
  SPEAK_SUMMARY_MAX_LENGTH,
  SPEAK_VOICE_BY_GENDER,
} from "./types";

export function isSpeakVoiceGender(value: string): value is SpeakVoiceGender {
  return value === "male" || value === "female";
}

export function isSpeakLearnerGender(value: string): value is SpeakLearnerGender {
  return value === "male" || value === "female";
}

export function isSpeakLevel(value: string): value is SpeakLevel {
  return value === "beginner" || value === "intermediate" || value === "advanced";
}

export function isSpeakRealtimeModel(value: string): value is SpeakRealtimeModel {
  return value === "gpt-realtime-2.1" || value === "gpt-realtime-2.1-mini";
}

export function isSpeakScene(value: string): value is SpeakScene {
  return (SPEAK_SCENES as readonly string[]).includes(value);
}

export function clampSpeechSpeed(value: number): number {
  if (!Number.isFinite(value)) return SPEAK_SPEED_DEFAULT;
  return Math.min(SPEAK_SPEED_MAX, Math.max(SPEAK_SPEED_MIN, Math.round(value * 100) / 100));
}

export function getDefaultSpeechSpeed(level: SpeakLevel): number {
  return SPEAK_SPEED_BY_LEVEL[level];
}

export function getSpeakTurnDetection(level: SpeakLevel): SpeakTurnDetection {
  if (level === "beginner") {
    return {
      type: "server_vad",
      silenceDurationMs: 550,
      prefixPaddingMs: 180,
      threshold: 0.5,
      interruptResponse: false,
    };
  }
  if (level === "intermediate") {
    return {
      type: "server_vad",
      silenceDurationMs: 380,
      prefixPaddingMs: 160,
      threshold: 0.5,
      interruptResponse: true,
    };
  }
  return {
    type: "server_vad",
    silenceDurationMs: 280,
    prefixPaddingMs: 140,
    threshold: 0.5,
    interruptResponse: true,
  };
}

export function toRealtimeTurnDetection(td: SpeakTurnDetection) {
  return {
    type: td.type,
    createResponse: true as const,
    interruptResponse: td.interruptResponse,
    silenceDurationMs: td.silenceDurationMs,
    prefixPaddingMs: td.prefixPaddingMs,
    threshold: td.threshold,
  };
}

export function toClientSecretTurnDetection(td: SpeakTurnDetection) {
  return {
    type: td.type,
    create_response: true,
    interrupt_response: td.interruptResponse,
    silence_duration_ms: td.silenceDurationMs,
    prefix_padding_ms: td.prefixPaddingMs,
    threshold: td.threshold,
  };
}

export function getVoiceId(gender: SpeakVoiceGender): string {
  return SPEAK_VOICE_BY_GENDER[gender];
}

export function sanitizeLearnerFacts(input: unknown): SpeakLearnerFacts {
  if (!input || typeof input !== "object") return {};
  const raw = input as Record<string, unknown>;
  const facts: SpeakLearnerFacts = {};
  if (isSpeakLearnerGender(String(raw.gender ?? ""))) {
    facts.gender = raw.gender as SpeakLearnerGender;
  }
  for (const key of SPEAK_LEARNER_FACT_KEYS) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) {
      facts[key] = value.trim().slice(0, SPEAK_FACT_MAX_LENGTH);
    }
  }
  return facts;
}

export function mergeLearnerFacts(
  existing: SpeakLearnerFacts,
  patch: SpeakLearnerFacts
): SpeakLearnerFacts {
  const merged = { ...existing };
  if (patch.gender && isSpeakLearnerGender(patch.gender)) {
    merged.gender = patch.gender;
  }
  for (const key of SPEAK_LEARNER_FACT_KEYS) {
    const value = patch[key];
    if (typeof value === "string" && value.trim()) {
      merged[key] = value.trim().slice(0, SPEAK_FACT_MAX_LENGTH);
    }
  }
  return merged;
}

export function sanitizeConversationSummary(summary: string): string {
  return summary.trim().slice(0, SPEAK_SUMMARY_MAX_LENGTH);
}

function sanitizeNoteList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    if (typeof item !== "string") continue;
    const value = item.trim().slice(0, SPEAK_NOTE_MAX_LENGTH);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= SPEAK_NOTES_MAX_ITEMS) break;
  }
  return out;
}

export function emptySpeakSessionNotes(): SpeakSessionNotes {
  return { lastCorrections: [], targetPhrases: [] };
}

export function sanitizeSessionNotes(input: unknown): SpeakSessionNotes {
  if (!input || typeof input !== "object") return emptySpeakSessionNotes();
  const raw = input as Record<string, unknown>;
  return {
    lastCorrections: sanitizeNoteList(raw.last_corrections ?? raw.lastCorrections),
    targetPhrases: sanitizeNoteList(raw.target_phrases ?? raw.targetPhrases),
  };
}

export function sessionNotesToRow(notes: SpeakSessionNotes) {
  return {
    last_corrections: notes.lastCorrections.slice(0, SPEAK_NOTES_MAX_ITEMS),
    target_phrases: notes.targetPhrases.slice(0, SPEAK_NOTES_MAX_ITEMS),
  };
}

export function mergeSessionNotes(
  existing: SpeakSessionNotes,
  patch: Partial<SpeakSessionNotes>
): SpeakSessionNotes {
  return sanitizeSessionNotes({
    last_corrections: [...(patch.lastCorrections ?? []), ...existing.lastCorrections],
    target_phrases: [...(patch.targetPhrases ?? []), ...existing.targetPhrases],
  });
}

export function isSpeakLearnerFactKey(key: string): key is SpeakLearnerFactKey {
  return (SPEAK_LEARNER_FACT_KEYS as readonly string[]).includes(key);
}

export type SpeakProfileRow = {
  user_id: string;
  voice_gender: SpeakVoiceGender;
  level: SpeakLevel;
  realtime_model: SpeakRealtimeModel;
  speech_speed: number;
  scene?: SpeakScene | string | null;
  learner_facts: SpeakLearnerFacts;
  conversation_summary: string;
  session_notes?: unknown;
  updated_at?: string;
};

export function mapSpeakProfileRow(row: SpeakProfileRow) {
  return {
    userId: row.user_id,
    voiceGender: row.voice_gender,
    level: row.level,
    realtimeModel: row.realtime_model,
    speechSpeed: clampSpeechSpeed(Number(row.speech_speed)),
    scene: isSpeakScene(String(row.scene ?? "")) ? (row.scene as SpeakScene) : SPEAK_SCENE_DEFAULT,
    learnerFacts: sanitizeLearnerFacts(row.learner_facts),
    conversationSummary: sanitizeConversationSummary(row.conversation_summary ?? ""),
    sessionNotes: sanitizeSessionNotes(row.session_notes),
    updatedAt: row.updated_at,
  };
}
