/**
 * Timezone-Aware Time Utilities
 *
 * Provides robust date/time handling for keyword grouping that works consistently
 * across all user types (anonymous and signed-in) and timezone scenarios.
 *
 * REFACTORED: Now properly uses date-fns for reliable date calculations
 *
 * Key principles:
 * 1. Store everything in UTC (Unix timestamps)
 * 2. Calculate grouping boundaries in user's timezone using date-fns
 * 3. Handle edge cases around midnight transitions
 * 4. Leverage existing formatRelativeTime function
 *
 * References:
 * - date-fns Documentation: https://date-fns.org/docs/Getting-Started
 * - MDN Date Object: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date
 * - Timezone Best Practices: https://stackoverflow.com/questions/15141762/how-to-initialize-a-javascript-date-to-a-particular-timezone
 * - UTC Storage Pattern: https://www.w3.org/International/core/2005/09/timezone
 * - JavaScript Temporal Proposal: https://tc39.es/proposal-temporal/docs/
 * - ISO 8601 Standard: https://www.iso.org/iso-8601-date-and-time-format.html
 */

import {
  startOfDay,
  subDays,
  addDays,
  isValid as isValidDate,
  parseISO,
  differenceInDays,
  format,
  getTime,
} from "date-fns";
import { formatRelativeTime } from "../encoding/format";
import { logger } from "../../logger";

export interface TimezoneInfo {
  /** IANA timezone identifier (e.g., 'America/New_York') */
  timezone: string;
  /** Timezone offset in minutes from UTC (e.g., -300 for EST) */
  offsetMinutes: number;
  /** Whether daylight saving time is currently active */
  isDST: boolean;
}

export interface GroupingBoundaries {
  /** Start of today in user's timezone (as UTC timestamp) */
  todayStart: number;
  /** Start of yesterday in user's timezone (as UTC timestamp) */
  yesterdayStart: number;
  /** Start of last week in user's timezone (as UTC timestamp) */
  lastWeekStart: number;
}

export interface TimestampValidation {
  /** Whether the timestamp is valid */
  isValid: boolean;
  /** Normalized UTC timestamp (if valid) */
  utcTimestamp?: number;
  /** Original timezone offset (if determinable) */
  originalOffset?: number;
  /** Type of timestamp detected */
  type: "unix" | "iso" | "relative" | "invalid";
  /** Error message (if invalid) */
  error?: string;
}

// Shared constant for relative timestamp validation
export const RELATIVE_TIMESTAMP_PATTERN = /^(\d+)([smhd])$/;

/**
 * Get current user's timezone information
 * Uses Intl.DateTimeFormat API for accurate timezone detection
 *
 * Reference: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat
 */
export function getUserTimezoneInfo(): TimezoneInfo {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();

    // Calculate current offset using getTimezoneOffset (more reliable than manual calculation)
    const offsetMinutes = -now.getTimezoneOffset(); // Note: getTimezoneOffset returns negative values for positive offsets

    // Detect DST using date-fns and timezone offset comparison
    const january = new Date(now.getFullYear(), 0, 1);
    const july = new Date(now.getFullYear(), 6, 1);
    const isDST =
      Math.abs(january.getTimezoneOffset()) !==
        Math.abs(july.getTimezoneOffset()) &&
      now.getTimezoneOffset() !==
        Math.max(january.getTimezoneOffset(), july.getTimezoneOffset());

    return {
      timezone,
      offsetMinutes,
      isDST,
    };
  } catch (error) {
    logger.warn(
      "[TIME_UTILS] Failed to detect timezone, falling back to UTC:",
      error
    );
    return {
      timezone: "UTC",
      offsetMinutes: 0,
      isDST: false,
    };
  }
}

/**
 * Calculate grouping boundaries in user's timezone using date-fns
 * Returns UTC timestamps for consistent storage and comparison
 *
 * Reference: https://date-fns.org/docs/startOfDay
 */
