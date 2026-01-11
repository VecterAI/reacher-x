/**
 * URL utilities
 */

// URL detection and validation
export {
  extractTextFromEditorState,
  detectUrls,
  getFirstValidUrl,
  isValidUrl,
  normalizeUrl,
  isLikelyToHaveOpenGraph,
} from "./urlDetection";
export type { DetectedUrl } from "./urlDetection";

// URL description cache (client-side)
export {
  cacheGet,
  cacheSet,
  cacheHas,
  cacheEntries,
  cacheClear,
} from "./urlDescriptionCache";

// Social profile URL parsing
export {
  extractLinkedInUsername,
  extractTwitterUsername,
  isLinkedInUrl,
  isTwitterUrl,
} from "./socialProfiles";
