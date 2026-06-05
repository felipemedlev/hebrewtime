import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from "@/lib/supabase";
import { useUser } from "./useUser";

export type FinishedEpisodeRef = {
  level: string;
  episode: number;
};

function toKey(level: string, episode: number): string {
  return `${level}:${episode}`;
}

function parseStoredFinished(raw: unknown): Set<string> {
  const keys = new Set<string>();
  if (!Array.isArray(raw)) return keys;

  for (const item of raw) {
    if (typeof item === "number") {
      keys.add(toKey("intermediate", item));
      continue;
    }
    if (item && typeof item === "object") {
      const obj = item as { level?: string; episode?: number; episode_number?: number };
      const level = obj.level ?? "intermediate";
      const episode = obj.episode ?? obj.episode_number;
      if (typeof episode === "number") {
        keys.add(toKey(level, episode));
      }
    }
  }
  return keys;
}

export function useFinishedEpisodes() {
  const [finishedEpisodes, setFinishedEpisodes] = useState<Set<string>>(new Set());
  const { user } = useUser();
  const hasUploadedLocal = useRef(false);

  useEffect(() => {
    const stored = window.localStorage.getItem('finished-episodes');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setFinishedEpisodes(parseStoredFinished(parsed));
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    if (!user) {
      hasUploadedLocal.current = false;
      return;
    }

    supabase
      .from('finished_episodes')
      .select('level_slug, episode_number')
      .then(({ data, error }) => {
        if (!error && data) {
          setFinishedEpisodes(prev => {
            const next = new Set(prev);
            const dbKeys = new Set(
              data.map(row => toKey(row.level_slug ?? 'intermediate', row.episode_number))
            );

            if (!hasUploadedLocal.current) {
              hasUploadedLocal.current = true;
              const missingInDb = Array.from(next).filter(key => !dbKeys.has(key));
              if (missingInDb.length > 0) {
                const inserts = missingInDb.map(key => {
                  const [level, epStr] = key.split(':');
                  return {
                    user_id: user.id,
                    level_slug: level,
                    episode_number: parseInt(epStr, 10),
                  };
                });
                supabase.from('finished_episodes').insert(inserts).then();
              }
            }

            data.forEach(row => {
              next.add(toKey(row.level_slug ?? 'intermediate', row.episode_number));
            });
            window.localStorage.setItem(
              'finished-episodes',
              JSON.stringify(
                Array.from(next).map(key => {
                  const [level, epStr] = key.split(':');
                  return { level, episode: parseInt(epStr, 10) };
                })
              )
            );
            return next;
          });
        }
      });
  }, [user]);

  const isFinished = useCallback(
    (level: string, epNum: number) => finishedEpisodes.has(toKey(level, epNum)),
    [finishedEpisodes]
  );

  const toggleFinished = useCallback(async (level: string, epNum: number) => {
    const key = toKey(level, epNum);
    setFinishedEpisodes((prev) => {
      const next = new Set(prev);
      const wasFinished = next.has(key);

      if (wasFinished) {
        next.delete(key);
      } else {
        next.add(key);
      }

      window.localStorage.setItem(
        'finished-episodes',
        JSON.stringify(
          Array.from(next).map(k => {
            const [lvl, epStr] = k.split(':');
            return { level: lvl, episode: parseInt(epStr, 10) };
          })
        )
      );

      if (user) {
        if (wasFinished) {
          supabase
            .from('finished_episodes')
            .delete()
            .eq('user_id', user.id)
            .eq('level_slug', level)
            .eq('episode_number', epNum)
            .then();
        } else {
          supabase
            .from('finished_episodes')
            .insert({ user_id: user.id, level_slug: level, episode_number: epNum })
            .then();
        }
      }

      return next;
    });
  }, [user]);

  return { finishedEpisodes, isFinished, toggleFinished };
}
