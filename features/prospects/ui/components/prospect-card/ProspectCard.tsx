/**
 * ProspectCard
 * Main card component for rendering prospects in list view.
 * Uses Convex prospect document directly — no normalization needed.
 */
"use client";

import * as React from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/shared/lib/utils";
import { ProspectCardHeader } from "./ProspectCardHeader";
import { ProspectCardBody } from "./ProspectCardBody";
import { ProspectCardFooter } from "./ProspectCardFooter";
import { ProspectCardMenu } from "./ProspectCardMenu";

interface ProspectCardProps {
  prospect: Doc<"prospects">;
  highlightKeywords?: string[];
  onClick?: () => void;
  className?: string;
}

/**
 * Extract display data from prospect document.
 * Handles both enriched fields and raw platform data fallbacks.
 */
function extractDisplayData(prospect: Doc<"prospects">) {
  const data = prospect.data as Record<string, unknown> | undefined;

  // Use enriched fields if available, otherwise extract from raw data
  let avatarUrl: string | undefined;
  let displayName = prospect.displayName;
  let profileUrl: string | undefined;
  let twitterUsername: string | undefined;

  if (prospect.platform === "twitter" && data) {
    const user = data.user as Record<string, unknown> | undefined;
    avatarUrl = (user?.profile_image_url_https as string) || undefined;
    displayName = displayName || (user?.name as string) || undefined;
    twitterUsername = (user?.screen_name as string) || undefined;
    profileUrl = twitterUsername
      ? `https://x.com/${twitterUsername}`
      : undefined;
  } else if (prospect.platform === "linkedin" && data) {
    const author = data.author as Record<string, unknown> | undefined;
    avatarUrl = (author?.profilePictureURL as string) || undefined;
    displayName = displayName || (author?.name as string) || undefined;
    profileUrl = (author?.url as string) || undefined;
  }

  return {
    avatarUrl,
    displayName: displayName || "Unknown",
    profileUrl,
    twitterUsername,
  };
}

export function ProspectCard({
  prospect,
  highlightKeywords,
  onClick,
  className,
}: ProspectCardProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  // Optimistic status - when changed, card will hide immediately
  const [optimisticStatus, setOptimisticStatus] = React.useState<
    Doc<"prospects">["status"] | null
  >(null);

  const { avatarUrl, displayName, profileUrl, twitterUsername } =
    extractDisplayData(prospect);

  // If optimistic status is set and differs from current, hide the card
  if (optimisticStatus !== null && optimisticStatus !== prospect.status) {
    return null;
  }

  return (
    <article
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "cursor-pointer space-y-2 rounded-xl border px-4 py-3",
        className
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onClick?.();
        }
      }}
      aria-label={`Prospect: ${displayName}`}
    >
      <ProspectCardHeader
        prospectId={prospect._id}
        avatarUrl={avatarUrl}
        displayName={displayName}
        title={prospect.title}
        timestamp={prospect.updatedAt}
        prospectType={prospect.prospectType}
      >
        <ProspectCardMenu
          prospectId={prospect._id}
          platform={prospect.platform}
          profileUrl={profileUrl}
          twitterUsername={twitterUsername}
          status={prospect.status}
          onViewProfile={() => onClick?.()}
          onStatusChange={setOptimisticStatus}
        />
      </ProspectCardHeader>

      <ProspectCardBody
        text={prospect.briefIntro}
        highlightKeywords={highlightKeywords}
      />

      <ProspectCardFooter
        qualificationScore={prospect.qualificationScore}
        finance={prospect.finance?.displayValue}
        location={prospect.location}
        isHovered={isHovered}
      />
    </article>
  );
}
