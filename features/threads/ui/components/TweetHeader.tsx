// features/landing/ui/components/TweetHeader.tsx
"use client";

import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/shared/lib/utils/utils";
import { NewReleasesIcon } from "@/shared/ui/components/icons";
import { User, Tweet } from "@/features/threads/types";
import { Skeleton } from "@/shared/ui/components/Skeleton";

interface TweetHeaderProps {
  threadId: string;
  tweetId: string | undefined;
  avatarClass?: string;
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  // New prop for static data - when provided, skips API call
  staticUser?: User;
}

export function TweetHeader({
  threadId,
  tweetId,
  avatarClass,
  children,
  size,
  staticUser,
}: TweetHeaderProps) {
  const nameClass = cn(
    "text-base",
    size === "sm" && "md:text-base",
    size === "md" && "md:text-lg",
    size === "lg" && "md:text-xl"
  );

  const newReleasesIconClass = cn(
    "w-[14px] h-[14px]",
    size === "sm" && "md:w-[14px] md:h-[14px]",
    size === "md" && "md:w-4 md:h-4",
    size === "lg" && "md:w-4 md:h-4"
  );

  const screenNameClass = cn(
    "text-sm",
    size === "sm" && "md:text-sm",
    size === "md" && "md:text-base",
    size === "lg" && "md:text-lg"
  );

  const getDynamicThreadData = useAction(api.socialdata.getDynamicThreadData);
  const [user, setUser] = useState<User | null>(staticUser || null);
  const [loading, setLoading] = useState(!staticUser);

  useEffect(() => {
    // Skip API call if static user data is provided
    if (staticUser) {
      setUser(staticUser);
      setLoading(false);
      return;
    }

    // Only make API call if no static data is available
    if (!staticUser && threadId && tweetId) {
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
          setUser(tweetData?.user || null);
        })
        .catch((error) => {
          console.error("Error fetching dynamic thread data:", error);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [threadId, tweetId, staticUser, getDynamicThreadData]);

  if (loading || !user)
    return (
      <>
        <div className="flex gap-1">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-7" />
        </div>
      </>
    );

  return (
    <>
      {!avatarClass && (
        <div className="grid grid-cols-[auto,auto] items-center gap-1">
          <address className="grid grid-cols-[auto_auto_auto] items-center not-italic">
            {user.name && (
              <Link
                href={`https://x.com/${user.screen_name}`}
                className={cn(
                  nameClass,
                  "ease-[cubic-bezier(0.25, 1, 0.5, 1)] mr-1 whitespace-nowrap font-medium duration-300 hover:underline"
                )}
                onClick={(e) => e.stopPropagation()}
                aria-label={`View ${user.name}'s profile`}
              >
                {user.name}
              </Link>
            )}
            {user.verified && (
              <NewReleasesIcon
                className={cn(
                  newReleasesIconClass,
                  "ease-[cubic-bezier(0.25, 1, 0.5, 1)] mr-1 fill-current duration-300"
                )}
                aria-hidden="true"
                data-testid="verified-badge"
              />
            )}
            {user.screen_name && (
              <Link
                href={`https://x.com/${user.screen_name}`}
                className={cn(
                  screenNameClass,
                  "ease-[cubic-bezier(0.25, 1, 0.5, 1)] truncate font-mono font-medium text-muted-foreground duration-300 hover:underline"
                )}
                onClick={(e) => e.stopPropagation()}
                aria-label={`View @${user.screen_name}'s profile`}
              >
                @{user.screen_name}
              </Link>
            )}
          </address>
          {children}
        </div>
      )}
    </>
  );
}
