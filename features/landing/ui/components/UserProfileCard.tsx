"use client";

import * as React from "react";
import Link from "next/link";
import { Separator } from "@/shared/ui/components/Separator";
import { UserProfileHeader } from "@/features/landing/ui/components/UserProfileHeader";
import { LinkIcon } from "@/shared/ui/components/icons/index";
import { formatLargeNumber } from "@/shared/lib/utils/format";
import { cn } from "@/shared/lib/utils/utils";
import { parseText } from "@/shared/lib/utils/parseText";

export interface UserProfileCardProps {
  profileImageUrlHttps: string;
  name: string;
  screenName: string;
  description?: string;
  entities?: {
    description?: {
      urls?: Array<{
        url: string;
        expanded_url: string;
        display_url: string;
        indices: [number, number];
      }>;
    };
  };
  followersCount?: number;
  friendsCount?: number;
  url?: string;
  verified?: boolean;
  className?: string;
}

export function UserProfileCard({
  profileImageUrlHttps,
  name,
  screenName,
  description,
  entities,
  followersCount,
  friendsCount,
  url,
  verified,
  className,
}: UserProfileCardProps) {
  const formattedFollowersCount = formatLargeNumber(
    Number(followersCount ?? 0)
  );
  const formattedFriendsCount = formatLargeNumber(Number(friendsCount ?? 0));

  const parsedDescription = React.useMemo(() => {
    if (!description) return ""; // Handle undefined or empty description
    const urlEntities = entities?.description?.urls || []; // Extract URL entities
    return parseText(description, { urls: urlEntities });
  }, [description, entities]);

  return (
    <section
      aria-label={`${name} profile`}
      className={cn(className, "flex flex-col gap-4")}
    >
      <UserProfileHeader
        profileImageUrlHttps={profileImageUrlHttps}
        name={name}
        screenName={screenName}
        verified={verified}
      />

      {description && (
        <p
          className="whitespace-pre-line text-base [&_a]:text-muted-foreground hover:[&_a]:underline dark:[&_a]:text-neutral-400"
          dangerouslySetInnerHTML={{ __html: parsedDescription }}
        />
      )}

      <article
        aria-label="User statistics"
        className="grid grid-cols-[auto_auto_auto_auto_auto] justify-start gap-2 text-sm"
      >
        <div className="text-muted-foreground">
          <span className="font-mono font-medium text-foreground">
            {formattedFollowersCount}
          </span>{" "}
          Followers
        </div>
        <Separator orientation="vertical" className="w-[1px]" />
        <div className="text-muted-foreground">
          <span className="font-mono font-medium text-foreground">
            {formattedFriendsCount}
          </span>{" "}
          Following
        </div>

        {url && (
          <>
            <Separator orientation="vertical" className="w-[1px]" />
            <Link
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="grid w-full grid-cols-[auto_1fr] items-center gap-1 font-mono text-sm font-medium hover:underline"
              aria-label={`${name}'s personal url`}
            >
              <LinkIcon className="fill-muted-foreground" />
              <span className="truncate">{url}</span>
            </Link>
          </>
        )}
      </article>
    </section>
  );
}
