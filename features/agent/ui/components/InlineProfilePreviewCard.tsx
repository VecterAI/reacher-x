"use client";

import * as React from "react";
import { format } from "date-fns";
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
import { TwitterProfileActionButtons } from "@/features/profile/ui/components/TwitterProfileActionButtons";

export interface InlineProfilePreviewCardProps {
  variant: "prospect" | "twitter" | "linkedin";
  platform?: "twitter" | "linkedin" | null;
  profileData: Record<string, unknown>;
  label?: string | null;
  context?: string | null;
  interactive?: boolean | null;
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
  platform,
  profileData,
  label,
  context,
  interactive,
  onOpenPanel,
}: InlineProfilePreviewCardProps) {
  const resolvedPlatform =
    platform ??
    ((asString(profileData.kind) === "linkedin" ? "linkedin" : "twitter") as
      | "twitter"
      | "linkedin");
  const displayName =
    asString(profileData.displayName) ??
    asString(profileData.name) ??
    "Unknown";
  const title =
    asString(profileData.title) ??
    asString(profileData.headline) ??
    asString(profileData.bio);
  const avatarUrl =
    asString(profileData.avatarUrl) ??
    asString(profileData.profilePictureUrl) ??
    asString(profileData.profile_image_url_https);
  const bannerUrl =
    asString(profileData.bannerUrl) ?? asString(profileData.backgroundImageUrl);
  const username =
    asString(profileData.username) ??
    asString(profileData.twitterUsername) ??
    asString(profileData.linkedinUsername);
  const verified = profileData.verified === true;
  const location = asString(profileData.location);
  const websiteUrl = asString(profileData.websiteUrl);
  const followers =
    asNumber(profileData.followersCount) ?? asNumber(profileData.followerCount);
  const following = asNumber(profileData.followingCount);
  const connections = asNumber(profileData.connectionCount);
  const joinedAt = asString(profileData.joinedAt);
  const relationshipBadge = asString(profileData.relationshipBadge);
  const relationshipPrimaryAction = asString(profileData.relationshipPrimaryAction);
  const relationshipPrimaryLabel = asString(profileData.relationshipPrimaryLabel);
  const summary =
    asString(profileData.briefIntro) ??
    asString(profileData.summary) ??
    asString(profileData.bio);
  const relationshipText = asString(profileData.relationshipMessage);
  const avatarShape =
    asString(profileData.prospectType) === "organization"
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
  const handleOpenProfilePanel = React.useCallback(() => {
    onOpenPanel?.();
  }, [onOpenPanel]);

  return (
    <div className="space-y-3">
      <div className="border-border bg-background overflow-hidden rounded-xl border">
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

                {isTwitterVariant ? (
                  <TwitterProfileActionButtons
                    profileUserId={asString(profileData.userId)}
                    username={username}
                    profileUrl={asString(profileData.profileUrl)}
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
                ) : (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="xs"
                      disabled={!interactive}
                      onClick={handleOpenProfilePanel}
                    >
                      View
                    </Button>
                  </div>
                )}
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

            {websiteUrl ? (
              <div className="flex items-center gap-2 text-sm">
                <LinkIcon className="text-muted-foreground size-4 fill-current" />
                <span className="truncate font-medium">{websiteUrl}</span>
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
          <>
            <Button
              size="xsIcon"
              variant="outline"
              disabled={!interactive}
              onClick={handleOpenProfilePanel}
            >
              <OpenInNewIcon className="fill-current" />
            </Button>
          </>
        }
      />
    </div>
  );
}
