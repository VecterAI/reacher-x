"use client";

import { useMemo, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "./useAuth";
import {
  getKeywords as getLocalUnifiedKeywords,
  type UnifiedKeyword,
} from "../lib/utils/unifiedKeywordStore";

/**
 * Unified source of keyword data with stable loading semantics.
 * - Authenticated: reads only from Convex (no localStorage reads to avoid flicker)
 * - Unauthenticated: reads only from localStorage and listens for intra-tab changes
 *
 * All data transformation is computed during render per React guidance.
 * Reference: https://react.dev/learn/you-might-not-need-an-effect
 */
export function useUnifiedKeywords() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { workspace } = useAuth();

  // Convex query only when authenticated and workspace exists
  const convexKeywords = useQuery(
    api.keywords.getUserKeywords,
    isAuthenticated && workspace
      ? { workspaceId: workspace._id, sortBy: "lastUsedAt", limit: 200 }
      : "skip"
  );

  // Local change version to re-evaluate localStorage-derived state
  const [storageVersion, setStorageVersion] = useState(0);

  // Listen for intra-tab localStorage change custom event only when unauthenticated
  useEffect(() => {
    if (isAuthenticated) return;
    const handleStorageChange = () => setStorageVersion((v) => v + 1);
    window.addEventListener("onLocalStorageChange", handleStorageChange);
    return () => {
      window.removeEventListener("onLocalStorageChange", handleStorageChange);
    };
  }, [isAuthenticated]);

  // Derive keywords based on auth state
  const keywords: UnifiedKeyword[] = useMemo(() => {
    // During auth loading, avoid reading localStorage to prevent flicker
    if (authLoading) {
      return [];
    }

    if (isAuthenticated) {
      if (!convexKeywords) return [];
      return convexKeywords.map(
        (kw) =>
          ({
            id: kw._id,
            keyword: kw.keyword,
            exactMatch: kw.exactMatch,
            createdAt: kw._creationTime,
            lastUsedAt: kw.lastUsedAt,
            searchCount: kw.searchCount,
            isPinned: kw.isPinned,
            pinnedAt: kw.pinnedAt,
            source: kw.source,
            status: kw.status,
            votes: kw.votes,
            decayedScore: kw.decayedScore,
            metadata: kw.metadata,
          }) as UnifiedKeyword
      );
    }
    // Unauthenticated -> local only
    return getLocalUnifiedKeywords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, convexKeywords, storageVersion]);

  const isLoaded = useMemo(() => {
    if (authLoading) return false;
    // Keep showing a stable loader until workspace and first query resolve to avoid flicker
    if (isAuthenticated && !workspace) return false;
    return isAuthenticated ? convexKeywords !== undefined : true;
  }, [authLoading, isAuthenticated, convexKeywords, workspace]);

  const dataSource: "convex" | "localStorage" = isAuthenticated
    ? "convex"
    : "localStorage";

  return { keywords, isLoaded, dataSource };
}