export function calculateGroupingBoundaries(
  timezoneInfo?: TimezoneInfo
): GroupingBoundaries {
  const tz = timezoneInfo || getUserTimezoneInfo();

  try {
    // Get current time in user's timezone using proper conversion
    const now = new Date();

    // Calculate timezone-aware start of day
    // Convert current time to user's timezone, get start of day, then convert back to UTC
    const nowInUserTz = new Date(
      now.toLocaleString("en-US", { timeZone: tz.timezone })
    );

    // Use date-fns to get start of day in user's timezone
    const todayStartInUserTz = startOfDay(nowInUserTz);

    // Convert back to UTC by applying the timezone offset
    const todayStart =
      todayStartInUserTz.getTime() - tz.offsetMinutes * 60 * 1000;

    // Use date-fns to calculate yesterday and last week boundaries
    const yesterdayStart = subDays(new Date(todayStart), 1).getTime();
    const lastWeekStart = subDays(new Date(todayStart), 7).getTime();

    return {
      todayStart,
      yesterdayStart,
      lastWeekStart,
    };
  } catch (error) {
    logger.warn(
      "[TIME_UTILS] Failed to calculate timezone-aware boundaries, falling back to UTC:",
      error
    );

    // Fallback to UTC calculations using date-fns
    const now = new Date();
    const todayStart = startOfDay(now).getTime();
    const yesterdayStart = subDays(now, 1).getTime();
    const lastWeekStart = subDays(now, 7).getTime();

    return {
      todayStart,
      yesterdayStart,
      lastWeekStart,
    };
  }
}

/**
 * Validate and normalize timestamp from various formats
 * Uses date-fns for robust date validation and parsing
 *
 * Reference: https://date-fns.org/docs/isValid
 */
export function validateAndNormalizeTimestamp(
  timestamp: string | number | undefined | null
): TimestampValidation {
  if (timestamp === null || timestamp === undefined) {
    return {
      isValid: false,
      type: "invalid",
      error: "Timestamp is null or undefined",
    };
  }

  // Handle Unix timestamps (numbers)
  if (typeof timestamp === "number") {
    if (isNaN(timestamp) || timestamp < 0) {
      return {
        isValid: false,
        type: "invalid",
        error: "Invalid numeric timestamp",
      };
    }

    // Handle both seconds and milliseconds
    const normalizedTimestamp =
      timestamp < 10000000000 ? timestamp * 1000 : timestamp;

    // Use date-fns to validate the resulting date
    const date = new Date(normalizedTimestamp);
    if (!isValidDate(date)) {
      return {
        isValid: false,
        type: "invalid",
        error: "Timestamp results in invalid date",
      };
    }

    // Validate reasonable date range (between 1970 and 2100)
    const minYear = 1970;
    const maxYear = 2100;
    const year = date.getFullYear();

    if (year < minYear || year > maxYear) {
      return {
        isValid: false,
        type: "invalid",
        error: `Timestamp outside reasonable date range (${minYear}-${maxYear})`,
      };
    }

    return {
      isValid: true,
      utcTimestamp: normalizedTimestamp,
      type: "unix",
    };
  }

  // Handle string timestamps
  if (typeof timestamp === "string") {
    const trimmed = timestamp.trim();

    // Check for relative time strings (2h, 3d, etc.) - these cannot be accurately grouped
    if (RELATIVE_TIMESTAMP_PATTERN.test(trimmed)) {
      return {
        isValid: false,
        type: "relative",
        error: "Relative timestamps cannot be accurately grouped",
      };
    }

    // Try parsing as ISO string first using date-fns
    let parsed: Date;
    let originalOffset: number | undefined;

    // Improved timezone offset regex pattern for better validation
    const timezoneOffsetPattern = /[+-](?:0[0-9]|1[0-4]):[0-5][0-9]$/;

    // Check if it looks like an ISO string and use parseISO for better handling
    if (
      trimmed.includes("T") ||
      trimmed.includes("Z") ||
      timezoneOffsetPattern.test(trimmed)
    ) {
      try {
        parsed = parseISO(trimmed);

        // Extract timezone offset if available in ISO string
        const isoPattern = /([+-])(\d{2}):?(\d{2})$/;
        const match = trimmed.match(isoPattern);
        if (match) {
          const sign = match[1] === "+" ? 1 : -1;
          const hours = parseInt(match[2], 10);
          const minutes = parseInt(match[3], 10);
          originalOffset = sign * (hours * 60 + minutes);
        }
      } catch {
        // Fall back to regular Date parsing
        parsed = new Date(trimmed);
      }
    } else {
      // Use regular Date parsing for other formats
      parsed = new Date(trimmed);
    }

    // Use date-fns to validate the parsed date
    if (!isValidDate(parsed)) {
      return {
        isValid: false,
        type: "invalid",
        error: "Could not parse string timestamp into valid date",
      };
    }

    return {
      isValid: true,
      utcTimestamp: parsed.getTime(),
      originalOffset,
      type: "iso",
    };
  }

  return {
    isValid: false,
    type: "invalid",
    error: "Unsupported timestamp type",
  };
}

