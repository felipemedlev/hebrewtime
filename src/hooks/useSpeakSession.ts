"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSpeakSession } from "@/app/actions";
import {
  buildDontUnderstandPrompt,
  buildEndSessionSummaryPrompt,
  buildHintPrompt,
  buildLongerTurnPrompt,
  buildRecapSoonPrompt,
  buildRepeatAfterMePrompt,
  buildRepeatSlowerPrompt,
  buildSayShorterPrompt,
  buildSkipTopicPrompt,
  buildStartSessionPrompt,
  buildTalkMorePrompt,
} from "@/lib/speak/teacherPrompt";
import type {
  SpeakEpisodeContext,
  SpeakLearnerGender,
  SpeakLevel,
  SpeakRealtimeModel,
  SpeakRecapPayload,
  SpeakSessionStatus,
  SpeakVoiceGender,
  SpeakLearnerFacts,
} from "@/lib/speak/types";
import {
  SPEAK_END_WAIT_MS,
  SPEAK_LONGER_TURN_AFTER_MS,
  SPEAK_RECAP_WINDOW_SECONDS,
} from "@/lib/speak/types";
import { toRealtimeTurnDetection } from "@/lib/speak/profileUtils";

type UseSpeakSessionArgs = {
  accessToken: string | null;
  voiceGender: SpeakVoiceGender;
  level: SpeakLevel;
  realtimeModel: SpeakRealtimeModel;
  speechSpeed: number;
  learnerGender: SpeakLearnerGender | null;
  episodeContext: SpeakEpisodeContext | null;
  onLearnerFacts: (facts: SpeakLearnerFacts) => Promise<void>;
  onConversationSummary: (summary: string) => Promise<void>;
  onSessionRecap: (payload: SpeakRecapPayload) => Promise<void>;
  onLimitReached: () => void;
  onAuthRequired: () => void;
  onError: (message: string) => void;
};

type RealtimeModule = typeof import("@openai/agents/realtime");
type SpeakRealtimeSession = InstanceType<RealtimeModule["RealtimeSession"]> & {
  mute?: (muted: boolean) => void;
  interrupt?: () => void;
  transport?: { requestResponse?: (response?: Record<string, unknown>) => void };
};

function warmupMicrophone(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return Promise.resolve();
  }
  return navigator.mediaDevices
    .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    .then((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    })
    .catch(() => {
      // SDK connect will surface mic errors
    });
}

const RECOVERABLE_REALTIME_CODES = new Set([
  "conversation_already_has_active_response",
  "response_cancel_not_active",
  "input_audio_buffer_commit_empty",
]);

function walkRealtimeErrorField(error: unknown, key: "code" | "message"): string {
  const seen = new Set<unknown>();
  const walk = (value: unknown): string => {
    if (!value || typeof value !== "object" || seen.has(value)) return "";
    seen.add(value);
    const rec = value as Record<string, unknown>;
    const field = rec[key];
    if (typeof field === "string" && field.trim()) return field;
    if ("error" in rec) {
      const nested = walk(rec.error);
      if (nested) return nested;
    }
    return "";
  };
  if (typeof error === "string") return key === "message" ? error : "";
  return walk(error);
}

function isRecoverableRealtimeError(error: unknown): boolean {
  const code = walkRealtimeErrorField(error, "code").toLowerCase();
  if (RECOVERABLE_REALTIME_CODES.has(code)) return true;
  const message = walkRealtimeErrorField(error, "message").toLowerCase();
  if (!message) return false;
  // Barge-in / interrupt can truncate past generated audio, or cancel a response
  // that already finished. Overlapping response.create is also safe to ignore.
  return (
    message.includes("already shorter than") ||
    message.includes("no active response") ||
    message.includes("no response in progress") ||
    message.includes("cancellation failed") ||
    message.includes("already has an active response")
  );
}

function triggerGreeting(session: SpeakRealtimeSession) {
  if (typeof session.transport?.requestResponse === "function") {
    session.transport.requestResponse();
    return;
  }
  session.sendMessage(buildStartSessionPrompt());
}

function interruptSession(session: SpeakRealtimeSession | null) {
  if (!session) return;
  try {
    session.interrupt?.();
  } catch {
    // ignore interrupt errors
  }
}

