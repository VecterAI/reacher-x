"use client";

import * as React from "react";
import { toast } from "sonner";
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
  ContentCopyIcon,
  MoreHorizIcon,
  OpenInNewIcon,
  PersonIcon,
  TwitterIcon,
} from "@/shared/ui/components/icons";

export interface XDmConversationMenuProps {
  profileUrl?: string | null;
  /** Without @ prefix is fine; used for "View X/Twitter profile" when no custom handler. */
  resolvedTwitterUsername?: string | null;
  /** In-app X/Twitter profile panel; falls back to opening x.com when omitted. */
  onViewTwitterProfile?: (twitterUsername: string) => void;
  /** In-app CRM prospect profile. */
  onViewProfile?: () => void;
}

function normalizeUsername(u: string) {
  return u.trim().replace(/^@/, "");
}

export function XDmConversationMenu({
  profileUrl,
  resolvedTwitterUsername,
  onViewTwitterProfile,
  onViewProfile,
}: XDmConversationMenuProps) {
  const handleCopyProfile = React.useCallback(() => {
    if (!profileUrl) return;
    navigator.clipboard.writeText(profileUrl).then(
      () => toast.success("Copied profile link"),
      () => toast.error("Unable to copy profile link")
    );
  }, [profileUrl]);

  const handleOpenTwitter = React.useCallback(() => {
    if (!profileUrl) return;
    window.open(profileUrl, "_blank", "noopener,noreferrer");
  }, [profileUrl]);

  const handleViewTwitterProfile = React.useCallback(() => {
    const raw = resolvedTwitterUsername?.trim();
    if (!raw) return;
    const username = normalizeUsername(raw);
    if (onViewTwitterProfile) {
      onViewTwitterProfile(username);
      return;
    }
    window.open(
      `https://x.com/${encodeURIComponent(username)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }, [onViewTwitterProfile, resolvedTwitterUsername]);

  const showViewTwitter = Boolean(resolvedTwitterUsername?.trim());

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="xsIcon" aria-label="Conversation menu">
          <MoreHorizIcon className="fill-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>↳ Menu</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {showViewTwitter ? (
          <DropdownMenuItem onClick={handleViewTwitterProfile}>
            <TwitterIcon className="fill-current" aria-hidden />
            View X/Twitter profile
          </DropdownMenuItem>
        ) : null}
        {profileUrl ? (
          <DropdownMenuItem onClick={handleCopyProfile}>
            <ContentCopyIcon className="fill-current" aria-hidden />
            Copy profile link
          </DropdownMenuItem>
        ) : null}
        {profileUrl ? (
          <DropdownMenuItem onClick={handleOpenTwitter}>
            <OpenInNewIcon className="fill-current" aria-hidden />
            Open on X/Twitter
          </DropdownMenuItem>
        ) : null}
        {onViewProfile ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onViewProfile}>
              <PersonIcon className="fill-current" aria-hidden />
              View profile
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
