/**
 * ProspectCardMenu
 * Dropdown menu with platform-specific actions and status management.
 */
"use client";

import { useRouter } from "next/navigation";
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
  ContentCopyIcon,
  MoreHorizIcon,
  OpenInNewIcon,
  PersonIcon,
} from "@/shared/ui/components/icons";
import {
  CircleDot,
  MessageSquare,
  TrendingUp,
  CheckCircle,
  Share2,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { useProfile } from "@/features/profile/contexts/TwitterProfileContext";
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
    icon: <CircleDot className="size-4" />,
  },
  {
    value: "contacted",
    label: 'Mark "Contacted"',
    icon: <MessageSquare className="size-4" />,
  },
  {
    value: "in_progress",
    label: 'Mark "In progress"',
    icon: <TrendingUp className="size-4" />,
  },
  {
    value: "converted",
    label: 'Mark "Converted"',
    icon: <CheckCircle className="size-4" />,
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
  const router = useRouter();
  const { openProfile } = useProfile();
  const updateStatus = useMutation(api.prospects.updateProspectStatus);

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
    if (platform === "twitter" && twitterUsername) {
      openProfile({ username: twitterUsername });
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
          <Share2 className="size-4" aria-hidden />
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
        {platform === "twitter" && twitterUsername && (
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
              <Archive className="size-4" aria-hidden />
              Archive
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleUnarchive}>
              <ArchiveRestore className="size-4" aria-hidden />
              Unarchive
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
