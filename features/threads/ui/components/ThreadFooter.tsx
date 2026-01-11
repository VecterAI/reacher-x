"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import Link from "next/link";
import {
  QuickPhrasesIcon,
  RepeatIcon,
  FavoriteIcon,
  InsertChartIcon,
} from "@/shared/ui/components/icons";

export interface ThreadFooterProps {
  replies?: string | number;
  repeats?: string | number;
  likes?: string | number;
  views?: string | number;
  className?: string;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  // Minimal identity to compute tweet URL internally
  screenName?: string | null;
  tweetId?: string | null;
}
function Metric({
  icon: Icon,
  count,
  ariaLabel,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  count?: string | number;
  ariaLabel: string;
  href?: string;
}) {
  return (
    <Button asChild variant="ghost" size="xs" aria-label={ariaLabel}>
      {href ? (
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="relative z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <Icon className="fill-muted-foreground" />
          <span className="sr-only">{ariaLabel}</span>
          <span className="text-muted-foreground font-mono">{count}</span>
        </Link>
      ) : (
        <a
          href="#"
          className="relative z-20"
          onClick={(e) => e.preventDefault()}
        >
          <Icon className="fill-muted-foreground" />
          <span className="sr-only">{ariaLabel}</span>
          <span className="text-muted-foreground font-mono">{count}</span>
        </a>
      )}
    </Button>
  );
}

export function ThreadFooter({
  replies,
  repeats,
  likes,
  views,
  className,
  loading = false,
  screenName,
  tweetId,
}: ThreadFooterProps) {
  const tweetUrl =
    screenName && tweetId
      ? `https://x.com/${screenName}/status/${tweetId}`
      : undefined;
  if (loading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="bg-muted h-4 w-12 rounded-md" />
        <div className="bg-muted h-4 w-12 rounded-md" />
        <div className="bg-muted h-4 w-12 rounded-md" />
        <div className="bg-muted h-4 w-12 rounded-md" />
      </div>
    );
  }

  return (
    <div className={cn("flex justify-between", className)}>
      <Metric
        icon={QuickPhrasesIcon}
        count={replies}
        ariaLabel="View replies"
        href={tweetUrl}
      />
      <Metric
        icon={RepeatIcon}
        count={repeats}
        ariaLabel="View retweets and quotes"
        href={tweetUrl}
      />
      <Metric
        icon={FavoriteIcon}
        count={likes}
        ariaLabel="View likes"
        href={tweetUrl}
      />
      <Metric
        icon={InsertChartIcon}
        count={views}
        ariaLabel="View impressions"
        href={tweetUrl}
      />
    </div>
  );
}
