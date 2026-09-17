"use client";
import type * as React from "react";
import type {
  ProspectStatus,
  ProspectStatusMenuOption,
} from "@/features/prospects/lib/statusMenuOptions";
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
  ChangeHistoryIcon,
  ContentCopyIcon,
  IosShareIcon,
  MailIcon,
  MoreHorizIcon,
  OpenInNewIcon,
  PersonIcon,
  UnarchiveIcon,
  XChatIcon,
} from "@/shared/ui/components/icons";
interface ProspectCardMenuViewProps {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  platform: "twitter" | "linkedin";
  profileUrl?: string;
  resolvedTwitterUsername?: string;
  status: ProspectStatus;
  statusOptions: ProspectStatusMenuOption[];
  isPreviewMode: boolean;
  isOnboardingPreview: boolean;
  dmEligibility: { enabled: boolean; reasonLabel?: string };
  handleOpenAgentPanel: React.MouseEventHandler;
  handleViewProfile: React.MouseEventHandler;
  handleShareProfile: React.MouseEventHandler;
  handleStatusChange: (event: React.MouseEvent, status: ProspectStatus) => void;
  handleViewPlatformProfile: React.MouseEventHandler;
  handleCopyProfileLink: React.MouseEventHandler;
  handleOpenDmPanel: React.MouseEventHandler;
  handleArchive: React.MouseEventHandler;
  handleUnarchive: React.MouseEventHandler;
}

/** One menu tree for live data and local demonstrations. */
export function ProspectCardMenuView({
  menuOpen,
  setMenuOpen,
  platform,
  profileUrl,
  resolvedTwitterUsername,
  status,
  statusOptions,
  isPreviewMode,
  isOnboardingPreview,
  dmEligibility,
  handleOpenAgentPanel,
  handleViewProfile,
  handleShareProfile,
  handleStatusChange,
  handleViewPlatformProfile,
  handleCopyProfileLink,
  handleOpenDmPanel,
  handleArchive,
  handleUnarchive,
}: ProspectCardMenuViewProps) {
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

        {/* Agent */}
        <DropdownMenuItem
          disabled={isPreviewMode || status === "archived"}
          title={
            status === "archived"
              ? "Unarchive this profile to chat with the agent"
              : undefined
          }
          onClick={handleOpenAgentPanel}
        >
          <ChangeHistoryIcon className="fill-current" aria-hidden />
          Agent
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {/* View & Share */}
        <DropdownMenuItem onClick={handleViewProfile}>
          <PersonIcon className="fill-current" aria-hidden />
          View profile
        </DropdownMenuItem>
        {!isPreviewMode ? (
          <DropdownMenuItem onClick={handleShareProfile}>
            <IosShareIcon className="fill-current" aria-hidden />
            Share profile
          </DropdownMenuItem>
        ) : null}

        {!isPreviewMode ? <DropdownMenuSeparator /> : null}

        {/* Status options - exclude current status */}
        {statusOptions
          .filter((opt) => opt.value !== status)
          .map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              disabled={isPreviewMode || status === "archived"}
              title={
                status === "archived"
                  ? "Unarchive to change status"
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
            View X/Twitter profile
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
          {platform === "linkedin" ? (
            <MailIcon className="fill-current" aria-hidden />
          ) : (
            <XChatIcon aria-hidden />
          )}
          {platform === "linkedin" ? "Message on LinkedIn" : "DM on X/Twitter"}
        </DropdownMenuItem>

        {/* Archive / Unarchive */}
        {status !== "archived" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={isPreviewMode} onClick={handleArchive}>
              <ArchiveIcon className="fill-current" aria-hidden />
              Archive
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={isPreviewMode}
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
