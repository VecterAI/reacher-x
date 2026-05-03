import * as React from "react";
// No direct Link usage here; and avoid circular hook import in SSR
import { useProfile } from "@/features/profile/contexts/TwitterProfileContext";
import { cn } from "@/shared/lib/utils";
import { parseText } from "@/shared/lib/utils";
import { highlightInReactTreeMultiple } from "@/shared/lib/utils";
import { Tweet as TweetType } from "@/features/threads/types";
import { getVisibleTweetPlainText } from "@/shared/lib/utils";

export interface TweetBodyProps {
  tweet: TweetType;
  characterLimit?: number;
  showFullContent?: boolean;
  bodyLineClamp?: number;
  highlightQueries?: string[];
  className?: string;
  readOnly?: boolean;
}

export const TweetBody: React.FC<TweetBodyProps> = ({
  tweet,
  characterLimit = 280,
  showFullContent = false,
  bodyLineClamp,
  highlightQueries,
  className,
  readOnly = false,
}) => {
  const visibleText = getVisibleTweetPlainText(tweet, {
    characterLimit,
    showFullContent,
  });

  // Parse and highlight keywords in the tweet body
  const parsedBody = parseText(visibleText, tweet?.entities);
  const highlightedBody =
    Array.isArray(highlightQueries) && highlightQueries.length > 0
      ? highlightInReactTreeMultiple(parsedBody, highlightQueries)
      : parsedBody;
  const { openProfile } = useProfile();

  return (
    <>
      {/* Replying to */}
      {tweet?.in_reply_to_screen_name && (
        <p
          className={cn("text-muted-foreground text-sm font-medium", className)}
        >
          Replying to{" "}
          {readOnly ? (
            <span className="text-foreground font-mono">
              @{tweet?.in_reply_to_screen_name}
            </span>
          ) : (
            <button
              className="text-foreground font-mono hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                if (tweet?.in_reply_to_screen_name) {
                  openProfile({ username: tweet.in_reply_to_screen_name });
                }
              }}
            >
              @{tweet?.in_reply_to_screen_name}
            </button>
          )}
        </p>
      )}

      {/* Body */}
      <p
        lang="auto"
        className={cn(
          "word-break [&_a]:text-muted-foreground text-sm hyphens-auto whitespace-pre-line [&_a]:hover:underline dark:[&_a]:text-neutral-400",
          bodyLineClamp
            ? "[display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical]"
            : undefined
        )}
        style={
          bodyLineClamp
            ? ({ WebkitLineClamp: bodyLineClamp } as React.CSSProperties)
            : undefined
        }
        onClick={(e) => {
          if (readOnly) return;
          // Event delegation for @mention links
          const target = e.target as HTMLElement | null;
          if (!target) return;
          // Find nearest anchor if click bubbled from child
          const anchor = target.closest("a");
          if (!anchor) return;
          const text = (anchor.textContent || "").trim();
          const href = anchor.getAttribute("href") || "";
          // Heuristic: twitter-text makes mentions like https://x.com/@username or /username
          const isMention = text.startsWith("@") && /x\.com\//.test(href);
          if (!isMention) return;
          const username = text.slice(1);
          if (!username) return;
          e.preventDefault();
          e.stopPropagation();
          openProfile({ username });
        }}
      >
        {highlightedBody}
      </p>
    </>
  );
};

TweetBody.displayName = "TweetBody";
