"use client";

/**
 * OverviewTab
 * Displays the main overview content for a prospect profile.
 */

import * as React from "react";
import { cn, parseText } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import { Separator } from "@/shared/ui/components/Separator";
import { PipelineTimeline, type PipelineStage } from "../PipelineTimeline";
import { ProspectDetailsCard } from "../ProspectDetailsCard";
import { PainSolutionGrid, type PainPoint } from "../PainSolutionGrid";
import { SocialProfileLinks, type SocialProfiles } from "../SocialProfileLinks";
import type { Doc } from "@/convex/_generated/dataModel";

export interface OverviewTabProps {
  briefIntro?: string;
  pipelineStage?: PipelineStage;
  stageTimestamps?: Partial<Record<PipelineStage, number>>;
  qualificationStatus?: Doc<"prospects">["qualificationStatus"];
  qualificationScore?: number;
  status?: "new" | "contacted" | "in_progress" | "converted" | "archived";
  company?: string;
  websiteUrl?: string;
  email?: string;
  finance?: { displayValue: string };
  location?: string;
  foundViaLabel?: string;
  painPoints?: PainPoint[];
  socialProfiles?: SocialProfiles;
  onPainClick?: (painPoint: PainPoint) => void;
  onFinanceClick?: () => void;
  onTwitterClick?: (username: string) => void;
}

export function OverviewTab({
  briefIntro,
  pipelineStage = "new",
  stageTimestamps,
  qualificationStatus,
  qualificationScore,
  status,
  company,
  websiteUrl,
  email,
  finance,
  location,
  foundViaLabel,
  painPoints,
  socialProfiles,
  onPainClick,
  onFinanceClick,
  onTwitterClick,
}: OverviewTabProps) {
  const [showFullIntro, setShowFullIntro] = React.useState(false);

  return (
    <>
      {briefIntro && (
        <section className="space-y-2 px-4 pb-4">
          <h3 className="text-sm font-medium">Brief intro</h3>
          <p
            className={cn(
              "text-foreground [&_a]:text-muted-foreground text-sm whitespace-pre-line [&_a]:hover:underline",
              !showFullIntro && "line-clamp-3"
            )}
          >
            {parseText(briefIntro)}
          </p>
          {briefIntro.length > 150 && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => setShowFullIntro((prev) => !prev)}
            >
              {showFullIntro ? "Show less" : "Show more"}
            </Button>
          )}
        </section>
      )}

      <Separator />

      <section className="px-4 pt-4">
        <PipelineTimeline
          currentStage={pipelineStage}
          stageTimestamps={stageTimestamps}
        />
      </section>

      <Separator />

      <section className="px-4 py-4">
        <ProspectDetailsCard
          qualificationStatus={qualificationStatus}
          qualificationScore={qualificationScore}
          status={status}
          company={company}
          websiteUrl={websiteUrl}
          email={email}
          finance={finance?.displayValue}
          location={location}
          foundViaLabel={foundViaLabel}
          onFinanceClick={onFinanceClick}
        />
      </section>

      <Separator />

      {painPoints && painPoints.length > 0 && (
        <>
          <section className="px-4 py-4">
            <PainSolutionGrid
              painPoints={painPoints}
              onPainClick={onPainClick}
            />
          </section>
          <Separator />
        </>
      )}

      <section className="px-4 py-4">
        <SocialProfileLinks
          profiles={socialProfiles}
          onTwitterClick={onTwitterClick}
        />
      </section>
    </>
  );
}
