/**
 * Keyword Conflict Resolution System
 *
 * Handles complex edge cases and conflicts when syncing keyword data
 * between localStorage and Convex. Implements robust conflict resolution
 * strategies based on data freshness, user intent, and data integrity.
 */

import { UnifiedKeyword } from "./unifiedKeywordStore";
import { logger } from "../logger";

export interface ConflictResolutionStrategy {
  strategy:
    | "local_wins"
    | "remote_wins"
    | "merge"
    | "timestamp_based"
    | "user_intent";
  reason: string;
  confidence: number; // 0-1 scale
}

export interface ConflictResolutionResult {
  resolved: boolean;
  strategy: ConflictResolutionStrategy;
  resolvedData: UnifiedKeyword;
  conflicts: Array<{
    field: string;
    localValue: unknown;
    remoteValue: unknown;
    resolution: string;
  }>;
}

export interface SyncConflict {
  keyword: string;
  exactMatch: boolean;
  localData: UnifiedKeyword;
  remoteData: UnifiedKeyword;
  conflictFields: string[];
  timestamp: number;
}

/**
 * Detects conflicts between local and remote keyword data
 */
export function detectConflicts(
  localKeywords: UnifiedKeyword[],
  remoteKeywords: UnifiedKeyword[]
): SyncConflict[] {
  const conflicts: SyncConflict[] = [];
  const localMap = new Map(
    localKeywords.map((kw) => [`${kw.keyword}:${kw.exactMatch}`, kw])
  );
  const remoteMap = new Map(
    remoteKeywords.map((kw) => [`${kw.keyword}:${kw.exactMatch}`, kw])
  );

  // Check for conflicts in existing keywords
  for (const [key, localKw] of localMap) {
    const remoteKw = remoteMap.get(key);
    if (remoteKw) {
      const conflictFields = findConflictFields(localKw, remoteKw);
      if (conflictFields.length > 0) {
        conflicts.push({
          keyword: localKw.keyword,
          exactMatch: localKw.exactMatch,
          localData: localKw,
          remoteData: remoteKw,
          conflictFields,
          timestamp: Date.now(),
        });
      }
    }
  }

  return conflicts;
}

/**
 * Finds fields that have conflicting values between local and remote data
 */
function findConflictFields(
  local: UnifiedKeyword,
  remote: UnifiedKeyword
): string[] {
  const conflicts: string[] = [];

  // Critical fields that should always be checked
  const criticalFields: (keyof UnifiedKeyword)[] = [
    "lastUsedAt",
    "searchCount",
    "isPinned",
    "decayedScore",
    "status",
  ];

  for (const field of criticalFields) {
    if (local[field] !== remote[field]) {
      conflicts.push(field);
    }
  }

  // Check votes array for conflicts
  if (JSON.stringify(local.votes) !== JSON.stringify(remote.votes)) {
    conflicts.push("votes");
  }

  // Check metadata for conflicts
  if (JSON.stringify(local.metadata) !== JSON.stringify(remote.metadata)) {
    conflicts.push("metadata");
  }

  return conflicts;
}

/**
 * Resolves a single keyword conflict using multiple strategies
 */
