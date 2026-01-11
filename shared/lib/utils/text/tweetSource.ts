export type ParsedTweetSource = {
  label: string;
  href?: string;
};

/**
 * Parses Twitter's HTML source string (e.g., '<a href="https://twitter.com/download/iphone">Twitter for iPhone</a>')
 * in a way that's safe for SSR and the client. Falls back to plain text when no link is present.
 */
export function parseTweetSource(
  source?: string | null
): ParsedTweetSource | null {
  if (!source) return null;
  const raw = source.trim();
  if (!raw) return null;

  // Try to extract anchor href and text without DOM APIs (SSR-safe)
  const anchorMatch = raw.match(/<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/i);
  if (anchorMatch) {
    const href = sanitizeHref(anchorMatch[1]);
    const label = stripTags(anchorMatch[2]).trim();
    if (!label) return null;
    return href ? { label, href } : { label };
  }

  const label = stripTags(raw).trim();
  if (!label) return null;
  return { label };
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

function sanitizeHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const trimmed = href.trim();
  // Allow only http/https URLs; upgrade http to https for safety
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, "https://");
  }
  return undefined;
}
