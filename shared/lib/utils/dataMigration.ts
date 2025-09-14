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

/**
 * Interface for localStorage data that can be migrated
 */
export interface LocalStorageData {
  workspaceDescription?: string;
  workspaceName?: string;
  // Add more data types as needed
  [key: string]: string | undefined;
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

  // Add more data collection as needed
  // Example: search history, preferences, etc.

  return data;
}

/**
 * Checks if there's any data in localStorage that can be migrated
 */
export function hasDataToMigrate(): boolean {
  const data = collectLocalStorageData();
  return Object.keys(data).length > 0;
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
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${value?.length || 0} characters`)
    .join(", ");

  return `Migrating localStorage data: ${items || "no data"}`;
}
