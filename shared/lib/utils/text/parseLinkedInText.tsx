import React from "react";
import twitter from "twitter-text";

// Link email addresses within a text segment
function linkEmails(text: string, keyPrefix?: string): React.ReactNode[] {
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
        key={`email-${keyPrefix ?? "p"}-${match.index}`}
        href={`mailto:${email}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:underline"
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

// Decode a small set of common HTML entities in plain text
function decodeEntities(text: string): string {
  const prev = text;
  let next = prev
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  if (next !== prev) {
    next = next
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
  return next;
}

function toDisplayUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    let path = u.pathname || "/";
    if (path !== "/" && path.endsWith("/")) path = path.slice(0, -1);
    return host + (path === "/" ? "" : path);
  } catch {
    return url;
  }
}

export function parseLinkedInText(body: string): React.ReactNode {
  if (!body) return null;
  const text = decodeEntities(body);

  const html = twitter.autoLink(text, {
    hashtagUrlBase:
      "https://www.linkedin.com/search/results/content/?keywords=%23",
    usernameUrlBase:
      "https://www.linkedin.com/search/results/people/?keywords=",
    usernameIncludeSymbol: true,
    targetBlank: true,
  });

  const anchorRegex = /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  const pushText = (segment: string, keyPrefix: string) => {
    if (!segment) return;
    const decoded = decodeEntities(segment);
    nodes.push(...linkEmails(decoded, keyPrefix));
  };

  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) !== null) {
    const [full, attrString, innerHtml] = match;
    pushText(html.slice(lastIndex, match.index), `t-${lastIndex}`);

    const attrs: Record<string, string> = {};
    const attrRe = /(href|target|rel|class)=["']([^"']*)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(attrString)) !== null) {
      attrs[m[1].toLowerCase()] = m[2];
    }

    const href = attrs["href"];
    const target = attrs["target"];
    const rel = attrs["rel"];
    const className = attrs["class"] || "text-muted-foreground hover:underline";
    const textOnly = innerHtml.replace(/<[^>]*>/g, "");
    const anchorText = toDisplayUrl(
      decodeEntities(textOnly).trim() || href || ""
    );

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

  pushText(html.slice(lastIndex), `t-${lastIndex}`);

  return <>{nodes}</>;
}
