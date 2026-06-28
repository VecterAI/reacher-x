"use client";

import * as React from "react";
import { useAction } from "convex/react";
import { format } from "date-fns";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { Button } from "@/shared/ui/components/Button";
import { InlineFeatureStrip } from "@/shared/ui/components/InlineFeatureStrip";
import { ProspectPlatformAvatar } from "@/shared/ui/components/ProspectPlatformAvatar";
import {
  ChangeHistoryIcon,
  EventIcon,
  GroupIcon,
  LinkIcon,
  LocationOnIcon,
  NewReleasesIcon,
  OpenInNewIcon,
} from "@/shared/ui/components/icons";
import { cn, formatLargeNumber } from "@/shared/lib/utils";
import {
  formatUrlDisplayText,
  selectProfileWebsiteHref,
} from "@/shared/lib/twitter/profileLinks";
import { TwitterProfileActionButtons } from "@/features/profile/ui/components/TwitterProfileActionButtons";
import { LinkedInProfileSummaryHeader } from "@/features/prospects/ui/components/LinkedInProfileSummaryHeader";
import type { LinkedInProfileSummaryData } from "@/features/prospects/ui/components/LinkedInProfileSummaryHeader";

export interface InlineProfilePreviewCardProps {
  variant: "prospect" | "twitter" | "linkedin";
  prospectId?: string | null;
  platform?: "twitter" | "linkedin" | null;
  profileData: Record<string, unknown>;
  label?: string | null;
  context?: string | null;
  interactive?: boolean | null;
  openOnCardClick?: boolean | null;
  showActions?: boolean | null;
  showFeatureStrip?: boolean | null;
  onOpenPanel?: () => void;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null && !Array.isArray(item)
      )
    : [];
}

function formatJoinedAt(joinedAt: string | undefined): string | undefined {
  if (!joinedAt) {
    return undefined;
  }

  const date = new Date(joinedAt);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return `Joined on ${format(date, "MMMM yyyy")}.`;
}

