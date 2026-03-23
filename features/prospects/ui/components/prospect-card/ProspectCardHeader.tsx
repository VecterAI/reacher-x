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
import { useActiveUseCaseLabels } from "@/shared/hooks";

interface ProspectCardHeaderProps {
  prospectId: Id<"prospects">;
  avatarUrl?: string;
  displayName?: string;
  verified?: boolean;
  title?: string;
  timestamp?: number;
  prospectType?: "individual" | "organization" | "unknown";
  status?: "new" | "contacted" | "in_progress" | "converted" | "archived";
  interactive?: boolean;
  mode?: "default" | "onboarding_preview";
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
  status,
  interactive = true,
  mode = "default",
  children,
}: ProspectCardHeaderProps) {
  const router = useRouter();
  const { entitySingular, routes } = useActiveUseCaseLabels();
  const entitySingularLower = entitySingular.toLowerCase();
  const shouldLinkToDetailPage = interactive && mode !== "onboarding_preview";

  const handleClick = (e: React.MouseEvent) => {
    if (!shouldLinkToDetailPage) {
      return;
    }
    e.stopPropagation();
    router.push(routes.detailHref(prospectId));
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (!shouldLinkToDetailPage) {
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      router.push(routes.detailHref(prospectId));
    }
  };

  // Avatar shape: rounded-full for individuals, rounded-lg for organizations
  const avatarShape =
    prospectType === "organization" ? "rounded-sm" : "rounded-full";

  return (
    <header className="flex min-w-0 items-start gap-2">
      <div className="shrink-0">
        <Avatar
          className={cn(
            "ring-border size-8 ring-1",
            avatarShape,
            status === "archived" && "grayscale"
          )}
        >
          <AvatarImage src={avatarUrl} alt={displayName || entitySingular} />
          <AvatarFallback className={avatarShape}>
            {displayName?.charAt(0).toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="flex min-w-0 flex-1 items-start gap-2">
        <div
          onClick={shouldLinkToDetailPage ? handleClick : undefined}
          className={cn(
            "min-w-0 flex-1 overflow-hidden text-left",
            shouldLinkToDetailPage && "cursor-pointer"
          )}
          aria-label={
            shouldLinkToDetailPage
              ? `View ${displayName || entitySingularLower} profile`
              : undefined
          }
          role={shouldLinkToDetailPage ? "button" : undefined}
          tabIndex={shouldLinkToDetailPage ? 0 : undefined}
          onKeyDown={shouldLinkToDetailPage ? handleKeyDown : undefined}
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
        </div>

        {children ? <div className="shrink-0">{children}</div> : null}
      </div>
    </header>
  );
}
