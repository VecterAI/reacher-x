import * as React from "react";
import type { Tweet as TweetType } from "@/features/threads/types";
import { cn } from "@/shared/lib/utils";
import { formatRelativeTime } from "@/shared/lib/utils";
import { TweetHeader } from "./TweetHeader";
import { TweetFooter } from "./TweetFooter";
import { TweetMenu } from "./TweetMenu";
import { useProfile } from "@/features/profile/contexts/TwitterProfileContext";
import { TweetMedia } from "@/features/threads/ui/components/TweetMedia";
import { TweetBody } from "./TweetBody";
import { QuoteTweetCard } from "./QuoteTweetCard";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { Separator } from "@/shared/ui/components/Separator";
// LinkWrapper not used in webapp Tweet
import { OpenGraphPreview } from "@/features/composer/ui/components/OpenGraphPreview";
import {
  getFirstValidUrl,
  isLikelyToHaveOpenGraph,
  normalizeUrl,
} from "@/shared/lib/utils";
import { parseTweetSource } from "@/shared/lib/utils";

export interface TweetProps {
  tweet: TweetType;
  characterLimit?: number;
  showFullContent?: boolean;
  bodyLineClamp?: number;
  showOpenGraphPreview?: boolean;
  showMenu?: boolean;
  showSource?: boolean;
  showFooter?: boolean;
  interactiveCursor?: boolean;
  showThread?: boolean;
  isInReplyLaterList?: boolean;
  onReplyLater?: (tweetId: string) => void;
  onRemoveReplyLater?: (tweetId: string) => void;
  highlightQueries?: string[];
  className?: string;
  readOnly?: boolean;
}