export function resolveKeywordConflict(
  conflict: SyncConflict
): ConflictResolutionResult {
  const { localData, remoteData, conflictFields } = conflict;

  // Strategy 1: Check for data corruption or invalid states
  const corruptionCheck = checkForDataCorruption(localData, remoteData);
  if (corruptionCheck.hasCorruption) {
    return {
      resolved: true,
      strategy: {
        strategy: "user_intent",
        reason: "Data corruption detected, using valid data",
        confidence: 0.9,
      },
      resolvedData: corruptionCheck.validData,
      conflicts: conflictFields.map((field) => ({
        field,
        localValue: localData[field as keyof UnifiedKeyword],
        remoteValue: remoteData[field as keyof UnifiedKeyword],
        resolution: "corruption_fix",
      })),
    };
  }

  // Strategy 2: Timestamp-based resolution for recent activity
  const timestampStrategy = resolveByTimestamp(
    localData,
    remoteData,
    conflictFields
  );
  if (timestampStrategy.strategy.confidence > 0.8) {
    return timestampStrategy;
  }

  // Strategy 3: User intent-based resolution
  const intentStrategy = resolveByUserIntent(
    localData,
    remoteData,
    conflictFields
  );
  if (intentStrategy.strategy.confidence > 0.7) {
    return intentStrategy;
  }

  // Strategy 4: Merge strategy for complementary data
  const mergeStrategy = resolveByMerge(localData, remoteData, conflictFields);
  if (mergeStrategy.strategy.confidence > 0.6) {
    return mergeStrategy;
  }

  // Fallback: Local wins (most recent user action)
  return {
    resolved: true,
    strategy: {
      strategy: "local_wins",
      reason: "Fallback to local data as most recent user action",
      confidence: 0.5,
    },
    resolvedData: localData,
    conflicts: conflictFields.map((field) => ({
      field,
      localValue: localData[field as keyof UnifiedKeyword],
      remoteValue: remoteData[field as keyof UnifiedKeyword],
      resolution: "local_wins",
    })),
  };
}

/**
 * Checks for data corruption and returns valid data
 */
function checkForDataCorruption(
  local: UnifiedKeyword,
  remote: UnifiedKeyword
): { hasCorruption: boolean; validData: UnifiedKeyword } {
  // Check for invalid timestamps
  const now = Date.now();
  const localValid = local.lastUsedAt <= now && local.createdAt <= now;
  const remoteValid = remote.lastUsedAt <= now && remote.createdAt <= now;

  if (!localValid && remoteValid) {
    return { hasCorruption: true, validData: remote };
  }
  if (localValid && !remoteValid) {
    return { hasCorruption: true, validData: local };
  }

  // Check for invalid search counts
  if (local.searchCount < 0 && remote.searchCount >= 0) {
    return { hasCorruption: true, validData: remote };
  }
  if (remote.searchCount < 0 && local.searchCount >= 0) {
    return { hasCorruption: true, validData: local };
  }

  // Check for invalid status transitions
  const localStatusValid = ["active", "high_value", "discarded"].includes(
    local.status
  );
  const remoteStatusValid = ["active", "high_value", "discarded"].includes(
    remote.status
  );

  if (!localStatusValid && remoteStatusValid) {
    return { hasCorruption: true, validData: remote };
  }
  if (localValid && !remoteStatusValid) {
    return { hasCorruption: true, validData: local };
  }

  return { hasCorruption: false, validData: local };
}

/**
 * Resolves conflicts based on timestamp freshness
 */
function resolveByTimestamp(
  local: UnifiedKeyword,
  remote: UnifiedKeyword,
  conflictFields: string[]
): ConflictResolutionResult {
  const timeDiff = Math.abs(local.lastUsedAt - remote.lastUsedAt);
  const isRecentConflict = timeDiff < 5 * 60 * 1000; // 5 minutes

  // If timestamps are very close, use more recent data
  if (isRecentConflict) {
    const useLocal = local.lastUsedAt > remote.lastUsedAt;
    return {
      resolved: true,
      strategy: {
        strategy: "timestamp_based",
        reason: "Recent conflict, using most recent timestamp",
        confidence: 0.8,
      },
      resolvedData: useLocal ? local : remote,
      conflicts: conflictFields.map((field) => ({
        field,
        localValue: local[field as keyof UnifiedKeyword],
        remoteValue: remote[field as keyof UnifiedKeyword],
        resolution: useLocal ? "local_wins_timestamp" : "remote_wins_timestamp",
      })),
    };
  }

  // For older conflicts, prefer local data (user's most recent action)
  return {
    resolved: true,
    strategy: {
      strategy: "timestamp_based",
      reason: "Older conflict, preferring local user action",
      confidence: 0.6,
    },
    resolvedData: local,
    conflicts: conflictFields.map((field) => ({
      field,
      localValue: local[field as keyof UnifiedKeyword],
      remoteValue: remote[field as keyof UnifiedKeyword],
      resolution: "local_wins_older",
    })),
  };
}

/**
 * Resolves conflicts based on user intent and behavior patterns
 */
