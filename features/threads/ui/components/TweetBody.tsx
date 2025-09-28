import * as React from "react";
// No direct Link usage here; and avoid circular hook import in SSR
import { useProfile } from "@/features/profile/contexts/ProfileContext";
import { cn } from "@/shared/lib/utils/utils";
import { parseText } from "@/shared/lib/utils/parseText";
import { highlightInReactTree } from "@/shared/lib/utils/highlighting";
import { Tweet as TweetType } from "../../types";

export interface TweetBodyProps {
  tweet: TweetType;
  characterLimit?: number;
  showFullContent?: boolean;
  highlightQuery?: string;
  className?: string;
}

export const TweetBody: React.FC<TweetBodyProps> = ({
  tweet,
  characterLimit = 280,
  showFullContent = false,
  highlightQuery,
  className,
}) => {
  const fullText = tweet?.full_text || tweet?.text || "Tweet text unavailable";
  const isTextLong = fullText.length > characterLimit;
  const visibleText =
    showFullContent || !isTextLong
      ? fullText
      : fullText.substring(0, characterLimit) + ".... Read full ↗";

  // Parse and highlight keywords in the tweet body
  const parsedBody = parseText(visibleText, tweet?.entities);
  const highlightedBody = highlightInReactTree(parsedBody, highlightQuery);
  const { openProfile } = useProfile();

  return (
    <>
      {/* Replying to */}
      {tweet?.in_reply_to_screen_name && (
        <p
          className={cn("text-sm font-medium text-muted-foreground", className)}
        >
          Replying to{" "}
          <button
            className="font-mono text-foreground hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              if (tweet?.in_reply_to_screen_name) {
                openProfile({ username: tweet.in_reply_to_screen_name });
              }
            }}
          >
            @{tweet?.in_reply_to_screen_name}
          </button>
        </p>
      )}

      {/* Body */}
      <p
        lang="auto"
        className="word-break hyphens-auto whitespace-pre-line text-sm [&_a]:text-muted-foreground hover:[&_a]:underline dark:[&_a]:text-neutral-400"
        onClick={(e) => {
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
