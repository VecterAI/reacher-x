// features/threads/ui/components/TweetFooter.tsx
"use client";

import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import { formatLargeNumber } from "@/shared/lib/utils/format";
import { cn } from "@/shared/lib/utils/utils";
import {
  QuickPhrasesIcon,
  RepeatIcon,
  FavoriteIcon,
  InsertChartIcon,
  ThumbUpIcon,
  ThumbDownIcon,
  FilledThumbUpIcon,
  FilledThumbDownIcon,
} from "@/shared/ui/components/icons";
import { Tweet } from "@/features/threads/types";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { Button } from "@/shared/ui/components/Button";
import { useTweetVoting } from "@/shared/hooks/useTweetVoting";

interface TweetFooterProps {
  threadId: string;
  tweetId: string | undefined;
  tweetUrl: string;
  // New prop for static data - when provided, skips API call
  staticTweet?: Tweet;
  // Voting context - when provided, enables voting functionality
  votingContext?: {
    keywordId: string;
    searchQuery: string;
  };
  className?: string;
}

// TweetActionButton: icon-only if count is 0, icon+label if count > 0
function TweetActionButton({
  icon: Icon,
  count,
  href,
  ariaLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  count?: number | string;
  href: string;
  ariaLabel: string;
}) {
  const showLabel =
    typeof count === "number" ? count > 0 : !!count && count !== "0";
  return (
    <Button
      asChild
      variant="ghost"
      size={showLabel ? "xs" : "xsIcon"}
      aria-label={ariaLabel}
      className="gap-1 font-mono text-muted-foreground"
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        <Icon className="fill-current" aria-hidden="true" />
        {showLabel && `${count}`}
      </a>
    </Button>
  );
}

export function TweetFooter({
  threadId,
  tweetId,
  tweetUrl,
  staticTweet,
  votingContext,
  className,
}: TweetFooterProps) {
  const getDynamicThreadData = useAction(api.socialdata.getDynamicThreadData);
  const [metrics, setMetrics] = useState<Tweet | null>(staticTweet || null);
  const [loading, setLoading] = useState(!staticTweet);

  // Voting hook
  const { vote, isVoting, getVote } = useTweetVoting();

  useEffect(() => {
    // Skip API call if static tweet data is provided
    if (staticTweet) {
      setMetrics(staticTweet);
      setLoading(false);
      return;
    }

    // Only make API call if no static data is available
    if (!staticTweet && threadId && tweetId) {
      setLoading(true);
      getDynamicThreadData({ threadId })
        .then((data) => {
          const tweetData = data.tweets.find(
            (t: Tweet) => t.id_str === tweetId
          );
          if (!tweetData) {
            console.error(
              `Tweet with id ${tweetId} not found in thread ${threadId}`
            );
          }
          setMetrics(tweetData || null);
        })
        .catch((error) => {
          console.error("Error fetching dynamic thread data:", error);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [threadId, tweetId, staticTweet, getDynamicThreadData]);

  const handleVote = async (voteType: "up" | "down") => {
    if (!votingContext || !tweetId) return;

    await vote({
      tweetId,
      keywordId: votingContext.keywordId,
      vote: voteType,
      searchQuery: votingContext.searchQuery,
      tweetMetrics: {
        likes: metrics?.favorite_count,
        retweets: metrics?.retweet_count,
        replies: metrics?.reply_count,
        views: metrics?.views_count,
      },
    });
  };

  if (loading || !metrics)
    return (
      <footer className={cn("flex justify-between", className)}>
        <span className="flex gap-1">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-8" />
        </span>
        <span className="flex gap-1">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-8" />
        </span>
        <span className="flex gap-1">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-8" />
        </span>
        <span className="flex gap-1">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-8" />
        </span>
        <span className="flex gap-1">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-8" />
        </span>
      </footer>
    );

  const formattedReplyCount = formatLargeNumber(
    Number(metrics.reply_count ?? 0)
  );
  const repeatSum =
    Number(metrics.quote_count ?? 0) + Number(metrics.retweet_count ?? 0);
  const formattedRepeatSum = formatLargeNumber(repeatSum);
  const formattedFavoriteCount = formatLargeNumber(
    Number(metrics.favorite_count ?? 0)
  );
  const formattedViewsCount = formatLargeNumber(
    Number(metrics.views_count ?? 0)
  );

  const currentVote = tweetId ? getVote(tweetId) : null;
  const isCurrentlyVoting = tweetId ? isVoting(tweetId) : false;

  return (
    <footer
      className={cn(
        "flex items-center justify-between gap-6 text-xs",
        className
      )}
    >
      {/* Engagement Metrics */}
      <div className="flex items-center gap-2">
        <TweetActionButton
          icon={QuickPhrasesIcon}
          count={formattedReplyCount}
          href={tweetUrl}
          ariaLabel={`View replies (${formattedReplyCount})`}
        />
        <TweetActionButton
          icon={RepeatIcon}
          count={formattedRepeatSum}
          href={tweetUrl}
          ariaLabel={`View retweets and quotes (${formattedRepeatSum})`}
        />
        <TweetActionButton
          icon={FavoriteIcon}
          count={formattedFavoriteCount}
          href={tweetUrl}
          ariaLabel={`View likes (${formattedFavoriteCount})`}
        />
        <TweetActionButton
          icon={InsertChartIcon}
          count={formattedViewsCount}
          href={tweetUrl}
          ariaLabel={`View impressions (${formattedViewsCount})`}
        />
      </div>
      {/* Simple Voting Buttons - only show when voting context is provided */}
      {votingContext && tweetId && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xsIcon"
            onClick={(e) => {
              e.stopPropagation();
              handleVote("up");
            }}
            disabled={isCurrentlyVoting}
            aria-label={
              currentVote === "up"
                ? "You voted this tweet as helpful"
                : "Vote this tweet as helpful"
            }
          >
            {currentVote === "up" ? (
              <FilledThumbUpIcon className="fill-current" />
            ) : (
              <ThumbUpIcon className="fill-current" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="xsIcon"
            onClick={(e) => {
              e.stopPropagation();
              handleVote("down");
            }}
            disabled={isCurrentlyVoting}
            aria-label={
              currentVote === "down"
                ? "You voted this tweet as not helpful"
                : "Vote this tweet as not helpful"
            }
          >
            {currentVote === "down" ? (
              <FilledThumbDownIcon className="fill-current" />
            ) : (
              <ThumbDownIcon className="fill-current" />
            )}
          </Button>
        </div>
      )}
    </footer>
  );
}
