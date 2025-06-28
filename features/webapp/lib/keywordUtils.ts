/**
 * Keyword utility functions for the webapp feature
 *
 * These utilities are extracted from the original KeywordHistory component
 * to promote code reuse and maintainability.
 *
 * References:
 * - Pure Functions: https://react.dev/learn/keeping-components-pure
 * - TypeScript Utility Types: https://www.typescriptlang.org/docs/handbook/utility-types.html
 */

import type { KeywordItem } from "@/features/keywords/ui/components/KeywordList";

/**
 * Groups keywords by time period (Today, Yesterday, Last week, Older)
 * This is a pure function that doesn't modify the input array
 */
export function groupKeywordsByTime(
  keywords: KeywordItem[]
): Record<string, KeywordItem[]> {
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
    if (!item.timestamp) {
      groups.Older.push(item);
      return;
    }

    const itemDate = new Date(item.timestamp);

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

  // Remove empty groups
  Object.keys(groups).forEach((key) => {
    if (groups[key].length === 0) {
      delete groups[key];
    }
  });

  return groups;
}
