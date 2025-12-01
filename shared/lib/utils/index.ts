/**
 * Barrel exports for shared utility functions
 *
 * Organized by category for better discoverability.
 * Import from "@/shared/lib/utils" for convenience.
 *
 * Directory structure:
 * - core/      - Core utilities (cn)
 * - encoding/  - Encoding and formatting utilities
 * - opengraph/ - Open Graph fetching and caching
 * - text/      - Text parsing and highlighting
 * - time/      - Time and timezone utilities
 * - url/       - URL detection and validation
 * - validation/- Form and data validation
 * - storage/   - Session storage utilities
 */

// ============================================================================
// Core utilities
// ============================================================================
export { cn } from "./core";

// ============================================================================
// Encoding and formatting
// ============================================================================
export {
  base64UrlEncodeUtf8,
  base64UrlDecodeUtf8,
  formatRelativeTime,
  formatLargeNumber,
} from "./encoding";

// ============================================================================
// Time utilities
// ============================================================================
export {
  formatTimestampForDisplay,
  formatTimestampInTimezone,
  getUserTimezoneInfo,
  calculateGroupingBoundaries,
  validateAndNormalizeTimestamp,
  getCurrentUTCTimestamp,
  migrateLegacyTimestamp,
  isSameDay,
  timeUntilMidnight,
  debugTimezoneGrouping,
  RELATIVE_TIMESTAMP_PATTERN,
} from "./time";
export type {
  TimezoneInfo,
  GroupingBoundaries,
  TimestampValidation,
} from "./time";

// ============================================================================
// Validation
// ============================================================================
export {
  DESCRIPTION_CONSTRAINTS,
  WORKSPACE_NAME_CONSTRAINTS,
  VALIDATION_PRESETS,
  validateDescription,
  QUERY_CHAR_LIMIT,
  computeEffectiveLength,
} from "./validation";
export type { ValidationResult } from "./validation";

// ============================================================================
// URL utilities
// ============================================================================
export {
  getFirstValidUrl,
  extractTextFromEditorState,
  isLikelyToHaveOpenGraph,
  normalizeUrl,
  detectUrls,
  isValidUrl,
  cacheGet,
  cacheSet,
  cacheHas,
  cacheEntries,
  cacheClear,
} from "./url";
export type { DetectedUrl } from "./url";

// ============================================================================
// OpenGraph
// ============================================================================
export { fetchOpenGraph, openGraphCache, useOpenGraphCache } from "./opengraph";
export type {
  OpenGraphData,
  FetchOpenGraphOptions,
  FetchOpenGraphResult,
} from "./opengraph";

// ============================================================================
// Text parsing and highlighting
// ============================================================================
export { parseText } from "./text";
export { parseLinkedInText } from "./text";
export {
  highlightText,
  useHighlight,
  highlightInReactTree,
  highlightTextMultiple,
  useHighlightMultiple,
  highlightInReactTreeMultiple,
  calculateTextSimilarity,
  buildHighlightRegexFromQueries,
  extractKeywordsFromQuery,
  HIGHLIGHT_PRESETS,
} from "./text";
export type { HighlightOptions, HighlightResult } from "./text";
export { getVisibleTweetPlainText, parseTweetSource } from "./text";
export type { ParsedTweetSource } from "./text";

// ============================================================================
// Storage utilities (server-only - do not import in client components)
// These are intentionally NOT re-exported here because they use next/headers.
// Import directly from "@/shared/lib/utils/storage" in server-side code only.
// ============================================================================
