/**
 * Barrel exports for shared utility functions
 *
 * Organized by category for better discoverability.
 * Import from "@/shared/lib/utils" for convenience.
 */

// Core utilities
export { cn } from "./utils";

// Encoding
export { base64UrlEncodeUtf8, base64UrlDecodeUtf8 } from "./encoding";

// Formatting
export { formatRelativeTime, formatLargeNumber } from "./format";
export {
  formatTimestampForDisplay,
  formatTimestampInTimezone,
  getUserTimezoneInfo,
} from "./timeUtils";

// Validation
export { DESCRIPTION_CONSTRAINTS } from "./validation";
export { validateTokenExpiration } from "./tokenValidation";

// Storage (client-side)
export {
  getWorkspaceDescription,
  storeWorkspaceDescription,
  getWorkspaceName,
  storeWorkspaceName,
  storeWorkspaceSourceUrl,
  clearAllLocalAppData,
  STORAGE_KEYS,
} from "./localStorage";

// URL utilities
export {
  getFirstValidUrl,
  extractTextFromEditorState,
  isLikelyToHaveOpenGraph,
  normalizeUrl,
} from "./urlDetection";
export { cacheGet, cacheSet } from "./urlDescriptionCache";

// OpenGraph
export { fetchOpenGraph } from "./opengraph";
export type { OpenGraphData } from "./opengraph";
export { openGraphCache } from "./opengraphCache";

// Text parsing
export { parseText } from "./parseText";
export { parseLinkedInText } from "./parseLinkedInText";
export { highlightText } from "./highlighting";
export { getVisibleTweetPlainText } from "./tweetText";

// Tweet utilities
export { parseTweetSource } from "./tweetSource";

// Query utilities
export { QUERY_CHAR_LIMIT, computeEffectiveLength } from "./queryLimit";

// Feature flags
export { isLlmFilterDisabled } from "./featureFlags";

// Performance
export {
  performanceMonitor,
  startNavigation,
  startSearch,
  endSearch,
  getMetrics,
} from "./performance";
