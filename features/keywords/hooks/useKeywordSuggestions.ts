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
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getWorkspaceDescription } from "@/shared/lib/utils/localStorage";
import { DESCRIPTION_CONSTRAINTS } from "@/shared/lib/utils/validation";
import {
  getKeywords,
  type UnifiedKeyword,
} from "@/shared/lib/utils/unifiedKeywordStore";
import {
  getUnusedSuggestions,
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
 * Hook for managing keyword suggestions with proper lifecycle management
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

  // Convex actions
  const generateKeywordsAction = useAction(
    api.keywordSuggestions.generateKeywords
  );

  // Load user description and validate
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
  }, []);

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

  // Load suggestions from store
  const loadSuggestionsFromStore = useCallback(() => {
    if (!userDescription) return false;

    const unusedSuggestions = getUnusedSuggestions();

    if (unusedSuggestions.length > 0) {
      const keywordItems: KeywordItem[] = unusedSuggestions.map(
        (suggestion) => ({
          id: suggestion.id,
          keyword: suggestion.keyword,
          timestamp: new Date(suggestion.generatedAt).toISOString(),
          isPinned: false,
          metadata: suggestion.metadata,
        })
      );

      setSuggestions(keywordItems);
      setFromCache(true);
      setCacheAge(unusedSuggestions[0]?.generatedAt);

      console.log("[KEYWORD_SUGGESTIONS] Loaded suggestions from store:", {
        count: unusedSuggestions.length,
        stats: getSuggestionsStats(),
      });
      return true;
    }

    return false;
  }, [userDescription]);

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
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to generate keywords");
      }

      // Handle simple generation response
      const genData = result.data as KeywordGenerationResponse;
      const keywords = genData.keywords.map((kw) => ({
        keyword: kw.keyword,
        metadata: {
          ...kw.metadata,
          source: "ai_generation",
        },
      }));
      const metadata = genData.metadata;

      // Store new suggestions in the store
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

      // Trigger a refresh of suggestions UI
      window.dispatchEvent(
        new CustomEvent("keywordSuggestionsUpdated", {
          detail: { source: "generation", count: keywords.length },
        })
      );

      // Load the updated suggestions
      loadSuggestionsFromStore();

      // Set generation metadata
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
        keywordCount: keywords.length,
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
  ]);

  // Record keyword usage and mark as used in store
  const recordKeywordUsage = useCallback(
    (keywordId: string, keyword: string) => {
      try {
        console.log("[KEYWORD_SUGGESTIONS] Recording keyword usage:", {
          keywordId,
          keyword,
        });

        // Mark the suggestion as used in the store
        const success = markSuggestionAsUsed(keyword);
        if (success) {
          // Reload suggestions to show new ones
          loadSuggestionsFromStore();
        }
      } catch (error) {
        console.warn(
          "[KEYWORD_SUGGESTIONS] Failed to record keyword usage:",
          error
        );
      }
    },
    [loadSuggestionsFromStore]
  );

  // Refresh suggestions
  const refreshSuggestions = useCallback(async () => {
    if (!hasValidDescription) {
      setError("Valid workspace description required");
      return;
    }

    console.log("[KEYWORD_SUGGESTIONS] Refreshing suggestions:", {
      hasValidDescription,
      shouldRegenerate: shouldRegenerateSuggestions(),
      descriptionChanged: hasUserDescriptionChanged(userDescription || ""),
    });

    // Check if user description changed (needs regeneration)
    if (hasUserDescriptionChanged(userDescription || "")) {
      console.log(
        "[KEYWORD_SUGGESTIONS] User description changed, regenerating"
      );
      await generateKeywords();
      return;
    }

    // Try loading from store first
    if (loadSuggestionsFromStore()) {
      return;
    }

    // Check if regeneration is needed
    if (shouldRegenerateSuggestions()) {
      console.log(
        "[KEYWORD_SUGGESTIONS] Regeneration needed, generating new keywords"
      );
      await generateKeywords();
      return;
    }

    // If we still have no suggestions, generate them
    if (suggestions.length === 0) {
      console.log("[KEYWORD_SUGGESTIONS] No suggestions available, generating");
      await generateKeywords();
    }
  }, [
    hasValidDescription,
    userDescription,
    loadSuggestionsFromStore,
    generateKeywords,
    suggestions.length,
  ]);

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
      isInitialized.current = true;

      console.log("[KEYWORD_SUGGESTIONS] Auto-fetching suggestions on mount");

      // Use a timeout to prevent any race conditions
      const timeoutId = setTimeout(() => {
        refreshSuggestions();
      }, 100);

      return () => clearTimeout(timeoutId);
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
