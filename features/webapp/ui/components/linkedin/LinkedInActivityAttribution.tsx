"use client";

import type { UnifiedPostActivity } from "@/shared/lib/platforms/types";
import { cn } from "@/shared/lib/utils";
import { RepeatIcon, ThumbUpIcon } from "@/shared/ui/components/icons";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";

export interface LinkedInActivityAttributionProps {
  activity: UnifiedPostActivity;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function LinkedInActivityAttribution({
  activity,
}: LinkedInActivityAttributionProps) {
  const actorName = activity.actor.name ?? "LinkedIn user";
  const isOrganization = activity.actor.type?.toUpperCase() === "COMPANY";
  const actionLabel = activity.type === "like" ? "likes this" : "reposted this";
  const ariaLabel = `${actorName} ${actionLabel}`;

  return (
    <div
      className="border-border text-muted-foreground mb-3 flex min-w-0 items-center gap-2 border-b pb-3 text-xs"
      aria-label={ariaLabel}
    >
      <Avatar
        className={cn(
          "ring-border size-6 shrink-0 ring-1",
          isOrganization ? "rounded-md" : "rounded-full"
        )}
      >
        <AvatarImage
          src={activity.actor.avatarUrl}
          alt={`Avatar of ${actorName}`}
          className={cn(isOrganization ? "rounded-md" : undefined)}
        />
        <AvatarFallback
          className={cn(
            "text-[10px]",
            isOrganization ? "rounded-md" : undefined
          )}
        >
          {getInitials(actorName) || "?"}
        </AvatarFallback>
      </Avatar>

      <p className="min-w-0 flex-1 truncate">
        <span className="text-foreground font-medium">{actorName}</span>{" "}
        {actionLabel}
      </p>

      {activity.type === "like" ? (
        <ThumbUpIcon
          className="size-4 shrink-0 fill-current"
          aria-hidden="true"
        />
      ) : (
        <RepeatIcon
          className="size-4 shrink-0 fill-current"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
