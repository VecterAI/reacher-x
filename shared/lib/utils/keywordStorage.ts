/**
 * Keyword Performance Tracking System
 *
 * This module implements a robust localStorage-based keyword performance tracking system
 * with time-decay voting, threshold management, and performance analytics.
 *
 * Features:
 * - Time-decay voting (older votes have less impact)
 * - Performance thresholds for promotion/discarding
 * - Keyword uniqueness enforcement
 * - Fast suggestion serving
 * - Comprehensive analytics
 *
 * References:
 * - Time decay algorithms: https://en.wikipedia.org/wiki/Exponential_decay
 * - Recommendation systems: "Recommender Systems Handbook" by Ricci et al.
 * - Performance tracking: Netflix's approach to A/B testing and personalization
 */

import {
  getLocalStorage,
  setLocalStorage,
  removeLocalStorage,
} from "./localStorage";

// Storage keys
export const KEYWORD_STORAGE_KEYS = {
  KEYWORD_PERFORMANCE: "keyword_performance_data",
  KEYWORD_SUGGESTIONS: "keyword_suggestions_cache",
  KEYWORD_SETTINGS: "keyword_settings",
} as const;

// Configuration constants
export const KEYWORD_CONFIG = {
  // Performance thresholds
  UP_THRESHOLD: 0.7, // Keywords above this are high-value
  DOWN_THRESHOLD: 0.3, // Keywords below this are discarded

  // Time decay parameters (exponential decay)
  DECAY_HALF_LIFE_DAYS: 7, // Votes lose half their weight after 7 days

  // Similarity threshold for duplicate detection
  SIMILARITY_THRESHOLD: 0.8, // Keywords with >80% similarity are considered duplicates

  // Cache and performance settings
  MAX_KEYWORDS_TRACKED: 100, // Maximum keywords to track performance for
  SUGGESTION_CACHE_TTL_MS: 30 * 60 * 1000, // 30 minutes

  // Minimum votes required before applying thresholds
  MIN_VOTES_FOR_THRESHOLD: 5,
} as const;

// Types for keyword performance tracking
export interface KeywordVote {
  id: string;
  keywordId: string;
  vote: "up" | "down"; // 👍 or 👎
  timestamp: number; // Unix timestamp
  tweetId?: string; // Optional: which tweet was voted on
  searchQuery?: string; // Optional: search query that led to this result
}

export interface KeywordPerformance {
  id: string;
  keyword: string;
  votes: KeywordVote[];

  // Computed metrics
  totalVotes: number;
  upVotes: number;
  downVotes: number;

  // Time-decayed scores
  decayedScore: number; // Current score with time decay applied
  decayedUpScore: number; // Decayed positive votes
  decayedDownScore: number; // Decayed negative votes

  // Status and metadata
  status: "active" | "high_value" | "discarded";
  lastVoteTimestamp: number;
  createdAt: number;
  flaggedForRePrompt?: boolean; // True when status changes

  // Generation metadata
  source: "generated" | "user_created";
  generationRequestId?: string;
  originalConfidence?: number;
  searchIntent?: string;
}

export interface KeywordSettings {
  upThreshold: number;
  downThreshold: number;
  decayHalfLifeDays: number;
  minVotesForThreshold: number;
}

export interface KeywordSuggestionCache {
  suggestions: Array<{
    id: string;
    keyword: string;
    timestamp?: string;
    metadata?: Record<string, unknown>;
  }>;
  cachedAt: number;
  userDescriptionHash: string; // To invalidate when description changes
}

/**
 * Calculate time decay factor using exponential decay
 * Based on half-life formula: decay = 0.5^(age_days / half_life_days)
 *
 * Reference: https://en.wikipedia.org/wiki/Exponential_decay
 */
function calculateDecayFactor(
  timestamp: number,
  halfLifeDays: number = KEYWORD_CONFIG.DECAY_HALF_LIFE_DAYS
): number {
  const now = Date.now();
  const ageDays = (now - timestamp) / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, ageDays / halfLifeDays);
}

/**
 * Calculate keyword similarity using Levenshtein distance
 * Used for duplicate detection and keyword uniqueness
 *
 * Reference: "Introduction to Information Retrieval" by Manning, Raghavan, and Schütze
 */
