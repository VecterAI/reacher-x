/**
 * URL Detection and Validation Utilities
 *
 * Provides robust URL detection, validation, and extraction from text content
 * following Open Graph and social media best practices.
 */

export interface DetectedUrl {
  url: string;
  startIndex: number;
  endIndex: number;
  isValid: boolean;
}

/**
 * Comprehensive URL regex pattern that matches valid URLs
 * Based on RFC 3986 and common URL patterns used by social media platforms
 */
const URL_REGEX =
  /https?:\/\/(?:[-\w.])+(?::[0-9]+)?(?:\/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?/gi;

/**
 * Additional validation for URLs to ensure they're properly formatted
 */
const URL_VALIDATION_REGEX =
  /^https?:\/\/(?:[-\w.])+(?::[0-9]+)?(?:\/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?$/i;

/**
 * Extract text content from Lexical editor state
 * Preserve line breaks between blocks and soft line breaks.
 */
export function extractTextFromEditorState(editorState: unknown): string {
  if (!editorState || typeof editorState !== "object") return "";

  const state = editorState as { root?: { children?: unknown[] } };
  const rootChildren = state.root?.children;
  if (!Array.isArray(rootChildren)) return "";

  const getText = (node: unknown): string => {
    if (!node || typeof node !== "object") return "";
    const n = node as {
      type?: string;
      text?: string;
      children?: unknown[];
    };
    const type = n.type;
    const text = typeof n.text === "string" ? n.text : "";
    const children = Array.isArray(n.children) ? n.children : [];

    // Preserve soft line breaks
    if (type === "linebreak") {
      return "\n";
    }

    // Recurse children first
    const childText = children.map(getText).join("");

    // Text node
    if (text) return text;

    // Block nodes: add newline after their content
    if (type === "paragraph" || type === "heading" || type === "quote") {
      return childText + "\n";
    }

    // Lists: ensure items are separated with newlines
    if (type === "list") {
      return childText;
    }
    if (type === "listitem") {
      return childText + "\n";
    }

    // Inline containers (links, hashtags, mentions, etc.)
    return childText;
  };

  const combined = rootChildren.map(getText).join("");
  // Remove trailing newlines introduced by block processing
  return combined.replace(/\n+$/, "");
}

/**
 * Detect all URLs in text content with position information
 */
export function detectUrls(text: string): DetectedUrl[] {
  if (!text || typeof text !== "string") return [];

  const urls: DetectedUrl[] = [];
  let match;

  // Reset regex lastIndex to ensure we start from the beginning
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    const url = match[0];
    const isValid = URL_VALIDATION_REGEX.test(url);

    urls.push({
      url,
      startIndex: match.index,
      endIndex: match.index + url.length,
      isValid,
    });
  }

  return urls;
}

/**
 * Get the first valid URL from text content
 * Returns null if no valid URL is found
 */
export function getFirstValidUrl(text: string): string | null {
  const urls = detectUrls(text);
  const validUrl = urls.find((url) => url.isValid);
  return validUrl?.url || null;
}

/**
 * Validate if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;

  try {
    new URL(url);
    return URL_VALIDATION_REGEX.test(url);
  } catch {
    return false;
  }
}

/**
 * Normalize URL for consistent processing
 * Removes trailing slashes and normalizes protocol
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove trailing slash unless it's the root path
    if (urlObj.pathname !== "/" && urlObj.pathname.endsWith("/")) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }
    return urlObj.toString();
  } catch {
    return url;
  }
}

/**
 * Check if URL is likely to have Open Graph data
 * Filters out common non-content URLs
 */
export function isLikelyToHaveOpenGraph(url: string): boolean {
  if (!isValidUrl(url)) return false;

  try {
    // Skip common non-content URLs
    const skipPatterns = [
      /^mailto:/i,
      /^tel:/i,
      /^ftp:/i,
      /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z)$/i,
      /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i,
      /\.(mp4|avi|mov|wmv|flv|webm)$/i,
      /\.(mp3|wav|flac|aac)$/i,
    ];

    return !skipPatterns.some((pattern) => pattern.test(url));
  } catch {
    return false;
  }
}
