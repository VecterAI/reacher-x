"use client";

import { ReactNode, useCallback } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithAuth } from "convex/react";
import {
  AuthKitProvider,
  useAuth as useWorkosAuth,
  useAccessToken,
} from "@workos-inc/authkit-nextjs/components";

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
  const authenticated = !!user && !tokenError;

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

  // console.warn("useAuthFromWorkos", loading, authenticated);
  return {
    isLoading: loading,
    isAuthenticated: authenticated,
    fetchAccessToken,
  };
}

export { convex };