function calculateKeywordSimilarity(
  keyword1: string,
  keyword2: string
): number {
  const s1 = keyword1.toLowerCase().trim();
  const s2 = keyword2.toLowerCase().trim();

  if (s1 === s2) return 1.0;

  // Simple word overlap similarity for performance
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);

  const allWords = new Set([...words1, ...words2]);
  const commonWords = words1.filter((word) => words2.includes(word));

  return commonWords.length / allWords.size;
}

/**
 * Get current keyword settings with fallbacks
 */
export function getKeywordSettings(): KeywordSettings {
  try {
    const stored = getLocalStorage(KEYWORD_STORAGE_KEYS.KEYWORD_SETTINGS);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        upThreshold: parsed.upThreshold ?? KEYWORD_CONFIG.UP_THRESHOLD,
        downThreshold: parsed.downThreshold ?? KEYWORD_CONFIG.DOWN_THRESHOLD,
        decayHalfLifeDays:
          parsed.decayHalfLifeDays ?? KEYWORD_CONFIG.DECAY_HALF_LIFE_DAYS,
        minVotesForThreshold:
          parsed.minVotesForThreshold ?? KEYWORD_CONFIG.MIN_VOTES_FOR_THRESHOLD,
      };
    }
  } catch (error) {
    console.warn("Failed to parse keyword settings:", error);
  }

  return {
    upThreshold: KEYWORD_CONFIG.UP_THRESHOLD,
    downThreshold: KEYWORD_CONFIG.DOWN_THRESHOLD,
    decayHalfLifeDays: KEYWORD_CONFIG.DECAY_HALF_LIFE_DAYS,
    minVotesForThreshold: KEYWORD_CONFIG.MIN_VOTES_FOR_THRESHOLD,
  };
}

/**
 * Save keyword settings
 */
export function saveKeywordSettings(
  settings: Partial<KeywordSettings>
): boolean {
  const current = getKeywordSettings();
  const updated = { ...current, ...settings };
  return setLocalStorage(
    KEYWORD_STORAGE_KEYS.KEYWORD_SETTINGS,
    JSON.stringify(updated)
  );
}

/**
 * Get all keyword performance data
 */
export function getAllKeywordPerformance(): KeywordPerformance[] {
  try {
    const stored = getLocalStorage(KEYWORD_STORAGE_KEYS.KEYWORD_PERFORMANCE);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.map(updateKeywordMetrics);
      }
    }
  } catch (error) {
    console.warn("Failed to parse keyword performance data:", error);
  }

  return [];
}

/**
 * Save keyword performance data
 */
function saveKeywordPerformance(keywords: KeywordPerformance[]): boolean {
  // Limit the number of keywords tracked to prevent localStorage bloat
  const limitedKeywords = keywords
    .sort((a, b) => b.lastVoteTimestamp - a.lastVoteTimestamp)
    .slice(0, KEYWORD_CONFIG.MAX_KEYWORDS_TRACKED);

  return setLocalStorage(
    KEYWORD_STORAGE_KEYS.KEYWORD_PERFORMANCE,
    JSON.stringify(limitedKeywords)
  );
}

/**
 * Update keyword metrics with current decay calculations
 */
function updateKeywordMetrics(keyword: KeywordPerformance): KeywordPerformance {
  const settings = getKeywordSettings();

  // Calculate time-decayed scores
  let decayedUpScore = 0;
  let decayedDownScore = 0;

  keyword.votes.forEach((vote) => {
    const decayFactor = calculateDecayFactor(
      vote.timestamp,
      settings.decayHalfLifeDays
    );
    if (vote.vote === "up") {
      decayedUpScore += decayFactor;
    } else {
      decayedDownScore += decayFactor;
    }
  });

  const totalDecayedVotes = decayedUpScore + decayedDownScore;
  const decayedScore =
    totalDecayedVotes > 0 ? decayedUpScore / totalDecayedVotes : 0;

  // Count raw votes
  const upVotes = keyword.votes.filter((v) => v.vote === "up").length;
  const downVotes = keyword.votes.filter((v) => v.vote === "down").length;
  const totalVotes = upVotes + downVotes;

  // Determine status based on thresholds
  let status: KeywordPerformance["status"] = keyword.status;
  const prevStatus = status;

  if (totalVotes >= settings.minVotesForThreshold) {
    if (decayedScore >= settings.upThreshold) {
      status = "high_value";
    } else if (decayedScore <= settings.downThreshold) {
      status = "discarded";
    } else {
      status = "active";
    }
  }

  // Flag for re-prompt if status changed
  const flaggedForRePrompt =
    keyword.flaggedForRePrompt || prevStatus !== status;

  return {
    ...keyword,
    totalVotes,
    upVotes,
    downVotes,
    decayedScore,
    decayedUpScore,
    decayedDownScore,
    status,
    flaggedForRePrompt,
  };
}