export function InlineProfilePreviewCard({
  variant,
  prospectId,
  platform,
  profileData,
  label,
  context,
  interactive,
  openOnCardClick,
  showActions,
  showFeatureStrip,
  onOpenPanel,
}: InlineProfilePreviewCardProps) {
  const getLinkedInProfile = useAction(
    (api as any).linkedin.getLinkedInProfile
  );
  const getLinkedInProfileSupplemental = useAction(
    (api as any).linkedin.getLinkedInProfileSupplemental
  );
  const [hydratedLinkedInProfileState, setHydratedLinkedInProfileState] =
    React.useState<{
      prospectId: string;
      data: Record<string, unknown>;
    } | null>(null);
  const resolvedPlatform =
    platform ??
    ((asString(profileData.kind) === "linkedin" ? "linkedin" : "twitter") as
      | "twitter"
      | "linkedin");
  const hydratedLinkedInProfile =
    resolvedPlatform === "linkedin" &&
    prospectId &&
    hydratedLinkedInProfileState?.prospectId === prospectId
      ? hydratedLinkedInProfileState.data
      : null;
  const effectiveProfileData =
    resolvedPlatform === "linkedin" && hydratedLinkedInProfile
      ? { ...profileData, ...hydratedLinkedInProfile }
      : profileData;
  React.useEffect(() => {
    if (resolvedPlatform !== "linkedin" || !prospectId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const baseProfile = (await getLinkedInProfile({
          prospectId: prospectId as Id<"prospects">,
        })) as Record<string, unknown> | null;

        if (cancelled || !baseProfile) {
          return;
        }

        const basePositions = asRecordArray(baseProfile.positions);
        const baseCurrentPosition =
          basePositions.find((position) => position.isCurrent === true) ??
          basePositions[0];
        const baseCurrentCompany = asRecord(baseProfile.currentCompany);
        const supplemental = (await getLinkedInProfileSupplemental({
          prospectId: prospectId as Id<"prospects">,
          profileUrn: asString(baseProfile.urn),
          username: asString(baseProfile.username),
          providerId: asString(baseProfile.urn),
          currentCompanyId: asString(baseCurrentPosition?.companyId),
          currentCompanyName:
            asString(baseCurrentCompany?.name) ??
            asString(baseCurrentPosition?.companyName),
        }).catch(() => null)) as Record<string, unknown> | null;

        if (cancelled) {
          return;
        }

        setHydratedLinkedInProfileState({
          prospectId,
          data: supplemental
            ? {
                ...baseProfile,
                ...supplemental,
                positions: baseProfile.positions,
                currentCompany:
                  supplemental.currentCompany ?? baseProfile.currentCompany,
                contact: supplemental.contact ?? baseProfile.contact,
              }
            : baseProfile,
        });
      } catch {
        if (!cancelled) {
          setHydratedLinkedInProfileState((current) =>
            current?.prospectId === prospectId ? null : current
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    getLinkedInProfile,
    getLinkedInProfileSupplemental,
    prospectId,
    resolvedPlatform,
  ]);
  const displayName =
    asString(effectiveProfileData.displayName) ??
    asString(effectiveProfileData.name) ??
    "Unknown";
  const title =
    asString(effectiveProfileData.title) ??
    asString(effectiveProfileData.headline) ??
    asString(effectiveProfileData.bio);
  const avatarUrl =
    asString(effectiveProfileData.avatarUrl) ??
    asString(effectiveProfileData.profilePictureUrl) ??
    asString(effectiveProfileData.profilePictureURL) ??
    asString(effectiveProfileData.profile_image_url_https);
  const bannerUrl =
    asString(effectiveProfileData.bannerUrl) ??
    asString(effectiveProfileData.backgroundImageUrl) ??
    asString(effectiveProfileData.backgroundImageURL);
  const username =
    asString(effectiveProfileData.username) ??
    asString(effectiveProfileData.twitterUsername) ??
    asString(effectiveProfileData.linkedinUsername);
  const verified =
    effectiveProfileData.verified === true ||
    effectiveProfileData.isPremium === true;
  const location = asString(effectiveProfileData.location);
  const websiteUrl = asString(effectiveProfileData.websiteUrl);
  const websiteHref = selectProfileWebsiteHref(
    asString(effectiveProfileData.websiteHref),
    websiteUrl
  );
  const websiteDisplayText =
    asString(effectiveProfileData.websiteDisplayText) ??
    (websiteHref ? formatUrlDisplayText(websiteHref) : undefined);
  const followers =
    asNumber(effectiveProfileData.followersCount) ??
    asNumber(effectiveProfileData.followerCount);
  const following = asNumber(effectiveProfileData.followingCount);
  const connections = asNumber(effectiveProfileData.connectionCount);
  const joinedAt = asString(effectiveProfileData.joinedAt);
  const relationshipBadge = asString(effectiveProfileData.relationshipBadge);
  const relationshipPrimaryAction = asString(
    effectiveProfileData.relationshipPrimaryAction
  );
  const relationshipPrimaryLabel = asString(
    effectiveProfileData.relationshipPrimaryLabel
  );
  const summary =
    asString(effectiveProfileData.briefIntro) ??
    asString(effectiveProfileData.summary) ??
    asString(effectiveProfileData.bio);
  const profileUrl = asString(effectiveProfileData.profileUrl);
  const relationshipText = asString(effectiveProfileData.relationshipMessage);
  const avatarShape =
    asString(effectiveProfileData.prospectType) === "organization"
      ? "rounded-md"
      : "rounded-full";
  const showBanner = variant !== "prospect";
  const formattedJoinedAt = formatJoinedAt(joinedAt);
  const formattedFollowers =
    followers !== undefined ? formatLargeNumber(followers) : undefined;
  const formattedFollowing =
    following !== undefined ? formatLargeNumber(following) : undefined;
  const isTwitterVariant = resolvedPlatform === "twitter";
  const showMutualRelationship =
    isTwitterVariant &&
    relationshipBadge === "mutual" &&
    relationshipText !== undefined;
  const inferredPrimaryAction =
    relationshipBadge === "you_following" || relationshipBadge === "mutual"
      ? "unfollow"
      : "follow";
  const inferredPrimaryLabel =
    inferredPrimaryAction === "unfollow" ? "Unfollow" : "Follow";
  const canOpenPanel = interactive !== false && Boolean(onOpenPanel);
  const shouldShowActions = showActions !== false;
  const shouldShowFeatureStrip = showFeatureStrip !== false;
  const shouldOpenOnCardClick =
    openOnCardClick === true && canOpenPanel && !shouldShowActions;
  const handleOpenProfilePanel = React.useCallback(() => {
    onOpenPanel?.();
  }, [onOpenPanel]);
  const handleCardKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!shouldOpenOnCardClick) {
        return;
      }
      if (event.currentTarget !== event.target) {
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      handleOpenProfilePanel();
    },
    [handleOpenProfilePanel, shouldOpenOnCardClick]
  );
  const cardInteractionProps: React.HTMLAttributes<HTMLDivElement> =
    shouldOpenOnCardClick
      ? {
          role: "button",
          tabIndex: 0,
          "aria-label": `Open ${displayName}'s profile`,
          onClick: handleOpenProfilePanel,
          onKeyDown: handleCardKeyDown,
        }
      : {};
  const currentCompany = asRecord(effectiveProfileData.currentCompany);
  const contact = asRecord(effectiveProfileData.contact);
  const contactWebsite = asRecordArray(contact?.websites)
    .map((website) => asString(website.url))
    .find(Boolean);
  const positions = asRecordArray(effectiveProfileData.positions);
  const currentPosition =
    positions.find((position) => position.isCurrent === true) ?? positions[0];
  const currentCompanyName =
    asString(effectiveProfileData.currentCompanyName) ??
    asString(currentCompany?.name) ??
    asString(currentPosition?.companyName);
  const currentCompanyLogo =
    asString(effectiveProfileData.currentCompanyLogo) ??
    asString(currentCompany?.logoUrl) ??
    asString(currentPosition?.companyLogo);
  const currentCompanyWebsite =
    asString(effectiveProfileData.currentCompanyWebsite) ??
    asString(currentCompany?.website) ??
    contactWebsite ??
    websiteUrl;
  const normalizedLinkedInPositions: NonNullable<
    LinkedInProfileSummaryData["positions"]
  > = [];
  for (const position of positions) {
    const companyName = asString(position.companyName);
    if (companyName) {
      const companyLogo = asString(position.companyLogo);
      normalizedLinkedInPositions.push({
        companyName,
        ...(companyLogo ? { companyLogo } : {}),
        isCurrent: position.isCurrent === true,
      });
    }
  }

  if (!isTwitterVariant) {
    return (
      <div className="space-y-3">
        <div
          className={cn(
            "border-border bg-background overflow-hidden rounded-xl border",
            shouldOpenOnCardClick &&
              "hover:bg-accent/30 focus-visible:ring-ring cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
          )}
          {...cardInteractionProps}
        >
          <LinkedInProfileSummaryHeader
            profile={{
              displayName,
              firstName: asString(effectiveProfileData.firstName),
              headline: title,
              profilePictureUrl: avatarUrl,
              backgroundImageUrl: bannerUrl,
              profileUrl,
              isPremium: verified,
              location,
              followerCount: followers,
              connectionCount: connections,
              contact: currentCompanyWebsite
                ? { websites: [{ url: currentCompanyWebsite }] }
                : undefined,
              positions:
                normalizedLinkedInPositions.length > 0
                  ? normalizedLinkedInPositions
                  : currentCompanyName
                    ? [
                        {
                          companyName: currentCompanyName,
                          ...(currentCompanyLogo
                            ? { companyLogo: currentCompanyLogo }
                            : {}),
                          isCurrent: true,
                        },
                      ]
                    : undefined,
              currentCompany: currentCompanyName
                ? {
                    name: currentCompanyName,
                    logoUrl: currentCompanyLogo,
                    website: currentCompanyWebsite,
                  }
                : undefined,
            }}
            actions={
              shouldShowActions ? (
                <Button
                  size="xs"
                  disabled={!canOpenPanel}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleOpenProfilePanel();
                  }}
                >
                  View
                </Button>
              ) : null
            }
            className={context ? undefined : "border-b-0"}
            linkName={!shouldOpenOnCardClick}
          />

          {context ? (
            <p className="text-muted-foreground px-4 py-3 text-xs">{context}</p>
          ) : null}
        </div>

        {shouldShowFeatureStrip ? (
          <InlineFeatureStrip
            leading={
              <>
                <div className="border-border rounded-md border p-1">
                  <ChangeHistoryIcon className="text-foreground size-4 fill-current" />
                </div>
                <span className="truncate text-sm font-medium">
                  {(label ?? "Profile").trim()} →
                </span>
              </>
            }
            trailing={
              <Button
                size="xsIcon"
                variant="outline"
                disabled={!canOpenPanel}
                onClick={handleOpenProfilePanel}
                aria-label={`Open ${(label ?? "profile").trim()}`}
              >
                <OpenInNewIcon className="fill-current" />
              </Button>
            }
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "border-border bg-background overflow-hidden rounded-xl border",
          shouldOpenOnCardClick &&
            "hover:bg-accent/30 focus-visible:ring-ring cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
        )}
        {...cardInteractionProps}
      >
        <div
          className={cn(
            "relative border-b",
            showBanner ? "h-44" : "bg-muted/40 h-18"
          )}
          style={
            showBanner && bannerUrl
              ? {
                  backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.18)), url(${bannerUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          {!showBanner ? (
            <div className="from-muted/80 via-background to-muted/60 absolute inset-0 bg-linear-to-r" />
          ) : null}
        </div>

        <div className="px-4 pb-4">
          <div className="-mt-7 space-y-3">
            <ProspectPlatformAvatar platform={resolvedPlatform} badgeSize="lg">
              <Avatar
                className={cn(
                  "ring-background size-12 ring-1 ring-offset-2",
                  avatarShape
                )}
              >
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={displayName} />
                ) : null}
                <AvatarFallback>{displayName.charAt(0) || "?"}</AvatarFallback>
              </Avatar>
            </ProspectPlatformAvatar>
          </div>

          <div className="space-y-3 pt-3">
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="truncate text-sm font-medium">
                      {displayName}
                    </span>
                    {verified ? (
                      <NewReleasesIcon className="size-3.5 shrink-0 fill-current" />
                    ) : null}
                    {!showMutualRelationship && relationshipText ? (
                      <span className="text-muted-foreground text-sm">
                        {relationshipText}
                      </span>
                    ) : null}
                  </div>
                  {username ? (
                    <div className="text-muted-foreground truncate text-sm font-medium">
                      {resolvedPlatform === "twitter"
                        ? `@${username}`
                        : username}
                    </div>
                  ) : null}
                </div>

                {isTwitterVariant && shouldShowActions ? (
                  <TwitterProfileActionButtons
                    profileUserId={asString(effectiveProfileData.userId)}
                    username={username}
                    profileUrl={asString(effectiveProfileData.profileUrl)}
                    primaryAction={
                      relationshipPrimaryAction === "unfollow"
                        ? "unfollow"
                        : relationshipPrimaryAction === "follow"
                          ? "follow"
                          : inferredPrimaryAction
                    }
                    primaryLabel={
                      relationshipPrimaryLabel === "Unfollow"
                        ? "Unfollow"
                        : relationshipPrimaryLabel === "Follow"
                          ? "Follow"
                          : inferredPrimaryLabel
                    }
                  />
                ) : isTwitterVariant ? null : shouldShowActions ? (
                  <div
                    className="flex shrink-0 items-center gap-1"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Button
                      size="xs"
                      disabled={!canOpenPanel}
                      onClick={handleOpenProfilePanel}
                    >
                      View
                    </Button>
                  </div>
                ) : null}
              </div>

              {title ? <p className="text-sm">{title}</p> : null}
              {summary && summary !== title ? (
                <p className="text-sm">{summary}</p>
              ) : null}
            </div>

            {(followers !== undefined ||
              following !== undefined ||
              connections !== undefined) && (
              <div className="text-sm">
                {formattedFollowers !== undefined ? (
                  <span className="font-medium">{formattedFollowers}</span>
                ) : null}
                {formattedFollowers !== undefined ? (
                  <span className="text-muted-foreground"> Followers</span>
                ) : null}
                {formattedFollowing !== undefined ? (
                  <span className="text-muted-foreground"> · </span>
                ) : null}
                {formattedFollowing !== undefined ? (
                  <>
                    <span className="font-medium">{formattedFollowing}</span>
                    <span className="text-muted-foreground"> Following</span>
                  </>
                ) : null}
                {connections !== undefined ? (
                  <>
                    <span className="text-muted-foreground"> · </span>
                    <span className="font-medium">{connections}</span>
                    <span className="text-muted-foreground"> Connections</span>
                  </>
                ) : null}
              </div>
            )}

            {websiteHref ? (
              <div className="flex items-center gap-2 text-sm">
                <LinkIcon className="text-muted-foreground size-4 fill-current" />
                <span className="truncate font-medium">
                  {websiteDisplayText}
                </span>
              </div>
            ) : null}

            {showMutualRelationship ? (
              <div className="flex items-center gap-2 text-sm font-medium">
                <GroupIcon className="text-muted-foreground size-4 fill-current" />
                <span>{relationshipText}</span>
              </div>
            ) : null}

            {(location || formattedJoinedAt) && (
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                {location ? (
                  <span className="flex items-center gap-1">
                    <LocationOnIcon className="size-4 fill-current" />
                    <span>{location}</span>
                  </span>
                ) : null}
                {formattedJoinedAt ? (
                  <time
                    dateTime={joinedAt ?? undefined}
                    className="flex items-center gap-1"
                  >
                    <EventIcon className="size-4 fill-current" />
                    <span>{formattedJoinedAt}</span>
                  </time>
                ) : null}
              </div>
            )}

            {context ? (
              <p className="text-muted-foreground text-xs">{context}</p>
            ) : null}
          </div>
        </div>
      </div>

      {shouldShowFeatureStrip ? (
        <InlineFeatureStrip
          leading={
            <>
              <div className="border-border rounded-md border p-1">
                <ChangeHistoryIcon className="text-foreground size-4 fill-current" />
              </div>
              <span className="truncate text-sm font-medium">
                {(label ?? "Profile").trim()} →
              </span>
            </>
          }
          trailing={
            <Button
              size="xsIcon"
              variant="outline"
              disabled={!canOpenPanel}
              onClick={handleOpenProfilePanel}
              aria-label={`Open ${(label ?? "profile").trim()}`}
            >
              <OpenInNewIcon className="fill-current" />
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
