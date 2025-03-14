"use client";

import * as React from "react";
import Link from "next/link";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/shared/ui/components/Avatar";
import { NewReleasesIcon } from "@/shared/ui/components/icons";

interface UserProfileHeaderProps {
  profileImageUrlHttps: string | undefined;
  name: string | undefined;
  screenName: string | undefined;
  verified?: boolean;
  // Add any additional props needed for your new UI
}

export function UserProfileHeader({
  profileImageUrlHttps,
  name,
  screenName,
  verified,
}: UserProfileHeaderProps) {
  return (
    <div className="flex items-start gap-4">
      <Avatar>
        <AvatarImage
          src={profileImageUrlHttps}
          alt={`Profile picture of ${name}`}
        />
        <AvatarFallback>{name?.charAt(0).toUpperCase() || "?"}</AvatarFallback>
      </Avatar>

      <address className="flex flex-col not-italic">
        <div className="flex items-center gap-[2px]">
          {name && (
            <Link
              href={`https://x.com/${screenName}`}
              className="text-base font-medium hover:underline"
              aria-label={`View ${name}'s profile`}
            >
              {name}
            </Link>
          )}
          {verified && (
            <NewReleasesIcon
              className="h-[14px] w-[14px] fill-current"
              aria-hidden="true"
            />
          )}
        </div>
        {screenName && (
          <Link
            href={`https://x.com/${screenName}`}
            className="font-mono text-sm font-medium text-muted-foreground hover:underline"
            aria-label={`View @${screenName}'s profile`}
          >
            @{screenName}
          </Link>
        )}
      </address>
    </div>
  );
}
