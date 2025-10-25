import type { Tweet } from "@/features/threads/types";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripTcoMediaLinks(text: string, urls: string[]): string {
  if (!urls?.length) return text;
  let out = text;
  for (const u of urls) {
    const re = new RegExp(escapeRegExp(u), "g");
    out = out.replace(re, "");
  }
  // Collapse spaces/tabs but preserve line breaks
  out = out.replace(/[\t ]{2,}/g, " ");
  // Trim spaces around newlines without removing the newline
  out = out.replace(/[\t ]*\n[\t ]*/g, "\n");
  // Trim spaces at start/end of each line
  out = out.replace(/^[\t ]+|[\t ]+$/gm, "");
  return out;
}

function collectTcoMediaUrls(tweet: Tweet): string[] {
  const mediaEntityList = Array.isArray(tweet?.entities?.media)
    ? (tweet?.entities?.media ?? [])
    : [];
  const mediaUrls = mediaEntityList
    .map((m) => m?.url)
    .filter((u): u is string => typeof u === "string" && u.length > 0);

  const urlEntities = Array.isArray(tweet?.entities?.urls)
    ? tweet?.entities?.urls
    : [];
  const mediaTcoUrlsFromEntities = urlEntities
    .filter(
      (u) =>
        typeof u?.url === "string" &&
        /https:\/\/t\.co\//.test(u.url) &&
        typeof u?.display_url === "string" &&
        /^pic\.twitter\.com\b/.test(u.display_url)
    )
    .map((u) => u.url);

  return [...mediaUrls, ...mediaTcoUrlsFromEntities];
}

// Simple decoder for common entities; runs twice to collapse double-encodings
function decodeEntities(text: string): string {
  const decodeOnce = (t: string) =>
    t
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  const once = decodeOnce(text);
  return decodeOnce(once);
}

export function getVisibleTweetPlainText(
  tweet: Tweet,
  opts?: { characterLimit?: number; showFullContent?: boolean }
): string {
  const characterLimit = opts?.characterLimit ?? 280;
  const showFullContent = opts?.showFullContent ?? false;

  const raw = tweet?.full_text ?? tweet?.text ?? "";

  // Apply display_text_range if available
  const ranged = Array.isArray(tweet?.display_text_range)
    ? raw.slice(tweet.display_text_range[0], tweet.display_text_range[1])
    : raw;

  const allTcoMediaUrls = collectTcoMediaUrls(tweet);
  // Decode entities before/after stripping media URLs to avoid artifacts
  const fullText = decodeEntities(stripTcoMediaLinks(ranged, allTcoMediaUrls));

  const isTextLong = fullText.length > characterLimit;
  const visibleText =
    showFullContent || !isTextLong
      ? fullText
      : fullText.substring(0, characterLimit) + ".... Read full ↗";

  return visibleText;
}
