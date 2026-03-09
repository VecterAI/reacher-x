/**
 * ProspectProfileHeader
 * Displays avatar, name, title, menu, and primary action button.
 * Avatar shape: circle for individual, rounded-square for organization.
 */
"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/shared/lib/utils";
import { formatRelativeTime } from "@/shared/lib/utils";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { Button } from "@/shared/ui/components/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";
import {
  MoreHorizIcon,
  NewReleasesIcon,
  OpenInNewIcon,
  IosShareIcon,
  FramePersonIcon,
  MarkChatReadIcon,
  ForumIcon,
  HowToRegIcon,
  ArchiveIcon,
  UnarchiveIcon,
  ContentCopyIcon,
} from "@/shared/ui/components/icons";
import { toast } from "sonner";
import type { Id, Doc } from "@/convex/_generated/dataModel";

type ProspectStatus = Doc<"prospects">["status"];

const STATUS_OPTIONS: {
  value: ProspectStatus;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "new",
    label: 'Mark "New"',
    icon: <FramePersonIcon className="fill-current" />,
  },
  {
    value: "contacted",
    label: 'Mark "Contacted"',
    icon: <MarkChatReadIcon className="fill-current" />,
  },
  {
    value: "in_progress",
    label: 'Mark "In progress"',
    icon: <ForumIcon className="fill-current" />,
  },
  {
    value: "converted",
    label: 'Mark "Converted"',
    icon: <HowToRegIcon className="fill-current" />,
  },
];

export interface ProspectProfileHeaderProps {
  /** Prospect ID for status updates */
  prospectId?: string;
  /** Current status */
  status?: ProspectStatus;
  /** Display name */
  name?: string;
  /** Title/role (e.g., "Solo SaaS Founder") */
  title?: string;
  /** Whether the prospect is verified on platform */
  verified?: boolean;
  /** Avatar URL */
  avatarUrl?: string;
  /** Profile URL (LinkedIn or Twitter) */
  profileUrl?: string;
  /** Platform for external link */
  platform?: "twitter" | "linkedin";
  /** Type of prospect for avatar shape */
  prospectType?: "individual" | "organization" | "unknown";
  /** Timestamp for relative time display */
  timestamp?: number;
  /** Additional className */
  className?: string;
  /** Chat with Agent button click handler */
  onChatWithAgent?: () => void;
  /** Platform profile action (Twitter opens in-app panel) */
  onViewPlatformProfile?: () => void;
}

