"use client";

import * as React from "react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/shared/ui/components/Avatar";
import { cn } from "@/shared/lib/utils/utils";
import { WaitlistUser } from "../../waitlist/types";

export interface AvatarStackProps {
  users: WaitlistUser[];
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
  maxAvatars = 4,
  className,
}) => {
  const visibleUsers = users.slice(0, maxAvatars);
  const extraCount = users.length - maxAvatars;

  return (
    <div className={cn("flex items-center", className)}>
      {/* Merge default classes with className */}
      {visibleUsers.map((user, index) => (
        <div key={index} className="relative -ml-3 first:ml-0">
          <Avatar className="h-10 w-10 ring-4 ring-main">
            <AvatarImage src={user.profile_image_url_https} alt={user.name} />
            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
        </div>
      ))}
      {extraCount > 0 && (
        <div className="relative -ml-3 first:ml-0">
          <Avatar className="h-10 w-10 ring-4 ring-main">
            <AvatarFallback>+{extraCount}</AvatarFallback>
          </Avatar>
        </div>
      )}
    </div>
  );
};
