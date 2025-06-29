/**
 * Keyword utility functions for the webapp feature
 *
 * These utilities are extracted from the original KeywordHistory component
 * to promote code reuse and maintainability.
 *
 * UPDATED: Now uses timezone-aware grouping for consistency across all user types
 *
 * References:
 * - Pure Functions: https://react.dev/learn/keeping-components-pure
 * - TypeScript Utility Types: https://www.typescriptlang.org/docs/handbook/utility-types.html
 * - Date manipulation best practices: https://date-fns.org/
 * - Timezone-aware calculations: MDN Intl.DateTimeFormat API
 */

import type { KeywordItem } from "@/features/keywords/ui/components/KeywordList";
import type { KeywordItemWithRawTimestamp } from "@/features/search/hooks/useSearchHistory";
import {
  calculateGroupingBoundaries,
  validateAndNormalizeTimestamp,
  getUserTimezoneInfo,
  debugTimezoneGrouping,
  type TimezoneInfo,
  type GroupingBoundaries,
} from "@/shared/lib/utils/timeUtils";

/**
 * Helper function to validate and group a single keyword
 * Extracted for better readability and maintainability
 */
function validateAndGroupKeyword(
  item: KeywordItem | KeywordItemWithRawTimestamp,
  boundaries: GroupingBoundaries,
  validationIssues: Array<{ keyword: string; issue: string }>
): string | null {
  let utcTimestamp: number;

  // Enhanced timestamp handling with validation
  if ("rawTimestamp" in item && typeof item.rawTimestamp === "number") {
    // Use rawTimestamp directly (already UTC)
    const validation = validateAndNormalizeTimestamp(item.rawTimestamp);
    if (validation.isValid && validation.utcTimestamp) {
      utcTimestamp = validation.utcTimestamp;
    } else {
      validationIssues.push({
        keyword: item.keyword,
        issue: `Invalid rawTimestamp: ${validation.error}`,
      });
      return "Older"; // Place invalid items in "Older" group
    }
  } else if (item.timestamp) {
    // Validate and normalize the timestamp
    const validation = validateAndNormalizeTimestamp(item.timestamp);

    if (validation.isValid && validation.utcTimestamp) {
      utcTimestamp = validation.utcTimestamp;

      // Log warning for relative timestamps that can't be accurately grouped
      if (validation.type === "relative") {
        console.warn(
          `[KEYWORD_UTILS] Relative timestamp detected for "${item.keyword}": "${item.timestamp}". ` +
            `This cannot be accurately grouped and will be placed in "Older". ` +
            `Consider storing UTC timestamps for accurate time grouping.`
        );
        return "Older";
      }
    } else {
      validationIssues.push({
        keyword: item.keyword,
        issue: `Invalid timestamp: ${validation.error}`,
      });
      console.warn(
        `[KEYWORD_UTILS] Cannot process keyword "${item.keyword}" with timestamp "${item.timestamp}": ${validation.error}`
      );
      return "Older";
    }
  } else {
    // No timestamp available
    validationIssues.push({
      keyword: item.keyword,
      issue: "No timestamp provided",
    });
    return "Older";
  }

  // Group by timezone-aware time periods
  if (utcTimestamp >= boundaries.todayStart) {
    return "Today";
  } else if (utcTimestamp >= boundaries.yesterdayStart) {
    return "Yesterday";
  } else if (utcTimestamp >= boundaries.lastWeekStart) {
    return "Last week";
  } else {
    return "Older";
  }
}

/**
 * Groups keywords by time period (Today, Yesterday, Last week, Older)
 *
 * ENHANCED: Now uses timezone-aware calculations for consistent grouping
 * across all user types (anonymous and signed-in) and timezone scenarios.
 *
 * Key improvements:
 * 1. UTC timestamp storage with timezone-aware grouping
 * 2. Robust timestamp validation and normalization
 * 3. Consistent behavior across different timezones
 * 4. Handles edge cases around midnight transitions
 * 5. Maintains backward compatibility
 *
 * References:
 * - UTC storage pattern: https://www.w3.org/International/core/2005/09/timezone
 * - Timezone calculations: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat
 * - Date edge cases: https://stackoverflow.com/questions/7556591/is-the-javascript-date-object-always-one-day-off
 */
