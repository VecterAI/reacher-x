/**
 * Keyword Suggestions Store
 *
 * This module manages AI-generated keyword suggestions with the following logic:
 * - Store 15 generated keywords at a time
 * - Show only 5 unused keywords to the user
 * - When a keyword is used, remove it from suggestions and show a new one
 * - When no unused keywords remain, trigger regeneration
 * - Use re-prompt service if user has voting data, otherwise use simple generation
 *
 * References:
 * - Single source of truth principle
 * - React state management patterns
 */

import { getLocalStorage, setLocalStorage } from "./localStorage";
import { generateUniqueId } from "./request";
import { getCurrentUTCTimestamp } from "./timeUtils";

// Storage key for keyword suggestions
const KEYWORD_SUGGESTIONS_KEY = "reacherx_keyword_suggestions";

// Configuration constants
const SUGGESTIONS_CONFIG = {
  TOTAL_GENERATED: 15, // Total keywords to generate at once
  DISPLAY_COUNT: 5, // Number of keywords to show to user
  MIN_UNUSED_FOR_REGENERATION: 2, // Trigger regeneration when this many unused remain
} as const;

/**
 * Represents a keyword suggestion in the store
 */
export interface KeywordSuggestion {
  id: string;
  keyword: string;
  generatedAt: number; // UTC timestamp
  usedAt?: number; // UTC timestamp when user used this keyword
  isUsed: boolean;
  metadata?: {
    rationale?: string;
    searchIntent?: string;
    confidence?: number;
    source?: string; // "ai_generation" | "ai_reprompt"
    [key: string]: unknown;
  };
}

/**
 * Represents the complete suggestions state
 */
export interface KeywordSuggestionsState {
  suggestions: KeywordSuggestion[];
  lastGeneratedAt: number;
  userDescription: string;
  generationCount: number;
}

/**
 * Load keyword suggestions from localStorage
 */
function loadSuggestions(): KeywordSuggestionsState | null {
  try {
    const stored = getLocalStorage(KEYWORD_SUGGESTIONS_KEY);
    if (!stored) return null;

    const state: KeywordSuggestionsState = JSON.parse(stored);

    // Basic validation
    if (!state.suggestions || !Array.isArray(state.suggestions)) {
      console.warn(
        "[KEYWORD_SUGGESTIONS_STORE] Invalid suggestions data, resetting"
      );
      return null;
    }

    return state;
  } catch (error) {
    console.warn(
      "[KEYWORD_SUGGESTIONS_STORE] Failed to load suggestions:",
      error
    );
    return null;
  }
}

/**
 * Save keyword suggestions to localStorage
 */
function saveSuggestions(state: KeywordSuggestionsState): boolean {
  try {
    return setLocalStorage(KEYWORD_SUGGESTIONS_KEY, JSON.stringify(state));
  } catch (error) {
    console.error(
      "[KEYWORD_SUGGESTIONS_STORE] Failed to save suggestions:",
      error
    );
    return false;
  }
}

/**
 * Get current suggestions state
 */
export function getSuggestionsState(): KeywordSuggestionsState | null {
  return loadSuggestions();
}

/**
 * Get unused keyword suggestions (up to DISPLAY_COUNT)
 */
export function getUnusedSuggestions(): KeywordSuggestion[] {
  const state = loadSuggestions();
  if (!state) return [];

  const unusedSuggestions = state.suggestions
    .filter((s) => !s.isUsed)
    .sort((a, b) => b.generatedAt - a.generatedAt); // Show newest first

  return unusedSuggestions.slice(0, SUGGESTIONS_CONFIG.DISPLAY_COUNT);
}

/**
 * Mark a keyword suggestion as used
 */
export function markSuggestionAsUsed(keyword: string): boolean {
  const state = loadSuggestions();
  if (!state) return false;

  const suggestion = state.suggestions.find(
    (s) => s.keyword === keyword && !s.isUsed
  );
  if (!suggestion) return false;

  suggestion.isUsed = true;
  suggestion.usedAt = getCurrentUTCTimestamp();

  const success = saveSuggestions(state);
  if (success) {
    console.log(
      "[KEYWORD_SUGGESTIONS_STORE] Marked suggestion as used:",
      keyword
    );
  }

  return success;
}

/**
 * Check if regeneration is needed
 */
export function shouldRegenerateSuggestions(): boolean {
  const state = loadSuggestions();
  if (!state) return true; // No state means we need initial generation

  const unusedCount = state.suggestions.filter((s) => !s.isUsed).length;
  return unusedCount <= SUGGESTIONS_CONFIG.MIN_UNUSED_FOR_REGENERATION;
}

/**
 * Store new keyword suggestions
 */
export function storeNewSuggestions(
  keywords: Array<{
    keyword: string;
    metadata?: KeywordSuggestion["metadata"];
  }>,
  userDescription: string
): boolean {
  const now = getCurrentUTCTimestamp();
  const state = loadSuggestions();

  // Create new suggestions
  const newSuggestions: KeywordSuggestion[] = keywords.map((kw, index) => ({
    id: generateUniqueId("suggestion"),
    keyword: kw.keyword,
    generatedAt: now + index, // Slight offset to maintain order
    isUsed: false,
    metadata: kw.metadata,
  }));

  // If we have existing state, keep some unused suggestions
  let finalSuggestions = newSuggestions;
  if (state) {
    const unusedExisting = state.suggestions.filter((s) => !s.isUsed);
    finalSuggestions = [...newSuggestions, ...unusedExisting]; // New suggestions first
  }

  const newState: KeywordSuggestionsState = {
    suggestions: finalSuggestions,
    lastGeneratedAt: now,
    userDescription,
    generationCount: (state?.generationCount || 0) + 1,
  };

  const success = saveSuggestions(newState);
  if (success) {
    console.log("[KEYWORD_SUGGESTIONS_STORE] Stored new suggestions:", {
      count: newSuggestions.length,
      totalSuggestions: finalSuggestions.length,
      unusedCount: finalSuggestions.filter((s) => !s.isUsed).length,
    });
  }

  return success;
}

/**
 * Clear all suggestions (useful for testing or reset)
 */
export function clearSuggestions(): boolean {
  try {
    return setLocalStorage(KEYWORD_SUGGESTIONS_KEY, "");
  } catch (error) {
    console.error(
      "[KEYWORD_SUGGESTIONS_STORE] Failed to clear suggestions:",
      error
    );
    return false;
  }
}

/**
 * Get statistics about current suggestions
 */
export function getSuggestionsStats(): {
  total: number;
  unused: number;
  used: number;
  lastGeneratedAt?: number;
  generationCount: number;
} {
  const state = loadSuggestions();
  if (!state) {
    return { total: 0, unused: 0, used: 0, generationCount: 0 };
  }

  const unused = state.suggestions.filter((s) => !s.isUsed).length;
  const used = state.suggestions.filter((s) => s.isUsed).length;

  return {
    total: state.suggestions.length,
    unused,
    used,
    lastGeneratedAt: state.lastGeneratedAt,
    generationCount: state.generationCount,
  };
}

/**
 * Check if user description has changed (needs regeneration)
 */
export function hasUserDescriptionChanged(userDescription: string): boolean {
  const state = loadSuggestions();
  if (!state) return true; // No state means we need generation

  return state.userDescription !== userDescription;
}
