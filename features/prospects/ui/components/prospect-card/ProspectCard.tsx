/**
 * ProspectCard
 * Main card component for rendering prospects in list view.
 * Accepts either a full prospect doc or a summary read-model row.
 */
"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import {
  getProspectDisplayData,
  type ProspectCardRecord,
} from "@/features/prospects/lib/getProspectDisplayData";
import { useActiveUseCaseLabels } from "@/shared/hooks";
import { ProspectCardHeader } from "./ProspectCardHeader";
import { ProspectCardBody } from "./ProspectCardBody";
import { ProspectCardFooter } from "./ProspectCardFooter";
import { ProspectCardMenu } from "./ProspectCardMenu";

export type ProspectSurfaceMode =
  | "default"
  | "onboarding_preview"
  | "ui_preview";

interface ProspectCardProps {
  prospect: ProspectCardRecord;
  highlightKeywords?: string[];
  onClick?: () => void;
  className?: string;
  interactive?: boolean;
  showMenu?: boolean;
  mode?: ProspectSurfaceMode;
  /** Unread when the user has not opened the profile panel for this prospect */
  unread?: boolean;
}

export function ProspectCard({
  prospect,
  highlightKeywords,
  onClick,
  className,
  interactive = true,
  showMenu = true,
  mode = "default",
  unread = false,
}: ProspectCardProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const { entitySingular } = useActiveUseCaseLabels();
  // Optimistic status - when changed, card will hide immediately
  const [optimisticStatus, setOptimisticStatus] = React.useState<
    ProspectCardRecord["status"] | null
  >(null);

  const { avatarUrl, displayName, profileUrl, twitterUsername, verified } =
    getProspectDisplayData(prospect);
  const prospectId =
    "prospectId" in prospect ? prospect.prospectId : prospect._id;
  const financeDisplayValue =
    "prospectId" in prospect
      ? prospect.financeDisplayValue
      : prospect.finance?.displayValue;

  // If optimistic status is set and differs from current, hide the card
  if (optimisticStatus !== null && optimisticStatus !== prospect.status) {
    return null;
  }

  return (
    <article
      onClick={interactive ? onClick : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "w-full min-w-0 space-y-2 rounded-xl border px-4 py-3",
        interactive && "cursor-pointer",
        unread && "bg-muted/40 dark:bg-muted/25",
        className
      )}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                onClick?.();
              }
            }
          : undefined
      }
      aria-label={`${entitySingular}: ${displayName}`}
    >
      <ProspectCardHeader
        prospectId={prospectId}
        avatarUrl={avatarUrl}
        displayName={displayName}
        verified={verified}
        title={prospect.title}
        timestamp={prospect.updatedAt}
        prospectType={prospect.prospectType}
        status={prospect.status}
        interactive={interactive}
        mode={mode}
        platform={prospect.platform}
      >
        {showMenu ? (
          <ProspectCardMenu
            prospectId={prospectId}
            platform={prospect.platform}
            profileUrl={profileUrl}
            twitterUsername={twitterUsername}
            status={prospect.status}
            mode={mode}
            onViewProfile={() => onClick?.()}
            onStatusChange={setOptimisticStatus}
          />
        ) : null}
      </ProspectCardHeader>

      <ProspectCardBody
        text={prospect.briefIntro}
        highlightKeywords={highlightKeywords}
      />

      <ProspectCardFooter
        qualificationStatus={prospect.qualificationStatus}
        qualificationScore={prospect.qualificationScore}
        finance={financeDisplayValue}
        location={prospect.location}
        isHovered={isHovered}
      />
    </article>
  );
}
