"use client";

import { useState, useEffect, useCallback } from "react";
import type { VocabWord } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useUser } from "./useUser";

export function useVocabulary() {
  const [vocabWords, setVocabWords] = useState<VocabWord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { user } = useUser();

  // Load from Supabase on mount or when user changes
  useEffect(() => {
    if (!user) {
      setVocabWords([]);
      setIsLoaded(true);
      return;
    }

    setIsLoaded(false);
    supabase
      .from("vocabulary")
      .select("*")
      .order("saved_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setVocabWords(
            data.map((d) => ({
              id: d.id,
              word: d.word,
              wordWithNekudot: d.word_with_nekudot,
              verbFormWithNekudot: d.verb_form_with_nekudot,
              translation: d.translation,
              episodeTitle: d.episode_title,
              episodeUrl: d.episode_url,
              savedAt: d.saved_at,
            }))
          );
        }
        setIsLoaded(true);
      });
  }, [user]);

  const addWord = useCallback(
    async (word: Omit<VocabWord, "id" | "savedAt">): Promise<{ added: boolean; message: string; type?: "auth_required" | "duplicate" | "success" | "error" }> => {
      if (!user) {
        return { added: false, message: "Please log in to save vocabulary.", type: "auth_required" };
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
          episode_title: word.episodeTitle,
          episode_url: word.episodeUrl,
          saved_at: newWord.savedAt,
        })
        .select()
        .single();

      if (error) {
        setVocabWords((prev) => prev.filter((v) => v.id !== tempId));
        return { added: false, message: "Error saving word: " + error.message, type: "error" };
      }

      // Replace temp id with real id
      if (data) {
        setVocabWords((prev) =>
          prev.map((v) => (v.id === tempId ? { ...v, id: data.id } : v))
        );
      }

      return { added: true, message: `Saved "${word.word}" to vocabulary!`, type: "success" };
    },
    [vocabWords, user]
  );

  const deleteWord = useCallback(
    async (id: string) => {
      if (!user) return;
      
      // Optimistic delete
      setVocabWords((prev) => prev.filter((v) => v.id !== id));
      
      const { error } = await supabase
        .from("vocabulary")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed to delete word:", error);
      }
    },
    [user]
  );

  const updateWord = useCallback(
    async (id: string, updates: Partial<VocabWord>) => {
      if (!user) return { updated: false, message: "Please log in to edit vocabulary.", type: "auth_required" };

      // Optimistic update
      setVocabWords((prev) =>
        prev.map((v) => (v.id === id ? { ...v, ...updates } : v))
      );

      const dbUpdates: any = {};
      if (updates.word !== undefined) dbUpdates.word = updates.word;
      if (updates.wordWithNekudot !== undefined) dbUpdates.word_with_nekudot = updates.wordWithNekudot || null;
      if (updates.verbFormWithNekudot !== undefined) dbUpdates.verb_form_with_nekudot = updates.verbFormWithNekudot || null;
      if (updates.translation !== undefined) dbUpdates.translation = updates.translation;
      if (updates.episodeTitle !== undefined) dbUpdates.episode_title = updates.episodeTitle;
      if (updates.episodeUrl !== undefined) dbUpdates.episode_url = updates.episodeUrl;

      const { error } = await supabase
        .from("vocabulary")
        .update(dbUpdates)
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed to update word:", error);
        return { updated: false, message: "Failed to update word.", type: "error" };
      }
      return { updated: true, message: "Word updated successfully.", type: "success" };
    },
    [user]
  );

  return { vocabWords, isLoaded, addWord, deleteWord, updateWord };
}
