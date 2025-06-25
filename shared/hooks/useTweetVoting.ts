/**
 * Tweet Voting Hook
 *
 * Integrates tweet voting with keyword performance tracking system.
 * Implements best practices from recommendation systems and user feedback loops.
 *
 * References:
 * - "Recommender Systems Handbook" by Ricci et al. - Chapter on implicit feedback
 * - Netflix's approach to user feedback: https://netflixtechblog.com/netflix-recommendations-beyond-the-5-stars-part-1-55838468f429
 * - Spotify's feedback loop implementation: https://engineering.atspotify.com/2022/03/introducing-natural-language-search-for-podcast-episodes/
 */

"use client";

import { useState, useCallback, useRef } from "react";
import { recordKeywordVote } from "@/shared/lib/utils/keywordStorage";

export interface TweetVote {
  id: string;
  tweetId: string;
  keywordId: string;
  vote: "up" | "down";
  timestamp: number;
  searchQuery: string;
  // Additional metadata for future analytics
  tweetMetrics?: {
    likes?: number;
    retweets?: number;
    replies?: number;
    views?: number;
  };
}

export interface TweetVotingState {
  // Current vote states for tweets
  votes: Record<string, "up" | "down">;

  // Loading states
  voting: Record<string, boolean>;

  // Error handling
  errors: Record<string, string>;
}

export interface UseTweetVotingReturn {
  // State
  votes: Record<string, "up" | "down">;
  isVoting: (tweetId: string) => boolean;
  getVoteError: (tweetId: string) => string | null;

  // Actions
  vote: (params: {
    tweetId: string;
    keywordId: string;
    vote: "up" | "down";
    searchQuery: string;
    tweetMetrics?: TweetVote["tweetMetrics"];
  }) => Promise<boolean>;

  // Utilities
  hasVoted: (tweetId: string) => boolean;
  getVote: (tweetId: string) => "up" | "down" | null;
  clearError: (tweetId: string) => void;

  // Analytics helpers
  getVoteStats: () => {
    totalVotes: number;
    upVotes: number;
    downVotes: number;
    votingAccuracy: number;
  };
}

// Local storage key for vote persistence
const VOTE_STORAGE_KEY = "reacherx_tweet_votes";
const VOTE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface StoredVote {
  tweetId: string;
  keywordId: string;
  vote: "up" | "down";
  timestamp: number;
  searchQuery: string;
  tweetMetrics?: TweetVote["tweetMetrics"];
}

interface VoteCache {
  votes: StoredVote[];
  lastUpdated: number;
}

/**
 * Load votes from localStorage with TTL check
 */
function loadStoredVotes(): Record<string, "up" | "down"> {
  try {
    const stored = localStorage.getItem(VOTE_STORAGE_KEY);
    if (!stored) return {};

    const cache: VoteCache = JSON.parse(stored);

    // Check TTL
    if (Date.now() - cache.lastUpdated > VOTE_CACHE_TTL_MS) {
      localStorage.removeItem(VOTE_STORAGE_KEY);
      return {};
    }

    // Convert to lookup map
    const voteMap: Record<string, "up" | "down"> = {};
    cache.votes.forEach((vote) => {
      voteMap[vote.tweetId] = vote.vote;
    });

    return voteMap;
  } catch (error) {
    console.warn("Failed to load stored votes:", error);
    return {};
  }
}

/**
 * Save vote to localStorage
 */
function saveVote(vote: StoredVote): void {
  try {
    const stored = localStorage.getItem(VOTE_STORAGE_KEY);
    let cache: VoteCache;

    if (stored) {
      cache = JSON.parse(stored);
      // Remove existing vote for this tweet if any
      cache.votes = cache.votes.filter((v) => v.tweetId !== vote.tweetId);
    } else {
      cache = { votes: [], lastUpdated: Date.now() };
    }

    // Add new vote
    cache.votes.push(vote);
    cache.lastUpdated = Date.now();

    // Limit cache size (keep last 1000 votes)
    if (cache.votes.length > 1000) {
      cache.votes = cache.votes
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 1000);
    }

    localStorage.setItem(VOTE_STORAGE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn("Failed to save vote:", error);
  }
}

/**
 * Hook for managing tweet voting with keyword performance integration
 */
