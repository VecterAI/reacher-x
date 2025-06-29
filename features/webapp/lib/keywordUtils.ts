/**
 * Keyword utility functions for the webapp feature
 *
 * These utilities are extracted from the original KeywordHistory component
 * to promote code reuse and maintainability.
 *
 * References:
 * - Pure Functions: https://react.dev/learn/keeping-components-pure
 * - TypeScript Utility Types: https://www.typescriptlang.org/docs/handbook/utility-types.html
 * - Date manipulation best practices: https://date-fns.org/
 */

import type { KeywordItem } from "@/features/keywords/ui/components/KeywordList";
import type { KeywordItemWithRawTimestamp } from "@/features/search/hooks/useSearchHistory";

/**
 * Groups keywords by time period (Today, Yesterday, Last week, Older)
 * This is a pure function that doesn't modify the input array
 *
 * Enhanced to handle both raw timestamps and formatted timestamps for backward compatibility
 *
 * References:
 * - Date calculation best practices: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date
 * - Timezone considerations: https://stackoverflow.com/questions/7556591/is-the-javascript-date-object-always-one-day-off
 */
export function groupKeywordsByTime(
  keywords: KeywordItem[] | KeywordItemWithRawTimestamp[]
): Record<string, KeywordItem[]> {
  // Local time approach for consistent user experience
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const groups: Record<string, KeywordItem[]> = {
    Today: [],
    Yesterday: [],
    "Last week": [],
    Older: [],
  };

  keywords.forEach((item) => {
    let itemDate: Date;

    // Check if item has rawTimestamp (enhanced version)
    if ("rawTimestamp" in item && typeof item.rawTimestamp === "number") {
      itemDate = new Date(item.rawTimestamp);
    } else if (item.timestamp) {
      // Try to parse the timestamp - could be ISO string or relative string
      if (typeof item.timestamp === "string") {
        // First try parsing as ISO string
        const parsed = new Date(item.timestamp);
        if (!isNaN(parsed.getTime())) {
          itemDate = parsed;
        } else {
          // If it's a relative string like "2h", "3d", we can't accurately group it
          // Place it in "Older" as fallback, but log warning
          console.warn(
            `[KEYWORD_UTILS] Cannot accurately group keyword "${item.keyword}" with relative timestamp "${item.timestamp}". Consider using raw timestamps for accurate grouping.`
          );
          groups.Older.push(item);
          return;
        }
      } else {
        // If timestamp is a number, treat as Unix timestamp
        itemDate = new Date(item.timestamp);
      }
    } else {
      // No timestamp, put in Older
      groups.Older.push(item);
      return;
    }

    // Validate the parsed date
    if (isNaN(itemDate.getTime())) {
      console.warn(
        `[KEYWORD_UTILS] Invalid date for keyword "${item.keyword}": ${item.timestamp}`
      );
      groups.Older.push(item);
      return;
    }

    // Group by time periods
    if (itemDate >= today) {
      groups.Today.push(item);
    } else if (itemDate >= yesterday) {
      groups.Yesterday.push(item);
    } else if (itemDate >= lastWeek) {
      groups["Last week"].push(item);
    } else {
      groups.Older.push(item);
    }
  });

  // Remove empty groups for cleaner UI
  Object.keys(groups).forEach((key) => {
    if (groups[key].length === 0) {
      delete groups[key];
    }
  });

  return groups;
}
