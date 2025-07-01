/**
 * Keyword Suggestions Hook
 *
 * This hook provides a complete integration between the frontend and the keyword
 * suggestion system, managing both AI generation and performance tracking.
 *
 * Features:
 * - Smart caching with description-based invalidation
 * - Fallback to high-value keywords from performance tracking
 * - Seamless integration with existing KeywordItem interface
 * - Automatic performance tracking initialization
 * - Error handling and loading states
 * - Request deduplication to prevent infinite loops
 *
 * References:
 * - React Query patterns: https://react-query.tanstack.com/guides/dependent-queries
 * - Custom hooks best practices: "React Hooks in Action" by John Larsen
 * - Performance optimization: React's official docs on useMemo and useCallback
 */

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getWorkspaceDescription } from "@/shared/lib/utils/localStorage";
import { DESCRIPTION_CONSTRAINTS } from "@/shared/lib/utils/validation";
import {
  getKeywords,
  type UnifiedKeyword,
} from "@/shared/lib/utils/unifiedKeywordStore";
import type { KeywordItem } from "../ui/components/KeywordList";

// Hook configuration
const HOOK_CONFIG = {
  AUTO_FETCH_ON_MOUNT: true,
  USE_PERFORMANCE_FALLBACK: true,
  MAX_FALLBACK_KEYWORDS: 5,
  MIN_DESCRIPTION_LENGTH: DESCRIPTION_CONSTRAINTS.MIN_LENGTH,
  REQUEST_DEDUPE_TIME_MS: 1000, // Prevent requests within 1 second of each other
} as const;

export interface KeywordSuggestionsState {
  // Suggestions data
  suggestions: KeywordItem[];
  loading: boolean;
  error: string | null;

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
 * Hook for managing keyword suggestions with AI generation and performance tracking
 */
export function useKeywordSuggestions(): KeywordSuggestionsState {
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

  // Convex action for keyword generation
  const generateKeywordsAction = useAction(
    api.keywordSuggestions.generateKeywords
  );

  // Load user description and validate - stable effect
  useEffect(() => {
    try {
      const description = getWorkspaceDescription();
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
  }, []); // No dependencies - only run once

  // Load keywords from unified store and listen for changes
  useEffect(() => {
    const refreshAllKeywords = () => {
      setAllKeywords(getKeywords());
    };
    refreshAllKeywords(); // Initial load

    window.addEventListener("onLocalStorageChange", refreshAllKeywords);
    return () => {
      window.removeEventListener("onLocalStorageChange", refreshAllKeywords);
    };
  }, []);

  // Computed values - stable dependencies
  const hasValidDescription = useMemo(() => {
    return (
      userDescription &&
      userDescription.length >= HOOK_CONFIG.MIN_DESCRIPTION_LENGTH
    );
  }, [userDescription]);

  // Performance tracking data is now derived from the unified store
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

  // Stable helper functions
  const loadCachedSuggestions = useCallback(() => {
    if (!userDescription) return false;

    // "Cache" is now just previously generated AI suggestions
    const aiSuggestions = allKeywords.filter(
      (kw) => kw.source === "ai_suggestion" || kw.source === "ai_reprompt"
    );

    if (aiSuggestions.length > 0) {
      setSuggestions(
        aiSuggestions.map((kw) => ({
          id: kw.id,
          keyword: kw.keyword,
          timestamp: new Date(kw.createdAt).toISOString(),
          isPinned: kw.isPinned,
          metadata: kw.metadata,
        }))
      );
      setFromCache(true);
      setCacheAge(
        aiSuggestions.reduce((max, kw) => Math.max(max, kw.createdAt), 0)
      );

      console.log(
        "[KEYWORD_SUGGESTIONS] Loaded AI suggestions from unified store:",
        {
          count: aiSuggestions.length,
        }
      );
      return true;
    }

    return false;
  }, [userDescription, allKeywords]);

  const loadFallbackSuggestions = useCallback(() => {
    if (!HOOK_CONFIG.USE_PERFORMANCE_FALLBACK) return false;

    try {
      // Get fresh performance data to avoid stale dependencies
      const fallbackFromStore = performanceData.availableForFallback;

      if (fallbackFromStore.length > 0) {
        const fallbackSuggestions: KeywordItem[] = fallbackFromStore.map(
          (kw) => ({
            id: kw.id,
            keyword: kw.keyword,
            timestamp: new Date(kw.lastUsedAt).toISOString(),
            isPinned: kw.isPinned,
            metadata: {
              ...kw.metadata,
              source: "performance_tracking",
              decayedScore: kw.decayedScore,
              status: kw.status,
              totalVotes: kw.votes.length,
            },
          })
        );

        setSuggestions(fallbackSuggestions);
        setFromCache(false);

        console.log(
          "[KEYWORD_SUGGESTIONS] Loaded fallback suggestions from performance data:",
          {
            count: fallbackSuggestions.length,
            sources: fallbackFromStore.map((k) => k.source),
          }
        );

        return true;
      }
    } catch (error) {
      console.warn(
        "[KEYWORD_SUGGESTIONS] Failed to load fallback suggestions:",
        error
      );
    }

    return false;
  }, []); // FIXED: No dependencies - compute fresh data each time

  // Generate new keywords using AI - with request deduplication
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
        dedupeCheck: now - lastRequestTimestamp.current,
      });

