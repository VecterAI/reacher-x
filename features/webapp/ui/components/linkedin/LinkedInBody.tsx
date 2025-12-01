// features/webapp/ui/components/linkedin/LinkedInBody.tsx
"use client";

import * as React from "react";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { cn } from "@/shared/lib/utils";
import { parseLinkedInText } from "@/shared/lib/utils";
import {
  highlightInReactTreeMultiple,
  HIGHLIGHT_PRESETS,
} from "@/shared/lib/utils";

export interface LinkedInBodyProps {
  post: UnifiedPost;
  characterLimit?: number;
  showFullContent?: boolean;
  highlightQueries?: string[];
  className?: string;
}

function getVisibleLinkedInText(
  text: string,
  opts?: { characterLimit?: number; showFullContent?: boolean }
): string {
  const limit = opts?.characterLimit ?? 300;
  const full = String(text || "");
  if (opts?.showFullContent || full.length <= limit) return full;
  return full.substring(0, limit) + ".... Read more ↗";
}

export const LinkedInBody: React.FC<LinkedInBodyProps> = ({
  post,
  characterLimit = 300,
  showFullContent = false,
  highlightQueries,
  className,
}) => {
  const visible = getVisibleLinkedInText(post?.text || "", {
    characterLimit,
    showFullContent,
  });

  const parsed = parseLinkedInText(visible);
  const content =
    Array.isArray(highlightQueries) && highlightQueries.length > 0
      ? highlightInReactTreeMultiple(parsed, highlightQueries, {
          ...HIGHLIGHT_PRESETS.KEYWORD,
        })
      : parsed;

  return (
    <div
      className={cn(
        "word-break hyphens-auto whitespace-pre-line text-sm [&_a]:text-muted-foreground hover:[&_a]:underline dark:[&_a]:text-neutral-400",
        className
      )}
      lang="auto"
    >
      {content}
    </div>
  );
};

