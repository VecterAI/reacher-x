/**
 * ProspectCardBody
 * Summary/bio text from the prospect's brief intro.
 * Parses links/mentions like TweetBody and truncates to 3 lines.
 */
"use client";

import { cn } from "@/shared/lib/utils";
import { parseText, highlightInReactTreeMultiple } from "@/shared/lib/utils";

interface ProspectCardBodyProps {
  text?: string;
  highlightKeywords?: string[];
  className?: string;
}

export function ProspectCardBody({
  text,
  highlightKeywords,
  className,
}: ProspectCardBodyProps) {
  if (!text) return null;

  // Parse text for links, mentions, hashtags (like TweetBody)
  const parsedContent = parseText(text);

  // Apply keyword highlighting on top of parsed content
  const highlightedContent =
    Array.isArray(highlightKeywords) && highlightKeywords.length > 0
      ? highlightInReactTreeMultiple(parsedContent, highlightKeywords)
      : parsedContent;

  return (
    <p
      className={cn(
        "[&_a]:text-muted-foreground line-clamp-3 text-sm whitespace-pre-line [&_a]:hover:underline",
        className
      )}
    >
      {highlightedContent}
    </p>
  );
}
