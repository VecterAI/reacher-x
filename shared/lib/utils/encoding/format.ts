import {
  differenceInSeconds,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  format,
} from "date-fns";

function formatCalendarDate(date: Date, now: Date): string {
  if (date.getFullYear() === now.getFullYear()) {
    return format(date, "MMM d");
  }

  return format(date, "MMM d, yyyy");
}

/**
 * Formats a given date string into a relative time representation.
 *
 * - < 60s:  "5s"
 * - < 60m:  "12m"
 * - < 24h:  "3h"
 * - 1-6d:   "3d"
 * - 7+d same year:       "Feb 28"
 * - 7+d different year:  "Oct 4, 2025"
 */
export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  const now = new Date();

  const diffInSec = differenceInSeconds(now, date);
  if (diffInSec <= 0) return "now";

  if (diffInSec < 60) {
    return `${diffInSec}s`;
  }

  const diffInMin = differenceInMinutes(now, date);
  if (diffInMin < 60) {
    return `${diffInMin}m`;
  }

  const diffInHrs = differenceInHours(now, date);
  if (diffInHrs < 24) {
    return `${diffInHrs}h`;
  }

  const diffInDaysVal = differenceInDays(now, date);
  if (diffInDaysVal < 7) {
    return `${diffInDaysVal}d`;
  }

  return formatCalendarDate(date, now);
}

/**
 * Formats a given date string like formatRelativeTime, but preserves the time
 * once the output switches from compact relative values to calendar dates.
 *
 * - < 60s:  "5s"
 * - < 60m:  "12m"
 * - < 24h:  "3h"
 * - 1-6d:   "3d"
 * - 7+d same year:       "Feb 28 · 2:15 PM"
 * - 7+d different year:  "Oct 4, 2025 · 2:15 PM"
 */
export function formatRelativeTimeWithTime(dateString?: string): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  const now = new Date();

  const diffInSec = differenceInSeconds(now, date);
  if (diffInSec <= 0) return "now";

  if (diffInSec < 60) {
    return `${diffInSec}s`;
  }

  const diffInMin = differenceInMinutes(now, date);
  if (diffInMin < 60) {
    return `${diffInMin}m`;
  }

  const diffInHrs = differenceInHours(now, date);
  if (diffInHrs < 24) {
    return `${diffInHrs}h`;
  }

  const diffInDaysVal = differenceInDays(now, date);
  if (diffInDaysVal < 7) {
    return `${diffInDaysVal}d`;
  }

  return `${formatCalendarDate(date, now)} · ${format(date, "h:mm a")}`;
}

/**
 * Abbreviates large numbers using suffixes.
 *
 * Examples:
 * - 950 returns "950"
 * - 1500 returns "1.5K"
 *
 * @param value - The number to abbreviate.
 * @returns The abbreviated number as a string.
 */
export function formatLargeNumber(value: number): string {
  if (value < 1000) return String(value);

  const suffixes = ["", "K", "M", "B", "T"];
  let suffixIndex = 0;
  let num = value;

  while (num >= 1000 && suffixIndex < suffixes.length - 1) {
    num /= 1000;
    suffixIndex++;
  }

  // Remove a trailing ".0" if present (e.g., "1.0K" becomes "1K").
  const formatted = num.toFixed(1).replace(/\.0$/, "");
  return `${formatted}${suffixes[suffixIndex]}`;
}
