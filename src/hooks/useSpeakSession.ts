"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSpeakSession } from "@/app/actions";
import {
  buildDontUnderstandPrompt,
  buildEndSessionSummaryPrompt,
} from "@/lib/speak/teacherPrompt";
import type {
  SpeakLevel,
  SpeakRealtimeModel,
  SpeakSessionStatus,
  SpeakVoiceGender,
  SpeakLearnerFacts,
} from "@/lib/speak/types";

type UseSpeakSessionArgs = {
  accessToken: string | null;
  voiceGender: SpeakVoiceGender;
  level: SpeakLevel;
  realtimeModel: SpeakRealtimeModel;
  speechSpeed: number;
  onLearnerFacts: (facts: SpeakLearnerFacts) => Promise<void>;
  onConversationSummary: (summary: string) => Promise<void>;
  onLimitReached: () => void;
  onAuthRequired: () => void;
  onError: (message: string) => void;
};

type RealtimeModule = typeof import("@openai/agents/realtime");

export function useSpeakSession({
  accessToken,
  voiceGender,
  level,
  realtimeModel,
  speechSpeed,
  onLearnerFacts,
  onConversationSummary,
  onLimitReached,
  onAuthRequired,
  onError,
}: UseSpeakSessionArgs) {
  const [status, setStatus] = useState<SpeakSessionStatus>("idle");
  const [isActive, setIsActive] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const sessionRef = useRef<InstanceType<RealtimeModule["RealtimeSession"]> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endingRef = useRef(false);
  const startingRef = useRef(false);
  const startGenRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopSession = useCallback(
    async (requestSummary = false) => {
      startGenRef.current += 1;
      startingRef.current = false;

      if (endingRef.current) return;
      endingRef.current = true;

      clearTimer();
      setRemainingSeconds(null);

      const session = sessionRef.current;
      sessionRef.current = null;

      if (session && requestSummary) {
        try {
          session.sendMessage(buildEndSessionSummaryPrompt());
          await new Promise((resolve) => setTimeout(resolve, 2500));
        } catch {
          // ignore summary prompt failures on teardown
        }
      }

      try {
        session?.close();
      } catch {
        // ignore close errors
      }

      setIsActive(false);
      setStatus("idle");
      endingRef.current = false;
      startingRef.current = false;
    },
    [clearTimer]
  );

  const startSession = useCallback(async () => {
    if (!accessToken || isActive || startingRef.current) return;

    startingRef.current = true;
    const gen = ++startGenRef.current;
    setStatus("connecting");

    const isCurrent = () => gen === startGenRef.current;

    const result = await createSpeakSession(
      accessToken,
      voiceGender,
      level,
      realtimeModel,
      speechSpeed
    );

    if (!isCurrent()) return;

    if (result.type === "auth_required") {
      startingRef.current = false;
      setStatus("idle");
      onAuthRequired();
      return;
    }

    if (result.type === "limit_reached") {
      startingRef.current = false;
      setStatus("idle");
      onLimitReached();
      return;
    }

    if (result.type === "error") {
      startingRef.current = false;
      setStatus("error");
      onError(result.message ?? "Could not start session.");
      return;
    }

    try {
      const { RealtimeAgent, RealtimeSession, tool } = await import("@openai/agents/realtime");
      const { z } = await import("zod");

      const saveFactsTool = tool({
        name: "save_learner_facts",
        description:
          "Save stable learner facts when you learn their name, city, country, occupation, or interests.",
        parameters: z.object({
          name: z.string().optional(),
          city: z.string().optional(),
          country: z.string().optional(),
          occupation: z.string().optional(),
          interests: z.string().optional(),
        }),
        execute: async (input) => {
          await onLearnerFacts(input);
          return "Saved learner facts.";
        },
      });

      const updateSummaryTool = tool({
        name: "update_conversation_summary",
        description:
          "Replace the short English summary of prior conversations (max 500 characters).",
        parameters: z.object({
          summary: z.string().max(500),
        }),
        execute: async ({ summary }) => {
          await onConversationSummary(summary);
          return "Updated conversation summary.";
        },
      });

      const agent = new RealtimeAgent({
        name: "HebrewTeacher",
        voice: result.voice,
        instructions: result.instructions,
        tools: [saveFactsTool, updateSummaryTool],
      });

      const session = new RealtimeSession(agent, {
        model: result.model,
        config: {
          outputModalities: ["audio"],
          reasoning: { effort: "low" },
          audio: {
            input: {
              turnDetection: {
                type: "semantic_vad",
                eagerness: result.vadEagerness,
                createResponse: true,
                interruptResponse: true,
              },
            },
            output: {
              voice: result.voice,
              speed: result.speechSpeed,
            },
          },
        },
      });

      session.on("audio_start", () => setStatus("speaking"));
      session.on("audio_stopped", () => setStatus("listening"));
      session.on("error", (event) => {
        console.error("Realtime session error:", event.error);
        setStatus("error");
        onError("Voice session error. Please try again.");
        void stopSession(false);
      });

      sessionRef.current = session;
      setIsActive(true);

      if (!isCurrent()) {
        try {
          session.close();
        } catch {
          // ignore close errors
        }
        sessionRef.current = null;
        startingRef.current = false;
        setIsActive(false);
        return;
      }

      await session.connect({ apiKey: result.clientSecret });

      if (!isCurrent()) {
        startingRef.current = false;
        return;
      }

      setStatus((current) => (current === "connecting" ? "listening" : current));
      startingRef.current = false;

      if (result.sessionLimitSeconds != null) {
        setRemainingSeconds(result.sessionLimitSeconds);
        timerRef.current = setInterval(() => {
          setRemainingSeconds((prev) => {
            if (prev == null) return prev;
            if (prev <= 1) {
              void stopSession(true);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (err) {
      if (!isCurrent()) return;
      console.error("Failed to connect speak session:", err);
      startingRef.current = false;
      setStatus("error");
      setIsActive(false);
      sessionRef.current = null;
      onError("Could not connect microphone. Check permissions and try again.");
    }
  }, [
    accessToken,
    isActive,
    voiceGender,
    level,
    realtimeModel,
    speechSpeed,
    onLearnerFacts,
    onConversationSummary,
    onLimitReached,
    onAuthRequired,
    onError,
    stopSession,
  ]);

  const sendDontUnderstand = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    session.sendMessage(buildDontUnderstandPrompt());
  }, []);

  useEffect(() => {
    return () => {
      void stopSession(false);
    };
  }, [stopSession]);

  return {
    status,
    isActive,
    remainingSeconds,
    startSession,
    stopSession,
    sendDontUnderstand,
  };
}
