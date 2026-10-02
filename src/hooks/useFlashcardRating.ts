"use client";

import { useEffect, useRef, useState } from "react";

type ReviewActions = {
  save: () => Promise<boolean>;
  advance: () => void;
  rollback: () => void;
  complete: () => void;
  isLastCard: boolean;
};

export function useFlashcardRating() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const submitRating = async ({ save, advance, rollback, complete, isLastCard }: ReviewActions) => {
    // Lock immediately, including repeated taps before React renders again.
    if (pendingRef.current) return;
    pendingRef.current = true;
    setIsSubmitting(true);
    setSaveError(false);
    if (!isLastCard) advance();

    let saved = false;
    try {
      saved = await save();
    } catch {
      // The same retry path handles rejected requests and reported save errors.
    }

    pendingRef.current = false;
    if (!mountedRef.current) return;
    if (!saved) {
      rollback();
      setSaveError(true);
    } else if (isLastCard) {
      complete();
    }
    setIsSubmitting(false);
  };

  return { isSubmitting, saveError, setSaveError, submitRating };
}
