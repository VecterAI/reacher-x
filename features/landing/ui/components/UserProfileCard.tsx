"use client";

import * as React from "react";
import Link from "next/link";
import { Separator } from "@/shared/ui/components/Separator";
import { UserProfileHeader } from "@/features/landing/ui/components/UserProfileHeader";
import { LinkIcon } from "@/shared/ui/components/icons/index";
import { formatLargeNumber } from "@/shared/lib/utils/format";
import { cn } from "@/shared/lib/utils/utils";

export interface UserProfileCardProps {
  avatarUrl: string;
  displayName: string;
  username: string;
  bio?: string;
  parsedBio?: string; // <--- add this
  followers?: number;
  following?: number;
  link?: string;
  pro?: boolean;
  className?: string;
}

export function UserProfileCard({
  avatarUrl,
  displayName,
  username,
  bio,
  parsedBio, // <--- destructure here
  followers,
  following,
  link,
  pro,
  className,
}: UserProfileCardProps) {
  const followersCount = formatLargeNumber(Number(followers ?? 0));
  const followingCount = formatLargeNumber(Number(following ?? 0));

  return (
    <section
      aria-label={`${displayName} profile`}
      className={cn(className, "flex flex-col gap-4")}
    >
      <UserProfileHeader
        avatarUrl={avatarUrl}
        displayName={displayName}
        username={username}
        pro={pro}
      />

      {/* Render parsedBio with dangerouslySetInnerHTML if provided */}
      {parsedBio ? (
        <p
          className="whitespace-pre-line text-base [&_a]:text-muted-foreground hover:[&_a]:underline dark:[&_a]:text-neutral-400"
          dangerouslySetInnerHTML={{ __html: parsedBio }}
        />
      ) : (
        bio && (
          <p className="text-base [&_a]:text-muted-foreground hover:[&_a]:underline dark:[&_a]:text-neutral-400">
            {bio}
          </p>
        )
      )}

      <article
        aria-label="User statistics"
        className="grid grid-cols-[auto_auto_auto_auto_auto] justify-start gap-2 text-sm"
      >
        <div className="text-muted-foreground">
          <span className="font-mono font-medium text-foreground">
            {followersCount}
          </span>{" "}
          Followers
        </div>
        <Separator orientation="vertical" className="w-[1px]" />
        <div className="text-muted-foreground">
          <span className="font-mono font-medium text-foreground">
            {followingCount}
          </span>{" "}
          Following
        </div>

        {link && (
          <>
            <Separator orientation="vertical" className="w-[1px]" />
            <Link
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="grid w-full grid-cols-[auto_1fr] items-center gap-1 font-mono text-sm font-medium hover:underline"
              aria-label={`${displayName}'s personal link`}
            >
              <LinkIcon className="fill-muted-foreground" />
              <span className="truncate">{link}</span>
            </Link>
          </>
        )}
      </article>
    </section>
  );
}