/**
 * Generate current UTC timestamp using date-fns
 * Centralized function for consistent timestamp creation
 * Per AGENT_CONTEXT.txt: Use date-fns for reliable date handling
 */
export function getCurrentUTCTimestamp(): number {
  return getTime(new Date());
}

/**
 * Parse ISO date string to Unix timestamp
 * Centralized function for consistent ISO date parsing
 * Per AGENT_CONTEXT.txt: Use date-fns for reliable date handling
 *
 * @param isoString - ISO 8601 date string (e.g., "2024-01-15T10:30:00Z")
 * @returns Unix timestamp in milliseconds, or undefined if invalid
 */
export function parseIsoToTimestamp(isoString: string): number | undefined {
  const parsedDate = parseISO(isoString);
  if (isValidDate(parsedDate)) {
    return getTime(parsedDate);
  }
  return undefined;
}

/**
 * Format timestamp for display using the existing formatRelativeTime function
 * Leverages the robust date-fns implementation already in the codebase
 *
 * Reference: shared/lib/utils/format.ts formatRelativeTime function
 */
export function formatTimestampForDisplay(utcTimestamp: number): string {
  try {
    // Convert UTC timestamp to ISO string for the existing formatRelativeTime function
    const date = new Date(utcTimestamp);

    // Use date-fns to validate the date first
    if (!isValidDate(date)) {
      logger.warn(
        "[TIME_UTILS] Invalid timestamp for display formatting:",
        utcTimestamp
      );
      return "unknown";
    }

    // Use the existing formatRelativeTime which works with UTC dates
    const isoString = date.toISOString();

    // Use the existing robust formatRelativeTime function
    const formatted = formatRelativeTime(isoString);

    // Remove the "·" prefix if present (to match the expected format)
    return formatted.startsWith("·") ? formatted.substring(2) : formatted;
  } catch (error) {
    logger.warn("[TIME_UTILS] Failed to format timestamp for display:", error);
    return "unknown";
  }
}

/**
 * Enhanced format function for timezone-aware display
 * Uses date-fns format function with timezone consideration
 */
export function formatTimestampInTimezone(
  utcTimestamp: number,
  formatString: string = "MMM d, yyyy",
  timezoneInfo?: TimezoneInfo
): string {
  const tz = timezoneInfo || getUserTimezoneInfo();

  try {
    const date = new Date(utcTimestamp);

    if (!isValidDate(date)) {
      return "Invalid date";
    }

    // Convert to user's timezone for display
    const dateInUserTz = new Date(
      date.toLocaleString("en-US", { timeZone: tz.timezone })
    );

    // Use date-fns format function
    return format(dateInUserTz, formatString);
  } catch (error) {
    logger.warn("[TIME_UTILS] Failed to format timestamp in timezone:", error);
    return "Unknown date";
  }
}

/**
 * Convert legacy timestamp to UTC if needed
 * Uses enhanced validation with date-fns
 */
export function migrateLegacyTimestamp(
  timestamp: string | number | undefined | null,
  fallbackDate?: Date
): number {
  const validation = validateAndNormalizeTimestamp(timestamp);

  if (validation.isValid && validation.utcTimestamp) {
    return validation.utcTimestamp;
  }

  // Use fallback date (validated with date-fns) or current time
  if (fallbackDate && isValidDate(fallbackDate)) {
    return fallbackDate.getTime();
  }

  return getCurrentUTCTimestamp();
}

