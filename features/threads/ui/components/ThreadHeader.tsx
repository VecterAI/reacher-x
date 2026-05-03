"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { NewReleasesIcon } from "@/shared/ui/components/icons";
import Link from "next/link";

export interface ThreadHeaderProps {
  name?: string | null;
  screenName?: string | null;
  verified?: boolean | null;
  children?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ThreadHeader({
  name,
  screenName,
  verified,
  children,
  className,
  size = "md",
}: ThreadHeaderProps) {
  const nameClass = cn(
    "font-medium text-sm",
    size === "sm" && "md:text-sm",
    size === "md" && "md:text-base",
    size === "lg" && "md:text-lg"
  );
  const screenNameClass = cn(
    "font-mono text-muted-foreground text-sm",
    size === "sm" && "md:text-sm",
    size === "md" && "md:text-base",
    size === "lg" && "md:text-lg"
  );

  const newReleasesIconClass = cn(
    "fill-current",
    size === "sm" && "w-3 h-3",
    size === "md" && "w-4 h-4",
    size === "lg" && "w-4 h-4"
  );

  const profileUrl = screenName ? `https://x.com/${screenName}` : undefined;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden",
        className
      )}
    >
      <div className="flex min-w-0 shrink items-center gap-0.5 overflow-hidden">
        {name && profileUrl ? (
          <Link
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              nameClass,
              "mr-0 block max-w-24 min-w-0 truncate hover:underline md:max-w-56"
            )}
            aria-label={`View ${name}'s profile`}
            title={name || undefined}
          >
            {name}
          </Link>
        ) : (
          name && (
            <span
              className={cn(
                nameClass,
                "block max-w-24 min-w-0 truncate md:max-w-56"
              )}
              title={name || undefined}
            >
              {name}
            </span>
          )
        )}

        {verified && (
          <NewReleasesIcon
            className={cn(newReleasesIconClass, "mr-0.5 shrink-0")}
            aria-hidden="true"
          />
        )}

        {screenName && profileUrl ? (
          <Link
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              screenNameClass,
              "md:max-w-auto block max-w-16 min-w-0 shrink grow-0 truncate font-medium hover:underline"
            )}
            aria-label={`View @${screenName}'s profile`}
            title={`@${screenName}`}
          >
            @{screenName}
          </Link>
        ) : (
          screenName && (
            <span
              className={cn(
                screenNameClass,
                "block max-w-16 min-w-0 truncate md:max-w-56"
              )}
              title={`@${screenName}`}
            >
              @{screenName}
            </span>
          )
        )}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}
