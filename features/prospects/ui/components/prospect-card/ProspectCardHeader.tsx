/**
 * ProspectCardHeader
 * Avatar + Name + Time + Title area.
 * Clicking routes to prospect detail page.
 */
"use client";

import { useRouter } from "next/navigation";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { NewReleasesIcon } from "@/shared/ui/components/icons";
import { formatRelativeTime } from "@/shared/lib/utils";
import { cn } from "@/shared/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";

interface ProspectCardHeaderProps {
  prospectId: Id<"prospects">;
  avatarUrl?: string;
  displayName?: string;
  verified?: boolean;
  title?: string;
  timestamp?: number;
  prospectType?: "individual" | "organization" | "unknown";
  children?: React.ReactNode; // For menu slot
}

export function ProspectCardHeader({
  prospectId,
  avatarUrl,
  displayName,
  verified = false,
  title,
  timestamp,
  prospectType,
  children,
}: ProspectCardHeaderProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/prospects/${prospectId}`);
  };

  // Avatar shape: rounded-full for individuals, rounded-lg for organizations
  const avatarShape =
    prospectType === "organization" ? "rounded-sm" : "rounded-full";

  return (
    <header className="flex min-w-0 items-start gap-2">
      <button
        onClick={handleClick}
        className="shrink-0"
        aria-label={`View ${displayName || "prospect"} profile`}
      >
        <Avatar className={cn("ring-border size-8 ring-1", avatarShape)}>
          <AvatarImage src={avatarUrl} alt={displayName || "Prospect"} />
          <AvatarFallback className={avatarShape}>
            {displayName?.charAt(0).toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
      </button>

      <div className="flex min-w-0 flex-1 items-start gap-2">
        <button
          onClick={handleClick}
          className="min-w-0 flex-1 overflow-hidden text-left"
          aria-label={`View ${displayName || "prospect"} profile`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
            <div className="flex min-w-0 shrink items-center gap-0.5 overflow-hidden">
              <span className="block min-w-0 truncate text-sm font-medium">
                {displayName || "Unknown"}
              </span>
              {verified && (
                <NewReleasesIcon
                  className="mr-0.5 size-3 shrink-0 fill-current"
                  aria-hidden="true"
                />
              )}
            </div>
            {timestamp && (
              <div className="shrink-0">
                <time
                  className="text-muted-foreground shrink-0 text-sm"
                  dateTime={new Date(timestamp).toISOString()}
                  title={new Date(timestamp).toLocaleString()}
                >
                  · {formatRelativeTime(new Date(timestamp).toISOString())}
                </time>
              </div>
            )}
          </div>
          {title && (
            <p className="text-muted-foreground truncate text-xs">{title}</p>
          )}
        </button>

        {children ? <div className="shrink-0">{children}</div> : null}
      </div>
    </header>
  );
}
