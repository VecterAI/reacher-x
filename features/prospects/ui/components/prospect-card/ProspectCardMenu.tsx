/**
 * ProspectCardMenu
 * Dropdown menu with platform-specific actions and status management.
 */
"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";
import { Button } from "@/shared/ui/components/Button";
import {
  ArchiveIcon,
  ContentCopyIcon,
  ForumIcon,
  FramePersonIcon,
  HowToRegIcon,
  IosShareIcon,
  MarkChatReadIcon,
  MoreHorizIcon,
  OpenInNewIcon,
  PersonIcon,
  UnarchiveIcon,
} from "@/shared/ui/components/icons";
import { useProfile } from "@/features/profile/contexts/TwitterProfileContext";
import { usePanelStack } from "@/features/prospects/contexts/PanelStackContext";
import { extractTwitterUsername } from "@/shared/lib/utils/url/socialProfiles";
import { toast } from "sonner";
import type { Id, Doc } from "@/convex/_generated/dataModel";

type ProspectStatus = Doc<"prospects">["status"];

interface ProspectCardMenuProps {
  prospectId: Id<"prospects">;
  platform: "twitter" | "linkedin";
  profileUrl?: string;
  twitterUsername?: string;
  status: ProspectStatus;
  onViewProfile: () => void;
  /** Called immediately when status is changed (for optimistic updates) */
  onStatusChange?: (newStatus: ProspectStatus) => void;
}

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

export function ProspectCardMenu({
  prospectId,
  platform,
  profileUrl,
  twitterUsername,
  status,
  onViewProfile,
  onStatusChange,
}: ProspectCardMenuProps) {
  const { openProfile } = useProfile();
  const { pushPanel } = usePanelStack();
  const updateStatus = useMutation(api.prospects.updateProspectStatus);
  const resolvedTwitterUsername =
    platform === "twitter"
      ? twitterUsername ||
        (profileUrl ? extractTwitterUsername(profileUrl) : undefined)
      : undefined;

  const handleViewProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onViewProfile();
  };

  const handleShareProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleStatusChange = (
    e: React.MouseEvent,
    newStatus: ProspectStatus
  ) => {
    e.stopPropagation();

    // Call optimistic update callback immediately
    onStatusChange?.(newStatus);

    const statusLabel =
      STATUS_OPTIONS.find((o) => o.value === newStatus)
        ?.label.replace('Mark "', "")
        .replace('"', "") || newStatus;

    // Use toast.promise for immediate feedback
    toast.promise(updateStatus({ prospectId, status: newStatus }), {
      loading: `Marking as ${statusLabel}...`,
      success: `Prospect marked as ${statusLabel}`,
      error: "Failed to update status",
    });
  };

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Call optimistic update callback immediately
    onStatusChange?.("archived");

    toast.promise(updateStatus({ prospectId, status: "archived" }), {
      loading: "Archiving...",
      success: "Prospect moved to archive",
      error: "Failed to archive",
    });
  };

  const handleUnarchive = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Call optimistic update callback immediately
    onStatusChange?.("new");

    toast.promise(updateStatus({ prospectId, status: "new" }), {
      loading: "Unarchiving...",
      success: "Prospect restored to prospects",
      error: "Failed to unarchive",
    });
  };

  const handleViewPlatformProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (platform === "twitter" && resolvedTwitterUsername) {
      void openProfile({ username: resolvedTwitterUsername });
      pushPanel("twitter-profile", { username: resolvedTwitterUsername });
    } else if (platform === "linkedin" && profileUrl) {
      window.open(profileUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleCopyProfileLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profileUrl) return;
    navigator.clipboard.writeText(profileUrl).then(
      () => toast.success("Copied!", { description: "Profile link copied." }),
      () => toast.error("Error!", { description: "Unable to copy." })
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="xsIcon"
          variant="ghost"
          onClick={(e) => e.stopPropagation()}
          aria-label="More options"
        >
          <MoreHorizIcon className="fill-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>↳ Menu</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* View & Share */}
        <DropdownMenuItem onClick={handleViewProfile}>
          <PersonIcon className="fill-current" aria-hidden />
          View profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleShareProfile}>
          <IosShareIcon className="fill-current" aria-hidden />
          Share profile
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Status options - exclude current status */}
        {STATUS_OPTIONS.filter((opt) => opt.value !== status).map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={(e) => handleStatusChange(e, opt.value)}
          >
            {opt.icon}
            {opt.label}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        {/* Platform-specific links */}
        {platform === "twitter" && resolvedTwitterUsername && (
          <DropdownMenuItem onClick={handleViewPlatformProfile}>
            <OpenInNewIcon className="fill-current" aria-hidden />
            View Twitter profile
          </DropdownMenuItem>
        )}
        {platform === "linkedin" && profileUrl && (
          <DropdownMenuItem onClick={handleViewPlatformProfile}>
            <OpenInNewIcon className="fill-current" aria-hidden />
            View LinkedIn profile
          </DropdownMenuItem>
        )}
        {profileUrl && (
          <DropdownMenuItem onClick={handleCopyProfileLink}>
            <ContentCopyIcon className="fill-current" aria-hidden />
            Copy profile link
          </DropdownMenuItem>
        )}

        {/* Archive / Unarchive */}
        {status !== "archived" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleArchive}>
              <ArchiveIcon className="fill-current" aria-hidden />
              Archive
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleUnarchive}>
              <UnarchiveIcon className="fill-current" aria-hidden />
              Unarchive
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
