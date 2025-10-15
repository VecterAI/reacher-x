/**
 * Keyword Suggestions Hook
 *
 * This hook implements the proper keyword suggestion management system:
 * - Store 10 generated keywords at a time
 * - Show only 5 unused keywords to the user
 * - When a keyword is used, remove it from suggestions and show a new one
 * - When no unused keywords remain, trigger regeneration
 * - Use re-prompt service if user has voting data, otherwise use simple generation
 *
 * References:
 * - React Query patterns: https://react-query.tanstack.com/guides/dependent-queries
 * - Custom hooks best practices: "React Hooks in Action" by John Larsen
 * - Performance optimization: React's official docs on useMemo and useCallback
 */

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useWorkspaceProfile } from "@/shared/hooks/useWorkspaceProfile";
import { useAuth } from "@/shared/hooks/useAuth";
import { DESCRIPTION_CONSTRAINTS } from "@/shared/lib/utils/validation";
import {
  getKeywords,
  type UnifiedKeyword,
} from "@/shared/lib/utils/unifiedKeywordStore";
import {
  getAllUnusedSuggestions,
  markSuggestionAsUsed,
  shouldRegenerateSuggestions,
  storeNewSuggestions,
  hasUserDescriptionChanged,
  getSuggestionsStats,
} from "@/shared/lib/utils/keywordSuggestionsStore";
import type { KeywordItem } from "../ui/components/KeywordList";
import { logger } from "@/shared/lib/logger";
import { useKeywordGeneration } from "@/features/keywords/contexts/KeywordGenerationContext";

// Type definitions for API responses
interface KeywordGenerationResponse {
  keywords: Array<{
    id: string;
    keyword: string;
    timestamp: string;
    metadata: {
      generatedAt: number;
      source: string;
      usedFallback: boolean;
      exactMatch?: boolean;
      [key: string]: unknown;
    };
  }>;
  metadata: {
    requestId: string;
    generatedAt: number;
    processingTimeMs: number;
    llmProcessingTimeMs?: number;
    userDescriptionLength: number;
    modelUsed: string;
    usedFallback: boolean;
  };
}

// Hook configuration
const HOOK_CONFIG = {
  AUTO_FETCH_ON_MOUNT: true,
  USE_PERFORMANCE_FALLBACK: true,
  MAX_FALLBACK_KEYWORDS: 5,
  MIN_DESCRIPTION_LENGTH: DESCRIPTION_CONSTRAINTS.MIN_LENGTH,
  REQUEST_DEDUPE_TIME_MS: 1000, // Prevent requests within 1 second of each other
  AUTH_POOL_LIMIT: 50, // Fetch up to 50 unused suggestions from Convex
} as const;

export interface KeywordSuggestionsState {
  // Suggestions data
  suggestions: KeywordItem[];
  loading: boolean;
  error: string | null;

  // Hydration status (true while Convex/local data is hydrating)
  isHydrating?: boolean;

  // User context
  userDescription: string | null;
  hasValidDescription: boolean;

  // Performance data
  totalTrackedKeywords: number;
  highValueKeywords: number;

  // Cache status
  fromCache: boolean;
  cacheAge?: number;

  // Generation metadata
  generationMetadata: GenerationMetadata;

  // Actions
  generateKeywords: (
    descriptionOverride?: string,
    options?: { silent?: boolean }
  ) => Promise<void>;
  generateSeedKeyword: (descriptionOverride?: string) => Promise<{
    keyword: string;
    exactMatch: boolean;
  } | null>;
  recordKeywordUsage: (keywordId: string, keyword: string) => void;
  refreshSuggestions: () => Promise<void>;
  clearError: () => void;
}

export interface GenerationMetadata {
  requestId?: string;
  processingTimeMs?: number;
  llmProcessingTimeMs?: number;
  confidenceStats?: {
    min: number;
    max: number;
    avg: number;
  };
  intentDistribution?: Record<string, number>;
  modelUsed?: string;
  usedFallback?: boolean;
}

/**
 * Hook for managing keyword suggestions with proper lifecycle management
 */
