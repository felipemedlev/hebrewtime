"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  clampSpeechSpeed,
  emptySpeakSessionNotes,
  mapSpeakProfileRow,
  mergeLearnerFacts,
  mergeSessionNotes,
  sanitizeConversationSummary,
  sanitizeSessionNotes,
  sessionNotesToRow,
  type SpeakProfileRow,
} from "@/lib/speak/profileUtils";
import {
  SPEAK_SPEED_BY_LEVEL,
  type SpeakLearnerFacts,
  type SpeakLevel,
  type SpeakProfile,
  type SpeakRealtimeModel,
  type SpeakSessionNotes,
  type SpeakVoiceGender,
} from "@/lib/speak/types";

const DEFAULT_PROFILE: Omit<SpeakProfile, "userId"> = {
  voiceGender: "female",
  level: "beginner",
  realtimeModel: "gpt-realtime-2.1",
  speechSpeed: SPEAK_SPEED_BY_LEVEL.beginner,
  learnerFacts: {},
  conversationSummary: "",
  sessionNotes: emptySpeakSessionNotes(),
};

const PROFILE_COLUMNS =
  "user_id, voice_gender, level, realtime_model, speech_speed, learner_facts, conversation_summary, session_notes, updated_at";

export function useSpeakProfile(userId: string | null) {
  const [profile, setProfile] = useState<SpeakProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("speak_profiles")
        .select(PROFILE_COLUMNS)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Failed to load speak profile:", error);
        setProfile({ userId, ...DEFAULT_PROFILE });
        return;
      }

      if (!data) {
        setProfile({ userId, ...DEFAULT_PROFILE });
        return;
      }

      setProfile(mapSpeakProfileRow(data as SpeakProfileRow));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const savePreferences = useCallback(
    async (prefs: {
      voiceGender: SpeakVoiceGender;
      level: SpeakLevel;
      realtimeModel: SpeakRealtimeModel;
      speechSpeed: number;
    }) => {
      if (!userId) return;

      const payload = {
        user_id: userId,
        voice_gender: prefs.voiceGender,
        level: prefs.level,
        realtime_model: prefs.realtimeModel,
        speech_speed: clampSpeechSpeed(prefs.speechSpeed),
      };

      const { error } = await supabase.from("speak_profiles").upsert(payload, {
        onConflict: "user_id",
      });

      if (error) {
        console.error("Failed to save speak preferences:", error);
        return;
      }

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              voiceGender: prefs.voiceGender,
              level: prefs.level,
              realtimeModel: prefs.realtimeModel,
              speechSpeed: clampSpeechSpeed(prefs.speechSpeed),
            }
          : {
              userId,
              ...DEFAULT_PROFILE,
              ...prefs,
              speechSpeed: clampSpeechSpeed(prefs.speechSpeed),
            }
      );
    },
    [userId, profile]
  );

  const saveLearnerFacts = useCallback(
    async (patch: SpeakLearnerFacts) => {
      if (!userId) return;

      const merged = mergeLearnerFacts(profile?.learnerFacts ?? {}, patch);
      const payload = {
        user_id: userId,
        voice_gender: profile?.voiceGender ?? DEFAULT_PROFILE.voiceGender,
        level: profile?.level ?? DEFAULT_PROFILE.level,
        realtime_model: profile?.realtimeModel ?? DEFAULT_PROFILE.realtimeModel,
        speech_speed: profile?.speechSpeed ?? DEFAULT_PROFILE.speechSpeed,
        learner_facts: merged,
      };

      const { error } = await supabase.from("speak_profiles").upsert(payload, {
        onConflict: "user_id",
      });

      if (error) {
        console.error("Failed to save learner facts:", error);
        return;
      }

      setProfile((prev) =>
        prev
          ? { ...prev, learnerFacts: merged }
          : { userId, ...DEFAULT_PROFILE, learnerFacts: merged }
      );
    },
    [userId, profile]
  );

  const saveConversationSummary = useCallback(
    async (summary: string) => {
      if (!userId) return;

      const safeSummary = sanitizeConversationSummary(summary);
      const payload = {
        user_id: userId,
        voice_gender: profile?.voiceGender ?? DEFAULT_PROFILE.voiceGender,
        level: profile?.level ?? DEFAULT_PROFILE.level,
        realtime_model: profile?.realtimeModel ?? DEFAULT_PROFILE.realtimeModel,
        speech_speed: profile?.speechSpeed ?? DEFAULT_PROFILE.speechSpeed,
        conversation_summary: safeSummary,
      };

      const { error } = await supabase.from("speak_profiles").upsert(payload, {
        onConflict: "user_id",
      });

      if (error) {
        console.error("Failed to save conversation summary:", error);
        return;
      }

      setProfile((prev) =>
        prev
          ? { ...prev, conversationSummary: safeSummary }
          : { userId, ...DEFAULT_PROFILE, conversationSummary: safeSummary }
      );
    },
    [userId, profile]
  );

  const saveSessionNotes = useCallback(
    async (patch: Partial<SpeakSessionNotes>) => {
      if (!userId) return;

      const { data: existingRow } = await supabase
        .from("speak_profiles")
        .select("session_notes")
        .eq("user_id", userId)
        .maybeSingle();
      const dbNotes = sanitizeSessionNotes(existingRow?.session_notes);
      const local = profile?.sessionNotes ?? emptySpeakSessionNotes();
      const merged = mergeSessionNotes(
        {
          lastCorrections: local.lastCorrections,
          targetPhrases: local.targetPhrases,
          recentTopics: dbNotes.recentTopics,
        },
        patch
      );
      const payload = {
        user_id: userId,
        voice_gender: profile?.voiceGender ?? DEFAULT_PROFILE.voiceGender,
        level: profile?.level ?? DEFAULT_PROFILE.level,
        realtime_model: profile?.realtimeModel ?? DEFAULT_PROFILE.realtimeModel,
        speech_speed: profile?.speechSpeed ?? DEFAULT_PROFILE.speechSpeed,
        session_notes: sessionNotesToRow(merged),
      };

      const { error } = await supabase.from("speak_profiles").upsert(payload, {
        onConflict: "user_id",
      });

      if (error) {
        console.error("Failed to save session notes:", error);
        return;
      }

      setProfile((prev) =>
        prev
          ? { ...prev, sessionNotes: merged }
          : { userId, ...DEFAULT_PROFILE, sessionNotes: merged }
      );
    },
    [userId, profile]
  );

  return {
    profile,
    isLoading,
    savePreferences,
    saveLearnerFacts,
    saveConversationSummary,
    saveSessionNotes,
    reload: loadProfile,
  };
}
