"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";
import Link from "next/link";
import { UserProfileHeader } from "@/features/landing/ui/components/UserProfileHeader";
import { WaitlistUser } from "../../types";

const waitlistUserCardVariants = cva(
  [
    "group w-fit rounded-lg p-4 transition-colors",
    "hover:bg-accent focus-within:bg-accent",
    "flex items-center gap-4",
  ],
  {
    variants: {},
    defaultVariants: {},
  }
);

export interface WaitlistUserCardProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof waitlistUserCardVariants> {
  user: WaitlistUser;
}

export const WaitlistUserCard = React.forwardRef<
  HTMLElement,
  WaitlistUserCardProps
>(({ user, className, ...props }, ref) => {
  return (
    <article
      ref={ref}
      aria-label={`Waitlist user card for ${user.name}`}
      {...props}
    >
      <Link
        href={`https://x.com/${user.screen_name}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open @${user.screen_name}'s X/Twitter profile`}
        className={cn(waitlistUserCardVariants({ className }))}
      >
        <UserProfileHeader
          profileImageUrlHttps={user.profile_image_url_https}
          name={user.name}
          screenName={user.screen_name}
          verified={user.verified}
        />
      </Link>
    </article>
  );
});

WaitlistUserCard.displayName = "WaitlistUserCard";
