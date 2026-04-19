/**
 * SocialProfileLinks
 * Social profile buttons for X/Twitter and LinkedIn.
 * X/Twitter opens TwitterProfilePanel via panel stack.
 * LinkedIn opens profile in new tab.
 */
"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import { TwitterIcon, LinkedinIcon } from "@/shared/ui/components/icons";

export interface SocialProfiles {
  twitter?: {
    username: string;
    url: string;
    profileId?: string;
  };
  linkedin?: {
    username: string;
    url: string;
    urn?: string;
  };
}

export interface SocialProfileLinksProps {
  /** Social profiles data */
  profiles?: SocialProfiles;
  /** Handler for X/Twitter button click (pushes TwitterProfilePanel) */
  onTwitterClick?: (username: string) => void;
  /** Handler for LinkedIn button click */
  onLinkedInClick?: (url: string) => void;
  /** Additional className */
  className?: string;
}

export function SocialProfileLinks({
  profiles,
  onTwitterClick,
  onLinkedInClick,
  className,
}: SocialProfileLinksProps) {
  const hasTwitter = Boolean(profiles?.twitter?.username);
  const hasLinkedIn = Boolean(profiles?.linkedin?.url);

  if (!hasTwitter && !hasLinkedIn) {
    return null;
  }

  const handleTwitterClick = () => {
    if (profiles?.twitter?.username) {
      onTwitterClick?.(profiles.twitter.username);
    }
  };

  const handleLinkedInClick = () => {
    if (profiles?.linkedin?.url) {
      if (onLinkedInClick) {
        onLinkedInClick(profiles.linkedin.url);
        return;
      }
      window.open(profiles.linkedin.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <h3 className="text-sm font-medium">Social profiles</h3>
      <div className="flex gap-2">
        {hasTwitter && (
          <Button variant="outline" size="xs" onClick={handleTwitterClick}>
            <TwitterIcon className="fill-current" />
            X/Twitter
          </Button>
        )}
        {hasLinkedIn && (
          <Button variant="outline" size="xs" onClick={handleLinkedInClick}>
            <LinkedinIcon className="fill-current" />
            LinkedIn
          </Button>
        )}
      </div>
    </div>
  );
}
