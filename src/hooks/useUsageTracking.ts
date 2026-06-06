"use client";

import { useEffect, useRef } from "react";
import { recordUserActivity } from "@/app/actions";
import { supabase } from "@/lib/supabase";
import { useUser } from "./useUser";

const FLUSH_INTERVAL_MS = 30_000;
const IDLE_TIMEOUT_MS = 60_000;
const MIN_FLUSH_SECONDS = 5;

export function useUsageTracking() {
  const { user } = useUser();
  const pendingSecondsRef = useRef(0);
  const lastActivityRef = useRef(0);
  const lastTickRef = useRef(0);
  const isVisibleRef = useRef(true);

  useEffect(() => {
    if (!user) {
      pendingSecondsRef.current = 0;
      return;
    }

    const now = Date.now();
    lastActivityRef.current = now;
    lastTickRef.current = now;

    const markActive = () => {
      lastActivityRef.current = Date.now();
    };

    const flush = async () => {
      const seconds = pendingSecondsRef.current;
      if (seconds < MIN_FLUSH_SECONDS) return;

      pendingSecondsRef.current = 0;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        pendingSecondsRef.current += seconds;
        return;
      }

      await recordUserActivity(token, seconds);
    };

    const tick = () => {
      const now = Date.now();
      const elapsed = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      const isIdle = now - lastActivityRef.current > IDLE_TIMEOUT_MS;
      if (!isVisibleRef.current || isIdle) return;

      pendingSecondsRef.current += elapsed;
    };

    const handleVisibility = () => {
      isVisibleRef.current = document.visibilityState === "visible";
      if (!isVisibleRef.current) {
        void flush();
      } else {
        lastTickRef.current = Date.now();
        markActive();
      }
    };

    lastTickRef.current = Date.now();
    markActive();

    const intervalId = window.setInterval(() => {
      tick();
      void flush();
    }, FLUSH_INTERVAL_MS);

    const activityEvents: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    activityEvents.forEach((event) => {
      window.addEventListener(event, markActive, { passive: true });
    });
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, markActive);
      });
      document.removeEventListener("visibilitychange", handleVisibility);
      tick();
      void flush();
    };
  }, [user]);
}
