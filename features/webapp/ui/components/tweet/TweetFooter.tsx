// features/webapp/ui/components/tweet/TweetFooter.tsx
"use client";

import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import { formatLargeNumber } from "@/shared/lib/utils";
import { cn } from "@/shared/lib/utils";
import {
  QuickPhrasesIcon,
  RepeatIcon,
  FavoriteIcon,
  InsertChartIcon,
} from "@/shared/ui/components/icons";
import { Tweet } from "@/features/threads/types";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { Button } from "@/shared/ui/components/Button";
import { logger } from "@/shared/lib/logger";
import Link from "next/link";
import { base64UrlEncodeUtf8 } from "@/shared/lib/utils";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";

interface TweetFooterProps {
  threadId: string;
  tweetId: string | undefined;
  tweetUrl: string;
  // New prop for static data - when provided, skips API call
  staticTweet?: Tweet;
  className?: string;
}

function getAnimatedPartsFromCount(count?: number | string): {
  value: number;
  suffix?: string;
  decimals: number;
} {
  if (typeof count === "number") {
    const formatted = formatLargeNumber(Number(count || 0));
    const match = /^(\d+(?:\.\d+)?)([A-Za-z]*)$/.exec(formatted);
    if (!match) return { value: Number(count || 0), decimals: 0 };
    const n = Number(match[1]);
    const suffix = match[2] || undefined;
    const decimals = /\.\d/.test(match[1]) ? 1 : 0;
    return { value: n, suffix, decimals };
  }
  const str = String(count || "0");
  const m = /^(\d+(?:\.\d+)?)([A-Za-z]*)$/.exec(str);
  if (!m) return { value: Number(str) || 0, decimals: 0 };
  const n = Number(m[1]);
  const suffix = m[2] || undefined;
  const decimals = /\.\d/.test(m[1]) ? 1 : 0;
  return { value: n, suffix, decimals };
}

// TweetActionButton: icon-only if count is 0, icon+animated label if count > 0
function TweetActionButton({
  icon: Icon,
  count,
  href,
  ariaLabel,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  count?: number | string;
  href: string;
  ariaLabel: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const showLabel =
    typeof count === "number" ? count > 0 : !!count && count !== "0";
  const { value, suffix, decimals } = getAnimatedPartsFromCount(count);
  return (
    <Button
      asChild
      variant="ghost"
      size={showLabel ? "xs" : "xsIcon"}
      aria-label={ariaLabel}
      className="gap-1 font-mono text-muted-foreground"
    >
      <Link
        id={Icon === QuickPhrasesIcon ? "rx-tour-reply" : undefined}
        href={href}
        onClick={onClick}
      >
        <Icon className="fill-current" aria-hidden="true" />
        {showLabel && (
          <AnimatedNumber
            value={value}
            suffix={suffix}
            decimals={decimals}
            format={{ useGrouping: false }}
            animateOnMount
          />
        )}
      </Link>
    </Button>
  );
}

export function TweetFooter({
  threadId,
  tweetId,
  tweetUrl,
  staticTweet,
  className,
}: TweetFooterProps) {
  const getDynamicThreadData = useAction(api.socialapi.getDynamicThreadData);
  const [metrics, setMetrics] = useState<Tweet | null>(staticTweet || null);
  const [loading, setLoading] = useState(!staticTweet);

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
            logger.error(
              `Tweet with id ${tweetId} not found in thread ${threadId}`
            );
          }
          setMetrics(tweetData || null);
        })
        .catch((error) => {
          logger.error("Error fetching dynamic thread data:", error);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [threadId, tweetId, staticTweet, getDynamicThreadData]);

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

  // Build internal post link that mirrors tweet card navigation
  let postHref = tweetUrl;
  if (tweetId) {
    const params = new URLSearchParams();
    if (staticTweet) {
      try {
        const packed = base64UrlEncodeUtf8(JSON.stringify(staticTweet));
        if (packed) params.set("t", packed);
      } catch {}
    }
    const qs = params.toString();
    postHref = `/post/x/${tweetId}${qs ? `?${qs}` : ""}`;
  }

  const handleNavigateClick = (e: React.MouseEvent) => {
    // Prevent parent tweet row click handlers from firing
    e.stopPropagation();
  };

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
          // Used by onboarding tour to gate results and anchor the reply action step
          // We attach id to the underlying link via asChild composition
          icon={QuickPhrasesIcon}
          count={formattedReplyCount}
          href={postHref}
          ariaLabel={`View replies (${formattedReplyCount})`}
          onClick={handleNavigateClick}
        />
        <TweetActionButton
          icon={RepeatIcon}
          count={formattedRepeatSum}
          href={postHref}
          ariaLabel={`View retweets and quotes (${formattedRepeatSum})`}
          onClick={handleNavigateClick}
        />
        <TweetActionButton
          icon={FavoriteIcon}
          count={formattedFavoriteCount}
          href={postHref}
          ariaLabel={`View likes (${formattedFavoriteCount})`}
          onClick={handleNavigateClick}
        />
        <TweetActionButton
          icon={InsertChartIcon}
          count={formattedViewsCount}
          href={postHref}
          ariaLabel={`View impressions (${formattedViewsCount})`}
          onClick={handleNavigateClick}
        />
      </div>
    </footer>
  );
}

