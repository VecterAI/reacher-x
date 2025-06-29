/**
 * Shared validation utilities
 * Centralizes validation logic used across frontend and backend
 */

import { startOfDay, isValid as isValidDate, parseISO } from "date-fns";
import {
  validateAndNormalizeTimestamp,
  getUserTimezoneInfo,
  RELATIVE_TIMESTAMP_PATTERN,
} from "./timeUtils";

// Description validation constants
export const DESCRIPTION_CONSTRAINTS = {
  MIN_LENGTH: 64,
  MAX_LENGTH: 512,
} as const;

// Additional constraint sets for different contexts
export const VALIDATION_PRESETS = {
  DEFAULT: DESCRIPTION_CONSTRAINTS,
  SHORT_FORM: { MIN_LENGTH: 10, MAX_LENGTH: 100 },
  LONG_FORM: { MIN_LENGTH: 100, MAX_LENGTH: 1000 },
} as const;

// Validation result type
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates user description for consistency across frontend and backend
 * @param description - The description to validate
 * @param isRequired - Whether the description is required (default: false)
 * @param constraints - Validation constraints to use (default: DESCRIPTION_CONSTRAINTS)
 * @returns Validation result with isValid flag and optional error message
 */
export function validateDescription(
  description: string | undefined | null,
  isRequired: boolean = false,
  constraints: typeof DESCRIPTION_CONSTRAINTS = DESCRIPTION_CONSTRAINTS
): ValidationResult {
  // Handle empty/null descriptions
  if (!description || description.trim() === "") {
    if (isRequired) {
      return {
        isValid: false,
        error: "Description is required",
      };
    }
    return { isValid: true }; // Optional description
  }

  if (typeof description !== "string") {
    return {
      isValid: false,
      error: "Description must be a string",
    };
  }

  const trimmedDescription = description.trim();

  if (trimmedDescription.length < constraints.MIN_LENGTH) {
    return {
      isValid: false,
      error: `Description must be at least ${constraints.MIN_LENGTH} characters`,
    };
  }

  if (trimmedDescription.length > constraints.MAX_LENGTH) {
    return {
      isValid: false,
      error: `Description must not exceed ${constraints.MAX_LENGTH} characters`,
    };
  }

  return { isValid: true };
}

/**
 * Validates description specifically for keyword generation (required)
 */
export function validateDescriptionForKeywords(
  description: string | undefined | null
): ValidationResult {
  return validateDescription(description, true);
}

/**
 * Validates description specifically for LLM filtering (optional)
 */
export function validateDescriptionForFiltering(
  description: string | undefined | null
): ValidationResult {
  return validateDescription(description, false);
}

/**
 * Enhanced validation for timezone-aware keyword history functionality
 * Validates that the new system works correctly for all user types
 */
