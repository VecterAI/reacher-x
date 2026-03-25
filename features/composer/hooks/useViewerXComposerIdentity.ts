"use client";

import { useAction } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useAuth as useWorkosAuth } from "@workos-inc/authkit-nextjs/components";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import {
  buildComposerIdentityUser,
  parseXConnectionIdentitySnapshot,
  type XConnectionIdentitySnapshot,
} from "../lib/viewerComposerIdentity";

export interface UseViewerXComposerIdentityOptions {
  /** When false, skips loading X status (e.g. Convex user not ready). */
  enabled?: boolean;
}

/**
 * Loads `getTwitterConnectionStatus` and builds the composer header user:
 * X profile first, WorkOS fallback (same merge rule as reply/post pages).
 */
export function useViewerXComposerIdentity(
  options: UseViewerXComposerIdentityOptions = {}
) {
  const { enabled = true } = options;
  const { isAuthenticated, isLoading: convexAuthLoading } = useConvexAuth();
  const { user } = useWorkosAuth();
  const getStatus = useAction(api.x.getTwitterConnectionStatus);
  const getStatusRef = useRef(getStatus);
  useEffect(() => {
    getStatusRef.current = getStatus;
  }, [getStatus]);

  const [connectionStatus, setConnectionStatus] =
    useState<XConnectionIdentitySnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shouldFetch = enabled && isAuthenticated && !convexAuthLoading;

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const raw = await getStatusRef.current({});
      const status = parseXConnectionIdentitySnapshot(raw);
      if (status === null) {
        setConnectionStatus(null);
        setError("Unable to load X status.");
        return;
      }
      setConnectionStatus(status);
      setError(null);
    } catch (e) {
      setConnectionStatus(null);
      setError(e instanceof Error ? e.message : "Unable to load X status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!shouldFetch) {
      setConnectionStatus(null);
      setError(null);
      setLoading(false);
      return;
    }
    void refetch();
  }, [refetch, shouldFetch]);

  const currentUser = useMemo(
    () => buildComposerIdentityUser(connectionStatus, user),
    [connectionStatus, user]
  );

  return { connectionStatus, loading, error, currentUser, refetch };
}