export function useSpeakSession({
  accessToken,
  voiceGender,
  level,
  realtimeModel,
  speechSpeed,
  learnerGender,
  episodeContext,
  onLearnerFacts,
  onConversationSummary,
  onSessionRecap,
  onLimitReached,
  onAuthRequired,
  onError,
}: UseSpeakSessionArgs) {
  const [status, setStatus] = useState<SpeakSessionStatus>("idle");
  const [isActive, setIsActive] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const sessionRef = useRef<SpeakRealtimeSession | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endingRef = useRef(false);
  const startingRef = useRef(false);
  const startGenRef = useRef(0);
  const recapSentRef = useRef(false);
  const longerTurnSentRef = useRef(false);
  const longerTurnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thinkingRef = useRef(false);
  const responseBusyRef = useRef(false);
  const allowBargeInRef = useRef(true);
  const pendingMessageRef = useRef<string | null>(null);

  useEffect(() => {
    void import("@openai/agents/realtime");
    void import("zod");
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (longerTurnTimerRef.current) {
      clearTimeout(longerTurnTimerRef.current);
      longerTurnTimerRef.current = null;
    }
  }, []);

  const muteSession = useCallback((muted: boolean) => {
    try {
      sessionRef.current?.mute?.(muted);
    } catch {
      // ignore mute errors
    }
  }, []);

  const sendTurnMessage = useCallback((message: string) => {
    const session = sessionRef.current;
    if (!session) return;

    const sendNow = () => {
      if (sessionRef.current !== session) return;
      if (pendingMessageRef.current !== message) return;
      pendingMessageRef.current = null;
      try {
        session.sendMessage(message);
        responseBusyRef.current = true;
      } catch {
        // ignore prompt failures
      }
    };

    pendingMessageRef.current = message;
    if (responseBusyRef.current) {
      interruptSession(session);
      window.setTimeout(sendNow, 120);
      return;
    }
    sendNow();
  }, []);

  const stopSession = useCallback(
    async (requestSummary = false) => {
      startGenRef.current += 1;
      startingRef.current = false;

      if (endingRef.current) return;
      endingRef.current = true;

      clearTimer();
      setRemainingSeconds(null);
      setIsThinking(false);
      thinkingRef.current = false;
      recapSentRef.current = false;
      longerTurnSentRef.current = false;
      responseBusyRef.current = false;
      pendingMessageRef.current = null;

      const session = sessionRef.current;
      sessionRef.current = null;
      muteSession(false);

      if (session && requestSummary) {
        try {
          interruptSession(session);
          await new Promise((resolve) => setTimeout(resolve, 80));
          session.sendMessage(buildEndSessionSummaryPrompt());
          await new Promise((resolve) => setTimeout(resolve, SPEAK_END_WAIT_MS));
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
    [clearTimer, muteSession]
  );

  const startSession = useCallback(async () => {
    if (!accessToken || isActive || startingRef.current) return;

    startingRef.current = true;
    const gen = ++startGenRef.current;
    recapSentRef.current = false;
    longerTurnSentRef.current = false;
    thinkingRef.current = false;
    responseBusyRef.current = false;
    pendingMessageRef.current = null;
    setIsThinking(false);
    setStatus("connecting");

    const isCurrent = () => gen === startGenRef.current;

    const [result, realtimeMod, zodMod] = await Promise.all([
      createSpeakSession(
        accessToken,
        voiceGender,
        level,
        realtimeModel,
        speechSpeed,
        episodeContext,
        learnerGender
      ),
      import("@openai/agents/realtime"),
      import("zod"),
      warmupMicrophone(),
    ]);

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
      const { RealtimeAgent, RealtimeSession, tool } = realtimeMod;
      const { z } = zodMod;

      const saveFactsTool = tool({
        name: "save_learner_facts",
        description:
          "Save stable learner facts when you learn their name, gender (male/female), city, country, occupation, or interests.",
        parameters: z.object({
          name: z.string().optional(),
          gender: z.enum(["male", "female"]).optional(),
          city: z.string().optional(),
          country: z.string().optional(),
          occupation: z.string().optional(),
          interests: z.string().optional(),
        }),
        execute: async (input) => {
          void onLearnerFacts(input);
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
          void onConversationSummary(summary);
          return "Updated conversation summary.";
        },
      });

      const recapTool = tool({
        name: "save_session_recap",
        description:
          "Save a tiny recap: up to 3 reusable Hebrew phrases, one recast, and one new word. Call near the end of the session.",
        parameters: z.object({
          phrases: z
            .array(
              z.object({
                hebrew: z.string().max(120),
                english: z.string().max(120),
              })
            )
            .max(3),
          recast: z.string().max(120).optional(),
          new_word: z
            .object({
              hebrew: z.string().max(80),
              english: z.string().max(120),
            })
            .optional(),
        }),
        execute: async (input) => {
          void onSessionRecap({
            phrases: input.phrases,
            recast: input.recast,
            newWord: input.new_word
              ? { hebrew: input.new_word.hebrew, english: input.new_word.english }
              : undefined,
          });
          return "Saved session recap.";
        },
      });

      const agent = new RealtimeAgent({
        name: "HebrewTeacher",
        voice: result.voice,
        instructions: result.instructions,
        tools: [saveFactsTool, updateSummaryTool, recapTool],
      });

      const session = new RealtimeSession(agent, {
        model: result.model,
        config: {
          outputModalities: ["audio"],
          reasoning: { effort: "low" },
          audio: {
            input: {
              noiseReduction: { type: "near_field" },
              turnDetection: toRealtimeTurnDetection(result.turnDetection),
            },
            output: {
              voice: result.voice,
              speed: result.speechSpeed,
            },
          },
        },
      }) as SpeakRealtimeSession;

      const allowBargeIn = result.turnDetection.interruptResponse;
      allowBargeInRef.current = allowBargeIn;
      let audioStarted = false;

      const releaseMic = () => {
        if (!thinkingRef.current) muteSession(false);
      };

      const flushPendingMessage = () => {
        const sessionNow = sessionRef.current;
        const pending = pendingMessageRef.current;
        if (!sessionNow || !pending) return;
        pendingMessageRef.current = null;
        try {
          sessionNow.sendMessage(pending);
          responseBusyRef.current = true;
        } catch {
          // ignore queued prompt failures
        }
      };

      session.on("audio_start", () => {
        audioStarted = true;
        responseBusyRef.current = true;
        setStatus("speaking");
        if (!allowBargeInRef.current) muteSession(true);
      });
      session.on("audio_stopped", () => {
        responseBusyRef.current = false;
        setStatus("listening");
        flushPendingMessage();
        releaseMic();
      });
      session.on("audio_interrupted", () => {
        responseBusyRef.current = false;
        setStatus("listening");
        flushPendingMessage();
        releaseMic();
      });
      session.on("error", (event) => {
        if (isRecoverableRealtimeError(event) || isRecoverableRealtimeError(event.error)) {
          return;
        }
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

      if (!allowBargeIn) {
        muteSession(true);
      }

      try {
        if (!audioStarted) {
          triggerGreeting(session);
          responseBusyRef.current = true;
        }
      } catch {
        // first-turn prompt is best-effort
      }

      window.setTimeout(() => {
        if (!isCurrent() || thinkingRef.current || audioStarted) return;
        responseBusyRef.current = false;
        muteSession(false);
      }, 4000);

      setStatus((current) => (current === "connecting" ? "listening" : current));
      startingRef.current = false;

      const talkWindowSeconds =
        result.sessionLimitSeconds != null
          ? Math.max(0, result.sessionLimitSeconds - SPEAK_RECAP_WINDOW_SECONDS)
          : null;
      const longerTurnDelayMs =
        talkWindowSeconds != null
          ? Math.max(45_000, Math.floor(talkWindowSeconds * 500))
          : SPEAK_LONGER_TURN_AFTER_MS;
      longerTurnTimerRef.current = setTimeout(() => {
        longerTurnTimerRef.current = null;
        if (
          !isCurrent() ||
          endingRef.current ||
          recapSentRef.current ||
          longerTurnSentRef.current
        ) {
          return;
        }
        longerTurnSentRef.current = true;
        sendTurnMessage(buildLongerTurnPrompt());
      }, longerTurnDelayMs);

      if (result.sessionLimitSeconds != null) {
        setRemainingSeconds(result.sessionLimitSeconds);
        timerRef.current = setInterval(() => {
          setRemainingSeconds((prev) => {
            if (prev == null) return prev;
            if (prev === SPEAK_RECAP_WINDOW_SECONDS && !recapSentRef.current) {
              recapSentRef.current = true;
              sendTurnMessage(buildRecapSoonPrompt());
            }
            if (prev <= 1) {
              void stopSession(false);
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
    learnerGender,
    episodeContext,
    onLearnerFacts,
    onConversationSummary,
    onSessionRecap,
    onLimitReached,
    onAuthRequired,
    onError,
    muteSession,
    stopSession,
    sendTurnMessage,
  ]);

  const sendDontUnderstand = useCallback(() => {
    sendTurnMessage(buildDontUnderstandPrompt());
  }, [sendTurnMessage]);

  const sendRepeatSlower = useCallback(() => {
    sendTurnMessage(buildRepeatSlowerPrompt());
  }, [sendTurnMessage]);

  const sendSayShorter = useCallback(() => {
    sendTurnMessage(buildSayShorterPrompt());
  }, [sendTurnMessage]);

  const sendHint = useCallback(() => {
    sendTurnMessage(buildHintPrompt());
  }, [sendTurnMessage]);

  const sendSkipTopic = useCallback(() => {
    sendTurnMessage(buildSkipTopicPrompt());
  }, [sendTurnMessage]);

  const sendRepeatAfterMe = useCallback(() => {
    sendTurnMessage(buildRepeatAfterMePrompt());
  }, [sendTurnMessage]);

  const sendTalkMore = useCallback(() => {
    longerTurnSentRef.current = true;
    if (longerTurnTimerRef.current) {
      clearTimeout(longerTurnTimerRef.current);
      longerTurnTimerRef.current = null;
    }
    sendTurnMessage(buildTalkMorePrompt());
  }, [sendTurnMessage]);

  const toggleThinking = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    setIsThinking((prev) => {
      const next = !prev;
      thinkingRef.current = next;
      try {
        if (next) {
          pendingMessageRef.current = null;
          session.interrupt?.();
          session.mute?.(true);
        } else {
          session.mute?.(false);
        }
      } catch {
        // ignore mute/interrupt errors
      }
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      void stopSession(false);
    };
  }, [stopSession]);

  return {
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
  };
}
