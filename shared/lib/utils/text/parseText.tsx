import React from "react";
import twitter from "twitter-text";

// Function to detect and link email addresses as React elements
function linkEmails(text: string, pathPrefix?: string): React.ReactNode[] {
  const emailRegex =
    /(?:[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+)@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = emailRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const email = match[0];
    parts.push(
      <a
        key={`email-${pathPrefix ?? "p"}-${match.index}`}
        href={`mailto:${email}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-500 hover:underline"
      >
        {email}
      </a>
    );
    lastIndex = match.index + email.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

// Main parsing function: returns React nodes
export function parseText(
  body: string,
  entities?: {
    urls?: Array<{
      url: string;
      expanded_url: string;
      display_url: string;
      indices: [number, number];
    }>;
  }
): React.ReactNode {
  if (!body) return null;
  const urlEntities = entities?.urls ?? [];
  const urlEntityByHref = new Map<string, (typeof urlEntities)[number]>();
  for (const entity of urlEntities) {
    urlEntityByHref.set(entity.url, entity);
    urlEntityByHref.set(entity.expanded_url, entity);
  }

  // Use twitter-text to auto-link hashtags, mentions, and URLs as HTML.
  // Pass the raw text — twitter-text performs its own escaping.
  const twitterParsed = twitter.autoLink(body, {
    hashtagUrlBase: "https://x.com/hashtag/",
    usernameUrlBase: "https://x.com/",
    usernameIncludeSymbol: true,
    targetBlank: true,
    urlEntities,
  });
  // Parse the generated HTML string into React elements in an isomorphic way
  // to ensure SSR and CSR produce identical trees (no DOMParser).

  // Minimal HTML entity decoder to mirror browser behavior for text nodes.
  // Also handles accidental double-encoding by decoding until stable.
  const decodeEntities = (text: string): string => {
    const prev = text;
    let next = prev
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    // If decoding changed the string, try once more to collapse double-encoding
    if (next !== prev) {
      next = next
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }
    return next;
  };

  // Extract <a ...>...</a> anchors from the html string and build React nodes
  const anchorRegex = /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const pushTextSegment = (segment: string, keyPrefix: string) => {
    if (!segment) return;
    const decoded = decodeEntities(segment);
    nodes.push(...linkEmails(decoded, keyPrefix));
  };

  while ((match = anchorRegex.exec(twitterParsed)) !== null) {
    const [full, attrString, innerHtml] = match;
    // Preceding text
    const textBefore = twitterParsed.slice(lastIndex, match.index);
    pushTextSegment(textBefore, `t-${lastIndex}`);

    // Parse attributes into an object
    const attrs: Record<string, string> = {};
    const attrRe = /(href|target|rel|class)=["']([^"']*)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(attrString)) !== null) {
      attrs[m[1].toLowerCase()] = m[2];
    }

    const href = attrs["href"];
    const target = attrs["target"];
    const rel = attrs["rel"];
    const className = attrs["class"];

    // Derive clean, human-friendly anchor text:
    // 1) Prefer display_url from matching entity
    // 2) Fallback to text content by stripping any nested HTML from innerHtml
    // 3) Fallback to href
    let anchorText = "";
    const matchedEntity = href ? urlEntityByHref.get(href) : undefined;
    if (matchedEntity?.display_url) {
      anchorText = matchedEntity.display_url;
    } else {
      const textOnly = innerHtml.replace(/<[^>]*>/g, "");
      anchorText = decodeEntities(textOnly).trim() || href || "";
    }

    nodes.push(
      <a
        key={`a-${match.index}`}
        href={href}
        target={target}
        rel={rel}
        className={className}
      >
        {anchorText}
      </a>
    );

    lastIndex = match.index + full.length;
  }

  // Trailing text after the last anchor
  pushTextSegment(twitterParsed.slice(lastIndex), `t-${lastIndex}`);

  return <>{nodes}</>;
}
