"use client";

import type { ReactNode } from "react";
import { PageHeader } from "@/features/webapp/ui/components/page/PageHeader";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { ProspectPlatformAvatar } from "@/shared/ui/components/ProspectPlatformAvatar";
import { NewReleasesIcon } from "@/shared/ui/components/icons";

/** Presentation shared by live conversations and offline demonstrations. */
export function DmConversationHeader({
  participant,
  platform,
  onBack,
  actions,
}: {
  participant?: { displayName: string; avatarUrl?: string; verified?: boolean };
  platform: "twitter" | "linkedin";
  onBack?: () => void;
  actions?: ReactNode;
}) {
  return (
    <PageHeader
      title={
        participant?.displayName ??
        (platform === "twitter" ? "X/Twitter DM" : "LinkedIn messages")
      }
      titleLeading={
        participant ? (
          <ProspectPlatformAvatar platform={platform} badgeSize="xs">
            <Avatar className="ring-border size-7 shrink-0 ring-1">
              <AvatarImage
                src={participant.avatarUrl}
                alt={participant.displayName}
              />
              <AvatarFallback>
                {participant.displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </ProspectPlatformAvatar>
        ) : null
      }
      titleSuffix={
        platform === "twitter" && participant?.verified ? (
          <NewReleasesIcon
            className="mr-0.5 size-3 shrink-0 fill-current"
            aria-hidden="true"
          />
        ) : null
      }
      onBack={onBack}
      actions={actions}
    />
  );
}
