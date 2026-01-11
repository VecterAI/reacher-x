/**
 * Social Profile URL Parsing Utilities
 * Single source of truth for extracting usernames from social profile URLs.
 */

/**
 * Extracts LinkedIn username from a LinkedIn profile URL.
 * Handles both /in/ (personal) and /company/ (company) profile patterns.
 *
 * @example
 * extractLinkedInUsername("https://linkedin.com/in/johndoe") // "johndoe"
 * extractLinkedInUsername("https://www.linkedin.com/company/acme-corp") // "acme-corp"
 * extractLinkedInUsername("invalid-url") // undefined
 */
export function extractLinkedInUsername(url: string): string | undefined {
  if (!url) return undefined;

  // Pattern for personal profiles: /in/username
  const inMatch = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  if (inMatch?.[1]) return inMatch[1];

  // Pattern for company profiles: /company/name
  const companyMatch = url.match(/linkedin\.com\/company\/([^/?#]+)/i);
  if (companyMatch?.[1]) return companyMatch[1];

  return undefined;
}

/**
 * Extracts Twitter/X username from a Twitter profile URL.
 *
 * @example
 * extractTwitterUsername("https://twitter.com/johndoe") // "johndoe"
 * extractTwitterUsername("https://x.com/johndoe") // "johndoe"
 */
export function extractTwitterUsername(url: string): string | undefined {
  if (!url) return undefined;

  // Handle both twitter.com and x.com
  const match = url.match(/(?:twitter\.com|x\.com)\/([^/?#]+)/i);
  if (match?.[1] && !["intent", "share", "i"].includes(match[1])) {
    return match[1];
  }

  return undefined;
}

/**
 * Checks if a URL is a LinkedIn profile URL.
 */
export function isLinkedInUrl(url: string): boolean {
  return /linkedin\.com\/(in|company)\//i.test(url);
}

/**
 * Checks if a URL is a Twitter/X profile URL.
 */
export function isTwitterUrl(url: string): boolean {
  return /(?:twitter\.com|x\.com)\/[^/?#]+/i.test(url);
}
