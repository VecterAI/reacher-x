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

function stripLeadingReplyMentions(text: string, tweet: Tweet): string {
  if (!tweet?.in_reply_to_screen_name || !text) {
    return text;
  }

  const mentions = Array.isArray(tweet.entities?.user_mentions)
    ? tweet.entities.user_mentions
        .filter(
          (
            mention
          ): mention is NonNullable<
            NonNullable<Tweet["entities"]>["user_mentions"]
          >[number] =>
            Boolean(mention) &&
            Array.isArray(mention.indices) &&
            mention.indices.length === 2 &&
            typeof mention.indices[0] === "number" &&
            typeof mention.indices[1] === "number"
        )
        .slice()
        .sort((left, right) => left.indices[0] - right.indices[0])
    : [];

  let sliceStart = 0;

  for (const mention of mentions) {
    const [start, end] = mention.indices;
    if (start < sliceStart) {
      continue;
    }

    const gap = text.slice(sliceStart, start);
    if (gap.trim().length > 0) {
      break;
    }

    const mentionText = text.slice(start, end);
    if (!mentionText.startsWith("@")) {
      break;
    }

    sliceStart = end;

    while (sliceStart < text.length && /\s/.test(text.charAt(sliceStart))) {
      sliceStart += 1;
    }
  }

  return sliceStart > 0 ? text.slice(sliceStart) : text;
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
  const fullText = stripLeadingReplyMentions(
    decodeEntities(stripTcoMediaLinks(ranged, allTcoMediaUrls)),
    tweet
  ).trimStart();

  const isTextLong = fullText.length > characterLimit;
  const visibleText =
    showFullContent || !isTextLong
      ? fullText
      : fullText.substring(0, characterLimit) + ".... Read full ↗";

  return visibleText;
}
