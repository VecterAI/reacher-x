"use client";

import * as React from "react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/shared/ui/components/Avatar";
import { cn } from "@/shared/lib/utils";
import { WaitlistUser } from "../../../waitlist/types";

export interface AvatarStackProps {
  users: WaitlistUser[];
  totalCount?: number;
  maxAvatars?: number;
  className?: string;
}

/**
 * Renders a stack of avatars.
 * - Shows up to `maxAvatars` avatars (default 4).
 * - If there are more users than `maxAvatars`, renders an extra Avatar with the count.
 * - Uses negative margins to overlap the avatars.
 */
export const AvatarStack: React.FC<AvatarStackProps> = ({
  users,
  totalCount,
  maxAvatars = 4,
  className,
}) => {
  const visibleUsers = users.slice(0, maxAvatars);

  // Use fallback to users.length if totalCount is undefined
  // This provides a clean fallback when totalCount isn't provided
  const count = totalCount !== undefined ? totalCount : users.length;
  const extraCount = Math.max(0, count - maxAvatars) + 39;

  return (
    <div className={cn("flex items-center", className)}>
      {/* Merge default classes with className */}
      {visibleUsers.map((user, index) => (
        <div key={index} className="relative -ml-3 first:ml-0">
          <Avatar className="ring-main h-10 w-10 ring-4">
            <AvatarImage src={user.profile_image_url_https} alt={user.name} />
            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
        </div>
      ))}
      {extraCount > 0 && (
        <div className="relative -ml-3 first:ml-0">
          <Avatar className="ring-main h-10 w-10 ring-4">
            <AvatarFallback>+{extraCount}</AvatarFallback>
          </Avatar>
        </div>
      )}
    </div>
  );
};
