"use client";

import { ReactNode, useCallback, useEffect, useRef } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithAuth } from "convex/react";
import {
  AuthKitProvider,
  useAuth as useWorkosAuth,
  useAccessToken,
} from "@workos-inc/authkit-nextjs/components";
import { clearAllLocalAppData } from "@/shared/lib/utils/localStorage";
import { logger } from "@/shared/lib/logger";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!, {
  verbose: process.env.NODE_ENV !== "production",
});

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <AuthKitProvider>
      <ConvexProviderWithAuth client={convex} useAuth={useAuthFromWorkos}>
        {children}
      </ConvexProviderWithAuth>
    </AuthKitProvider>
  );
}

function useAuthFromWorkos() {
  const { user, loading: isLoading } = useWorkosAuth();
  const {
    loading: tokenLoading,
    error: tokenError,
    getAccessToken,
  } = useAccessToken();

  const loading = (isLoading ?? false) || (tokenLoading ?? false);
  // Consider the session authenticated based on stable user presence; token may
  // be rotating in the background. Convex will call fetchAccessToken for a fresh
  // token when (re)connecting.
  logger.warn("useAuthFromWorkos", user, tokenError);
  const authenticated = !!user && !tokenError;

  const wasAuthenticated = useRef<boolean>(false);

  const fetchAccessToken = useCallback(async () => {
    try {
      const token = await getAccessToken();
      // console.warn("fetchAccessToken", token);
      return token ?? null;
    } catch {
      // console.warn("fetchAccessToken", tokenError);
      return null;
    }
  }, [getAccessToken]);

  // Clear local storage only when the user actually signs out (user becomes null),
  // not during transient token refresh states.
  useEffect(() => {
    if (wasAuthenticated.current && !user) {
      try {
        clearAllLocalAppData();
      } catch {}
    }
    wasAuthenticated.current = !!user;
  }, [user]);

  // console.warn("useAuthFromWorkos", loading, authenticated);
  return {
    isLoading: loading,
    isAuthenticated: authenticated,
    fetchAccessToken,
  };
}

export { convex };
