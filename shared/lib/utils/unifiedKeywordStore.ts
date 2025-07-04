/**
 * Unified Keyword Store
 *
 * This module provides a single, unified system for managing all keyword-related
 * data in localStorage. It replaces the fragmented system of search history,
 * pinned keywords, and performance tracking with a single source of truth.
 *
 * Key principles:
 * - Single Source of Truth: All keyword data is stored in one place.
 * - Data Integrity: Operations like deletion are atomic and affect all aspects of a keyword.
 * - Clear Schema: A single, comprehensive `UnifiedKeyword` type.
 * - Easy Migration: Designed to be easily migrated to a database backend (like Convex) once
 *   authentication is implemented.
 *
 * References:
 * - "Single source of truth" principle: https://en.wikipedia.org/wiki/Single_source_of_truth
 * - Data-driven application design patterns
 */

import { getLocalStorage, setLocalStorage } from "./localStorage";
import { generateUniqueId } from "./request";
import { getCurrentUTCTimestamp } from "./timeUtils";

// The single key for all keyword data in localStorage
const UNIFIED_KEYWORDS_KEY = "reacherx_keywords_unified";

/**
 * The canonical representation of a keyword in the system.
 */
export interface UnifiedKeyword {
  id: string; // Unique ID, e.g., 'kw_...'
  keyword: string;

  // History Tracking
  createdAt: number; // UTC timestamp
  lastUsedAt: number; // UTC timestamp
  searchCount: number;

  // Search Settings
  exactMatch: boolean; // Whether this keyword was searched with exact phrase match

  // Pinned Status
  isPinned: boolean;
  pinnedAt?: number; // UTC timestamp

  // Performance Tracking
  source: "user_created" | "ai_suggestion" | "ai_reprompt";
  status: "active" | "high_value" | "discarded";
  votes: Array<{
    vote: "up" | "down";
    timestamp: number; // UTC timestamp
    tweetId?: string;
  }>;
  decayedScore: number;

  // Metadata from AI suggestions or other sources
  metadata?: {
    originalKeywordId?: string; // For legacy migration from pinned keywords
    rationale?: string;
    searchIntent?: string;
    confidence?: number;
    [key: string]: unknown; // Allow for other metadata, but not 'any'
  };
}

/**
 * Loads all keywords from localStorage.
 * @returns An array of UnifiedKeyword objects.
 */
function loadKeywords(): UnifiedKeyword[] {
  try {
    const stored = getLocalStorage(UNIFIED_KEYWORDS_KEY);
    if (!stored) return [];

    const keywords: UnifiedKeyword[] = JSON.parse(stored);

    // Basic validation to ensure we have an array
    if (!Array.isArray(keywords)) {
      console.warn(
        "[UnifiedKeywordStore] Stored data is not an array, resetting."
      );
      return [];
    }

    // Migrate existing keywords to include exactMatch property
    const migratedKeywords = keywords.map((keyword) => {
      if (keyword.exactMatch === undefined) {
        return {
          ...keyword,
          exactMatch: false, // Default to false for existing keywords
        };
      }
      return keyword;
    });

    // Save migrated keywords if any were updated
    if (
      migratedKeywords.length !== keywords.length ||
      migratedKeywords.some(
        (kw, i) => kw.exactMatch !== keywords[i]?.exactMatch
      )
    ) {
      saveKeywords(migratedKeywords);
      console.log(
        "[UnifiedKeywordStore] Migrated existing keywords to include exactMatch property"
      );
    }

    return migratedKeywords;
  } catch (error) {
    console.warn("[UnifiedKeywordStore] Failed to load keywords:", error);
    return [];
  }
}

/**
 * Saves an array of keywords to localStorage.
 * @param keywords The array of UnifiedKeyword objects to save.
 * @returns True if saving was successful, false otherwise.
 */
