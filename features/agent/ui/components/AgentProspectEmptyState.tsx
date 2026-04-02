"use client";

import { cn } from "@/shared/lib/utils";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { ProspectPlatformAvatar } from "@/shared/ui/components/ProspectPlatformAvatar";
import { Button } from "@/shared/ui/components/Button";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { NewReleasesIcon } from "@/shared/ui/components/icons";
import type { ProspectDisplayData } from "@/features/prospects/lib/getProspectDisplayData";

export interface AgentProspectEmptyStateProps {
  prospect?: ProspectDisplayData | null;
  isLoading?: boolean;
  onViewProfile?: () => void;
  className?: string;
}

function getAvatarFallback(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function AgentProspectEmptyState({
  prospect,
  isLoading = false,
  onViewProfile,
  className,
}: AgentProspectEmptyStateProps) {
  const avatarShape =
    prospect?.prospectType === "organization" ? "rounded-md" : "rounded-full";

  if (isLoading) {
    return (
      <section
        className={cn(
          "mx-auto flex w-full max-w-sm flex-col items-center px-4 pt-16 text-center",
          className
        )}
      >
        <Skeleton className="size-12 rounded-full" />
        <div className="mt-3 space-y-1.5">
          <Skeleton className="mx-auto h-4 w-40 rounded-sm" />
          <Skeleton className="mx-auto h-4 w-28 rounded-sm" />
        </div>
        <Skeleton className="mt-3 h-8 w-24 rounded-md" />
      </section>
    );
  }

  if (!prospect) {
    return null;
  }

  return (
    <section
      className={cn(
        "mx-auto flex w-full max-w-sm flex-col items-center px-4 pt-6 text-center",
        className
      )}
    >
      <ProspectPlatformAvatar platform={prospect.platform} badgeSize="lg">
        <Avatar className={cn("ring-border size-12 ring-1", avatarShape)}>
          {prospect.avatarUrl ? (
            <AvatarImage
              src={prospect.avatarUrl}
              alt={`Avatar of ${prospect.displayName}`}
              className={avatarShape}
            />
          ) : null}
          <AvatarFallback className={avatarShape}>
            {getAvatarFallback(prospect.displayName)}
          </AvatarFallback>
        </Avatar>
      </ProspectPlatformAvatar>

      <div className="mt-2 min-w-0">
        <div className="flex min-w-0 items-center justify-center gap-0.5 overflow-hidden">
          <h2
            className="text-foreground truncate text-sm font-medium"
            title={prospect.displayName}
          >
            {prospect.displayName}
          </h2>
          {prospect.verified && (
            <NewReleasesIcon
              className="mr-0.5 size-3.5 shrink-0 fill-current"
              aria-hidden="true"
            />
          )}
        </div>
        {prospect.title ? (
          <p className="text-muted-foreground text-sm">{prospect.title}</p>
        ) : null}
      </div>

      {onViewProfile ? (
        <Button
          variant="outline"
          size="xs"
          className="mt-2"
          onClick={onViewProfile}
        >
          View profile
        </Button>
      ) : null}
    </section>
  );
}
