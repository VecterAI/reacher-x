"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import {
  FilledLinkedinIcon,
  FilledTwitterIcon,
} from "@/shared/ui/components/icons";

export type ProspectPlatform = "twitter" | "linkedin";

/**
 * Shell diameters stay fixed (~30–35% of parent avatar in Figma). xs/sm/md use a
 * larger icon asset clipped to the same tile (`overflow-hidden`) so the glyph
 * reads bigger without growing the badge tile.
 */
const BADGE: Record<
  "xs" | "sm" | "md" | "lg",
  { shell: string; icon: string; radius: string; clipIcon: boolean }
> = {
  xs: {
    shell: "size-2",
    icon: "size-2.5",
    radius: "rounded-[2px]",
    clipIcon: true,
  },
  sm: {
    shell: "size-[11px]",
    icon: "size-2.5",
    radius: "rounded-[3px]",
    clipIcon: true,
  },
  md: {
    shell: "size-[13px]",
    icon: "size-2.5",
    radius: "rounded-[3px]",
    clipIcon: true,
  },
  lg: {
    shell: "size-4",
    icon: "size-3",
    radius: "rounded-[4px]",
    clipIcon: false,
  },
};

const PLATFORM_BADGE: Record<
  ProspectPlatform,
  { className: string; label: string }
> = {
  twitter: {
    className:
      "bg-platform-twitter-badge text-platform-twitter-badge-foreground",
    label: "Found on X/Twitter",
  },
  linkedin: {
    className:
      "bg-platform-linkedin-badge text-platform-linkedin-badge-foreground",
    label: "Found on LinkedIn",
  },
};

export interface ProspectPlatformAvatarProps {
  platform?: ProspectPlatform;
  badgeIcon?: React.ReactNode;
  badgeSize?: keyof typeof BADGE;
  className?: string;
  children: React.ReactNode;
}

/** Platform-branded tile separated from the avatar by a surface-colored halo. */
export function ProspectPlatformAvatar({
  platform,
  badgeIcon,
  badgeSize = "sm",
  className,
  children,
}: ProspectPlatformAvatarProps) {
  const b = BADGE[badgeSize];
  const platformBadge = platform ? PLATFORM_BADGE[platform] : null;

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      {children}
      {platform && platformBadge ? (
        <span
          className={cn(
            "ring-background absolute -right-0.5 -bottom-0.5 ring-[3px]",
            b.radius
          )}
          role="img"
          aria-label={platformBadge.label}
          title={platformBadge.label}
        >
          <span
            className={cn(
              "flex items-center justify-center",
              platformBadge.className,
              b.clipIcon && "overflow-hidden",
              b.shell,
              b.radius
            )}
          >
            {badgeIcon ??
              (platform === "twitter" ? (
                <FilledTwitterIcon className={cn("shrink-0", b.icon)} />
              ) : (
                <FilledLinkedinIcon className={cn("shrink-0", b.icon)} />
              ))}
          </span>
        </span>
      ) : null}
    </div>
  );
}
