// features/webapp/ui/components/LinkedInFooter.tsx
"use client";

import * as React from "react";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { cn } from "@/shared/lib/utils/utils";
import { Button } from "@/shared/ui/components/Button";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import {
  QuickPhrasesIcon,
  RecommendIcon,
  RepeatIcon,
  ThumbUpIcon,
  FilledThumbUpIcon,
  ThumbDownIcon,
  FilledThumbDownIcon,
} from "@/shared/ui/components/icons";
import { useTweetVoting } from "@/shared/hooks/useTweetVoting";
import { formatLargeNumber } from "@/shared/lib/utils/format";

export interface LinkedInFooterProps {
  post: UnifiedPost;
  votingContext?: {
    keywordId: string;
    searchQuery: string;
    exact?: boolean;
  };
  className?: string;
}

function getAnimatedParts(value: number): {
  value: number;
  suffix?: string;
  decimals: number;
} {
  const formatted = formatLargeNumber(Number(value || 0));
  const match = /^(\d+(?:\.\d+)?)([A-Za-z]*)$/.exec(formatted);
  if (!match) {
    return { value: Number(value || 0), decimals: 0 };
  }
  const n = Number(match[1]);
  const suffix = match[2] || undefined;
  const decimals = /\.\d/.test(match[1]) ? 1 : 0;
  return { value: n, suffix, decimals };
}

function LinkedInActionButton({
  icon: Icon,
  count,
  href,
  ariaLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  href?: string;
  ariaLabel: string;
}) {
  const showLabel = Number(count || 0) > 0;
  const { value, suffix, decimals } = getAnimatedParts(Number(count || 0));
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
        {showLabel && (
          <AnimatedNumber
            value={value}
            suffix={suffix}
            decimals={decimals}
            format={{ useGrouping: false }}
            animateOnMount
          />
        )}
      </a>
    </Button>
  );
}

export const LinkedInFooter: React.FC<LinkedInFooterProps> = ({
  post,
  votingContext,
  className,
}) => {
  const { vote, isVoting, getVote } = useTweetVoting();
  const postId = post?.id;
  const currentVote = postId ? getVote(postId) : null;
  const isCurrentlyVoting = postId ? isVoting(postId) : false;

  const reactions = Number(post?.metrics?.reactions || 0);
  const comments = Number(post?.metrics?.comments || 0);
  const reposts = Number(post?.metrics?.reposts || 0);

  const postHref = post?.url || undefined;

  return (
    <footer
      className={cn(
        "mt-2 flex items-center justify-between gap-6 text-xs",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <LinkedInActionButton
          icon={RecommendIcon}
          count={reactions}
          href={postHref}
          ariaLabel={`View reactions (${formatLargeNumber(reactions)})`}
        />
        <LinkedInActionButton
          icon={QuickPhrasesIcon}
          count={comments}
          href={postHref}
          ariaLabel={`View comments (${formatLargeNumber(comments)})`}
        />
        <LinkedInActionButton
          icon={RepeatIcon}
          count={reposts}
          href={postHref}
          ariaLabel={`View reposts (${formatLargeNumber(reposts)})`}
        />
      </div>

      {votingContext && postId && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xsIcon"
            onClick={(e) => {
              e.stopPropagation();
              vote({
                tweetId: postId,
                keywordId: votingContext.keywordId,
                vote: "up",
                searchQuery: votingContext.searchQuery,
                tweetMetrics: {
                  likes: reactions,
                  retweets: reposts,
                  replies: comments,
                },
              });
            }}
            disabled={isCurrentlyVoting}
            aria-label={
              currentVote === "up"
                ? "You voted this post as helpful"
                : "Vote this post as helpful"
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
              vote({
                tweetId: postId,
                keywordId: votingContext.keywordId,
                vote: "down",
                searchQuery: votingContext.searchQuery,
                tweetMetrics: {
                  likes: reactions,
                  retweets: reposts,
                  replies: comments,
                },
              });
            }}
            disabled={isCurrentlyVoting}
            aria-label={
              currentVote === "down"
                ? "You voted this post as not helpful"
                : "Vote this post as not helpful"
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
};