function resolveByUserIntent(
  local: UnifiedKeyword,
  remote: UnifiedKeyword,
  conflictFields: string[]
): ConflictResolutionResult {
  const conflicts: Array<{
    field: string;
    localValue: unknown;
    remoteValue: unknown;
    resolution: string;
  }> = [];

  const resolvedData = { ...local };

  for (const field of conflictFields) {
    switch (field) {
      case "isPinned":
        // Pinned status: if either is pinned, keep it pinned (user intent)
        resolvedData.isPinned = local.isPinned || remote.isPinned;
        conflicts.push({
          field,
          localValue: local.isPinned,
          remoteValue: remote.isPinned,
          resolution: "preserve_user_intent",
        });
        break;

      case "searchCount":
        // Search count: use the higher value (more comprehensive)
        resolvedData.searchCount = Math.max(
          local.searchCount,
          remote.searchCount
        );
        conflicts.push({
          field,
          localValue: local.searchCount,
          remoteValue: remote.searchCount,
          resolution: "max_value",
        });
        break;

      case "lastUsedAt":
        // Last used: use the more recent timestamp
        resolvedData.lastUsedAt = Math.max(local.lastUsedAt, remote.lastUsedAt);
        conflicts.push({
          field,
          localValue: local.lastUsedAt,
          remoteValue: remote.lastUsedAt,
          resolution: "most_recent",
        });
        break;

      case "decayedScore":
        // Decayed score: use the higher value (better performance)
        resolvedData.decayedScore = Math.max(
          local.decayedScore,
          remote.decayedScore
        );
        conflicts.push({
          field,
          localValue: local.decayedScore,
          remoteValue: remote.decayedScore,
          resolution: "higher_score",
        });
        break;

      case "status":
        // Status: prefer high_value > active > discarded
        const statusPriority = { high_value: 3, active: 2, discarded: 1 };
        const localPriority =
          statusPriority[local.status as keyof typeof statusPriority] || 0;
        const remotePriority =
          statusPriority[remote.status as keyof typeof statusPriority] || 0;

        resolvedData.status =
          localPriority >= remotePriority ? local.status : remote.status;
        conflicts.push({
          field,
          localValue: local.status,
          remoteValue: remote.status,
          resolution: "priority_based",
        });
        break;

      case "votes":
        // Votes: merge and deduplicate
        const mergedVotes = [...local.votes, ...remote.votes]
          .sort((a, b) => a.timestamp - b.timestamp)
          .filter(
            (vote, index, arr) =>
              index === 0 || vote.timestamp !== arr[index - 1].timestamp
          );
        resolvedData.votes = mergedVotes;
        conflicts.push({
          field,
          localValue: local.votes,
          remoteValue: remote.votes,
          resolution: "merged_deduplicated",
        });
        break;

      case "metadata":
        // Metadata: merge objects
        resolvedData.metadata = { ...local.metadata, ...remote.metadata };
        conflicts.push({
          field,
          localValue: local.metadata,
          remoteValue: remote.metadata,
          resolution: "merged_objects",
        });
        break;

      default:
        // Default: use local value
        conflicts.push({
          field,
          localValue: local[field as keyof UnifiedKeyword],
          remoteValue: remote[field as keyof UnifiedKeyword],
          resolution: "local_default",
        });
    }
  }

  return {
    resolved: true,
    strategy: {
      strategy: "user_intent",
      reason: "Resolved based on user intent and behavior patterns",
      confidence: 0.7,
    },
    resolvedData,
    conflicts,
  };
}

/**
 * Resolves conflicts by merging complementary data
 */
