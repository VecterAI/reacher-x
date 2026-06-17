import * as React from "react";
// No direct Link usage here; and avoid circular hook import in SSR
import { useProfile } from "@/features/profile/contexts/TwitterProfileContext";
import { cn } from "@/shared/lib/utils";
import { parseText } from "@/shared/lib/utils";
import { highlightInReactTreeMultiple } from "@/shared/lib/utils";
import { Tweet as TweetType } from "@/features/threads/types";
import { getVisibleTweetPlainText } from "@/shared/lib/utils";

function getNodeText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(getNodeText).join("");
  }
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return getNodeText(props.children);
  }
  return "";
}

function enhanceMentionLinks(
  node: React.ReactNode,
  onMentionClick:
    | ((username: string, event: React.MouseEvent<HTMLAnchorElement>) => void)
    | null
): React.ReactNode {
  if (!onMentionClick || node === null || node === undefined) {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map((child) => enhanceMentionLinks(child, onMentionClick));
  }

  if (!React.isValidElement(node)) {
    return node;
  }

  if (node.type === "a") {
    const anchorElement = node as React.ReactElement<
      React.AnchorHTMLAttributes<HTMLAnchorElement>
    >;
    const props = anchorElement.props as {
      children?: React.ReactNode;
      href?: string;
      onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    };
    const text = getNodeText(props.children).trim();
    const href = props.href ?? "";
    const isMentionLink = text.startsWith("@") && /x\.com\//.test(href);

    if (isMentionLink) {
      const username = text.slice(1);
      return React.cloneElement(anchorElement, {
        onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
          props.onClick?.(event);
          if (event.defaultPrevented || !username) {
            return;
          }
          onMentionClick(username, event);
        },
      });
    }

    return node;
  }

  const element = node as React.ReactElement<{ children?: React.ReactNode }>;
  return React.cloneElement(
    element,
    undefined,
    enhanceMentionLinks(element.props.children, onMentionClick)
  );
}

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
  const handleMentionClick = React.useCallback(
    (username: string, event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      event.stopPropagation();
      openProfile({ username });
    },
    [openProfile]
  );
  const interactiveBody = React.useMemo(
    () =>
      readOnly
        ? highlightedBody
        : enhanceMentionLinks(highlightedBody, handleMentionClick),
    [handleMentionClick, highlightedBody, readOnly]
  );

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
              type="button"
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
      >
        {interactiveBody}
      </p>
    </>
  );
};

TweetBody.displayName = "TweetBody";
