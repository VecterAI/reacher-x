/**
 * Keyword Suggestions Hook
 *
 * This hook implements the proper keyword suggestion management system:
 * - Store 15 generated keywords at a time
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

// Type definitions for API responses
interface KeywordGenerationResponse {
  keywords: Array<{
    id: string;
    keyword: string;
    timestamp: string;
    metadata: {
      rationale: string;
      searchIntent: string;
      confidence: number;
      generatedAt: number;
      source: string;
      usedFallback: boolean;
    };
  }>;
  metadata: {
    requestId: string;
    generatedAt: number;
    processingTimeMs: number;
    llmProcessingTimeMs: number;
    confidenceStats: {
      min: number;
      max: number;
      avg: number;
    };
    intentDistribution: Record<string, number>;
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
  generateKeywords: () => Promise<void>;
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
  const generateKeywordsAction = useAction(
    api.keywordSuggestions.generateKeywords
  );
  const markSuggestionAsUsedMutation = useMutation(
    api.keywordSuggestions.markSuggestionAsUsed
  );
  const convexSuggestions = useQuery(
    api.keywordSuggestions.getSuggestions,
    isAuthenticated && workspace
      ? { workspaceId: workspace._id, limit: HOOK_CONFIG.AUTH_POOL_LIMIT }
      : "skip"
  );

  // Load unified user description and validate
  useEffect(() => {
    try {
      const description = unifiedDescription || null;
      setUserDescription(description);

      console.log("[KEYWORD_SUGGESTIONS] Loaded user description:", {
        hasDescription: !!description,
        descriptionLength: description?.length || 0,
        isValid:
          description &&
          description.length >= HOOK_CONFIG.MIN_DESCRIPTION_LENGTH,
      });
    } catch (error) {
      console.error(
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
      const filtered = (convexSuggestions || [])
        .filter((s) =>
          userDescription ? s.userDescription === userDescription : true
        )
        .sort((a, b) => a.generatedAt - b.generatedAt); // oldest first for stable window

      const items: KeywordItem[] = filtered.map((s) => ({
        id: s._id,
        keyword: s.keyword,
        timestamp: new Date(s.generatedAt).toISOString(),
        isPinned: false,
        metadata: s.metadata,
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
    const keywordItems: KeywordItem[] = allUnused.map((suggestion) => ({
      id: suggestion.id,
      keyword: suggestion.keyword,
      timestamp: new Date(suggestion.generatedAt).toISOString(),
      isPinned: false,
      metadata: suggestion.metadata,
    }));
    setSuggestions(keywordItems);
    setFromCache(true);
    setCacheAge(allUnused[0]?.generatedAt);
    return keywordItems.length > 0;
  }, [isAuthenticated, convexSuggestions, userDescription]);

  // Derived hydration flag
  const isHydrating = useMemo(() => {
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
        convexSuggestions.length === 0
      ) {
        return true;
      }
      return false;
    }
    // Unauthenticated: if description hasn't been resolved yet on first paint, keep hydrating
    if (!isAuthenticated && userDescription === null) return true;
    // If there's no valid description, don't show loaders
    if (!hasValidDescription) return false;
    // Before first attempt or before initial local read, consider hydrating
    return !isInitialized.current && !hasAttemptedInitialFetch.current;
  }, [
    authLoading,
    isAuthenticated,
    workspace,
    convexSuggestions,
    userDescription,
    hasValidDescription,
  ]);

  // Check if we should use re-prompt service
  // Note: Re-prompting is now handled by the separate useKeywordRePrompt hook
  // This hook only handles regular keyword generation
  const shouldUseRePrompt = useCallback(() => {
    return false; // Disable re-prompting in this hook
  }, []);

  // Generate new keywords using AI
  const generateKeywords = useCallback(async () => {
    if (!hasValidDescription || !userDescription) {
      setError("Valid workspace description required for keyword generation");
      return;
    }

    // Request deduplication
    const now = Date.now();
    if (
      now - lastRequestTimestamp.current <
      HOOK_CONFIG.REQUEST_DEDUPE_TIME_MS
    ) {
      console.log(
        "[KEYWORD_SUGGESTIONS] Request deduplicated - too soon after last request"
      );
      return;
    }

    if (isLoadingRef.current) {
      console.log(
        "[KEYWORD_SUGGESTIONS] Generation already in progress, skipping"
      );
      return;
    }

    lastRequestTimestamp.current = now;
    isLoadingRef.current = true;
    setLoading(true);
    setError(null);
    setFromCache(false);

    const startTime = Date.now();

    try {
      console.log("[KEYWORD_SUGGESTIONS] Starting keyword generation:", {
        descriptionLength: userDescription.length,
        useRePrompt: shouldUseRePrompt(),
        stats: getSuggestionsStats(),
      });

      // Use simple generation (re-prompting is handled by useKeywordRePrompt hook)
      const result = await generateKeywordsAction({
        userDescription,
        workspaceId: workspace?._id,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to generate keywords");
      }

      // Handle response
      const genData = result.data as KeywordGenerationResponse;
      const metadata = genData.metadata;

      if (!isAuthenticated) {
        // Unauthenticated: store locally
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
          userDescription
        );
        if (!storeSuccess) {
          throw new Error("Failed to store new suggestions");
        }
        // Refresh from local store
        window.dispatchEvent(
          new CustomEvent("keywordSuggestionsUpdated", {
            detail: { source: "generation", count: keywords.length },
          })
        );
        loadSuggestionsFromStore();
      } else {
        // Authenticated: server persisted; query will update reactively
        loadSuggestionsFromStore();
      }

      setGenerationMetadata({
        requestId: metadata.requestId,
        processingTimeMs: metadata.processingTimeMs,
        llmProcessingTimeMs: metadata.llmProcessingTimeMs,
        confidenceStats: metadata.confidenceStats,
        intentDistribution: metadata.intentDistribution,
        modelUsed: metadata.modelUsed,
        usedFallback: metadata.usedFallback,
      });

      const endTime = Date.now();
      console.log("[KEYWORD_SUGGESTIONS] Generation completed successfully:", {
        totalTimeMs: endTime - startTime,
        useRePrompt: shouldUseRePrompt(),
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to generate keywords";
      setError(errorMessage);

      console.error("[KEYWORD_SUGGESTIONS] Generation failed:", {
        error: errorMessage,
        stack: err instanceof Error ? err.stack : undefined,
        processingTimeMs: Date.now() - startTime,
      });
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [
    hasValidDescription,
    userDescription,
    generateKeywordsAction,
    shouldUseRePrompt,
    loadSuggestionsFromStore,
    isAuthenticated,
    workspace?._id,
  ]);

  // Record keyword usage and mark as used
  const recordKeywordUsage = useCallback(
    async (keywordId: string, keyword: string) => {
      try {
        console.log("[KEYWORD_SUGGESTIONS] Recording keyword usage:", {
          keywordId,
          keyword,
        });

        if (isAuthenticated) {
          await markSuggestionAsUsedMutation({
            suggestionId: keywordId as Id<"keywordSuggestions">,
          });
          // reactive query will refresh
        } else {
          const success = markSuggestionAsUsed(keyword);
          if (success) {
            loadSuggestionsFromStore();
          }
        }
      } catch (error) {
        console.warn(
          "[KEYWORD_SUGGESTIONS] Failed to record keyword usage:",
          error
        );
      }
    },
    [isAuthenticated, markSuggestionAsUsedMutation, loadSuggestionsFromStore]
  );

  // Refresh suggestions
  const refreshSuggestions = useCallback(async () => {
    if (!hasValidDescription) {
      setError("Valid workspace description required");
      return;
    }

    // Authenticated path
    if (isAuthenticated) {
      // Wait for query to resolve
      if (convexSuggestions === undefined) return;

      // Filter pool to current description
      const filtered = (convexSuggestions || [])
        .filter((s) =>
          userDescription ? s.userDescription === userDescription : true
        )
        .sort((a, b) => a.generatedAt - b.generatedAt);

      const hasCurrentDesc = filtered.length > 0;

      console.log("[KEYWORD_SUGGESTIONS] Refresh (auth):", {
        serverUnused: convexSuggestions.length,
        filteredUnused: filtered.length,
        userDescription,
        hasCurrentDesc,
      });

      if (!hasCurrentDesc) {
        await generateKeywords();
        return;
      }

      // Try to display what we have
      loadSuggestionsFromStore();

      if (filtered.length <= 2) {
        await generateKeywords();
      }
      return;
    }

    // Unauthenticated path: local store rule (<= 2) and description change via local state
    const localDescChanged = hasUserDescriptionChanged(userDescription || "");
    console.log("[KEYWORD_SUGGESTIONS] Refresh (unauth):", {
      localDescChanged,
      shouldRegenerate: shouldRegenerateSuggestions(),
    });

    if (localDescChanged) {
      await generateKeywords();
      return;
    }

    if (loadSuggestionsFromStore()) return;
    if (shouldRegenerateSuggestions()) {
      await generateKeywords();
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
      void refreshSuggestions();
    }
  }, [isAuthenticated, convexSuggestions, refreshSuggestions]);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-fetch on mount with proper controls
  useEffect(() => {
    if (
      !isInitialized.current &&
      !hasAttemptedInitialFetch.current &&
      HOOK_CONFIG.AUTO_FETCH_ON_MOUNT &&
      hasValidDescription
    ) {
      hasAttemptedInitialFetch.current = true;

      console.log("[KEYWORD_SUGGESTIONS] Auto-fetching suggestions on mount");

      // Kick off immediately to avoid flicker; refresh handles dedupe
      void refreshSuggestions();
    }
  }, [hasValidDescription, refreshSuggestions]);

  // Listen for suggestions updates from reprompt hook
  useEffect(() => {
    const handleSuggestionsUpdate = (event: CustomEvent) => {
      console.log(
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
    loading: loading || isHydrating,
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
    recordKeywordUsage,
    refreshSuggestions,
    clearError,
  };
}