function saveKeywords(keywords: UnifiedKeyword[]): boolean {
  try {
    // Sort by lastUsedAt descending before saving to keep recent items easily accessible
    const sortedKeywords = keywords.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
    return setLocalStorage(
      UNIFIED_KEYWORDS_KEY,
      JSON.stringify(sortedKeywords)
    );
  } catch (error) {
    console.error("[UnifiedKeywordStore] Failed to save keywords:", error);
    return false;
  }
}

/**
 * Gets all keywords, sorted by most recently used.
 * @returns An array of all unified keywords.
 */
export function getKeywords(): UnifiedKeyword[] {
  return loadKeywords();
}

/**
 * Finds a keyword by its text and exact match setting.
 * This is useful for distinguishing between the same keyword searched with different exact match settings.
 * @param keyword The keyword text to search for.
 * @param exactMatch The exact match setting to match.
 * @returns The matching keyword or null if not found.
 */
export function findKeywordByTextAndExactMatch(
  keyword: string,
  exactMatch: boolean
): UnifiedKeyword | null {
  const keywords = loadKeywords();
  const normalizedKeyword = keyword.trim().toLowerCase();

  return (
    keywords.find(
      (k) =>
        k.keyword.toLowerCase() === normalizedKeyword &&
        k.exactMatch === exactMatch
    ) || null
  );
}

/**
 * Gets a keyword by its ID.
 * @param id The keyword ID to find.
 * @returns The keyword or null if not found.
 */
export function getKeywordById(id: string): UnifiedKeyword | null {
  const keywords = loadKeywords();
  return keywords.find((k) => k.id === id) || null;
}

/**
 * Finds an existing keyword or creates a new one, updating its usage stats.
 * This is the primary entry point for when a user performs a search.
 * @param keyword The keyword string that was used.
 * @param source The origin of the keyword.
 * @param exactMatch Whether the search was performed with exact phrase match.
 * @param metadata Optional metadata, especially for AI-generated keywords.
 * @returns The ID of the created or updated keyword.
 */
export function addOrUseKeyword(
  keyword: string,
  source: UnifiedKeyword["source"] = "user_created",
  exactMatch: boolean = false,
  metadata?: UnifiedKeyword["metadata"]
): string {
  const keywords = loadKeywords();
  const normalizedKeyword = keyword.trim().toLowerCase();
  const now = getCurrentUTCTimestamp();

  // For existing keywords, we need to handle the case where exactMatch might not be stored
  // If the keyword exists but doesn't have exactMatch property, we'll update it
  const existing = keywords.find(
    (k) => k.keyword.toLowerCase() === normalizedKeyword
  );

  if (existing) {
    existing.lastUsedAt = now;
    existing.searchCount += 1;
    // Update exactMatch if it's not set or if it's different
    if (
      existing.exactMatch === undefined ||
      existing.exactMatch !== exactMatch
    ) {
      existing.exactMatch = exactMatch;
    }
  } else {
    const newKeyword: UnifiedKeyword = {
      id: generateUniqueId("kw"),
      keyword: keyword.trim(),
      createdAt: now,
      lastUsedAt: now,
      searchCount: 1,
      exactMatch,
      isPinned: false,
      source,
      status: "active",
      votes: [],
      decayedScore: 0,
      metadata,
    };
    keywords.push(newKeyword);
  }

  saveKeywords(keywords);
  return existing?.id || keywords[keywords.length - 1].id;
}

/**
 * Toggles the pinned state of a keyword.
 * @param id The ID of the keyword to pin/unpin.
 * @returns True if the operation was successful.
 */
export function togglePin(id: string): boolean {
  const keywords = loadKeywords();
  const keyword = keywords.find((k) => k.id === id);

  if (!keyword) {
    console.warn(`[UnifiedKeywordStore] Keyword with ID "${id}" not found.`);
    return false;
  }

  keyword.isPinned = !keyword.isPinned;
  keyword.pinnedAt = keyword.isPinned ? getCurrentUTCTimestamp() : undefined;

  return saveKeywords(keywords);
}