export function useTweetVoting(): UseTweetVotingReturn {
  // Initialize state from localStorage
  const [state, setState] = useState<TweetVotingState>(() => ({
    votes: loadStoredVotes(),
    voting: {},
    errors: {},
  }));

  // Track voting operations to prevent duplicate requests
  const votingOperations = useRef<Set<string>>(new Set());

  const vote = useCallback(
    async (params: {
      tweetId: string;
      keywordId: string;
      vote: "up" | "down";
      searchQuery: string;
      tweetMetrics?: TweetVote["tweetMetrics"];
    }): Promise<boolean> => {
      const {
        tweetId,
        keywordId,
        vote: voteType,
        searchQuery,
        tweetMetrics,
      } = params;

      // Prevent duplicate voting operations
      const operationKey = `${tweetId}_${voteType}`;
      if (votingOperations.current.has(operationKey)) {
        console.log(
          `[TWEET_VOTING] Duplicate vote operation prevented for tweet ${tweetId}`
        );
        return false;
      }

      votingOperations.current.add(operationKey);

      try {
        // Set loading state
        setState((prev) => ({
          ...prev,
          voting: { ...prev.voting, [tweetId]: true },
          errors: { ...prev.errors, [tweetId]: "" },
        }));

        console.log(
          `[TWEET_VOTING] Recording ${voteType} vote for tweet ${tweetId} from keyword ${keywordId}`
        );

        // Record vote in keyword performance system
        const success = recordKeywordVote(keywordId, voteType, {
          tweetId,
          searchQuery,
        });

        if (!success) {
          throw new Error(`Failed to record vote for keyword ${keywordId}`);
        }

        // Create vote record for local storage
        const voteRecord: StoredVote = {
          tweetId,
          keywordId,
          vote: voteType,
          timestamp: Date.now(),
          searchQuery,
          tweetMetrics,
        };

        // Save to localStorage
        saveVote(voteRecord);

        // Update state
        setState((prev) => ({
          ...prev,
          votes: { ...prev.votes, [tweetId]: voteType },
          voting: { ...prev.voting, [tweetId]: false },
        }));

        console.log(
          `[TWEET_VOTING] Successfully recorded ${voteType} vote for tweet ${tweetId}`
        );
        return true;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to record vote";

        console.error(
          `[TWEET_VOTING] Failed to record vote for tweet ${tweetId}:`,
          error
        );

        setState((prev) => ({
          ...prev,
          voting: { ...prev.voting, [tweetId]: false },
          errors: { ...prev.errors, [tweetId]: errorMessage },
        }));

        return false;
      } finally {
        votingOperations.current.delete(operationKey);
      }
    },
    []
  );

  const isVoting = useCallback(
    (tweetId: string): boolean => {
      return state.voting[tweetId] || false;
    },
    [state.voting]
  );

  const getVoteError = useCallback(
    (tweetId: string): string | null => {
      return state.errors[tweetId] || null;
    },
    [state.errors]
  );

  const hasVoted = useCallback(
    (tweetId: string): boolean => {
      return tweetId in state.votes;
    },
    [state.votes]
  );

  const getVote = useCallback(
    (tweetId: string): "up" | "down" | null => {
      return state.votes[tweetId] || null;
    },
    [state.votes]
  );

  const clearError = useCallback((tweetId: string): void => {
    setState((prev) => ({
      ...prev,
      errors: { ...prev.errors, [tweetId]: "" },
    }));
  }, []);

  const getVoteStats = useCallback(() => {
    const votes = Object.values(state.votes);
    const totalVotes = votes.length;
    const upVotes = votes.filter((v) => v === "up").length;
    const downVotes = votes.filter((v) => v === "down").length;

    // Calculate voting accuracy (could be enhanced with actual conversion data)
    const votingAccuracy = totalVotes > 0 ? upVotes / totalVotes : 0;

    return {
      totalVotes,
      upVotes,
      downVotes,
      votingAccuracy,
    };
  }, [state.votes]);

  return {
    // State
    votes: state.votes,
    isVoting,
    getVoteError,

    // Actions
    vote,

    // Utilities
    hasVoted,
    getVote,
    clearError,

    // Analytics
    getVoteStats,
  };
}

/**
 * Get cached vote statistics for analytics
 */
export function getCachedVoteStatistics(): {
  totalVotes: number;
  upVotes: number;
  downVotes: number;
  recentVotes: number;
} {
  try {
    const stored = localStorage.getItem(VOTE_STORAGE_KEY);
    if (!stored) {
      return { totalVotes: 0, upVotes: 0, downVotes: 0, recentVotes: 0 };
    }

    const cache: VoteCache = JSON.parse(stored);
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const totalVotes = cache.votes.length;
    const upVotes = cache.votes.filter((v) => v.vote === "up").length;
    const downVotes = cache.votes.filter((v) => v.vote === "down").length;
    const recentVotes = cache.votes.filter(
      (v) => v.timestamp > oneHourAgo
    ).length;

    return { totalVotes, upVotes, downVotes, recentVotes };
  } catch (error) {
    console.warn("Failed to get cached vote statistics:", error);
    return { totalVotes: 0, upVotes: 0, downVotes: 0, recentVotes: 0 };
  }
}