export function useKeywordSuggestions(): KeywordSuggestionsState {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { description: unifiedDescription } = useWorkspaceProfile();
  const { workspace } = useAuth();
  // State management
  const [suggestions, setSuggestions] = useState<KeywordItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userDescription, setUserDescription] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [cacheAge, setCacheAge] = useState<number | undefined>();
  const [generationMetadata, setGenerationMetadata] =
    useState<GenerationMetadata>({});
  const [allKeywords, setAllKeywords] = useState<UnifiedKeyword[]>([]);

  // Request deduplication
  const lastRequestTimestamp = useRef<number>(0);
  const isInitialized = useRef<boolean>(false);
  const hasAttemptedInitialFetch = useRef<boolean>(false);
  const isLoadingRef = useRef<boolean>(false);

  // Convex actions & queries
  const generateSeedKeywordAction = useAction(
    api.keywordGeneration.generateSeedKeyword
  );
  const markSuggestionAsUsedMutation = useMutation(
    api.keywordSuggestions.markSuggestionAsUsed
  );
  const convexSuggestions = useQuery(
    api.keywordSuggestions.getSuggestions,
    isAuthenticated && workspace && userDescription
      ? {
          workspaceId: workspace._id,
          // Normalize once for server parity (trim/lower/spaces)
          userDescription: userDescription
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " "),
          limit: HOOK_CONFIG.AUTH_POOL_LIMIT,
        }
      : "skip"
  );

  // Context-based coordinated generation (cross-route dedupe)
  const { runGeneration } = useKeywordGeneration();

  // Load unified user description and validate
  useEffect(() => {
    try {
      const description = unifiedDescription || null;
      setUserDescription(description);

      logger.info("[KEYWORD_SUGGESTIONS] Loaded user description:", {
        hasDescription: !!description,
        descriptionLength: description?.length || 0,
        isValid:
          description &&
          description.length >= HOOK_CONFIG.MIN_DESCRIPTION_LENGTH,
      });
    } catch (error) {
      logger.error(
        "[KEYWORD_SUGGESTIONS] Failed to load user description:",
        error
      );
      setError("Failed to load workspace description");
    }
  }, [unifiedDescription]);

  // Load keywords from unified store and listen for changes (unauthenticated only)
  useEffect(() => {
    if (authLoading || isAuthenticated) return;

    const refreshAllKeywords = () => {
      setAllKeywords(getKeywords());
    };
    refreshAllKeywords(); // Initial load

    window.addEventListener("onLocalStorageChange", refreshAllKeywords);
    return () => {
      window.removeEventListener("onLocalStorageChange", refreshAllKeywords);
    };
  }, [authLoading, isAuthenticated]);

  // Computed values
  const hasValidDescription = useMemo(() => {
    return (
      userDescription &&
      userDescription.length >= HOOK_CONFIG.MIN_DESCRIPTION_LENGTH
    );
  }, [userDescription]);

  // Performance tracking data derived from unified store
  const performanceData = useMemo(() => {
    const highValue = allKeywords.filter((kw) => kw.status === "high_value");
    const activeKeywords = allKeywords.filter(
      (kw) => kw.status === "active" || kw.status === "high_value"
    );

    return {
      totalTrackedKeywords: allKeywords.length,
      highValueKeywords: highValue.length,
      availableForFallback: activeKeywords
        .sort((a, b) => b.decayedScore - a.decayedScore)
        .slice(0, HOOK_CONFIG.MAX_FALLBACK_KEYWORDS),
    };
  }, [allKeywords]);

  // Load suggestions either from Convex (authenticated) or from local store
  const loadSuggestionsFromStore = useCallback(() => {
    if (isAuthenticated) {
      // Wait for query to resolve
      if (convexSuggestions === undefined) return false;
      // Server now returns oldest-first unused; consume as-is
      const items: KeywordItem[] = (convexSuggestions || []).map((s) => ({
        kind: "suggestion",
        id: s._id,
        keyword: s.keyword,
        timestamp: new Date(s.generatedAt).toISOString(),
        isPinned: false,
        metadata: s.metadata,
        exactMatch: s.metadata?.exactMatch ?? false,
      }));
      setSuggestions(items);
      setFromCache(false);
      setCacheAge(
        items[0] ? new Date(items[0].timestamp || "").getTime() : undefined
      );
      return true;
    }

    // Unauthenticated: use full unused pool (no slicing)
    const allUnused = getAllUnusedSuggestions();
    const seenLocal = new Set<string>();
    const keywordItems: KeywordItem[] = allUnused
      .filter((s) => {
        const key = `${s.keyword.trim().toLowerCase()}|${s.metadata?.exactMatch ? 1 : 0}`;
        if (seenLocal.has(key)) return false;
        seenLocal.add(key);
        return true;
      })
      .map((suggestion) => ({
        kind: "suggestion",
        id: suggestion.id,
        keyword: suggestion.keyword,
        timestamp: new Date(suggestion.generatedAt).toISOString(),
        isPinned: false,
        metadata: suggestion.metadata,
        exactMatch: suggestion.metadata?.exactMatch ?? false,
      }));
    setSuggestions(keywordItems);
    setFromCache(true);
    setCacheAge(allUnused[0]?.generatedAt);
    return keywordItems.length > 0;
  }, [isAuthenticated, convexSuggestions]);

  // Derived hydration flag
  const isHydrating = useMemo(() => {
    // If we already have suggestions or an error, we are no longer hydrating
    if (suggestions.length > 0 || !!error) return false;
    // While auth status is loading, keep hydrating to render skeletons immediately
    if (authLoading) return true;

    if (isAuthenticated) {
      // While authenticated and workspace not ready, keep hydrating to avoid initial blank state
      if (!workspace) return true;
      // Keep hydrating until the first server read resolves
      if (convexSuggestions === undefined) return true;
      // If the first read resolved but returned an empty pool, keep hydrating
      // until we either generate suggestions or hit an error (initialized flips then)
      if (
        !isInitialized.current &&
        Array.isArray(convexSuggestions) &&
        (convexSuggestions?.length ?? 0) === 0
      ) {
        return true;
      }
      return false;
    }
    // Unauthenticated: If there's no valid description, don't show loaders
    if (!hasValidDescription) return false;
    // Before first attempt or before initial local read, consider hydrating
    return !isInitialized.current && !hasAttemptedInitialFetch.current;
  }, [
    authLoading,
    isAuthenticated,
    workspace,
    convexSuggestions,
    hasValidDescription,
    suggestions.length,
    error,
  ]);

  // Check if we should use re-prompt service
  // Note: Re-prompting is now handled by the separate useKeywordRePrompt hook
  // This hook only handles regular keyword generation
  const shouldUseRePrompt = useCallback(() => {
    return false; // Disable re-prompting in this hook
  }, []);

  // Generate new keywords using AI
  const generateKeywords = useCallback(
    async (descriptionOverride?: string, options?: { silent?: boolean }) => {
      // Choose explicit override first, then hydrated description
      const descriptionToUse = (descriptionOverride ?? userDescription) || "";
      if (descriptionToUse.length < HOOK_CONFIG.MIN_DESCRIPTION_LENGTH) {
        setError("Valid workspace description required for keyword generation");
        return;
      }

      // Request deduplication
      const now = Date.now();
      if (
        now - lastRequestTimestamp.current <
        HOOK_CONFIG.REQUEST_DEDUPE_TIME_MS
      ) {
        logger.info(
          "[KEYWORD_SUGGESTIONS] Request deduplicated - too soon after last request"
        );
        return;
      }

      if (isLoadingRef.current) {
        logger.info(
          "[KEYWORD_SUGGESTIONS] Generation already in progress, skipping"
        );
        return;
      }

      lastRequestTimestamp.current = now;
      isLoadingRef.current = true;
      if (!options?.silent) {
        setLoading(true);
      }
      setError(null);
      setFromCache(false);

      const startTime = Date.now();

      try {
        logger.info("[KEYWORD_SUGGESTIONS] Starting keyword generation:", {
          descriptionLength: descriptionToUse.length,
          useRePrompt: shouldUseRePrompt(),
          stats: getSuggestionsStats(),
        });

        // Coordinate with context to ensure a single in-flight request
        const genData = (await runGeneration({
          userDescription: descriptionToUse,
          workspaceId: workspace?._id,
        })) as KeywordGenerationResponse;
        const metadata = genData.metadata;

        if (!isAuthenticated) {
          // Unauthenticated: store locally and optimistically render
          const keywords = genData.keywords.map((kw) => ({
            keyword: kw.keyword,
            metadata: {
              ...kw.metadata,
              source: "ai_generation",
            },
          }));
          const storeSuccess = storeNewSuggestions(
            keywords.map((kw) => ({
              keyword: kw.keyword,
              metadata: kw.metadata,
            })),
            descriptionToUse
          );
          if (!storeSuccess) {
            throw new Error("Failed to store new suggestions");
          }

          // Optimistically render returned keywords immediately
          try {
            const optimisticItems: KeywordItem[] = (genData.keywords || []).map(
              (k): KeywordItem => ({
                kind: "suggestion" as const,
                id: k.id,
                keyword: k.keyword,
                timestamp: k.timestamp,
                isPinned: false,
                metadata: k.metadata,
                exactMatch: k.metadata?.exactMatch ?? false,
              })
            );
            if (optimisticItems.length > 0) {
              setSuggestions(optimisticItems);
              setFromCache(false);
              setCacheAge(
                optimisticItems[0]?.timestamp
                  ? Date.parse(optimisticItems[0].timestamp) || undefined
                  : undefined
              );
            }
          } catch {}

          // Dispatch event and refresh from local store
          window.dispatchEvent(
            new CustomEvent("keywordSuggestionsUpdated", {
              detail: { source: "generation", count: keywords.length },
            })
          );
          loadSuggestionsFromStore();
        } else {
          // Authenticated: optimistically render returned keywords; reactive query will reconcile
          try {
            const optimisticItems: KeywordItem[] = (genData.keywords || []).map(
              (k): KeywordItem => ({
                kind: "suggestion" as const,
                id: k.id,
                keyword: k.keyword,
                timestamp: k.timestamp,
                isPinned: false,
                metadata: k.metadata,
                exactMatch: k.metadata?.exactMatch ?? false,
              })
            );
            if (optimisticItems.length > 0) {
              setSuggestions(optimisticItems);
              setFromCache(false);
              setCacheAge(
                optimisticItems[0]?.timestamp
                  ? Date.parse(optimisticItems[0].timestamp) || undefined
                  : undefined
              );
            }
          } catch {}

          // Then wait for Convex useQuery to update and replace
          loadSuggestionsFromStore();
        }

        setGenerationMetadata({
          requestId: metadata.requestId,
          processingTimeMs: metadata.processingTimeMs,
          llmProcessingTimeMs: metadata.llmProcessingTimeMs,
          modelUsed: metadata.modelUsed,
          usedFallback: metadata.usedFallback,
        });

        const endTime = Date.now();
        logger.info(
          "[KEYWORD_SUGGESTIONS] Generation completed successfully:",
          {
            totalTimeMs: endTime - startTime,
            useRePrompt: shouldUseRePrompt(),
          }
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to generate keywords";
        setError(errorMessage);

        logger.error("[KEYWORD_SUGGESTIONS] Generation failed:", {
          error: errorMessage,
          stack: err instanceof Error ? err.stack : undefined,
          processingTimeMs: Date.now() - startTime,
        });
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
        isLoadingRef.current = false;
      }
    },
    [
      userDescription,
      runGeneration,
      shouldUseRePrompt,
      loadSuggestionsFromStore,
      isAuthenticated,
      workspace?._id,
    ]
  );

  // Generate a single seed keyword for immediate search
  const generateSeedKeyword = useCallback(
    async (
      descriptionOverride?: string
    ): Promise<{
      keyword: string;
      exactMatch: boolean;
    } | null> => {
      const descriptionToUse = (descriptionOverride ?? userDescription) || "";
      if (descriptionToUse.length < HOOK_CONFIG.MIN_DESCRIPTION_LENGTH) {
        setError("Valid workspace description required for keyword generation");
        return null;
      }

      try {
        logger.info("[KEYWORD_SUGGESTIONS] Generating seed keyword:", {
          descriptionLength: descriptionToUse.length,
        });

        const result = await generateSeedKeywordAction({
          userDescription: descriptionToUse,
        });

        if (!result.success || !result.data) {
          throw new Error(result.error || "Failed to generate seed keyword");
        }

        logger.info("[KEYWORD_SUGGESTIONS] Seed keyword generated:", {
          keyword: result.data.keyword,
          exactMatch: result.data.exactMatch,
          processingTimeMs: result.data.metadata.processingTimeMs,
        });

        return {
          keyword: result.data.keyword,
          exactMatch: result.data.exactMatch,
        };
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to generate seed keyword";
        logger.error("[KEYWORD_SUGGESTIONS] Seed generation failed:", {
          error: errorMessage,
          stack: err instanceof Error ? err.stack : undefined,
        });
        return null;
      }
    },
    [userDescription, generateSeedKeywordAction]
  );

  // Record keyword usage and mark as used
  const recordKeywordUsage = useCallback(
    async (keywordId: string, keyword: string) => {
      try {
        logger.info("[KEYWORD_SUGGESTIONS] Recording keyword usage:", {
          keywordId,
          keyword,
        });

        if (isAuthenticated) {
          // Only mark as used if this ID belongs to a real server-side suggestion
          const isSuggestionId =
            Array.isArray(convexSuggestions) &&
            convexSuggestions.some(
              (s) =>
                s._id === (keywordId as unknown as Id<"keywordSuggestions">)
            );

          if (isSuggestionId) {
            await markSuggestionAsUsedMutation({
              suggestionId: keywordId as Id<"keywordSuggestions">,
            });
          } else {
            // Skip mutation for non-suggestion IDs (e.g., history/similar keyword IDs)
            logger.info(
              "[KEYWORD_SUGGESTIONS] Skipping markSuggestionAsUsed - not a suggestion ID",
              { keywordId }
            );
          }
          // Let Convex reactivity update the list; avoid manual override with stale data
          // Fallback to local refresh only if needed (no-op here)
        } else {
          const success = markSuggestionAsUsed(keyword);
          if (success) {
            loadSuggestionsFromStore();
          }
        }
      } catch (error) {
        logger.warn(
          "[KEYWORD_SUGGESTIONS] Failed to record keyword usage:",
          error
        );
      }
    },
    [
      isAuthenticated,
      markSuggestionAsUsedMutation,
      loadSuggestionsFromStore,
      convexSuggestions,
    ]
  );

  // Refresh suggestions
  const refreshSuggestions = useCallback(async () => {
    // Avoid erroring while description is still hydrating
    if (userDescription === null) {
      return;
    }
    if (!hasValidDescription) {
      setError("Valid workspace description required");
      return;
    }

    // Authenticated path
    if (isAuthenticated) {
      // Wait for query to resolve
      if (convexSuggestions === undefined) return;
      const hasCurrentDesc = (convexSuggestions || []).length > 0;

      logger.info("[KEYWORD_SUGGESTIONS] Refresh (auth):", {
        serverUnused: Array.isArray(convexSuggestions)
          ? convexSuggestions.length
          : 0,
        userDescription,
        hasCurrentDesc,
      });

      if (!hasCurrentDesc) {
        await generateKeywords(undefined, { silent: false });
        return;
      }

      // Try to display what we have
      loadSuggestionsFromStore();

      // Harmonize threshold: regenerate when <=5 remain to match 10-target pool
      if ((convexSuggestions || []).length <= 5) {
        void generateKeywords(undefined, { silent: true });
      }
      return;
    }

    // Unauthenticated path: local store rule (<= 5) and description change via local state
    const localDescChanged = hasUserDescriptionChanged(userDescription || "");
    logger.info("[KEYWORD_SUGGESTIONS] Refresh (unauth):", {
      localDescChanged,
      shouldRegenerate: shouldRegenerateSuggestions(),
    });

    if (localDescChanged) {
      await generateKeywords(undefined, { silent: false });
      return;
    }

    // Always update UI with current suggestions, then decide on regeneration
    loadSuggestionsFromStore();
    if (shouldRegenerateSuggestions()) {
      void generateKeywords(undefined, { silent: true });
    }
  }, [
    hasValidDescription,
    isAuthenticated,
    userDescription,
    convexSuggestions,
    loadSuggestionsFromStore,
    generateKeywords,
  ]);

  // Reactively update UI when Convex suggestions arrive, and trigger generation if needed
  useEffect(() => {
    if (isAuthenticated && convexSuggestions !== undefined) {
      // For auth: rely on reactive updates; refresh handles generation threshold
      void refreshSuggestions();
    }
  }, [isAuthenticated, convexSuggestions, refreshSuggestions]);

  // Listen to localStorage changes to immediately refresh suggestions for unauth users
  useEffect(() => {
    if (isAuthenticated) return;
    const onChange = () => loadSuggestionsFromStore();
    window.addEventListener("onLocalStorageChange", onChange);
    return () => window.removeEventListener("onLocalStorageChange", onChange);
  }, [isAuthenticated, loadSuggestionsFromStore]);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-fetch once when a valid description becomes available
  useEffect(() => {
    if (
      !hasAttemptedInitialFetch.current &&
      HOOK_CONFIG.AUTO_FETCH_ON_MOUNT &&
      hasValidDescription
    ) {
      hasAttemptedInitialFetch.current = true;

      logger.info(
        "[KEYWORD_SUGGESTIONS] Auto-fetching suggestions (first valid description)"
      );

      // Kick off immediately to avoid flicker; refresh handles dedupe
      void refreshSuggestions();
    }
  }, [hasValidDescription, refreshSuggestions]);

  // Ensure hydration terminates after logout (unauth) even if there are no local suggestions
  useEffect(() => {
    if (
      !isAuthenticated &&
      !isInitialized.current &&
      hasAttemptedInitialFetch.current
    ) {
      // Either suggestions loaded (handled above) or none exist; mark initialized to stop loaders
      isInitialized.current = true;
    }
  }, [isAuthenticated]);

  // Listen for suggestions updates from reprompt hook
  useEffect(() => {
    const handleSuggestionsUpdate = (event: CustomEvent) => {
      logger.info(
        "[KEYWORD_SUGGESTIONS] Received suggestions update event:",
        event.detail
      );
      // Refresh suggestions when new ones are added by reprompt
      loadSuggestionsFromStore();
    };

    window.addEventListener(
      "keywordSuggestionsUpdated",
      handleSuggestionsUpdate as EventListener
    );

    return () => {
      window.removeEventListener(
        "keywordSuggestionsUpdated",
        handleSuggestionsUpdate as EventListener
      );
    };
  }, [loadSuggestionsFromStore]);

  // Mark as initialized when we have suggestions or an error
  useEffect(() => {
    if ((suggestions.length > 0 || error) && !isInitialized.current) {
      isInitialized.current = true;
    }
  }, [suggestions.length, error]);

  // Return the complete state and actions
  return {
    // Suggestions data
    suggestions,
    loading: isHydrating || loading,
    error,
    isHydrating,

    // User context
    userDescription,
    hasValidDescription: !!hasValidDescription,

    // Performance data
    totalTrackedKeywords: performanceData.totalTrackedKeywords,
    highValueKeywords: performanceData.highValueKeywords,

    // Cache status
    fromCache,
    cacheAge,

    // Generation metadata
    generationMetadata,

    // Actions
    generateKeywords,
    generateSeedKeyword,
    recordKeywordUsage,
    refreshSuggestions,
    clearError,
  };
}