      const result = await generateKeywordsAction({
        userDescription,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to generate keywords");
      }

      const { keywords, metadata } = result.data;

      // Transform to KeywordItem format.
      // DO NOT add to the unified store yet. They are only suggestions.
      const keywordItems: KeywordItem[] = keywords.map((kw) => ({
        id: kw.id, // This is the temporary ID from the backend, e.g., "generated_..."
        keyword: kw.keyword,
        timestamp: kw.timestamp,
        isPinned: false, // AI-generated keywords are not pinned by default
        metadata: {
          ...kw.metadata,
          fromGeneration: true,
        },
      }));

      // Set the suggestions in the local state of this hook.
      setSuggestions(keywordItems);
      setFromCache(false);

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
        keywordCount: keywordItems.length,
        totalTimeMs: endTime - startTime,
        avgConfidence: metadata.confidenceStats?.avg,
        intentTypes: Object.keys(metadata.intentDistribution || {}),
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

      // If generation fails, attempt to load fallback suggestions as a last resort.
      console.warn(
        "[KEYWORD_SUGGESTIONS] Generation failed. Attempting to load fallback suggestions."
      );
      if (!loadFallbackSuggestions()) {
        // Ensure suggestions are empty if there are no fallbacks either to avoid showing stale data.
        setSuggestions([]);
      }
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [
    hasValidDescription,
    userDescription,
    generateKeywordsAction,
    loadFallbackSuggestions,
  ]);

  // Record keyword usage for performance tracking
  const recordKeywordUsage = useCallback(
    (keywordId: string, keyword: string) => {
      try {
        console.log("[KEYWORD_SUGGESTIONS] Recording keyword usage:", {
          keywordId,
          keyword,
        });

        // This can be extended to record actual usage patterns
        // For now, we just log the usage - voting will be handled separately
      } catch (error) {
        console.warn(
          "[KEYWORD_SUGGESTIONS] Failed to record keyword usage:",
          error
        );
      }
    },
    []
  );

  // Refresh suggestions - FIXED: Stable implementation without circular dependencies
  const refreshSuggestions = useCallback(async () => {
    if (!hasValidDescription) {
      setError("Valid workspace description required");
      return;
    }

    console.log("[KEYWORD_SUGGESTIONS] Refreshing suggestions:", {
      hasValidDescription,
    });

    // Try loading from unified store first
    if (loadCachedSuggestions()) {
      return;
    }

    // If cache misses, generate new suggestions. This now handles its own fallback logic on error.
    await generateKeywords();
  }, [hasValidDescription, loadCachedSuggestions, generateKeywords]);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // FIXED: Stable auto-fetch on mount with proper controls
  useEffect(() => {
    // Only run once when component mounts and has valid description
    if (
      !isInitialized.current &&
      !hasAttemptedInitialFetch.current &&
      HOOK_CONFIG.AUTO_FETCH_ON_MOUNT &&
      hasValidDescription &&
      suggestions.length === 0
    ) {
      hasAttemptedInitialFetch.current = true;
      isInitialized.current = true;

      console.log("[KEYWORD_SUGGESTIONS] Auto-fetching suggestions on mount");

      // Use a timeout to prevent any race conditions
      const timeoutId = setTimeout(() => {
        refreshSuggestions();
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [hasValidDescription]); // FIXED: Only depend on hasValidDescription

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
    loading,
    error,

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
