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

interface ProspectCardProps {
  prospect: ProspectCardRecord;
  highlightKeywords?: string[];
  onClick?: () => void;
  className?: string;
}

export function ProspectCard({
  prospect,
  highlightKeywords,
  onClick,
  className,
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
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "w-full min-w-0 cursor-pointer space-y-2 rounded-xl border px-4 py-3",
        className
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onClick?.();
        }
      }}
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
      >
        <ProspectCardMenu
          prospectId={prospectId}
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
        finance={financeDisplayValue}
        location={prospect.location}
        isHovered={isHovered}
      />
    </article>
  );
}
