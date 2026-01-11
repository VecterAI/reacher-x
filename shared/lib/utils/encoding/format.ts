import {
  differenceInSeconds,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  format,
} from "date-fns";

/**
 * Formats a given date string into a relative time representation.
 *
 * For dates within the last 7 days:
 * - If the difference is 0 seconds (or the date is in the future), returns "now".
 * - If less than 60 seconds, returns "· {seconds}s".
 * - If less than 60 minutes, returns "· {minutes}m".
 * - If less than 24 hours, returns "· {hours}h".
 * - Otherwise (but still within 7 days), returns "· {days}d".
 *
 * For dates 7 days or older, returns the formatted date (e.g., "· Oct 4, 2022").
 *
 * @param dateString - The ISO date string to format.
 * @returns The formatted relative time string.
 */
export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return ""; // Fallback for invalid dates

  const now = new Date();

  // Calculate the time difference in seconds.
  const diffInSec = differenceInSeconds(now, date);
  if (diffInSec <= 0) return "now"; // For dates in the future or exactly now

  // If less than 60 seconds, display seconds.
  if (diffInSec < 60) {
    return `${diffInSec}s`;
  }

  // If less than 60 minutes, display minutes.
  const diffInMin = differenceInMinutes(now, date);
  if (diffInMin < 60) {
    return `${diffInMin}m`;
  }

  // If less than 24 hours, display hours.
  const diffInHrs = differenceInHours(now, date);
  if (diffInHrs < 24) {
    return `${diffInHrs}h`;
  }

  // If less than 7 days, display days.
  const diffInDaysVal = differenceInDays(now, date);
  if (diffInDaysVal < 7) {
    return `${diffInDaysVal}d`;
  }

  // For posts 7 days or older, return the formatted date.
  return `${format(date, "MMM d, yyyy")}`;
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