/**
 * Add a new keyword to performance tracking
 */
export function addKeywordToTracking(
  keyword: string,
  metadata: {
    source: "generated" | "user_created";
    generationRequestId?: string;
    originalConfidence?: number;
    searchIntent?: string;
  }
): string {
  const keywords = getAllKeywordPerformance();
  const keywordId = `keyword_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Check for duplicates
  const existingKeyword = keywords.find(
    (k) =>
      calculateKeywordSimilarity(k.keyword, keyword) >=
      KEYWORD_CONFIG.SIMILARITY_THRESHOLD
  );

  if (existingKeyword) {
    console.log(
      `[KEYWORD_TRACKING] Duplicate keyword detected: "${keyword}" similar to "${existingKeyword.keyword}"`
    );
    return existingKeyword.id;
  }

  const newKeyword: KeywordPerformance = {
    id: keywordId,
    keyword: keyword.trim(),
    votes: [],
    totalVotes: 0,
    upVotes: 0,
    downVotes: 0,
    decayedScore: 0,
    decayedUpScore: 0,
    decayedDownScore: 0,
    status: "active",
    lastVoteTimestamp: Date.now(),
    createdAt: Date.now(),
    source: metadata.source,
    generationRequestId: metadata.generationRequestId,
    originalConfidence: metadata.originalConfidence,
    searchIntent: metadata.searchIntent,
  };

  keywords.push(newKeyword);
  saveKeywordPerformance(keywords);

  console.log(
    `[KEYWORD_TRACKING] Added new keyword: "${keyword}" with ID: ${keywordId}`
  );
  return keywordId;
}

/**
 * Record a vote for a keyword
 */
export function recordKeywordVote(
  keywordId: string,
  vote: "up" | "down",
  metadata?: {
    tweetId?: string;
    searchQuery?: string;
  }
): boolean {
  const keywords = getAllKeywordPerformance();
  const keywordIndex = keywords.findIndex((k) => k.id === keywordId);

  if (keywordIndex === -1) {
    console.warn(
      `[KEYWORD_TRACKING] Keyword not found for voting: ${keywordId}`
    );
    return false;
  }

  const voteId = `vote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const newVote: KeywordVote = {
    id: voteId,
    keywordId,
    vote,
    timestamp: Date.now(),
    tweetId: metadata?.tweetId,
    searchQuery: metadata?.searchQuery,
  };

  keywords[keywordIndex].votes.push(newVote);
  keywords[keywordIndex].lastVoteTimestamp = Date.now();

  // Update metrics and save
  keywords[keywordIndex] = updateKeywordMetrics(keywords[keywordIndex]);
  saveKeywordPerformance(keywords);

  console.log(
    `[KEYWORD_TRACKING] Recorded ${vote} vote for keyword: ${keywords[keywordIndex].keyword}`
  );
  return true;
}

/**
 * Get high-value keywords for suggestions
 */
export function getHighValueKeywords(): KeywordPerformance[] {
  return getAllKeywordPerformance()
    .filter((k) => k.status === "high_value")
    .sort((a, b) => b.decayedScore - a.decayedScore);
}

/**
 * Get active keywords (not discarded, available for suggestions)
 */
export function getActiveKeywords(): KeywordPerformance[] {
  return getAllKeywordPerformance()
    .filter((k) => k.status !== "discarded")
    .sort((a, b) => b.decayedScore - a.decayedScore);
}

/**
 * Cache keyword suggestions
 */
export function cacheKeywordSuggestions(
  suggestions: KeywordSuggestionCache["suggestions"],
  userDescriptionHash: string
): boolean {
  const cache: KeywordSuggestionCache = {
    suggestions,
    cachedAt: Date.now(),
    userDescriptionHash,
  };

  return setLocalStorage(
    KEYWORD_STORAGE_KEYS.KEYWORD_SUGGESTIONS,
    JSON.stringify(cache)
  );
}

