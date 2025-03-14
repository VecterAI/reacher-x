// features/landing/ui/components/TweetHeader.tsx
"use client";

import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/shared/ui/components/Avatar";
import { cn } from "@/shared/lib/utils/utils";
import { NewReleasesIcon } from "@/shared/ui/components/icons";
import { User, Tweet } from "@/app/(landing)/threads/types";

interface TweetHeaderProps {
  threadId: string;
  tweetId: string | undefined;
  avatarClass?: string;
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export function TweetHeader({
  threadId,
  tweetId,
  avatarClass,
  children,
  size,
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
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    getDynamicThreadData({ threadId })
      .then((data) => {
        const tweetData = data.tweets.find((t: Tweet) => t.id_str === tweetId);
        if (!tweetData) {
          console.error(
            `Tweet with id ${tweetId} not found in thread ${threadId}`
          );
        }
        setUser(tweetData?.user || null);
      })
      .catch((error) => {
        console.error("Error fetching dynamic thread data:", error);
      });
  }, [threadId, tweetId, getDynamicThreadData]);

  if (!user) return <div>Loading...</div>;

  return (
    <>
      {avatarClass && (
        <Link
          href={`https://x.com/${user.screen_name}`}
          aria-label={`View ${user.name ?? user.screen_name}'s profile`}
          onClick={(e) => e.stopPropagation()}
        >
          <Avatar className={cn(avatarClass, "ring-1 ring-border")}>
            <AvatarImage
              src={user.profile_image_url_https}
              alt={`Avatar of ${user.name}`}
            />
            <AvatarFallback>
              {user.name?.charAt(0).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        </Link>
      )}
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
