/**
 * Shared validation utilities
 * Centralizes validation logic used across frontend and backend
 */

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
 * Debug utility to validate keyword history functionality
 * Only available in development mode
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
      // Check if it's a valid ISO string
      const parsed = new Date(item.timestamp);
      return isNaN(parsed.getTime()) && !item.timestamp.match(/^\d+[smhd]$/);
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