export function groupKeywordsByTime(
  keywords: KeywordItem[] | KeywordItemWithRawTimestamp[],
  timezoneInfo?: TimezoneInfo
): Record<string, KeywordItem[]> {
  // Use provided timezone info or detect current user's timezone
  const tz = timezoneInfo || getUserTimezoneInfo();

  // Calculate timezone-aware boundaries
  const boundaries = calculateGroupingBoundaries(tz);

  const groups: Record<string, KeywordItem[]> = {
    Today: [],
    Yesterday: [],
    "Last week": [],
    Older: [],
  };

  // Track validation issues for debugging
  const validationIssues: Array<{ keyword: string; issue: string }> = [];

  keywords.forEach((item) => {
    const groupName = validateAndGroupKeyword(
      item,
      boundaries,
      validationIssues
    );
    if (groupName) {
      groups[groupName].push(item);
    }
  });

  // Log validation issues in development
  if (process.env.NODE_ENV === "development" && validationIssues.length > 0) {
    console.group("[KEYWORD_UTILS] Timestamp Validation Issues");
    validationIssues.forEach((issue) => {
      console.warn(`"${issue.keyword}": ${issue.issue}`);
    });
    console.groupEnd();
  }

  // Debug timezone grouping in development
  if (process.env.NODE_ENV === "development") {
    const validKeywords = keywords
      .filter((item) => {
        const timestamp =
          "rawTimestamp" in item
            ? (item as KeywordItemWithRawTimestamp).rawTimestamp
            : (item as KeywordItem).timestamp;
        const validation = validateAndNormalizeTimestamp(timestamp);
        return validation.isValid && validation.utcTimestamp;
      })
      .map((item) => {
        const timestamp =
          "rawTimestamp" in item
            ? (item as KeywordItemWithRawTimestamp).rawTimestamp
            : (item as KeywordItem).timestamp;
        const validation = validateAndNormalizeTimestamp(timestamp);
        return {
          keyword: item.keyword,
          timestamp: validation.utcTimestamp!, // We know this is valid from filter above
        };
      });

    if (validKeywords.length > 0) {
      debugTimezoneGrouping(validKeywords);
    }
  }

  // Remove empty groups for cleaner UI
  Object.keys(groups).forEach((key) => {
    if (groups[key].length === 0) {
      delete groups[key];
    }
  });

  return groups;
}

/**
 * Enhanced validation function for keyword history functionality
 * Now includes timezone-aware validation checks
 */
export function validateKeywordHistoryGrouping(
  keywords: KeywordItem[] | KeywordItemWithRawTimestamp[],
  expectedGroups: Record<string, number>,
  timezoneInfo?: TimezoneInfo
): {
  isValid: boolean;
  issues: string[];
  actualGroups: Record<string, number>;
  timezoneInfo: TimezoneInfo;
} {
  const tz = timezoneInfo || getUserTimezoneInfo();
  const grouped = groupKeywordsByTime(keywords, tz);

  const actualGroups: Record<string, number> = {};
  Object.entries(grouped).forEach(([group, items]) => {
    actualGroups[group] = items.length;
  });

  const issues: string[] = [];

  // Check if expected groups match actual groups
  Object.entries(expectedGroups).forEach(([group, expectedCount]) => {
    const actualCount = actualGroups[group] || 0;
    if (actualCount !== expectedCount) {
      issues.push(
        `Group "${group}": expected ${expectedCount}, got ${actualCount}`
      );
    }
  });

  // Check for unexpected groups
  Object.keys(actualGroups).forEach((group) => {
    if (!(group in expectedGroups)) {
      issues.push(
        `Unexpected group "${group}" with ${actualGroups[group]} items`
      );
    }
  });

  return {
    isValid: issues.length === 0,
    issues,
    actualGroups,
    timezoneInfo: tz,
  };
}