function resolveByMerge(
  local: UnifiedKeyword,
  remote: UnifiedKeyword,
  conflictFields: string[]
): ConflictResolutionResult {
  const conflicts: Array<{
    field: string;
    localValue: unknown;
    remoteValue: unknown;
    resolution: string;
  }> = [];

  const resolvedData = { ...local };

  for (const field of conflictFields) {
    switch (field) {
      case "searchCount":
        // Add search counts together
        resolvedData.searchCount = local.searchCount + remote.searchCount;
        conflicts.push({
          field,
          localValue: local.searchCount,
          remoteValue: remote.searchCount,
          resolution: "sum_values",
        });
        break;

      case "votes":
        // Merge votes and recalculate score
        const mergedVotes = [...local.votes, ...remote.votes].sort(
          (a, b) => a.timestamp - b.timestamp
        );
        resolvedData.votes = mergedVotes;

        // Recalculate decayed score
        const VOTE_WEIGHTS = { up: 1, down: -1.5 };
        const DECAY_RATE = 0.05;
        const now = Date.now();
        let decayedScore = 0;

        mergedVotes.forEach((vote) => {
          const daysOld = (now - vote.timestamp) / (1000 * 60 * 60 * 24);
          const decayFactor = Math.exp(-DECAY_RATE * daysOld);
          const voteValue = VOTE_WEIGHTS[vote.vote];
          decayedScore += voteValue * decayFactor;
        });

        resolvedData.decayedScore = decayedScore;
        conflicts.push({
          field,
          localValue: local.votes,
          remoteValue: remote.votes,
          resolution: "merged_recalculated",
        });
        break;

      case "metadata":
        // Deep merge metadata
        resolvedData.metadata = deepMerge(
          local.metadata || {},
          remote.metadata || {}
        );
        conflicts.push({
          field,
          localValue: local.metadata,
          remoteValue: remote.metadata,
          resolution: "deep_merged",
        });
        break;

      default:
        // For other fields, use the more recent or higher value
        const localValue = local[field as keyof UnifiedKeyword];
        const remoteValue = remote[field as keyof UnifiedKeyword];

        if (typeof localValue === "number" && typeof remoteValue === "number") {
          (resolvedData as Record<string, unknown>)[field] = Math.max(
            localValue,
            remoteValue
          );
          conflicts.push({
            field,
            localValue,
            remoteValue,
            resolution: "max_numeric",
          });
        } else {
          // Default to local value
          conflicts.push({
            field,
            localValue,
            remoteValue,
            resolution: "local_default",
          });
        }
    }
  }

  return {
    resolved: true,
    strategy: {
      strategy: "merge",
      reason: "Merged complementary data from both sources",
      confidence: 0.6,
    },
    resolvedData,
    conflicts,
  };
}

/**
 * Deep merge two objects
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target };

  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(
        (target[key] as Record<string, unknown>) || {},
        source[key] as Record<string, unknown>
      );
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

/**
 * Validates resolved data for consistency
 */
export function validateResolvedData(data: UnifiedKeyword): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check timestamp consistency
  if (data.createdAt > data.lastUsedAt) {
    errors.push("Created timestamp cannot be after last used timestamp");
  }

  // Check search count validity
  if (data.searchCount < 0) {
    errors.push("Search count cannot be negative");
  }

  // Check status validity
  if (!["active", "high_value", "discarded"].includes(data.status)) {
    errors.push("Invalid status value");
  }

  // Check votes validity
  for (const vote of data.votes) {
    if (!["up", "down"].includes(vote.vote)) {
      errors.push("Invalid vote value");
    }
    if (vote.timestamp > Date.now()) {
      errors.push("Vote timestamp cannot be in the future");
    }
  }

  // Check pinned consistency
  if (data.isPinned && !data.pinnedAt) {
    errors.push("Pinned keyword must have pinnedAt timestamp");
  }
  if (!data.isPinned && data.pinnedAt) {
    errors.push("Unpinned keyword should not have pinnedAt timestamp");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Logs conflict resolution for debugging and analytics
 */
export function logConflictResolution(
  conflict: SyncConflict,
  resolution: ConflictResolutionResult
): void {
  if (process.env.NODE_ENV !== "development") return;
  logger.debug(`🔧 Keyword Conflict Resolved: "${conflict.keyword}"`);
  logger.debug("Strategy:", resolution.strategy.strategy);
  logger.debug("Reason:", resolution.strategy.reason);
  logger.debug("Confidence:", resolution.strategy.confidence);
  logger.debug("Conflicts:", resolution.conflicts);
  logger.debug("Resolved Data:", resolution.resolvedData);
}
