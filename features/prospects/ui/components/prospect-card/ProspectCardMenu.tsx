/**
 * ProspectCardMenu
 * Dropdown menu with platform-specific actions and status management.
 */
"use client";

import * as React from "react";
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
  AlternateEmailIcon,
  ArchiveIcon,
  ContentCopyIcon,
  IosShareIcon,
  MoreHorizIcon,
  OpenInNewIcon,
  PersonIcon,
  UnarchiveIcon,
} from "@/shared/ui/components/icons";
import { useProfile } from "@/features/profile/contexts/TwitterProfileContext";
import { usePanelStack } from "@/features/prospects/contexts/PanelStackContext";
import { useProspectProfile } from "@/features/prospects/contexts/ProspectProfileContext";
import { useProspectDmState } from "@/features/prospects/hooks/useProspectDmState";
import { getProspectStatusMenuOptions } from "@/features/prospects/lib/statusMenuOptions";
import { extractTwitterUsername } from "@/shared/lib/utils/url/socialProfiles";
import { toast } from "sonner";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import { useActiveUseCaseLabels } from "@/shared/hooks";

type ProspectStatus = Doc<"prospects">["status"];

interface ProspectCardMenuProps {
  prospectId: Id<"prospects">;
  platform: "twitter" | "linkedin";
  profileUrl?: string;
  twitterUsername?: string;
  status: ProspectStatus;
  mode?: "default" | "onboarding_preview";
  onViewProfile: () => void;
  /** Called immediately when status is changed (for optimistic updates) */
  onStatusChange?: (newStatus: ProspectStatus) => void;
}

export function ProspectCardMenu({
  prospectId,
  platform,
  profileUrl,
  twitterUsername,
  status,
  mode = "default",
  onViewProfile,
  onStatusChange,
}: ProspectCardMenuProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const { openProfile } = useProfile();
  const { pushPanel } = usePanelStack();
  const { openProspect } = useProspectProfile();
  const updateStatus = useMutation(api.prospects.updateProspectStatus);
  const {
    activeUseCaseKey,
    entityPlural,
    entitySingular,
    routes,
    stageLabels,
  } = useActiveUseCaseLabels();
  const statusOptions = React.useMemo(
    () => getProspectStatusMenuOptions(activeUseCaseKey),
    [activeUseCaseKey]
  );
  const resolvedTwitterUsername =
    platform === "twitter"
      ? twitterUsername ||
        (profileUrl ? extractTwitterUsername(profileUrl) : undefined)
      : undefined;
  const isOnboardingPreview = mode === "onboarding_preview";
  const dmState = useProspectDmState(String(prospectId), {
    enabled: menuOpen,
    platform,
  });
  const dmEligibility = React.useMemo(() => {
    return (
      dmState.data?.eligibility ?? {
        enabled: false,
        reasonLabel: dmState.loading
          ? platform === "linkedin"
            ? "Checking LinkedIn messaging availability..."
            : "Checking DM availability on X..."
          : platform === "linkedin"
            ? "LinkedIn messaging eligibility unavailable right now."
            : "DM eligibility unavailable right now.",
      }
    );
  }, [dmState.data?.eligibility, dmState.loading, platform]);

  const handleViewProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onViewProfile();
  };

  const handleShareProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Copy internal prospect profile URL
    const prospectUrl = `${window.location.origin}${routes.detailHref(prospectId)}`;
    navigator.clipboard.writeText(prospectUrl).then(
      () =>
        toast.success("Copied!", {
          description: `${entitySingular} profile link copied.`,
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

    const statusLabel = stageLabels[newStatus];

    // Use toast.promise for immediate feedback
    toast.promise(updateStatus({ prospectId, status: newStatus }), {
      loading: `Marking as ${statusLabel}...`,
      success: `${entitySingular} marked as ${statusLabel}`,
      error: "Failed to update status",
    });
  };

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Call optimistic update callback immediately
    onStatusChange?.("archived");

    toast.promise(updateStatus({ prospectId, status: "archived" }), {
      loading: "Archiving...",
      success: `${entitySingular} moved to archive`,
      error: "Failed to archive",
    });
  };

  const handleUnarchive = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Call optimistic update callback immediately
    onStatusChange?.("new");

    toast.promise(updateStatus({ prospectId, status: "new" }), {
      loading: "Unarchiving...",
      success: `${entitySingular} restored to ${entityPlural.toLowerCase()}`,
      error: "Failed to unarchive",
    });
  };

  const handleViewPlatformProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOnboardingPreview) {
      const fallbackUrl =
        profileUrl ||
        (platform === "twitter" && resolvedTwitterUsername
          ? `https://x.com/${resolvedTwitterUsername}`
          : undefined);
      if (fallbackUrl) {
        window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }

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

  const handleOpenDmPanel = (e: React.MouseEvent) => {
    e.stopPropagation();
    openProspect(prospectId);
    pushPanel("platform-conversation", {
      prospectId: String(prospectId),
      platform,
    });
  };

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
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
        {!isOnboardingPreview ? (
          <DropdownMenuItem onClick={handleShareProfile}>
            <IosShareIcon className="fill-current" aria-hidden />
            Share profile
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator />

        {/* Status options - exclude current status */}
        {statusOptions
          .filter((opt) => opt.value !== status)
          .map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              disabled={isOnboardingPreview || status === "archived"}
              title={
                status === "archived"
                  ? "Unarchive to change pipeline stage"
                  : undefined
              }
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
        <DropdownMenuItem
          disabled={isOnboardingPreview || !dmEligibility.enabled}
          onClick={dmEligibility.enabled ? handleOpenDmPanel : undefined}
          title={
            isOnboardingPreview
              ? "DMs are disabled in onboarding preview."
              : !dmEligibility.enabled
                ? dmEligibility.reasonLabel
                : undefined
          }
        >
          <AlternateEmailIcon className="fill-current" aria-hidden />
          {platform === "linkedin" ? "Message on LinkedIn" : "DM on X"}
        </DropdownMenuItem>

        {/* Archive / Unarchive */}
        {status !== "archived" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={isOnboardingPreview}
              onClick={handleArchive}
            >
              <ArchiveIcon className="fill-current" aria-hidden />
              Archive
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={isOnboardingPreview}
              onClick={handleUnarchive}
            >
              <UnarchiveIcon className="fill-current" aria-hidden />
              Unarchive
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
