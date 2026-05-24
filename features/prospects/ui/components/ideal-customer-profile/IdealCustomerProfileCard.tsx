/**
 * Ideal Customer Profile card — matches ProspectCard shell (padding, radius, type scale)
 * without avatar or role; shows channel icons instead of fit/finance footer.
 */
"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/components/Badge";
import { FilledLinkedinIcon, TwitterIcon } from "@/shared/ui/components/icons";

export type IdealCustomerProfileCardData = {
  title: string;
  description: string;
  painPoints: string[];
  channels: string[];
};

export interface IdealCustomerProfileCardProps {
  profile: IdealCustomerProfileCardData;
  /** How many pain badges to show before "+N more pains" */
  maxPainBadges?: number;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
  /** Read-only / non-interactive presentation (e.g. view mode alongside disabled fields). */
  disabled?: boolean;
}

function channelShowsTwitter(ch: string): boolean {
  const s = ch.toLowerCase();
  return s.includes("twitter") || s === "x" || s.includes("tweet");
}

function channelShowsLinkedIn(ch: string): boolean {
  return ch.toLowerCase().includes("linkedin");
}

function getVisibleChannels(channels: string[]): Array<"twitter" | "linkedin"> {
  const visibleChannels: Array<"twitter" | "linkedin"> = [];

  if (channels.some(channelShowsTwitter)) {
    visibleChannels.push("twitter");
  }

  if (channels.some(channelShowsLinkedIn)) {
    visibleChannels.push("linkedin");
  }

  return visibleChannels;
}

export function IdealCustomerProfileCard({
  profile,
  maxPainBadges = 2,
  className,
  interactive = false,
  onClick,
  disabled = false,
}: IdealCustomerProfileCardProps) {
  const pains = profile.painPoints ?? [];
  const visiblePains = pains.slice(0, maxPainBadges);
  const rest = Math.max(0, pains.length - visiblePains.length);
  const visibleChannels = getVisibleChannels(profile.channels ?? []);

  return (
    <article
      className={cn(
        "w-full min-w-0 rounded-xl border px-4 py-3",
        interactive && !disabled && "cursor-pointer",
        disabled && "border-border/70 pointer-events-none opacity-65",
        className
      )}
      onClick={interactive && !disabled ? onClick : undefined}
      role={interactive && !disabled ? "button" : undefined}
      tabIndex={interactive && !disabled ? 0 : undefined}
      onKeyDown={
        interactive && !disabled
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick?.();
            }
          : undefined
      }
      aria-disabled={disabled ? true : undefined}
    >
      <h3
        className={cn(
          "mb-1 text-sm leading-snug font-medium",
          disabled ? "text-muted-foreground" : "text-foreground"
        )}
      >
        {profile.title}
      </h3>
      {profile.description ? (
        <p
          className={cn(
            "line-clamp-4 text-sm leading-6 whitespace-pre-line",
            disabled ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {profile.description}
        </p>
      ) : null}

      {visiblePains.length > 0 || rest > 0 ? (
        <footer className="my-2 overflow-hidden">
          <div className="scrollbar-none scroll-fade-effect-x flex items-center gap-2 overflow-x-auto">
            {visiblePains.map((p) => (
              <Badge
                key={p}
                variant="outline"
                className={cn(
                  "max-w-[min(100%,18rem)] shrink-0 truncate rounded-md font-normal",
                  disabled
                    ? "border-border/70 text-muted-foreground bg-transparent"
                    : "text-foreground"
                )}
              >
                {p}
              </Badge>
            ))}
            {rest > 0 ? (
              <Badge
                variant="outline"
                className="border-border/70 text-muted-foreground shrink-0 rounded-md bg-transparent font-normal"
              >
                {rest} more pains
              </Badge>
            ) : null}
          </div>
        </footer>
      ) : null}

      {visibleChannels.length > 0 && (
        <div
          className={cn(
            "text-muted-foreground flex flex-wrap items-center gap-1.5 pt-0.5 text-xs",
            disabled && "opacity-60"
          )}
        >
          {visibleChannels.map((channel, index) => (
            <React.Fragment key={channel}>
              {index > 0 ? <span aria-hidden>·</span> : null}
              <span className="inline-flex items-center gap-1.5">
                {channel === "twitter" ? (
                  <TwitterIcon className="h-3 w-3 text-current" aria-hidden />
                ) : (
                  <FilledLinkedinIcon
                    className="h-3 w-3 text-current"
                    aria-hidden
                  />
                )}
                <span>{channel === "twitter" ? "X/Twitter" : "LinkedIn"}</span>
              </span>
            </React.Fragment>
          ))}
        </div>
      )}
    </article>
  );
}
