"use client";

import * as React from "react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/shared/ui/components/Avatar";
import { cn } from "@/shared/lib/utils/utils";

export interface WaitlistUser {
  avatarUrl: string;
  displayName: string;
  username: string;
  pro: boolean;
}

export interface AvatarStackProps {
  users: WaitlistUser[];
  maxAvatars?: number;
  className?: string; // Add className prop
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
      {" "}
      {/* Merge default classes with className */}
      {visibleUsers.map((user, index) => (
        <div key={index} className="relative -ml-3 first:ml-0">
          <Avatar className="h-10 w-10 ring-4 ring-main">
            <AvatarImage src={user.avatarUrl} alt={user.displayName} />
            <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
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
