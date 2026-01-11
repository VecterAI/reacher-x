// features/webapp/ui/components/linkedin/LinkedInFooter.tsx
"use client";

import * as React from "react";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import {
  QuickPhrasesIcon,
  RecommendIcon,
  RepeatIcon,
} from "@/shared/ui/components/icons";
import { formatLargeNumber } from "@/shared/lib/utils";

export interface LinkedInFooterProps {
  post: UnifiedPost;
  className?: string;
  /** Whether the parent card is being hovered - triggers animation */
  isHovered?: boolean;
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
  isHovered = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  href?: string;
  ariaLabel: string;
  isHovered?: boolean;
}) {
  const showLabel = Number(count || 0) > 0;
  const { value, suffix, decimals } = getAnimatedParts(Number(count || 0));
  return (
    <Button
      asChild
      variant="ghost"
      size={showLabel ? "xs" : "xsIcon"}
      aria-label={ariaLabel}
      className="text-muted-foreground gap-1 font-mono"
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
            animateOnMount={false}
          />
        )}
      </a>
    </Button>
  );
}

export const LinkedInFooter: React.FC<LinkedInFooterProps> = ({
  post,
  className,
  isHovered = false,
}) => {
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
    </footer>
  );
};
