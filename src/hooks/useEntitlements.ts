"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getUserEntitlements } from "@/app/actions";

type Entitlements = {
  isAuthenticated: boolean;
  isPremium: boolean;
  isAdmin: boolean;
  email: string | null;
};

const defaultEntitlements: Entitlements = {
  isAuthenticated: false,
  isPremium: false,
  isAdmin: false,
  email: null,
};

export function useEntitlements() {
  const [entitlements, setEntitlements] = useState<Entitlements>(defaultEntitlements);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const next = await getUserEntitlements(token);
    setEntitlements(next);
    setIsLoading(false);
    return next;
  }, []);

  useEffect(() => {
    let isActive = true;
    const load = () =>
      supabase.auth
      .getSession()
      .then(async ({ data }) => {
        const token = data.session?.access_token;
        const next = await getUserEntitlements(token);
        if (!isActive) return;
        setEntitlements(next);
        setIsLoading(false);
      })
      .catch(() => {
        if (!isActive) return;
        setEntitlements(defaultEntitlements);
        setIsLoading(false);
      });
    load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [refresh]);

  return { entitlements, isLoading, refresh };
}
