import * as React from "react";
import type { Tweet as TweetType } from "../../types";
import { cn } from "@/shared/lib/utils/utils";
import { formatRelativeTime } from "@/shared/lib/utils/format";
import { TweetHeader } from "./TweetHeader";
import { TweetFooter } from "./TweetFooter";
import { TweetMenu } from "./TweetMenu";
import { useProfile } from "@/features/profile/contexts/ProfileContext";
import { TweetMedia } from "./TweetMedia";
import { TweetBody } from "./TweetBody";
import { QuoteTweetCard } from "./QuoteTweetCard";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { Separator } from "@/shared/ui/components/Separator";
// LinkWrapper not used in webapp Tweet

export interface TweetProps {
  tweet: TweetType;
  characterLimit?: number;
  showFullContent?: boolean;
  showThread?: boolean;
  votingContext?: {
    keywordId: string;
    searchQuery: string;
  };
  isInReplyLaterList?: boolean;
  onReplyLater?: (tweetId: string) => void;
  onRemoveReplyLater?: (tweetId: string) => void;
  highlightQuery?: string;
  className?: string;
}

export const Tweet: React.FC<TweetProps> = ({
  tweet,
  characterLimit = 280,
  showFullContent = false,
  showThread = false,
  votingContext,
  isInReplyLaterList = false,
  onReplyLater,
  onRemoveReplyLater,
  highlightQuery,
  className,
}) => {
  const media = tweet?.entities?.media;
  const tweetUrl = `https://x.com/${tweet?.user?.screen_name}/status/${tweet?.id_str}`;
  const profileUrl = `https://x.com/${tweet?.user?.screen_name}`;
  const screenName = tweet?.user?.screen_name || "";
  const { openProfile } = useProfile();

  // Quoted tweet support
  const hasQuoted = tweet?.is_quote_status && tweet?.quoted_status;
  const tweetId = tweet.id_str || tweet.id?.toString() || "";
  const threadId = tweet.conversation_id_str || tweetId;

  // Extract tweet source (e.g., Twitter for iPhone)
  let tweetSource: React.ReactNode = null;
  if (tweet?.source) {
    // tweet.source is HTML like: <a href="...">Twitter for iPhone</a>
    if (typeof window !== "undefined") {
      const parser = new window.DOMParser();
      const doc = parser.parseFromString(tweet.source, "text/html");
      const a = doc.querySelector("a");
      if (a) {
        tweetSource = (
          <span className="text-xs text-muted-foreground">
            via{" "}
            <a
              href={a.getAttribute("href") || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {a.textContent}
            </a>
          </span>
        );
      }
    }
  }

  return (
    <article
      className={cn(
        "group flex w-full cursor-pointer gap-2 overflow-hidden",
        className
      )}
      aria-label={`View post by ${tweet?.user?.name ?? tweet?.user?.screen_name ?? "user"}`}
    >
      {/* Avatar */}
      <div className="flex flex-col items-center gap-2">
        <button
          className="mt-1"
          onClick={(e) => {
            e.stopPropagation();
            if (screenName)
              openProfile({
                username: screenName,
                seedProfile: tweet.user,
              });
          }}
        >
          <Avatar className="h-8 w-8 ring-1 ring-border">
            <AvatarImage
              src={tweet?.user?.profile_image_url_https}
              alt={`Avatar of ${tweet?.user?.name}`}
            />
            <AvatarFallback>
              {tweet?.user?.name?.charAt(0).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        </button>
        {!showThread && (
          <Separator orientation="vertical" className="w-[2px]" />
        )}
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <TweetHeader
            threadId={threadId}
            tweetId={tweetId}
            size="sm"
            staticUser={tweet?.user}
          >
            <time
              className="truncate text-sm text-muted-foreground"
              dateTime={tweet?.tweet_created_at}
            >
              · {formatRelativeTime(tweet?.tweet_created_at)}
            </time>
          </TweetHeader>
          <TweetMenu
            tweetUrl={tweetUrl}
            profileUrl={profileUrl}
            screenName={screenName}
            fullText={tweet?.full_text || tweet?.text || ""}
          />
        </header>

        {/* Body */}
        <TweetBody
          tweet={tweet}
          characterLimit={characterLimit}
          showFullContent={showFullContent}
          highlightQuery={highlightQuery}
          className="my-1"
        />

        {/* Media */}
        {media && (
          <div className="block shrink-0">
            <TweetMedia media={media} />
          </div>
        )}

        {/* Quoted Tweet */}
        {hasQuoted && tweet.quoted_status && (
          <div className="mt-2">
            <QuoteTweetCard
              tweet={tweet.quoted_status}
              characterLimit={characterLimit}
              showFullContent={showFullContent}
              highlightQuery={highlightQuery}
            />
          </div>
        )}

        {/* Tweet source */}
        {tweetSource && <div className="mt-1">{tweetSource}</div>}

        {/* Footer/Actions */}
        <TweetFooter
          threadId={threadId}
          tweetId={tweetId}
          tweetUrl={tweetUrl}
          staticTweet={tweet}
          votingContext={votingContext}
          className="mt-2"
        />
        {/* Reply later/Remove button (outside TweetFooter) */}
        <div className="mt-1 flex gap-2">
          {onReplyLater && !isInReplyLaterList && tweetId && (
            <button
              className="text-xs text-muted-foreground hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onReplyLater(tweetId);
              }}
            >
              + Reply later
            </button>
          )}
          {onRemoveReplyLater && isInReplyLaterList && tweetId && (
            <button
              className="text-xs text-destructive hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveReplyLater(tweetId);
              }}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

Tweet.displayName = "Tweet";
