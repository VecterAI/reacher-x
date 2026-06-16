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
  const { refresh, getAccessToken } = useAccessToken();

  // Keep Convex's auth provider state tied to the stable WorkOS session only.
  // Token fetch/refresh loading is handled inside fetchAccessToken; exposing it
  // here makes Convex reset auth on every token refresh, which causes UI flicker.
  const loading = isLoading ?? false;
  const authenticated = !!user;

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      try {
        const token = forceRefreshToken
          ? await refresh()
          : await getAccessToken();
        return token ?? null;
      } catch {
        return null;
      }
    },
    [getAccessToken, refresh]
  );

  return {
    isLoading: loading,
    isAuthenticated: authenticated,
    fetchAccessToken,
  };
}

export { convex };
