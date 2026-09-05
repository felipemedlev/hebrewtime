"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useUser } from "./useUser";
import { LEGACY_PROGRESS_KEY, readLegacyProgress } from "@/lib/progress";

export type FinishedEpisodeRef = { level: string; episode: number };
export type ProgressError = "sync" | "save";
const GUEST_FINISHED_KEY = "hebrewtime-finished-episodes:guest";
const LEVEL_SLUG_REGEX = /^[a-z0-9-]{1,64}$/;

function toKey(level: string, episode: number): string { return `${level}:${episode}`; }
function storageKey(userId?: string): string {
  return userId ? `hebrewtime-finished-episodes:${userId}` : GUEST_FINISHED_KEY;
}
function parseStoredFinished(raw: unknown): Set<string> {
  const keys = new Set<string>();
  if (!Array.isArray(raw)) return keys;
  for (const item of raw) {
    if (typeof item === "number" && Number.isSafeInteger(item) && item > 0) {
      keys.add(toKey("intermediate", item));
      continue;
    }
    if (item && typeof item === "object") {
      const obj = item as { level?: unknown; episode?: unknown; episode_number?: unknown };
      const level = obj.level === undefined
        ? "intermediate"
        : typeof obj.level === "string" && LEVEL_SLUG_REGEX.test(obj.level)
          ? obj.level
          : null;
      const episode = obj.episode ?? obj.episode_number;
      if (level && typeof episode === "number" && Number.isSafeInteger(episode) && episode > 0) {
        keys.add(toKey(level, episode));
      }
    }
  }
  return keys;
}
function readStoredFinished(key: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? parseStoredFinished(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}
function writeStoredFinished(key: string, values: Set<string>): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(values).map((value) => {
      const [level, episode] = value.split(":");
      return { level, episode: Number(episode) };
    })));
    return true;
  } catch {
    return false;
  }
}

export function useFinishedEpisodes() {
  const { user } = useUser();
  const userId = user?.id;
  const [finishedEpisodes, setFinishedEpisodes] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);
  const [saveError, setSaveError] = useState<ProgressError | null>(null);
  const [legacyProgressAvailable, setLegacyProgressAvailable] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    const key = storageKey(userId);
    const legacy = readLegacyProgress();
    queueMicrotask(() => {
      if (id !== requestId.current) return;
      setLegacyProgressAvailable(Boolean(userId && parseStoredFinished(legacy).size > 0));
      // Clear the previous account's state before loading the new account.
      setFinishedEpisodes(readStoredFinished(key));
      setSaveError(null);
      setSavingKey(null);
      setIsLoaded(!userId);
    });

    if (!userId) {
      if (legacy.length > 0 && readStoredFinished(key).size === 0) {
        const migrated = parseStoredFinished(legacy);
        writeStoredFinished(key, migrated);
        queueMicrotask(() => {
          if (id === requestId.current) setFinishedEpisodes(migrated);
        });
      }
      return;
    }

    void supabase.from("finished_episodes").select("level_slug, episode_number").eq("user_id", userId)
      .then(({ data, error }) => {
        if (id !== requestId.current) return;
        if (error) {
          setSaveError("sync");
          setIsLoaded(true);
          return;
        }
        const values = new Set((data ?? []).map((row) => toKey(row.level_slug ?? "intermediate", row.episode_number)));
        writeStoredFinished(key, values);
        setFinishedEpisodes(values);
        setIsLoaded(true);
      }, (error: unknown) => {
        if (id !== requestId.current) return;
        console.error("Unexpected error loading finished episodes:", error);
        setSaveError("sync");
        setIsLoaded(true);
      });
  }, [userId]);

  const isFinished = useCallback((level: string, epNum: number) => finishedEpisodes.has(toKey(level, epNum)), [finishedEpisodes]);

  const toggleFinished = useCallback(async (level: string, epNum: number): Promise<boolean> => {
    const key = toKey(level, epNum);
    if (savingKey === key) return false;
    const mutationId = requestId.current;
    const storage = storageKey(user?.id);
    const previous = finishedEpisodes;
    const next = new Set(previous);
    const wasFinished = next.has(key);
    if (wasFinished) next.delete(key); else next.add(key);
    setFinishedEpisodes(next);
    if (!writeStoredFinished(storage, next)) {
      setFinishedEpisodes(previous);
      setSaveError("save");
      return false;
    }
    setSaveError(null);
    if (!user) return true;

    setSavingKey(key);
    try {
      const result = wasFinished
        ? await supabase.from("finished_episodes").delete().eq("user_id", user.id).eq("level_slug", level).eq("episode_number", epNum)
        : await supabase.from("finished_episodes").upsert(
            { user_id: user.id, level_slug: level, episode_number: epNum },
            { onConflict: "user_id,level_slug,episode_number" }
          );
      if (mutationId !== requestId.current) return false;
      if (result.error) {
        setFinishedEpisodes(previous);
        writeStoredFinished(storage, previous);
        setSaveError("save");
        return false;
      }
      return true;
    } catch {
      if (mutationId !== requestId.current) return false;
      setFinishedEpisodes(previous);
      writeStoredFinished(storage, previous);
      setSaveError("save");
      return false;
    } finally {
      if (mutationId === requestId.current) setSavingKey(null);
    }
  }, [finishedEpisodes, savingKey, user]);

  const importLegacyProgress = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    const mutationId = requestId.current;
    const legacy = parseStoredFinished(readLegacyProgress());
    if (legacy.size === 0) {
      setLegacyProgressAvailable(false);
      return true;
    }
    const rows = Array.from(legacy).map((value) => {
      const [level, episode] = value.split(":");
      return { user_id: user.id, level_slug: level, episode_number: Number(episode) };
    });
    try {
      const { error } = await supabase
        .from("finished_episodes")
        .upsert(rows, { onConflict: "user_id,level_slug,episode_number" });
      if (error || mutationId !== requestId.current) return false;
    } catch {
      return false;
    }
    const key = storageKey(user.id);
    const current = readStoredFinished(key);
    const merged = new Set([...current, ...legacy]);
    writeStoredFinished(key, merged);
    setFinishedEpisodes(merged);
    try { window.localStorage.removeItem(LEGACY_PROGRESS_KEY); } catch { /* keep legacy copy for a later retry */ }
    setLegacyProgressAvailable(false);
    return true;
  }, [user]);

  return {
    finishedEpisodes,
    isFinished,
    toggleFinished,
    importLegacyProgress,
    legacyProgressAvailable,
    isLoaded,
    saveError,
    savingKey,
  };
}
