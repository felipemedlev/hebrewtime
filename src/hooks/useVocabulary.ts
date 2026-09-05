"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { VocabWord } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useUser } from "./useUser";

export function useVocabulary(isPremium = false) {
  const [vocabWords, setVocabWords] = useState<VocabWord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { user } = useUser();
  const loadIdRef = useRef(0);

  // Load from Supabase on mount or when user changes
  useEffect(() => {
    const loadId = ++loadIdRef.current;
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVocabWords([]);
      setIsLoaded(true);
      return;
    }

    // Clear the previous account before loading this account's vocabulary.
    setVocabWords([]);
    setIsLoaded(false);
    supabase
      .from("vocabulary")
      .select("*")
      .eq("user_id", user.id)
      .order("saved_at", { ascending: false })
      .then(({ data, error }) => {
        if (loadId !== loadIdRef.current) return;
        if (!error && data) {
          setVocabWords(
            data.map((d) => ({
              id: d.id,
              word: d.word,
              wordWithNekudot: d.word_with_nekudot,
              verbFormWithNekudot: d.verb_form_with_nekudot,
              translation: d.translation,
              pronunciation: d.pronunciation,
              dictionaryPealimId: d.dictionary_pealim_id ?? null,
              entryKind: (d.entry_kind as VocabWord["entryKind"]) ?? "word",
              episodeTitle: d.episode_title,
              episodeUrl: d.episode_url,
              savedAt: d.saved_at,
              examplePhrases: d.example_phrases || [],
            }))
          );
        }
        setIsLoaded(true);
      }, (error: unknown) => {
        if (loadId !== loadIdRef.current) return;
        console.error("Unexpected error loading vocabulary:", error);
        setVocabWords([]);
        setIsLoaded(true);
      });
  }, [user]);

  const addWord = useCallback(
    async (word: Omit<VocabWord, "id" | "savedAt">): Promise<{ added: boolean; message: string; type?: "auth_required" | "duplicate" | "success" | "error" | "limit_reached" }> => {
      if (!user) {
        return { added: false, message: "Please log in to save vocabulary.", type: "auth_required" };
      }

      if (!isPremium && vocabWords.length >= 100) {
        return {
          added: false,
          message: "You've learned your first 100 words. Upgrade to continue building your Hebrew vocabulary.",
          type: "limit_reached",
        };
      }

      // Check for exact duplicate locally. We allow the same word if the translation or the Nekudot are different.
      const isDuplicate = vocabWords.some((v) => {
        const sameWord = v.word === word.word;
        const sameTranslation = v.translation.trim().toLowerCase() === word.translation.trim().toLowerCase();
        // If they have different Nekudot, it means it's a different pronunciation/context, so not a duplicate.
        const sameNekudot = (v.wordWithNekudot || "") === (word.wordWithNekudot || "");
        return sameWord && sameTranslation && sameNekudot;
      });

      if (isDuplicate) {
        return { added: false, message: "This exact meaning is already saved!", type: "duplicate" };
      }

      const tempId = Date.now().toString() + Math.random().toString();
      const mutationLoadId = loadIdRef.current;
      const newWord: VocabWord = {
        ...word,
        id: tempId, // We use this until real id returns, but actually UUID is generated on server.
                    // For optimistic UI, it's fine.
        savedAt: Date.now(),
      };

      setVocabWords((prev) => [newWord, ...prev]);

      const { data, error } = await supabase
        .from("vocabulary")
        .insert({
          user_id: user.id,
          word: word.word,
          word_with_nekudot: word.wordWithNekudot || null,
          verb_form_with_nekudot: word.verbFormWithNekudot || null,
          translation: word.translation,
          pronunciation: word.pronunciation || null,
          dictionary_pealim_id: word.dictionaryPealimId ?? null,
          entry_kind: word.entryKind ?? "word",
          episode_title: word.episodeTitle,
          episode_url: word.episodeUrl,
          saved_at: newWord.savedAt,
          example_phrases: word.examplePhrases || [],
        })
        .select()
        .single();

      if (mutationLoadId !== loadIdRef.current) {
        return { added: false, message: "Session changed while saving vocabulary.", type: "error" };
      }

      if (error) {
        console.error("Failed to save word:", error);
        setVocabWords((prev) => prev.filter((v) => v.id !== tempId));
        return { added: false, message: "Could not save this word. Please try again.", type: "error" };
      }

      // Replace temp id with real id
      if (data) {
        setVocabWords((prev) =>
          prev.map((v) => (v.id === tempId ? { ...v, id: data.id } : v))
        );
      }

      return { added: true, message: `Saved "${word.word}" to vocabulary!`, type: "success" };
    },
    [vocabWords, user, isPremium]
  );

  const deleteWord = useCallback(
    async (id: string) => {
      if (!user) return;
      const mutationLoadId = loadIdRef.current;
      const previous = vocabWords.find((word) => word.id === id);
      
      // Optimistic delete
      setVocabWords((prev) => prev.filter((v) => v.id !== id));
      
      const { error } = await supabase
        .from("vocabulary")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed to delete word:", error);
        if (mutationLoadId === loadIdRef.current && previous) {
          setVocabWords((prev) => (prev.some((word) => word.id === id) ? prev : [...prev, previous]));
        }
      }
    },
    [user, vocabWords]
  );

  const updateWord = useCallback(
    async (id: string, updates: Partial<VocabWord>) => {
      if (!user) return { updated: false, message: "Please log in to edit vocabulary.", type: "auth_required" };

      // Snapshot previous value for rollback
      const previous = vocabWords.find((v) => v.id === id);
      const mutationLoadId = loadIdRef.current;

      // Optimistic update
      setVocabWords((prev) =>
        prev.map((v) => (v.id === id ? { ...v, ...updates } : v))
      );

      const dbUpdates: Record<string, unknown> = {};
      if (updates.word !== undefined) dbUpdates.word = updates.word;
      if (updates.wordWithNekudot !== undefined) dbUpdates.word_with_nekudot = updates.wordWithNekudot || null;
      if (updates.verbFormWithNekudot !== undefined) dbUpdates.verb_form_with_nekudot = updates.verbFormWithNekudot || null;
      if (updates.translation !== undefined) dbUpdates.translation = updates.translation;
      if (updates.pronunciation !== undefined) dbUpdates.pronunciation = updates.pronunciation || null;
      if (updates.dictionaryPealimId !== undefined) dbUpdates.dictionary_pealim_id = updates.dictionaryPealimId;
      if (updates.entryKind !== undefined) dbUpdates.entry_kind = updates.entryKind;
      if (updates.episodeTitle !== undefined) dbUpdates.episode_title = updates.episodeTitle;
      if (updates.episodeUrl !== undefined) dbUpdates.episode_url = updates.episodeUrl;
      if (updates.examplePhrases !== undefined) dbUpdates.example_phrases = updates.examplePhrases;

      const { data, error } = await supabase
        .from("vocabulary")
        .update(dbUpdates)
        .eq("id", id)
        .eq("user_id", user.id)
        .select();

      if (mutationLoadId !== loadIdRef.current) {
        return { updated: false, message: "Session changed while updating vocabulary.", type: "error" };
      }

      if (error || !data || data.length === 0) {
        console.error("Failed to update word:", error ?? "No rows matched — check RLS UPDATE policy");
        // Rollback optimistic update
        if (previous) {
          setVocabWords((prev) =>
            prev.map((v) => (v.id === id ? previous : v))
          );
        }
        return { updated: false, message: "Could not update this word. Please try again.", type: "error" };
      }
      return { updated: true, message: "Word updated!", type: "success" };
    },
    [user, vocabWords]
  );

  return { vocabWords, isLoaded, addWord, deleteWord, updateWord };
}
