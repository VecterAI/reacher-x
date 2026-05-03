"use client";

import * as React from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { Button } from "@/shared/ui/components/Button";
import { InlineFeatureStrip } from "@/shared/ui/components/InlineFeatureStrip";
import { ProspectPlatformAvatar } from "@/shared/ui/components/ProspectPlatformAvatar";
import {
  LinkIcon,
  LocationOnIcon,
  MoreHorizIcon,
  NewReleasesIcon,
  OpenInNewIcon,
} from "@/shared/ui/components/icons";
import { cn } from "@/shared/lib/utils";

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
  const profileUrl = asString(profileData.profileUrl);
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
          <div className="-mt-7 flex items-end justify-between gap-3">
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

            <div className="flex items-center gap-2 pb-1">
              {profileUrl ? (
                <Button
                  size="xsIcon"
                  variant="outline"
                  onClick={() =>
                    window.open(profileUrl, "_blank", "noopener,noreferrer")
                  }
                >
                  <OpenInNewIcon className="fill-current" />
                </Button>
              ) : null}
              <Button
                size="xsIcon"
                variant="outline"
                disabled={!interactive}
                onClick={() => onOpenPanel?.()}
              >
                <MoreHorizIcon className="fill-current" />
              </Button>
            </div>
          </div>

          <div className="space-y-3 pt-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium">{displayName}</span>
                {verified ? (
                  <NewReleasesIcon className="size-3.5 fill-current" />
                ) : null}
              </div>
              {username ? (
                <div className="text-muted-foreground text-sm">
                  {resolvedPlatform === "twitter" ? `@${username}` : username}
                </div>
              ) : null}
              {title ? <p className="text-sm">{title}</p> : null}
              {summary && summary !== title ? (
                <p className="text-sm">{summary}</p>
              ) : null}
            </div>

            {(followers !== undefined ||
              following !== undefined ||
              connections !== undefined) && (
              <div className="text-sm">
                {followers !== undefined ? (
                  <span className="font-medium">{followers}</span>
                ) : null}
                {followers !== undefined ? (
                  <span className="text-muted-foreground"> Followers</span>
                ) : null}
                {following !== undefined ? (
                  <span className="text-muted-foreground"> · </span>
                ) : null}
                {following !== undefined ? (
                  <>
                    <span className="font-medium">{following}</span>
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

            {relationshipText ? (
              <p className="text-sm">{relationshipText}</p>
            ) : null}

            {(location || joinedAt) && (
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                {location ? (
                  <>
                    <LocationOnIcon className="size-4 fill-current" />
                    <span>{location}</span>
                  </>
                ) : null}
                {location && joinedAt ? <span>·</span> : null}
                {joinedAt ? <span>{joinedAt}</span> : null}
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
          <span className="truncate text-sm font-medium">
            {(label ?? "Profile").trim()} →
          </span>
        }
        trailing={
          <>
            <Button
              size="xs"
              variant="outline"
              disabled={!interactive}
              onClick={() => onOpenPanel?.()}
            >
              View
            </Button>
            <Button
              size="xsIcon"
              variant="outline"
              disabled={!interactive}
              onClick={() => onOpenPanel?.()}
            >
              <OpenInNewIcon className="fill-current" />
            </Button>
          </>
        }
      />
    </div>
  );
}