export const Tweet: React.FC<TweetProps> = ({
  tweet,
  characterLimit = 280,
  showFullContent = false,
  bodyLineClamp,
  showOpenGraphPreview = true,
  showMenu,
  showSource = true,
  showFooter = true,
  interactiveCursor,
  showThread = false,
  isInReplyLaterList = false,
  onReplyLater,
  onRemoveReplyLater,
  highlightQueries,
  className,
  readOnly = false,
}) => {
  const media = tweet?.entities?.media;
  const tweetUrl = `https://x.com/${tweet?.user?.screen_name}/status/${tweet?.id_str}`;
  const profileUrl = `https://x.com/${tweet?.user?.screen_name}`;
  const screenName = tweet?.user?.screen_name || "";
  const { openProfile } = useProfile();
  const [isHovered, setIsHovered] = React.useState(false);
  const shouldShowMenu = showMenu ?? !readOnly;

  // Detect first external URL suitable for Open Graph preview
  const ogUrl: string | null = React.useMemo(() => {
    // Prefer expanded_url from entities
    const entityUrls = Array.isArray(tweet?.entities?.urls)
      ? tweet.entities.urls
      : [];
    for (const u of entityUrls) {
      const candidate = normalizeUrl((u?.expanded_url || u?.url || "").trim());
      if (candidate && isLikelyToHaveOpenGraph(candidate)) {
        return candidate;
      }
    }

    // Fallback to scanning visible text
    const rawText = tweet?.full_text || tweet?.text || "";
    const candidate = getFirstValidUrl(rawText);
    if (candidate && isLikelyToHaveOpenGraph(candidate)) {
      return normalizeUrl(candidate);
    }
    return null;
  }, [tweet]);

  // Quoted tweet support
  const hasQuoted = tweet?.is_quote_status && tweet?.quoted_status;
  const tweetId = tweet.id_str || tweet.id?.toString() || "";

  // Extract and parse tweet source (SSR-safe)
  const parsedSource = React.useMemo(
    () => parseTweetSource(tweet?.source),
    [tweet?.source]
  );

  return (
    <article
      className={cn(
        "group flex w-full gap-2 overflow-hidden",
        (interactiveCursor ?? !readOnly) ? "cursor-pointer" : "cursor-default",
        className
      )}
      aria-label={`Post by ${tweet?.user?.name ?? tweet?.user?.screen_name ?? "user"}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Left column: avatar + thread guideline */}
      <div className="flex flex-col items-center gap-2">
        {readOnly ? (
          <Avatar className="ring-border mt-1 h-8 w-8 ring-1">
            <AvatarImage
              src={tweet?.user?.profile_image_url_https}
              alt={`Avatar of ${tweet?.user?.name}`}
            />
            <AvatarFallback>
              {tweet?.user?.name?.charAt(0).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (screenName)
                openProfile({ username: screenName, seedProfile: tweet.user });
            }}
            aria-label={`View ${tweet?.user?.name ?? tweet?.user?.screen_name ?? "user"}'s profile`}
          >
            <Avatar className="ring-border mt-1 h-8 w-8 ring-1">
              <AvatarImage
                src={tweet?.user?.profile_image_url_https}
                alt={`Avatar of ${tweet?.user?.name}`}
              />
              <AvatarFallback>
                {tweet?.user?.name?.charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
          </button>
        )}
        {!showThread && <Separator className="w-0.5 flex-1" />}
      </div>

      {/* Right column: content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-w-0 items-center gap-2">
          <TweetHeader staticUser={tweet?.user} readOnly={readOnly}>
            <time
              className="text-muted-foreground shrink-0 text-sm"
              dateTime={tweet?.tweet_created_at}
              title={
                tweet?.tweet_created_at
                  ? new Date(tweet.tweet_created_at).toLocaleString()
                  : undefined
              }
            >
              · {formatRelativeTime(tweet?.tweet_created_at)}
            </time>
          </TweetHeader>
          {shouldShowMenu ? (
            <TweetMenu
              tweetUrl={tweetUrl}
              profileUrl={profileUrl}
              screenName={screenName}
              tweet={tweet}
              characterLimit={characterLimit}
              showFullContent={showFullContent}
              className="ml-auto shrink-0"
              readOnly={readOnly}
            />
          ) : null}
        </header>

        {/* Body */}
        <TweetBody
          tweet={tweet}
          characterLimit={characterLimit}
          showFullContent={showFullContent}
          bodyLineClamp={bodyLineClamp}
          highlightQueries={highlightQueries}
          className="my-1"
          readOnly={readOnly}
        />

        {/* Open Graph preview for external links (only when no media and no quote) */}
        {showOpenGraphPreview && ogUrl && !media && !hasQuoted && (
          <div className="mt-2">
            <OpenGraphPreview
              url={ogUrl}
              context="timeline"
              debounceMs={300}
              enableCache
              retryOnError
            />
          </div>
        )}
        {/* Media */}
        {media && (
          <div className="mt-2 block shrink-0">
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
              bodyLineClamp={bodyLineClamp}
              showOpenGraphPreview={showOpenGraphPreview}
              highlightQueries={highlightQueries}
              readOnly={readOnly}
            />
          </div>
        )}

        {/* Tweet source */}
        {showSource && parsedSource && (
          <div className="mt-1">
            <span className="text-muted-foreground text-xs">
              Source:{" "}
              {parsedSource.href ? (
                <a
                  href={parsedSource.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {parsedSource.label}
                </a>
              ) : (
                parsedSource.label
              )}
            </span>
          </div>
        )}

        {/* Footer/Actions */}
        {showFooter ? (
          <TweetFooter
            tweet={tweet}
            className="mt-2"
            isHovered={isHovered}
            readOnly={readOnly}
          />
        ) : null}
        {/* Reply later/Remove button (outside TweetFooter) */}
        <div className="mt-1 flex gap-2">
          {onReplyLater && !isInReplyLaterList && tweetId && (
            <button
              className="text-muted-foreground text-xs hover:underline"
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
              className="text-destructive text-xs hover:underline"
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