export function ProspectProfileHeader({
  prospectId,
  status,
  name = "Unknown",
  verified = false,
  title,
  avatarUrl,
  profileUrl,
  platform = "linkedin",
  prospectType = "individual",
  timestamp,
  className,
  onChatWithAgent,
  onViewPlatformProfile,
}: ProspectProfileHeaderProps) {
  const isOrg = prospectType === "organization";
  const avatarShape = isOrg ? "rounded-md" : "rounded-full";
  const updateStatus = useMutation(api.prospects.updateProspectStatus);

  const platformLabel = platform === "twitter" ? "X (Twitter)" : "LinkedIn";
  const timestampIso = timestamp ? new Date(timestamp).toISOString() : "";

  const handleStatusChange = (newStatus: ProspectStatus) => {
    if (!prospectId) return;
    const statusLabel =
      STATUS_OPTIONS.find((o) => o.value === newStatus)
        ?.label.replace('Mark "', "")
        .replace('"', "") || newStatus;

    toast.promise(
      updateStatus({
        prospectId: prospectId as Id<"prospects">,
        status: newStatus,
      }),
      {
        loading: `Marking as ${statusLabel}...`,
        success: `Prospect marked as ${statusLabel}`,
        error: "Failed to update status",
      }
    );
  };

  const handleArchive = () => {
    if (!prospectId) return;
    toast.promise(
      updateStatus({
        prospectId: prospectId as Id<"prospects">,
        status: "archived",
      }),
      {
        loading: "Archiving...",
        success: "Prospect moved to archive",
        error: "Failed to archive",
      }
    );
  };

  const handleUnarchive = () => {
    if (!prospectId) return;
    toast.promise(
      updateStatus({
        prospectId: prospectId as Id<"prospects">,
        status: "new",
      }),
      {
        loading: "Unarchiving...",
        success: "Prospect restored to prospects",
        error: "Failed to unarchive",
      }
    );
  };

  const handleShareProfile = () => {
    // Copy internal prospect profile URL
    const prospectUrl = `${window.location.origin}/prospects/${prospectId}`;
    navigator.clipboard.writeText(prospectUrl).then(
      () =>
        toast.success("Copied!", {
          description: "Prospect profile link copied.",
        }),
      () => toast.error("Error!", { description: "Unable to copy." })
    );
  };

  const handleCopyLink = () => {
    if (!profileUrl) return;
    navigator.clipboard.writeText(profileUrl).then(
      () => toast.success("Copied!", { description: "Profile link copied." }),
      () => toast.error("Error!", { description: "Unable to copy link." })
    );
  };

  return (
    <header
      className={cn("flex flex-wrap items-start gap-3 px-4 py-4", className)}
    >
      {/* Avatar + Name group - stays together */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* Avatar */}
        <Avatar
          className={cn(
            "ring-border size-12 shrink-0 ring-1",
            avatarShape,
            status === "archived" && "grayscale"
          )}
        >
          {avatarUrl ? (
            <AvatarImage
              src={avatarUrl}
              alt={`Avatar of ${name}`}
              className={cn(isOrg ? "rounded-md" : undefined)}
            />
          ) : null}
          <AvatarFallback className={cn(isOrg ? "rounded-md" : undefined)}>
            {name?.charAt(0).toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>

        {/* Name and meta */}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-0.5 overflow-hidden">
            <div className="flex min-w-0 shrink items-center gap-0.5 overflow-hidden">
              <span className="truncate text-sm font-medium" title={name}>
                {name}
              </span>
              {verified && (
                <NewReleasesIcon
                  className="mr-0.5 size-3.5 shrink-0 fill-current"
                  aria-hidden="true"
                />
              )}
            </div>
            {timestampIso && (
              <div className="shrink-0">
                <time
                  className="text-muted-foreground shrink-0 text-sm"
                  dateTime={timestampIso}
                  title={new Date(timestampIso).toLocaleString()}
                >
                  · {formatRelativeTime(timestampIso)}
                </time>
              </div>
            )}
          </div>
          {title && (
            <span className="text-muted-foreground block truncate text-sm">
              {title}
            </span>
          )}
        </div>
      </div>

      {/* Actions - wraps to second row if needed */}
      <div className="flex w-full shrink-0 items-center gap-1 sm:w-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="xsIcon" aria-label="Profile menu">
              <MoreHorizIcon className="fill-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>↳ Menu</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* Status options - exclude current status */}
            {STATUS_OPTIONS.filter((opt) => opt.value !== status).map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => handleStatusChange(opt.value)}
              >
                {opt.icon}
                {opt.label}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            {/* Share profile */}
            <DropdownMenuItem onClick={handleShareProfile}>
              <IosShareIcon className="fill-current" />
              Share profile
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Platform links */}
            {profileUrl && (
              <DropdownMenuItem
                onClick={() => {
                  if (onViewPlatformProfile) {
                    onViewPlatformProfile();
                    return;
                  }

                  window.open(profileUrl, "_blank", "noopener,noreferrer");
                }}
              >
                <OpenInNewIcon className="fill-current" />
                {platform === "twitter"
                  ? "View Twitter profile"
                  : `Open on ${platformLabel}`}
              </DropdownMenuItem>
            )}
            {profileUrl && (
              <DropdownMenuItem onClick={handleCopyLink}>
                <ContentCopyIcon className="fill-current" />
                Copy profile link
              </DropdownMenuItem>
            )}

            {/* Archive / Unarchive */}
            {status !== "archived" ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleArchive}>
                  <ArchiveIcon className="fill-current" />
                  Archive
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleUnarchive}>
                  <UnarchiveIcon className="fill-current" />
                  Unarchive
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {onChatWithAgent && (
          <Button
            size="xs"
            className="flex-1 sm:flex-none"
            onClick={onChatWithAgent}
          >
            ∆ Agent
          </Button>
        )}
      </div>
    </header>
  );
}