/**
 * Check if two timestamps are in the same day in the user's timezone
 * Uses date-fns for reliable day comparison
 */
export function isSameDay(
  timestamp1: number,
  timestamp2: number,
  timezoneInfo?: TimezoneInfo
): boolean {
  const tz = timezoneInfo || getUserTimezoneInfo();

  try {
    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);

    // Validate both dates using date-fns
    if (!isValidDate(date1) || !isValidDate(date2)) {
      logger.warn("[TIME_UTILS] Invalid dates for comparison:", {
        timestamp1,
        timestamp2,
      });
      return false;
    }

    // Convert to user's timezone and compare using date-fns
    const date1InUserTz = new Date(
      date1.toLocaleString("en-US", { timeZone: tz.timezone })
    );
    const date2InUserTz = new Date(
      date2.toLocaleString("en-US", { timeZone: tz.timezone })
    );

    // Use date-fns to check if they're the same day
    return differenceInDays(date1InUserTz, date2InUserTz) === 0;
  } catch (error) {
    logger.warn("[TIME_UTILS] Failed to compare days:", error);
    return false;
  }
}

/**
 * Calculate time until start of next day in user's timezone
 * Useful for cache invalidation timing
 */
export function timeUntilMidnight(timezoneInfo?: TimezoneInfo): number {
  const tz = timezoneInfo || getUserTimezoneInfo();

  try {
    const now = new Date();
    const nowInUserTz = new Date(
      now.toLocaleString("en-US", { timeZone: tz.timezone })
    );

    // Get start of tomorrow in user's timezone
    const tomorrowStart = startOfDay(addDays(nowInUserTz, 1)); // Add 1 day

    // Convert back to UTC and calculate difference
    const tomorrowStartUTC =
      tomorrowStart.getTime() - tz.offsetMinutes * 60 * 1000;

    return Math.max(0, tomorrowStartUTC - now.getTime());
  } catch (error) {
    logger.warn("[TIME_UTILS] Failed to calculate time until midnight:", error);
    // Default to 6 hours if calculation fails
    return 6 * 60 * 60 * 1000;
  }
}

/**
 * Debug function to validate timezone-aware grouping
 * Enhanced with date-fns formatting for better debugging output
 */
export function debugTimezoneGrouping(
  keywords: Array<{ keyword: string; timestamp: number }>
): void {
  if (process.env.NODE_ENV !== "development") return;

  const tz = getUserTimezoneInfo();
  const boundaries = calculateGroupingBoundaries(tz);

  const scoped = logger.withScope("TIME_UTILS");
  scoped.info("Timezone Grouping Debug");
  scoped.info("Timezone Info:", tz);
  scoped.info("Boundaries:", {
    todayStart: format(
      new Date(boundaries.todayStart),
      "yyyy-MM-dd HH:mm:ss 'UTC'"
    ),
    yesterdayStart: format(
      new Date(boundaries.yesterdayStart),
      "yyyy-MM-dd HH:mm:ss 'UTC'"
    ),
    lastWeekStart: format(
      new Date(boundaries.lastWeekStart),
      "yyyy-MM-dd HH:mm:ss 'UTC'"
    ),
  });

  keywords.forEach((item) => {
    if (!isValidDate(new Date(item.timestamp))) {
      scoped.warn(`${item.keyword}: Invalid timestamp ${item.timestamp}`);
      return;
    }

    const group =
      item.timestamp >= boundaries.todayStart
        ? "Today"
        : item.timestamp >= boundaries.yesterdayStart
          ? "Yesterday"
          : item.timestamp >= boundaries.lastWeekStart
            ? "Last week"
            : "Older";

    const formattedTime = format(
      new Date(item.timestamp),
      "yyyy-MM-dd HH:mm:ss 'UTC'"
    );
    scoped.info(`${item.keyword}: ${formattedTime} -> ${group}`);
  });
}
