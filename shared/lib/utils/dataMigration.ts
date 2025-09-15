/**
 * Data Migration Utilities
 *
 * Handles migration of localStorage data to Convex when users sign up.
 * This ensures a seamless transition from anonymous usage to authenticated usage.
 */

import {
  STORAGE_KEYS,
  getLocalStorage,
  clearWorkspaceData,
} from "./localStorage";
import { getKeywords } from "./unifiedKeywordStore";

/**
 * Interface for localStorage data that can be migrated
 */
export interface LocalStorageData {
  workspaceDescription?: string;
  workspaceName?: string;
  keywords?: Array<{
    id: string;
    keyword: string;
    exactMatch: boolean;
    createdAt: number;
    lastUsedAt: number;
    searchCount: number;
    isPinned: boolean;
    pinnedAt?: number;
    source: "user_created" | "ai_suggestion" | "ai_reprompt";
    status: "active" | "high_value" | "discarded";
    votes: Array<{
      vote: "up" | "down";
      timestamp: number;
      tweetId?: string;
    }>;
    decayedScore: number;
    metadata?: {
      [key: string]: unknown;
    };
  }>;
  // Add more data types as needed
  [key: string]: string | undefined | unknown;
}

/**
 * Interface for migration result
 */
export interface MigrationResult {
  success: boolean;
  migratedData: Partial<LocalStorageData>;
  errors: string[];
}

/**
 * Collects all localStorage data that can be migrated
 */
export function collectLocalStorageData(): LocalStorageData {
  const data: LocalStorageData = {};

  // Collect workspace data
  const description = getLocalStorage(STORAGE_KEYS.WORKSPACE_DESCRIPTION);
  const name = getLocalStorage(STORAGE_KEYS.WORKSPACE_NAME);

  if (description) {
    data.workspaceDescription = description;
  }

  if (name) {
    data.workspaceName = name;
  }

  // Collect keyword data
  try {
    const keywords = getKeywords();
    if (keywords && keywords.length > 0) {
      data.keywords = keywords.map((keyword) => ({
        id: keyword.id,
        keyword: keyword.keyword,
        exactMatch: keyword.exactMatch,
        createdAt: keyword.createdAt,
        lastUsedAt: keyword.lastUsedAt,
        searchCount: keyword.searchCount,
        isPinned: keyword.isPinned,
        pinnedAt: keyword.pinnedAt,
        source: keyword.source,
        status: keyword.status,
        votes: keyword.votes,
        decayedScore: keyword.decayedScore,
        metadata: keyword.metadata,
      }));
    }
  } catch (error) {
    console.warn("Failed to collect keyword data for migration:", error);
  }

  return data;
}

/**
 * Checks if there's any data in localStorage that can be migrated
 */
export function hasDataToMigrate(): boolean {
  const data = collectLocalStorageData();
  return (
    Object.keys(data).length > 0 &&
    Boolean(
      data.workspaceDescription ||
        data.workspaceName ||
        (data.keywords && data.keywords.length > 0)
    )
  );
}

/**
 * Clears all migrated data from localStorage
 * Should only be called after successful migration to Convex
 */
export function clearMigratedData(): boolean {
  return clearWorkspaceData();
}

/**
 * Validates that the collected data is valid for migration
 */
export function validateMigrationData(data: LocalStorageData): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate workspace description
  if (data.workspaceDescription !== undefined) {
    if (typeof data.workspaceDescription !== "string") {
      errors.push("Workspace description must be a string");
    } else if (data.workspaceDescription.length === 0) {
      errors.push("Workspace description cannot be empty");
    }
  }

  // Validate workspace name
  if (data.workspaceName !== undefined) {
    if (typeof data.workspaceName !== "string") {
      errors.push("Workspace name must be a string");
    } else if (data.workspaceName.length === 0) {
      errors.push("Workspace name cannot be empty");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a migration summary for logging/debugging
 */
export function createMigrationSummary(data: LocalStorageData): string {
  const items = Object.entries(data)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      if (typeof value === "string") {
        return `${key}: ${value.length} characters`;
      } else if (Array.isArray(value)) {
        return `${key}: ${value.length} items`;
      } else {
        return `${key}: 1 item`;
      }
    })
    .join(", ");

  return `Migrating localStorage data: ${items || "no data"}`;
}
