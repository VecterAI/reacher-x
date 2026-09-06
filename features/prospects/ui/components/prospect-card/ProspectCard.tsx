/**
 * ProspectCard
 * Main card component for rendering prospects in list view.
 * Accepts either a full prospect doc or a summary read-model row.
 */
"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { normalizeTwitterUrlEntities } from "@/shared/lib/twitter/profileLinks";
import {
  getProspectDisplayData,
  type ProspectCardRecord,
} from "@/features/prospects/lib/getProspectDisplayData";
import { getProspectDisplayTimestamp } from "@/features/prospects/lib/getProspectDisplayTimestamp";
import { useActiveUseCaseLabels } from "@/shared/hooks";
import { ProspectCardHeader } from "./ProspectCardHeader";
import { ProspectCardBody } from "./ProspectCardBody";
import { ProspectCardFooter } from "./ProspectCardFooter";
import { ProspectCardMenu } from "./ProspectCardMenu";

export type ProspectSurfaceMode =
  | "default"
  | "onboarding_preview"
  | "ui_preview";

/** Display-only synthetic profile. Has no prospect ID, actions, links, or evidence. */
export type SyntheticProspectCardRecord = {
  synthetic: true;
  displayName: string;
  platform: "twitter" | "linkedin";
  title: string;
  briefIntro: string;
  status?: never;
  bioUrlEntities?: never;
  prospectType?: "individual";
  planGenerationStatus?: never;
  qualificationStatus?: never;
  qualificationScore?: never;
  location?: never;
};

interface ProspectCardProps {
  prospect: ProspectCardRecord | SyntheticProspectCardRecord;
  highlightKeywords?: string[];
  /** Label for a preview of a different use case. Defaults to the active workspace. */
  entityLabel?: string;
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
  entityLabel,
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

  const storedProspect = "synthetic" in prospect ? null : prospect;
  const canInteract = Boolean(storedProspect) && interactive;
  const {
    avatarUrl,
    displayName,
    profileUrl,
    twitterUsername,
    verified,
    platform,
  } = storedProspect
    ? getProspectDisplayData(storedProspect)
    : {
        displayName: prospect.displayName ?? "",
        platform: prospect.platform,
        avatarUrl: undefined,
        profileUrl: undefined,
        twitterUsername: undefined,
        verified: false,
      };
  const prospectId = storedProspect
    ? "prospectId" in storedProspect
      ? storedProspect.prospectId
      : storedProspect._id
    : undefined;
  const financeDisplayValue = storedProspect
    ? "prospectId" in storedProspect
      ? storedProspect.financeDisplayValue
      : storedProspect.finance?.displayValue
    : undefined;
  const outreachProgress =
    "prospectId" in prospect ? prospect.outreachProgress : undefined;
  const displayTimestamp = storedProspect
    ? getProspectDisplayTimestamp(storedProspect)
    : undefined;

  // If optimistic status is set and differs from current, hide the card
  if (optimisticStatus !== null && optimisticStatus !== prospect.status) {
    return null;
  }

  return (
    <article
      onClick={canInteract ? onClick : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "h-full w-full min-w-0 space-y-2 rounded-xl border px-4 py-3",
        canInteract && "cursor-pointer",
        unread && "bg-muted/40 dark:bg-muted/25",
        className
      )}
      role={canInteract ? "button" : undefined}
      tabIndex={canInteract ? 0 : undefined}
      onKeyDown={
        canInteract
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                onClick?.();
              }
            }
          : undefined
      }
      aria-label={`${entityLabel ?? entitySingular}: ${displayName}`}
    >
      <ProspectCardHeader
        prospectId={prospectId}
        avatarUrl={avatarUrl}
        displayName={displayName}
        verified={verified}
        title={prospect.title}
        timestamp={displayTimestamp}
        prospectType={prospect.prospectType}
        status={prospect.status}
        interactive={canInteract}
        mode={mode}
        platform={platform}
      >
        {showMenu && prospectId && storedProspect ? (
          <ProspectCardMenu
            prospectId={prospectId}
            platform={platform}
            profileUrl={profileUrl}
            twitterUsername={twitterUsername}
            status={storedProspect.status}
            mode={mode}
            onViewProfile={() => onClick?.()}
            onStatusChange={setOptimisticStatus}
          />
        ) : null}
      </ProspectCardHeader>

      <ProspectCardBody
        text={
          storedProspect && mode !== "ui_preview"
            ? storedProspect.qualificationReasoning
            : prospect.briefIntro
        }
        urlEntities={
          storedProspect && mode !== "ui_preview"
            ? undefined
            : normalizeTwitterUrlEntities(prospect.bioUrlEntities)
        }
        highlightKeywords={highlightKeywords}
      />

      <ProspectCardFooter
        planGenerationStatus={prospect.planGenerationStatus}
        outreachProgress={outreachProgress}
        qualificationStatus={prospect.qualificationStatus}
        qualificationScore={prospect.qualificationScore}
        finance={financeDisplayValue}
        location={prospect.location}
        isHovered={isHovered}
      />
    </article>
  );
}
