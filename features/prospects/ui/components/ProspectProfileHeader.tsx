/**
 * ProspectProfileHeader
 * Displays avatar, name, title, menu, and primary action button.
 * Avatar shape: circle for individual, rounded-square for organization.
 */
"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useProspectDmState } from "@/features/prospects/hooks/useProspectDmState";
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
  ArchiveIcon,
  UnarchiveIcon,
  ContentCopyIcon,
  AlternateEmailIcon,
} from "@/shared/ui/components/icons";
import { toast } from "sonner";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import { getProspectStatusMenuOptions } from "@/features/prospects/lib/statusMenuOptions";
import { useActiveUseCaseLabels } from "@/shared/hooks";

type ProspectStatus = Doc<"prospects">["status"];

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
  /** Open the X DM panel for this prospect */
  onOpenDmPanel?: () => void;
  /** Read-only onboarding preview mode */
  mode?: "default" | "onboarding_preview";
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
  onOpenDmPanel,
  mode = "default",
}: ProspectProfileHeaderProps) {
  const isOrg = prospectType === "organization";
  const avatarShape = isOrg ? "rounded-md" : "rounded-full";
  const [menuOpen, setMenuOpen] = React.useState(false);
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
  const isOnboardingPreview = mode === "onboarding_preview";
  const dmState = useProspectDmState(prospectId, {
    enabled: menuOpen && platform === "twitter",
  });
  const dmEligibility = React.useMemo(() => {
    if (platform !== "twitter") {
      return {
        enabled: false,
        reasonLabel: "DM on X is only available for X prospects right now.",
      };
    }

    return (
      dmState.data?.eligibility ?? {
        enabled: false,
        reasonLabel: dmState.loading
          ? "Checking DM availability on X..."
          : "DM eligibility unavailable right now.",
      }
    );
  }, [dmState.data?.eligibility, dmState.loading, platform]);

  const platformLabel = platform === "twitter" ? "X (Twitter)" : "LinkedIn";
  const timestampIso = timestamp ? new Date(timestamp).toISOString() : "";

  const handleStatusChange = (newStatus: ProspectStatus) => {
    if (!prospectId) return;
    const statusLabel = stageLabels[newStatus];

    toast.promise(
      updateStatus({
        prospectId: prospectId as Id<"prospects">,
        status: newStatus,
      }),
      {
        loading: `Marking as ${statusLabel}...`,
        success: `${entitySingular} marked as ${statusLabel}`,
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
        success: `${entitySingular} moved to archive`,
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
        success: `${entitySingular} restored to ${entityPlural.toLowerCase()}`,
        error: "Failed to unarchive",
      }
    );
  };

  const handleShareProfile = () => {
    if (!prospectId) return;
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
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="xsIcon" aria-label="Profile menu">
              <MoreHorizIcon className="fill-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>↳ Menu</DropdownMenuLabel>
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
                  onClick={() => handleStatusChange(opt.value)}
                >
                  {opt.icon}
                  {opt.label}
                </DropdownMenuItem>
              ))}

            <DropdownMenuSeparator />

            {/* Share profile */}
            {!isOnboardingPreview ? (
              <>
                <DropdownMenuItem onClick={handleShareProfile}>
                  <IosShareIcon className="fill-current" />
                  Share profile
                </DropdownMenuItem>

                <DropdownMenuSeparator />
              </>
            ) : null}

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
            <DropdownMenuItem
              disabled={
                isOnboardingPreview || !onOpenDmPanel || !dmEligibility.enabled
              }
              onClick={dmEligibility.enabled ? onOpenDmPanel : undefined}
              title={
                isOnboardingPreview
                  ? "DMs are disabled in onboarding preview."
                  : !dmEligibility.enabled
                    ? dmEligibility.reasonLabel
                    : undefined
              }
            >
              <AlternateEmailIcon className="fill-current" />
              DM on X
            </DropdownMenuItem>

            {/* Archive / Unarchive */}
            {status !== "archived" ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={isOnboardingPreview}
                  onClick={handleArchive}
                >
                  <ArchiveIcon className="fill-current" />
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
                  <UnarchiveIcon className="fill-current" />
                  Unarchive
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {(onChatWithAgent || isOnboardingPreview) && (
          <Button
            size="xs"
            className="flex-1 sm:flex-none"
            disabled={
              isOnboardingPreview || !onChatWithAgent || status === "archived"
            }
            title={
              status === "archived"
                ? "Unarchive this profile to chat with the agent"
                : undefined
            }
            onClick={onChatWithAgent}
          >
            ∆ Agent
          </Button>
        )}
      </div>
    </header>
  );
}
