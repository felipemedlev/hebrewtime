"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  clampSpeechSpeed,
  mapSpeakProfileRow,
  mergeLearnerFacts,
  sanitizeConversationSummary,
  type SpeakProfileRow,
} from "@/lib/speak/profileUtils";
import {
  SPEAK_SPEED_BY_LEVEL,
  type SpeakLearnerFacts,
  type SpeakLevel,
  type SpeakProfile,
  type SpeakRealtimeModel,
  type SpeakVoiceGender,
} from "@/lib/speak/types";

const DEFAULT_PROFILE: Omit<SpeakProfile, "userId"> = {
  voiceGender: "female",
  level: "beginner",
  realtimeModel: "gpt-realtime-2.1",
  speechSpeed: SPEAK_SPEED_BY_LEVEL.beginner,
  learnerFacts: {},
  conversationSummary: "",
};

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
        .select(
          "user_id, voice_gender, level, realtime_model, speech_speed, learner_facts, conversation_summary, updated_at"
        )
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
        learner_facts: profile?.learnerFacts ?? {},
        conversation_summary: profile?.conversationSummary ?? "",
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
        conversation_summary: profile?.conversationSummary ?? "",
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
        learner_facts: profile?.learnerFacts ?? {},
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

  return {
    profile,
    isLoading,
    savePreferences,
    saveLearnerFacts,
    saveConversationSummary,
    reload: loadProfile,
  };
}
