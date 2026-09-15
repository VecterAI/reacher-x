"use client";

import * as React from "react";
import type { Tweet as TweetType } from "@/features/threads/types";
import { cn } from "@/shared/lib/utils";
import { formatRelativeTime } from "@/shared/lib/utils";
import { TweetHeader } from "./TweetHeader";
import { TweetBody } from "./TweetBody";
import { TweetMedia } from "@/features/threads/ui/components/TweetMedia";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { TweetMenu } from "./TweetMenu";
import { OpenGraphPreview } from "@/features/composer/ui/components/OpenGraphPreview";
import {
  getFirstValidUrl,
  isLikelyToHaveOpenGraph,
  normalizeUrl,
} from "@/shared/lib/utils";
import {
  buildXPostHref,
  shouldIgnorePostCardClick,
  shouldIgnorePostCardKeyDown,
} from "@/features/webapp/lib/postNavigation";
import { useTwitterProfileNavigation } from "./useTwitterProfileNavigation";
import { usePostNavigation } from "@/features/webapp/hooks/usePostNavigation";

export interface QuoteTweetCardProps {
  tweet: TweetType;
  characterLimit?: number;
  showFullContent?: boolean;
  bodyLineClamp?: number;
  showOpenGraphPreview?: boolean;
  highlightQueries?: string[];
  className?: string;
  readOnly?: boolean;
}

export const QuoteTweetCard: React.FC<QuoteTweetCardProps> = ({
  tweet,
  characterLimit = 280,
  showFullContent = false,
  bodyLineClamp,
  showOpenGraphPreview = true,
  highlightQueries,
  className,
  readOnly = false,
}) => {
  const media = tweet?.entities?.media;
  const externalTweetUrl = `https://x.com/${tweet?.user?.screen_name}/status/${tweet?.id_str}`;
  const externalProfileUrl = `https://x.com/${tweet?.user?.screen_name}`;
  const screenName = tweet?.user?.screen_name || "";
  const { openProfile, prefetchProfile } = useTwitterProfileNavigation();
  const { hasPanelStack, openTwitterPost } = usePostNavigation();
  const hasQuoted = tweet?.is_quote_status && tweet?.quoted_status;

  const postHref = React.useMemo(() => buildXPostHref(tweet), [tweet]);

  const openPost = React.useCallback(() => {
    openTwitterPost(tweet, hasPanelStack ? "panel" : "route");
  }, [hasPanelStack, openTwitterPost, tweet]);

  const handleCardNavigate = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly) return;
    if (shouldIgnorePostCardClick(e)) return;
    e.stopPropagation();
    openPost();
  };

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

  // Source intentionally hidden in quoted tweet cards to reduce visual noise.
  const interactiveCardProps = readOnly
    ? {
        role: "article" as const,
      }
    : {
        role: "button" as const,
        tabIndex: 0,
        onClick: handleCardNavigate,
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
          if (shouldIgnorePostCardKeyDown(e) || !postHref) return;
          e.preventDefault();
          e.stopPropagation();
          openPost();
        },
      };

  return (
    <div
      {...interactiveCardProps}
      className={cn(
        "group block w-full rounded-xl border p-2 transition-colors",
        readOnly
          ? "cursor-default"
          : "cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900",
        className
      )}
      aria-label={`View post by ${tweet?.user?.name ?? tweet?.user?.screen_name ?? "user"}`}
    >
      {/* Single column layout with avatar in header */}
      <div className="flex flex-col">
        {/* Header with integrated avatar */}
        <header className="mb-1 flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (screenName)
                openProfile({
                  username: screenName,
                  seedProfile: tweet.user,
                });
            }}
            onMouseEnter={() => screenName && prefetchProfile(screenName)}
            onFocus={() => screenName && prefetchProfile(screenName)}
            aria-label={`View ${tweet?.user?.name ?? tweet?.user?.screen_name ?? "user"}'s profile`}
          >
            <Avatar className="ring-border h-6 w-6 ring-1">
              <AvatarImage
                src={tweet?.user?.profile_image_url_https}
                alt={`Avatar of ${tweet?.user?.name}`}
              />
              <AvatarFallback>
                {tweet?.user?.name?.charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <TweetHeader staticUser={tweet?.user}>
              <time
                className="text-muted-foreground shrink-0 text-sm"
                dateTime={tweet?.tweet_created_at}
              >
                · {formatRelativeTime(tweet?.tweet_created_at)}
              </time>
            </TweetHeader>
            {!readOnly ? (
              <TweetMenu
                tweetUrl={externalTweetUrl}
                profileUrl={externalProfileUrl}
                screenName={screenName}
                tweet={tweet}
                characterLimit={characterLimit}
                showFullContent={showFullContent}
                className="ml-auto shrink-0"
              />
            ) : null}
          </div>
        </header>

        {/* Body */}
        <TweetBody
          tweet={tweet}
          characterLimit={characterLimit}
          showFullContent={showFullContent}
          bodyLineClamp={bodyLineClamp}
          highlightQueries={highlightQueries}
          className="mb-1"
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

        {/* Source hidden in quotes */}
      </div>
    </div>
  );
};

QuoteTweetCard.displayName = "QuoteTweetCard";