/**
 * Get cached keyword suggestions if still valid
 */
export function getCachedKeywordSuggestions(
  userDescriptionHash: string
): KeywordSuggestionCache["suggestions"] | null {
  try {
    const stored = getLocalStorage(KEYWORD_STORAGE_KEYS.KEYWORD_SUGGESTIONS);
    if (stored) {
      const cache: KeywordSuggestionCache = JSON.parse(stored);

      // Check if cache is still valid
      const isValid =
        cache.userDescriptionHash === userDescriptionHash &&
        Date.now() - cache.cachedAt < KEYWORD_CONFIG.SUGGESTION_CACHE_TTL_MS;

      if (isValid) {
        return cache.suggestions;
      }
    }
  } catch (error) {
    console.warn("Failed to parse cached keyword suggestions:", error);
  }

  return null;
}

/**
 * Get keywords flagged for re-prompting
 */
export function getKeywordsFlaggedForRePrompt(): KeywordPerformance[] {
  return getAllKeywordPerformance().filter((k) => k.flaggedForRePrompt);
}

/**
 * Clear re-prompt flags for keywords
 */
export function clearRePromptFlags(keywordIds: string[]): boolean {
  const keywords = getAllKeywordPerformance();
  let updated = false;

  keywords.forEach((keyword) => {
    if (keywordIds.includes(keyword.id) && keyword.flaggedForRePrompt) {
      keyword.flaggedForRePrompt = false;
      updated = true;
    }
  });

  if (updated) {
    return saveKeywordPerformance(keywords);
  }

  return true;
}

/**
 * Get keyword performance analytics
 */
export interface KeywordAnalytics {
  totalKeywords: number;
  activeKeywords: number;
  highValueKeywords: number;
  discardedKeywords: number;
  totalVotes: number;
  avgDecayedScore: number;
  flaggedForRePrompt: number;
  oldestKeyword?: {
    keyword: string;
    createdAt: number;
  };
  topPerformer?: {
    keyword: string;
    decayedScore: number;
  };
}

export function getKeywordAnalytics(): KeywordAnalytics {
  const keywords = getAllKeywordPerformance();

  const analytics: KeywordAnalytics = {
    totalKeywords: keywords.length,
    activeKeywords: keywords.filter((k) => k.status === "active").length,
    highValueKeywords: keywords.filter((k) => k.status === "high_value").length,
    discardedKeywords: keywords.filter((k) => k.status === "discarded").length,
    totalVotes: keywords.reduce((sum, k) => sum + k.totalVotes, 0),
    avgDecayedScore:
      keywords.length > 0
        ? keywords.reduce((sum, k) => sum + k.decayedScore, 0) / keywords.length
        : 0,
    flaggedForRePrompt: keywords.filter((k) => k.flaggedForRePrompt).length,
  };

  // Find oldest keyword
  const oldestKeyword = keywords.reduce(
    (oldest, k) => (!oldest || k.createdAt < oldest.createdAt ? k : oldest),
    null as KeywordPerformance | null
  );

  if (oldestKeyword) {
    analytics.oldestKeyword = {
      keyword: oldestKeyword.keyword,
      createdAt: oldestKeyword.createdAt,
    };
  }

  // Find top performer
  const topPerformer = keywords.reduce(
    (top, k) => (!top || k.decayedScore > top.decayedScore ? k : top),
    null as KeywordPerformance | null
  );

  if (topPerformer) {
    analytics.topPerformer = {
      keyword: topPerformer.keyword,
      decayedScore: topPerformer.decayedScore,
    };
  }

  return analytics;
}

/**
 * Clear all keyword performance data
 */
export function clearAllKeywordData(): boolean {
  const removed1 = removeLocalStorage(KEYWORD_STORAGE_KEYS.KEYWORD_PERFORMANCE);
  const removed2 = removeLocalStorage(KEYWORD_STORAGE_KEYS.KEYWORD_SUGGESTIONS);
  const removed3 = removeLocalStorage(KEYWORD_STORAGE_KEYS.KEYWORD_SETTINGS);

  return removed1 && removed2 && removed3;
}

/**
 * Simple hash function for user descriptions
 * Used to invalidate cache when description changes
 */
export function hashUserDescription(description: string): string {
  let hash = 0;
  for (let i = 0; i < description.length; i++) {
    const char = description.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
}
