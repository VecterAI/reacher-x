"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils/utils";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/shared/ui/components/Avatar";
import Link from "next/link";
import { NewReleasesIcon } from "@/shared/ui/components/icons";

const waitlistUserCardVariants = cva(
  [
    "group w-fit rounded-lg p-4 transition-colors",
    "hover:bg-accent focus-within:bg-accent",
    "flex items-center gap-4",
  ],
  {
    variants: {
      // You may add variants (e.g. size, color) if needed
    },
    defaultVariants: {},
  }
);

export interface WaitlistUserCardProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof waitlistUserCardVariants> {
  avatarUrl: string;
  displayName: string;
  username: string;
  pro?: boolean;
}

export const WaitlistUserCard = React.forwardRef<
  HTMLElement,
  WaitlistUserCardProps
>(({ avatarUrl, displayName, username, pro, className, ...props }, ref) => {
  return (
    <article
      ref={ref}
      aria-label={`Waitlist user card for ${displayName}`}
      {...props}
    >
      <Link
        // The entire card is clickable, so we make the anchor stretch
        // by giving it the main styling classes.
        href={`https://x.com/${username}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open @${username}'s X/Twitter profile`}
        className={cn(waitlistUserCardVariants({ className }))}
      >
        <Avatar>
          <AvatarImage
            src={avatarUrl}
            alt={`Profile picture of ${displayName}`}
          />
          <AvatarFallback>
            {displayName?.charAt(0).toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
        <address className="flex flex-col not-italic">
          <div className="flex items-center gap-[2px]">
            {displayName && (
              <Link
                href={`https://x.com/${username}`}
                className="text-base font-medium hover:underline"
                aria-label={`View ${displayName}'s profile`}
              >
                {displayName}
              </Link>
            )}
            {pro && (
              <NewReleasesIcon
                className="h-[14px] w-[14px] fill-current"
                aria-hidden="true"
              />
            )}
          </div>
          {username && (
            <Link
              href={`https://x.com/${username}`}
              className="font-mono font-medium text-muted-foreground hover:underline"
              aria-label={`View @${username}'s profile`}
            >
              @{username}
            </Link>
          )}
        </address>
      </Link>
    </article>
  );
});

WaitlistUserCard.displayName = "WaitlistUserCard";
