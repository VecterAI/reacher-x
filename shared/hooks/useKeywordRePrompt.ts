"use client";

import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCallback, useState, useEffect } from "react";
import {
  getFlaggedKeywords,
  clearKeywordFlags,
} from "@/shared/lib/utils/unifiedKeywordStore";
import { storeNewSuggestions } from "@/shared/lib/utils/keywordSuggestionsStore";
import { getWorkspaceDescription } from "@/shared/lib/utils/localStorage";

export interface RePromptState {
  isRePrompting: boolean;
  lastRePromptTime: number | null;
  error: string | null;
  insights: {
    highPerformingPatterns: string[];
    lowPerformingPatterns: string[];
    recommendedAdjustments: string[];
  } | null;
}

export interface KeywordItem {
  id: string;
  keyword: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface RePromptInsights {
  highPerformingPatterns: string[];
  lowPerformingPatterns: string[];
  recommendedAdjustments: string[];
}

export interface RePromptResult {
  success: boolean;
  improvedKeywords?: KeywordItem[];
  insights?: RePromptInsights;
  error?: string;
}

/**
 * Hook for managing keyword re-prompting based on performance thresholds
 */
export function useKeywordRePrompt() {
  const [state, setState] = useState<RePromptState>({
    isRePrompting: false,
    lastRePromptTime: null,
    error: null,
    insights: null,
  });

  const rePromptAction = useAction(api.keywordRePrompt.rePromptKeywords);

  // Check for flagged keywords and trigger re-prompt if needed
  const checkAndRePrompt = useCallback(async (): Promise<RePromptResult> => {
    setState((prev) => ({ ...prev, isRePrompting: true, error: null }));

    try {
      const userDescription = getWorkspaceDescription();
      if (!userDescription) {
        throw new Error("User description not found");
      }

      const flaggedKeywords = getFlaggedKeywords();

      if (flaggedKeywords.length === 0) {
        console.log("[KEYWORD_REPROMPT] No flagged keywords found");
        setState((prev) => ({
          ...prev,
          isRePrompting: false,
        }));
        return { success: false, error: "No flagged keywords to process" };
      }

      const flaggedKeywordsForAction = flaggedKeywords.map((kw) => ({
        keyword: kw.keyword,
        status: kw.status,
        decayedScore: kw.decayedScore,
        totalVotes: kw.votes.length,
        upVotes: kw.votes.filter((v) => v.vote === "up").length,
        downVotes: kw.votes.filter((v) => v.vote === "down").length,
      }));

      console.log("[KEYWORD_REPROMPT] Processing flagged keywords:", {
        count: flaggedKeywords.length,
        keywords: flaggedKeywords.map((k) => k.keyword),
      });

      // Call the Convex action
      const result = await rePromptAction({
        userDescription,
        flaggedKeywords: flaggedKeywordsForAction,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || "Re-prompt failed");
      }

      const { improvedKeywords, insights } = result.data;

      // Store improved keywords in suggestions store (not unified store)
      const success = storeNewSuggestions(
        improvedKeywords.map((kw: KeywordItem) => ({
          keyword: kw.keyword,
          metadata: {
            ...kw.metadata,
            source: "ai_reprompt",
            isRePrompt: true,
            basedOnPerformance: true,
          },
        })),
        userDescription
      );

      if (!success) {
        console.warn("[KEYWORD_REPROMPT] Failed to store new suggestions");
      } else {
        // Trigger a refresh of suggestions UI by dispatching a custom event
        window.dispatchEvent(
          new CustomEvent("keywordSuggestionsUpdated", {
            detail: { source: "reprompt", count: improvedKeywords.length },
          })
        );
      }

      // Clear flags for processed keywords
      clearKeywordFlags(flaggedKeywords.map((k) => k.id));

      console.log(
        "[KEYWORD_REPROMPT] Successfully generated improved keywords:",
        {
          count: improvedKeywords.length,
          keywords: improvedKeywords.map((k: KeywordItem) => k.keyword),
          insights,
        }
      );

      setState((prev) => ({
        ...prev,
        isRePrompting: false,
        lastRePromptTime: Date.now(),
        insights,
        error: null,
      }));

      return {
        success: true,
        improvedKeywords,
        insights,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("[KEYWORD_REPROMPT] Re-prompt failed:", error);

      setState((prev) => ({
        ...prev,
        isRePrompting: false,
        error: errorMessage,
      }));

      return {
        success: false,
        error: errorMessage,
      };
    }
  }, [rePromptAction]);

  // Get current flagged keywords count
  const getFlaggedKeywordsCount = useCallback(() => {
    return getFlaggedKeywords().length;
  }, []);

  // Check if re-prompt is needed (has flagged keywords and not recently re-prompted)
  const shouldRePrompt = useCallback(() => {
    const flaggedCount = getFlaggedKeywords().length;
    const timeSinceLastRePrompt = state.lastRePromptTime
      ? Date.now() - state.lastRePromptTime
      : Infinity;

    // Don't re-prompt if done recently (within 5 minutes)
    const MIN_REPROMPT_INTERVAL = 5 * 60 * 1000; // 5 minutes

    return (
      flaggedCount > 0 &&
      timeSinceLastRePrompt > MIN_REPROMPT_INTERVAL &&
      !state.isRePrompting
    );
  }, [state.lastRePromptTime, state.isRePrompting]);

  // Auto-check for re-prompt opportunities on mount and when voting occurs
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const flaggedCount = getFlaggedKeywords().length;
      const timeSinceLastRePrompt = state.lastRePromptTime
        ? Date.now() - state.lastRePromptTime
        : Infinity;
      const MIN_REPROMPT_INTERVAL = 5 * 60 * 1000; // 5 minutes

      if (
        flaggedCount > 0 &&
        timeSinceLastRePrompt > MIN_REPROMPT_INTERVAL &&
        !state.isRePrompting
      ) {
        console.log("[KEYWORD_REPROMPT] Auto-triggering re-prompt check");
        checkAndRePrompt();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(checkInterval);
  }, [state.lastRePromptTime, state.isRePrompting, checkAndRePrompt]);

  return {
    ...state,
    checkAndRePrompt,
    getFlaggedKeywordsCount,
    shouldRePrompt: shouldRePrompt(),
  };
}
