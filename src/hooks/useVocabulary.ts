"use client";

import { useState, useEffect, useCallback } from "react";
import type { VocabWord } from "@/lib/types";

const STORAGE_KEY = "hebrewTimeVocab";

export function useVocabulary() {
  const [vocabWords, setVocabWords] = useState<VocabWord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setVocabWords(JSON.parse(saved));
      }
    } catch {
      // Ignore parse errors
    }
    setIsLoaded(true);
  }, []);

  const persist = useCallback((words: VocabWord[]) => {
    setVocabWords(words);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
  }, []);

  const addWord = useCallback(
    (word: Omit<VocabWord, "id" | "savedAt">): { added: boolean; message: string } => {
      // Check for exact duplicate (same word + same translation)
      if (vocabWords.some((v) => v.word === word.word && v.translation === word.translation)) {
        return { added: false, message: "This exact meaning is already saved!" };
      }

      const newWord: VocabWord = {
        ...word,
        id: Date.now().toString() + Math.random().toString(),
        savedAt: Date.now(),
      };

      persist([newWord, ...vocabWords]);
      return { added: true, message: `Saved "${word.word}" to vocabulary!` };
    },
    [vocabWords, persist]
  );

  const deleteWord = useCallback(
    (id: string) => {
      persist(vocabWords.filter((v) => v.id !== id));
    },
    [vocabWords, persist]
  );

  return { vocabWords, isLoaded, addWord, deleteWord };
}
