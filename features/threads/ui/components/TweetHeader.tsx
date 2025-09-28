// features/landing/ui/components/TweetHeader.tsx
"use client";

import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState, useRef } from "react";
// Removed unused Link import
import { useProfile } from "@/features/profile/contexts/ProfileContext";
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
  const { openProfile, prefetchProfile } = useProfile();
  const nameClass = cn(
    "text-base",
    size === "sm" && "md:text-sm",
    size === "md" && "md:text-lg",
    size === "lg" && "md:text-xl"
  );

  const newReleasesIconClass = cn(
    "w-[12px] h-[12px]",
    size === "sm" && "md:w-[12px] md:h-[12px]",
    size === "md" && "md:w-4 md:h-4",
    size === "lg" && "md:w-4 md:h-4"
  );

  const screenNameClass = cn(
    "text-sm",
    size === "sm" && "md:text-sm",
    size === "md" && "md:text-base",
    size === "lg" && "md:text-lg"
  );

  const getDynamicThreadData = useAction(api.socialapi.getDynamicThreadData);
  const [user, setUser] = useState<User | null>(staticUser || null);
  const [loading, setLoading] = useState(!staticUser);

  // Debounced hover prefetch — purpose: warms cache so clicking is instant.
  const hoverTimerRef = useRef<number | null>(null);
  const schedulePrefetch = (username?: string | null) => {
    if (!username) return;
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    hoverTimerRef.current = window.setTimeout(() => {
      prefetchProfile(username).catch(() => {});
      hoverTimerRef.current = null;
    }, 150);
  };
  const cancelPrefetch = () => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

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
              <button
                className={cn(
                  nameClass,
                  "ease-[cubic-bezier(0.25, 1, 0.5, 1)] mr-1 whitespace-nowrap font-medium duration-300 hover:underline"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (user.screen_name)
                    openProfile({
                      username: user.screen_name,
                      seedProfile: user,
                    });
                }}
                onMouseEnter={() => schedulePrefetch(user.screen_name)}
                onMouseLeave={cancelPrefetch}
                onFocus={() => schedulePrefetch(user.screen_name)}
                aria-label={`View ${user.name}'s profile`}
              >
                {user.name}
              </button>
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
              <button
                className={cn(
                  screenNameClass,
                  "ease-[cubic-bezier(0.25, 1, 0.5, 1)] truncate font-mono font-medium text-muted-foreground duration-300 hover:underline"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  openProfile({
                    username: user.screen_name!,
                    seedProfile: user,
                  });
                }}
                onMouseEnter={() => schedulePrefetch(user.screen_name)}
                onMouseLeave={cancelPrefetch}
                onFocus={() => schedulePrefetch(user.screen_name)}
                aria-label={`View @${user.screen_name}'s profile`}
              >
                @{user.screen_name}
              </button>
            )}
          </address>
          {children}
        </div>
      )}
    </>
  );
}
