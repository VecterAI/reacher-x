import React from "react";
import twitter from "twitter-text";

// Function to detect and link email addresses as React elements
function linkEmails(text: string): React.ReactNode[] {
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
        key={`email-${match.index}`}
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
  // Escape HTML characters to prevent XSS
  const escaped = twitter.htmlEscape(body);
  // Use twitter-text to auto-link hashtags, mentions, and URLs as HTML
  const twitterParsed = twitter.autoLink(escaped, {
    hashtagUrlBase: "https://x.com/hashtag/",
    usernameUrlBase: "https://x.com/",
    usernameIncludeSymbol: true,
    targetBlank: true,
    urlEntities: entities?.urls || [],
  });
  // Now, parse the HTML string into React elements
  // We'll use a simple DOMParser approach for this (safe since input is sanitized)
  const parser = typeof window !== "undefined" ? new window.DOMParser() : null;
  let nodes: React.ReactNode[] = [];
  if (parser) {
    const doc = parser.parseFromString(
      `<div>${twitterParsed}</div>`,
      "text/html"
    );
    const walk = (node: ChildNode): React.ReactNode => {
      if (node.nodeType === Node.TEXT_NODE) {
        // Link emails in text nodes
        return linkEmails(node.textContent || "");
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const children = Array.from(node.childNodes).map(walk);
        if (el.tagName === "A") {
          return (
            <a
              key={(el.textContent ?? "") + (el.getAttribute("href") ?? "")}
              href={el.getAttribute("href") || undefined}
              target={el.getAttribute("target") || undefined}
              rel={el.getAttribute("rel") || undefined}
              className={el.getAttribute("class") || undefined}
            >
              {children}
            </a>
          );
        }
        // For other tags, just render children
        return (
          <React.Fragment key={el.textContent ?? "fragment"}>
            {children}
          </React.Fragment>
        );
      }
      return null;
    };
    const root = doc.body.firstChild;
    if (root) {
      nodes = Array.from(root.childNodes).map(walk).flat();
    }
  } else {
    // Fallback: just link emails in the HTML string (SSR)
    nodes = linkEmails(twitterParsed);
  }
  return <>{nodes}</>;
}
