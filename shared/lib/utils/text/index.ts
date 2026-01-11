/**
 * Text parsing and highlighting utilities
 */

// Text parsing
export { parseText } from "./parseText";
export { parseLinkedInText } from "./parseLinkedInText";

// Tweet utilities
export { parseTweetSource } from "./tweetSource";
export type { ParsedTweetSource } from "./tweetSource";
export { getVisibleTweetPlainText } from "./tweetText";

// Highlighting
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
} from "./highlighting";
export type { HighlightOptions, HighlightResult } from "./highlighting";
