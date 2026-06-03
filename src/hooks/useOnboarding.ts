"use client";

import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";

export function useOnboarding() {
  const { user, isLoading } = useUser();
  const [dismissed, setDismissed] = useState(false);

  const isOnboarded = user?.user_metadata?.onboarded === true;
  const shouldShow = !isLoading && !!user && !isOnboarded && !dismissed;

  const dismiss = useCallback(async () => {
    setDismissed(true);
    await supabase.auth.updateUser({ data: { onboarded: true } });
  }, []);

  return { shouldShow, dismiss };
}
