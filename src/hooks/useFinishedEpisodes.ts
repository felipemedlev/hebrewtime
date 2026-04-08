import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from "@/lib/supabase";
import { useUser } from "./useUser";

export function useFinishedEpisodes() {
  const [finishedEpisodes, setFinishedEpisodes] = useState<Set<number>>(new Set());
  const { user } = useUser();
  const hasUploadedLocal = useRef(false);

  // Initial load from local storage
  useEffect(() => {
    const stored = window.localStorage.getItem('finished-episodes');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setFinishedEpisodes(new Set(parsed));
        }
      } catch {
        // ignore
      }
    }
  }, []);

  // Sync with Supabase on auth state change
  useEffect(() => {
    if (!user) {
      hasUploadedLocal.current = false;
      return;
    }

    supabase
      .from('finished_episodes')
      .select('episode_number')
      .then(({ data, error }) => {
        if (!error && data) {
          setFinishedEpisodes(prev => {
            const next = new Set(prev);
            const dbEpisodes = new Set(data.map(row => row.episode_number));
            
            // Upload local episodes that are not in the DB yet
            if (!hasUploadedLocal.current) {
              hasUploadedLocal.current = true;
              const missingInDb = Array.from(next).filter(ep => !dbEpisodes.has(ep));
              if (missingInDb.length > 0) {
                const inserts = missingInDb.map(ep => ({ user_id: user.id, episode_number: ep }));
                supabase.from('finished_episodes').insert(inserts).then();
              }
            }

            // Merge DB episodes into local state
            data.forEach(row => next.add(row.episode_number));
            window.localStorage.setItem('finished-episodes', JSON.stringify(Array.from(next)));
            return next;
          });
        }
      });
  }, [user]);

  const toggleFinished = useCallback(async (epNum: number) => {
    setFinishedEpisodes((prev) => {
      const next = new Set(prev);
      const isFinished = next.has(epNum);
      
      if (isFinished) {
        next.delete(epNum);
      } else {
        next.add(epNum);
      }
      window.localStorage.setItem('finished-episodes', JSON.stringify(Array.from(next)));
      
      if (user) {
        if (isFinished) {
          supabase.from('finished_episodes').delete().eq('user_id', user.id).eq('episode_number', epNum).then();
        } else {
          supabase.from('finished_episodes').insert({ user_id: user.id, episode_number: epNum }).then();
        }
      }

      return next;
    });
  }, [user]);

  return { finishedEpisodes, toggleFinished };
}
