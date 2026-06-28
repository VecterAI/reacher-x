"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ProspectProfileHeader } from "@/features/prospects/ui/components/ProspectProfileHeader";
import type { ProspectProfileData } from "@/features/prospects/ui/components/ProspectProfilePanel";
import type { PipelineStage } from "@/features/prospects/ui/components/PipelineTimeline";
import { getProspectDisplayTimestamp } from "@/features/prospects/lib/getProspectDisplayTimestamp";
import { Button } from "@/shared/ui/components/Button";
import { InlineFeatureStrip } from "@/shared/ui/components/InlineFeatureStrip";
import { Separator } from "@/shared/ui/components/Separator";
import { useActiveUseCaseLabels } from "@/shared/hooks";
import { cn, parseText } from "@/shared/lib/utils";
import {
  normalizeTwitterUrlEntities,
  selectProfileWebsiteHref,
} from "@/shared/lib/twitter/profileLinks";
import { ChangeHistoryIcon, OpenInNewIcon } from "@/shared/ui/components/icons";

export interface InlineProspectProfileCardProps {
  prospectId?: string | null;
  profileData: Record<string, unknown>;
  label?: string | null;
  interactive?: boolean | null;
  onOpenPanel?: () => void;
  onOpenDmPanel?: () => void;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function asPipelineStage(value: unknown): PipelineStage | undefined {
  return value === "new" ||
    value === "contacted" ||
    value === "in_progress" ||
    value === "converted" ||
    value === "archived"
    ? value
    : undefined;
}

function asStageTimestamps(
  value: unknown
): Partial<Record<PipelineStage, number>> | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const stageTimestamps: Partial<Record<PipelineStage, number>> = {};
  for (const stage of [
    "new",
    "contacted",
    "in_progress",
    "converted",
    "archived",
  ] as const) {
    const timestamp = asNumber(record[stage]);
    if (timestamp !== undefined) {
      stageTimestamps[stage] = timestamp;
    }
  }

  return Object.keys(stageTimestamps).length > 0 ? stageTimestamps : undefined;
}

function toProspectProfileData(
  profileData: Record<string, unknown>,
  prospectId?: string | null
): ProspectProfileData {
  const socialProfiles = asRecord(profileData.socialProfiles);
  const twitterProfile = asRecord(socialProfiles?.twitter);
  const linkedInProfile = asRecord(socialProfiles?.linkedin);
  const platform =
    asString(profileData.platform) === "linkedin" ? "linkedin" : "twitter";
  const twitterUsername = asString(twitterProfile?.username);
  const twitterUrl = asString(twitterProfile?.profileUrl);
  const linkedInUsername = asString(linkedInProfile?.username);
  const linkedInUrl = asString(linkedInProfile?.profileUrl);

  return {
    id: prospectId ?? asString(profileData.id) ?? "unknown",
    displayName: asString(profileData.displayName) ?? "Unknown",
    verified: asBoolean(profileData.verified) ?? false,
    title: asString(profileData.title),
    avatarUrl: asString(profileData.avatarUrl),
    profileUrl: asString(profileData.profileUrl),
    platform,
    prospectType:
      asString(profileData.prospectType) === "organization"
        ? "organization"
        : asString(profileData.prospectType) === "individual"
          ? "individual"
          : "unknown",
    briefIntro: asString(profileData.briefIntro),
    pipelineStage: asPipelineStage(profileData.pipelineStage),
    stageTimestamps: asStageTimestamps(profileData.stageTimestamps),
    status: asPipelineStage(profileData.status),
    qualifiedAt: asNumber(profileData.qualifiedAt),
    readyAt: asNumber(profileData.readyAt),
    createdAt: asNumber(profileData.createdAt),
    company: asString(profileData.company),
    websiteUrl: asString(profileData.websiteUrl),
    websiteHref: selectProfileWebsiteHref(
      asString(profileData.websiteHref),
      asString(profileData.websiteUrl)
    ),
    websiteDisplayText: asString(profileData.websiteDisplayText),
    bioUrlEntities: normalizeTwitterUrlEntities(profileData.bioUrlEntities),
    location: asString(profileData.location),
    updatedAt: asNumber(profileData.updatedAt),
    socialProfiles: {
      twitter:
        twitterUsername && twitterUrl
          ? {
              username: twitterUsername,
              url: twitterUrl,
            }
          : undefined,
      linkedin:
        linkedInUsername && linkedInUrl
          ? {
              username: linkedInUsername,
              url: linkedInUrl,
            }
          : undefined,
    },
  };
}

export function InlineProspectProfileCard({
  prospectId,
  profileData,
  label,
  interactive,
  onOpenPanel,
  onOpenDmPanel,
}: InlineProspectProfileCardProps) {
  const router = useRouter();
  const { routes } = useActiveUseCaseLabels();
  const prospect = React.useMemo(
    () => toProspectProfileData(profileData, prospectId),
    [profileData, prospectId]
  );
  const hasBriefIntro = Boolean(prospect.briefIntro);
  const handleOpenProfilePanel = React.useCallback(() => {
    onOpenPanel?.();
  }, [onOpenPanel]);
  const handleOpenFullProfile = React.useCallback(() => {
    if (!prospectId) {
      return;
    }
    router.push(routes.detailHref(prospectId));
  }, [prospectId, router, routes]);

  return (
    <div className="space-y-3">
      <article className="border-border bg-background overflow-hidden rounded-xl border">
        <ProspectProfileHeader
          prospectId={prospectId ?? undefined}
          name={prospect.displayName}
          verified={prospect.verified}
          title={prospect.title}
          avatarUrl={prospect.avatarUrl}
          profileUrl={prospect.profileUrl}
          platform={prospect.platform}
          prospectType={prospect.prospectType}
          timestamp={getProspectDisplayTimestamp(prospect)}
          mode="default"
          surface="inline_card"
          onViewPlatformProfile={() => {
            if (prospect.profileUrl) {
              window.open(prospect.profileUrl, "_blank", "noopener,noreferrer");
            }
          }}
          onOpenDmPanel={onOpenDmPanel}
        />

        {hasBriefIntro ? (
          <div className="my-0">
            <Separator orientation="horizontal" />
          </div>
        ) : null}

        {hasBriefIntro ? (
          <section className="space-y-2 px-4 py-4">
            <h3 className="text-sm font-medium">Brief intro</h3>
            <div
              className={cn(
                "text-foreground [&_a]:text-muted-foreground text-sm whitespace-pre-line [&_a]:hover:underline"
              )}
            >
              {parseText(prospect.briefIntro ?? "", {
                urls: prospect.bioUrlEntities,
              })}
            </div>
          </section>
        ) : null}
      </article>

      <InlineFeatureStrip
        leading={
          <>
            <div className="border-border rounded-md border p-1">
              <ChangeHistoryIcon className="text-foreground size-4 fill-current" />
            </div>
            <span className="truncate text-sm font-medium">
              {(label === "Prospect profile"
                ? "Profile"
                : (label ?? "Profile")
              ).trim()}{" "}
              →
            </span>
          </>
        }
        trailing={
          <>
            <Button
              size="xs"
              disabled={interactive === false || !onOpenPanel}
              onClick={handleOpenProfilePanel}
            >
              View
            </Button>
            <Button
              size="xsIcon"
              variant="outline"
              disabled={!prospectId}
              onClick={handleOpenFullProfile}
            >
              <OpenInNewIcon className="fill-current" />
            </Button>
          </>
        }
      />
    </div>
  );
}
