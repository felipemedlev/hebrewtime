"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";

export function useOnboarding() {
  const { user, isLoading } = useUser();
  const [dismissed, setDismissed] = useState(false);
  const [reopened, setReopened] = useState(false);
  const previousUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const nextUserId = user?.id ?? null;
    if (previousUserIdRef.current === undefined) {
      previousUserIdRef.current = nextUserId;
      return;
    }
    if (previousUserIdRef.current === nextUserId) return;
    previousUserIdRef.current = nextUserId;
    // Onboarding completion is account-scoped; do not carry a prior account's
    // in-memory dismissal into this account.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(false);
    setReopened(false);
  }, [user?.id]);

  const isOnboarded = user?.user_metadata?.onboarded === true;
  let guestDismissed = false;
  if (typeof window !== "undefined") {
    try {
      guestDismissed = window.localStorage.getItem("hebrewtime-onboarding-v1") === "1";
    } catch {
      guestDismissed = false;
    }
  }
  const shouldShow = !isLoading && (reopened || (!isOnboarded && !dismissed && (!user ? !guestDismissed : true)));

  const dismiss = useCallback(async () => {
    setDismissed(true);
    setReopened(false);
    if (user) {
      try {
        await supabase.auth.updateUser({ data: { onboarded: true } });
      } catch (error) {
        console.error("Failed to save onboarding preference:", error);
      }
    } else {
      try {
        window.localStorage.setItem("hebrewtime-onboarding-v1", "1");
      } catch {
        // Guests can continue even when browser storage is blocked.
      }
    }
  }, [user]);

  const reopen = useCallback(() => {
    setDismissed(false);
    setReopened(true);
  }, []);

  return { shouldShow, dismiss, reopen };
}