export function validateTimezoneAwareKeywordHistory(
  historyItems: Array<{
    keyword: string;
    timestamp: string | number;
    rawTimestamp?: number;
  }>,
  pinnedKeywords: Array<{ keyword: string; pinnedAt: number }>,
  groupedHistory: Record<string, Array<{ keyword: string }>>,
  timezoneInfo?: {
    timezone: string;
    offsetMinutes: number;
    isDST: boolean;
  }
): {
  isValid: boolean;
  issues: string[];
  summary: {
    totalHistory: number;
    totalPinned: number;
    groupedCount: number;
    duplicatesInHistory: string[];
    pinnedInHistory: string[];
    timestampValidation: {
      validTimestamps: number;
      invalidTimestamps: number;
      utcTimestamps: number;
      relativeTimestamps: number;
    };
    timezoneConsistency: {
      isConsistent: boolean;
      detectedTimezone: string;
      providedTimezone?: string;
    };
  };
} {
  const issues: string[] = [];

  // Check for duplicates in history
  const historyKeywords = historyItems.map((h) => h.keyword.toLowerCase());
  const duplicatesInHistory = historyKeywords.filter(
    (keyword, index) => historyKeywords.indexOf(keyword) !== index
  );

  // Check if pinned keywords appear in grouped history
  const pinnedKeywordSet = new Set(
    pinnedKeywords.map((p) => p.keyword.toLowerCase())
  );
  const allGroupedKeywords = Object.values(groupedHistory)
    .flat()
    .map((item) => item.keyword.toLowerCase());

  const pinnedInHistory = allGroupedKeywords.filter((keyword) =>
    pinnedKeywordSet.has(keyword)
  );

  // Enhanced timestamp validation
  let validTimestamps = 0;
  let invalidTimestamps = 0;
  let utcTimestamps = 0;
  let relativeTimestamps = 0;

  const timestampIssues = historyItems.filter((item) => {
    const primaryTimestamp = item.rawTimestamp || item.timestamp;
    const validation = validateAndNormalizeTimestamp(primaryTimestamp);

    if (validation.isValid) {
      validTimestamps++;
      if (validation.type === "unix") {
        utcTimestamps++;
      } else if (validation.type === "relative") {
        relativeTimestamps++;
      }
      return false;
    } else {
      invalidTimestamps++;
      return true;
    }
  });

  // Timezone consistency check
  const currentTimezone = timezoneInfo || getUserTimezoneInfo();
  const detectedTimezone = currentTimezone.timezone;
  const isTimezoneConsistent =
    !timezoneInfo || timezoneInfo.timezone === detectedTimezone;

  // Add issues based on validation
  if (duplicatesInHistory.length > 0) {
    issues.push(
      `Duplicate keywords in history: ${duplicatesInHistory.join(", ")}`
    );
  }

  if (pinnedInHistory.length > 0) {
    issues.push(
      `Pinned keywords appearing in history: ${pinnedInHistory.join(", ")}`
    );
  }

  if (timestampIssues.length > 0) {
    issues.push(
      `Invalid timestamps detected: ${timestampIssues.map((i) => i.keyword).join(", ")}`
    );
  }

  if (relativeTimestamps > 0) {
    issues.push(
      `Relative timestamps detected (${relativeTimestamps} items) - these cannot be accurately grouped`
    );
  }

  if (!isTimezoneConsistent) {
    issues.push(
      `Timezone inconsistency: provided "${timezoneInfo?.timezone}" but detected "${detectedTimezone}"`
    );
  }

  // Check grouping accuracy for recent items
  const recentItems = historyItems
    .filter((item) => {
      const validation = validateAndNormalizeTimestamp(
        item.rawTimestamp || item.timestamp
      );
      return validation.isValid;
    })
    .slice(0, 10);

  if (recentItems.length > 0) {
    // Use date-fns startOfDay for reliable start-of-day calculation
    const todayStart = startOfDay(new Date()).getTime();

    const shouldBeToday = recentItems.filter((item) => {
      let timestamp: number;

      if (typeof item.rawTimestamp === "number") {
        timestamp = item.rawTimestamp;
      } else if (typeof item.timestamp === "number") {
        timestamp = item.timestamp;
      } else {
        // Use date-fns parseISO for better ISO string parsing, fallback to Date.parse
        const timestampStr = item.timestamp as string;
        if (timestampStr.includes("T") || timestampStr.includes("Z")) {
          const parsed = parseISO(timestampStr);
          timestamp = isValidDate(parsed)
            ? parsed.getTime()
            : Date.parse(timestampStr);
        } else {
          timestamp = Date.parse(timestampStr);
        }
      }

      return timestamp >= todayStart;
    });

    const actualTodayGroup = groupedHistory["Today"] || [];
    const todayKeywords = new Set(
      actualTodayGroup.map((k) => k.keyword.toLowerCase())
    );

    const missingFromToday = shouldBeToday.filter(
      (item) => !todayKeywords.has(item.keyword.toLowerCase())
    );

    if (missingFromToday.length > 0) {
      issues.push(
        `Recent items not properly grouped in "Today": ${missingFromToday.map((i) => i.keyword).join(", ")}`
      );
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    summary: {
      totalHistory: historyItems.length,
      totalPinned: pinnedKeywords.length,
      groupedCount: Object.values(groupedHistory).flat().length,
      duplicatesInHistory,
      pinnedInHistory,
      timestampValidation: {
        validTimestamps,
        invalidTimestamps,
        utcTimestamps,
        relativeTimestamps,
      },
      timezoneConsistency: {
        isConsistent: isTimezoneConsistent,
        detectedTimezone,
        providedTimezone: timezoneInfo?.timezone,
      },
    },
  };
}

/**
 * Debug utility to validate keyword history functionality
 * LEGACY: Kept for backward compatibility, use validateTimezoneAwareKeywordHistory for new implementations
 */
export function validateKeywordHistoryFunctionality(
  historyItems: Array<{ keyword: string; timestamp: string | number }>,
  pinnedKeywords: Array<{ keyword: string }>,
  groupedHistory: Record<string, Array<{ keyword: string }>>
): {
  isValid: boolean;
  issues: string[];
  summary: {
    totalHistory: number;
    totalPinned: number;
    groupedCount: number;
    duplicatesInHistory: string[];
    pinnedInHistory: string[];
  };
} {
  const issues: string[] = [];

  // Check for duplicates in history
  const historyKeywords = historyItems.map((h) => h.keyword.toLowerCase());
  const duplicatesInHistory = historyKeywords.filter(
    (keyword, index) => historyKeywords.indexOf(keyword) !== index
  );

  // Check if pinned keywords appear in grouped history
  const pinnedKeywordSet = new Set(
    pinnedKeywords.map((p) => p.keyword.toLowerCase())
  );
  const allGroupedKeywords = Object.values(groupedHistory)
    .flat()
    .map((item) => item.keyword.toLowerCase());

  const pinnedInHistory = allGroupedKeywords.filter((keyword) =>
    pinnedKeywordSet.has(keyword)
  );

  // Check timestamp validity for recent items
  const recentItems = historyItems.slice(0, 5);
  const invalidTimestamps = recentItems.filter((item) => {
    if (typeof item.timestamp === "number") return false;
    if (typeof item.timestamp === "string") {
      // Use date-fns isValid for reliable date validation
      const parsed = new Date(item.timestamp);
      return (
        !isValidDate(parsed) && !RELATIVE_TIMESTAMP_PATTERN.test(item.timestamp)
      );
    }
    return true;
  });

  // Add issues
  if (duplicatesInHistory.length > 0) {
    issues.push(
      `Duplicate keywords in history: ${duplicatesInHistory.join(", ")}`
    );
  }

  if (pinnedInHistory.length > 0) {
    issues.push(
      `Pinned keywords appearing in history: ${pinnedInHistory.join(", ")}`
    );
  }

  if (invalidTimestamps.length > 0) {
    issues.push(
      `Invalid timestamps detected: ${invalidTimestamps.map((i) => i.keyword).join(", ")}`
    );
  }

  return {
    isValid: issues.length === 0,
    issues,
    summary: {
      totalHistory: historyItems.length,
      totalPinned: pinnedKeywords.length,
      groupedCount: Object.values(groupedHistory).flat().length,
      duplicatesInHistory,
      pinnedInHistory,
    },
  };
}
