/**
 * ProspectCardBody
 * Summary/bio text from the prospect's brief intro.
 * Parses links/mentions like TweetBody and truncates to 3 lines.
 */
"use client";

import { cn } from "@/shared/lib/utils";
import { parseText, highlightInReactTreeMultiple } from "@/shared/lib/utils";
import type { TwitterUrlEntity } from "@/shared/lib/twitter/profileLinks";

interface ProspectCardBodyProps {
  text?: string;
  urlEntities?: TwitterUrlEntity[];
  highlightKeywords?: string[];
  className?: string;
}

export function ProspectCardBody({
  text,
  urlEntities,
  highlightKeywords,
  className,
}: ProspectCardBodyProps) {
  if (!text) return null;
  const parsedContent = parseText(text, { urls: urlEntities });

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