/**
 * Deletes a keyword from the store permanently.
 * @param id The ID of the keyword to delete.
 * @returns True if the operation was successful.
 */
export function deleteKeyword(id: string): boolean {
  const keywords = loadKeywords();
  const initialCount = keywords.length;
  const filteredKeywords = keywords.filter((k) => k.id !== id);

  if (initialCount === filteredKeywords.length) {
    console.warn(
      `[UnifiedKeywordStore] Delete failed: Keyword with ID "${id}" not found.`
    );
    return false;
  }

  return saveKeywords(filteredKeywords);
}

// --- Performance Tracking ---

const VOTE_WEIGHTS = {
  up: 1,
  down: -1.5, // Downvotes have a stronger negative impact
};
const DECAY_RATE = 0.05; // Per day

/**
 * Calculates a time-decayed score for a keyword based on its votes.
 * More recent votes have a greater impact.
 */
function calculateDecayedScore(keyword: UnifiedKeyword): number {
  const now = Date.now();
  let score = 0;

  keyword.votes.forEach((vote) => {
    const daysOld = (now - vote.timestamp) / (1000 * 60 * 60 * 24);
    const decayFactor = Math.exp(-DECAY_RATE * daysOld);
    const voteValue = VOTE_WEIGHTS[vote.vote];
    score += voteValue * decayFactor;
  });

  return score;
}

/**
 * Determines the status of a keyword based on its score.
 */
function getStatusFromScore(score: number): UnifiedKeyword["status"] {
  if (score > 2) return "high_value";
  if (score < -2) return "discarded";
  return "active";
}

/**
 * Records a vote for a specific keyword and updates its performance metrics.
 * @param keywordId The ID of the keyword to vote on.
 * @param vote The type of vote ('up' or 'down').
 * @param metadata Optional metadata like the tweet ID.
 * @returns True if the vote was successfully recorded.
 */
export function recordVote(
  keywordId: string,
  vote: "up" | "down",
  metadata?: { tweetId?: string }
): boolean {
  const keywords = loadKeywords();
  const keyword = keywords.find((k) => k.id === keywordId);

  if (!keyword) {
    console.warn(
      `[UnifiedKeywordStore] Cannot vote: Keyword with ID "${keywordId}" not found.`
    );
    return false;
  }

  // Add the new vote
  keyword.votes.push({
    vote,
    timestamp: getCurrentUTCTimestamp(),
    tweetId: metadata?.tweetId,
  });

  // Recalculate score and update status
  keyword.decayedScore = calculateDecayedScore(keyword);
  keyword.status = getStatusFromScore(keyword.decayedScore);

  console.log(
    `[UnifiedKeywordStore] Voted ${vote} on "${keyword.keyword}". New score: ${keyword.decayedScore.toFixed(
      2
    )}, Status: ${keyword.status}`
  );

  return saveKeywords(keywords);
}

// --- Re-Prompting Logic ---

/**
 * Retrieves keywords that have been flagged for re-prompting due to performance.
 * Flagged keywords are those with a 'high_value' or 'discarded' status.
 * @returns An array of flagged UnifiedKeyword objects.
 */
export function getFlaggedKeywords(): UnifiedKeyword[] {
  const keywords = loadKeywords();
  return keywords.filter(
    (kw) => kw.status === "high_value" || kw.status === "discarded"
  );
}

/**
 * Resets the status of specified keywords back to 'active'.
 * This is typically done after they have been used in a re-prompt action.
 * @param keywordIds An array of keyword IDs to clear flags for.
 * @returns True if the operation was successful.
 */
export function clearKeywordFlags(keywordIds: string[]): boolean {
  const keywords = loadKeywords();
  const idsToClear = new Set(keywordIds);
  let changed = false;

  keywords.forEach((kw) => {
    if (idsToClear.has(kw.id)) {
      kw.status = "active";
      changed = true;
    }
  });

  return changed ? saveKeywords(keywords) : true;
}
