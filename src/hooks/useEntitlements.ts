"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
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
  // Tracks the most recent token we attempted to resolve, so stale async
  // resolutions can't clobber a newer auth state.
  const currentTokenRef = useRef<string | null>(null);

  // Resolve entitlements for a specific access token. Pulling the token from
  // the caller (instead of calling supabase.auth.getSession here) is critical:
  // calling getSession inside an onAuthStateChange callback deadlocks in
  // supabase-js v2 because the callback runs while holding an internal lock.
  const resolveForToken = useCallback(async (token: string | undefined) => {
    const normalizedToken = token ?? null;
    const tokenChanged = currentTokenRef.current !== normalizedToken;
    currentTokenRef.current = normalizedToken;
    if (tokenChanged) {
      // Do not expose the previous account's premium/admin state while the new
      // token is being resolved.
      setEntitlements(defaultEntitlements);
      setIsLoading(true);
    }

    try {
      const next = await getUserEntitlements(token);

      // Ignore if a newer auth state arrived while we were resolving.
      if (currentTokenRef.current !== normalizedToken) return;

      setEntitlements((prev) => {
        // If we have a token but resolution came back unauthenticated, treat it
        // as a transient failure and keep the last-known-good state rather than
        // silently demoting a premium/admin user to free.
        if (token && !next.isAuthenticated && prev.isAuthenticated) {
          return prev;
        }
        return next;
      });
    } catch {
      if (currentTokenRef.current !== normalizedToken) return;
      // Network/transient error: never downgrade a known-good session.
      setEntitlements((prev) => (token && prev.isAuthenticated ? prev : defaultEntitlements));
    } finally {
      if (currentTokenRef.current === normalizedToken) {
        setIsLoading(false);
      }
    }
  }, []);

  // Public refresh that safely reads the current session (only call this
  // OUTSIDE of an onAuthStateChange callback).
  const refresh = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      await resolveForToken(data.session?.access_token);
    } catch {
      // A refresh failure must not clobber a newer auth event or a known-good
      // entitlement result.
      if (currentTokenRef.current === null) {
        setEntitlements(defaultEntitlements);
        setIsLoading(false);
      }
    }
  }, [resolveForToken]);

  useEffect(() => {
    // Initial load (outside any auth callback, so getSession is safe here).
    void refresh();

    const handleSession = (session: Session | null) => {
      // Defer to the next tick so this runs outside the auth lock held during
      // the onAuthStateChange callback in supabase-js v2.
      setTimeout(() => {
        void resolveForToken(session?.access_token);
      }, 0);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    // Self-heal a stuck state when the user returns to the tab.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [refresh, resolveForToken]);

  return { entitlements, isLoading, refresh };
}
