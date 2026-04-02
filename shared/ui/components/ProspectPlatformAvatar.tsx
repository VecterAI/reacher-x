"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { FilledTwitterIcon, LinkedinIcon } from "@/shared/ui/components/icons";

export type ProspectPlatform = "twitter" | "linkedin";

/**
 * Shell diameters stay fixed (~30–35% of parent avatar in Figma). xs/sm/md use a
 * larger icon asset clipped to the same disc (`overflow-hidden`) so the glyph
 * reads bigger without growing the badge circle.
 */
const BADGE: Record<
  "xs" | "sm" | "md" | "lg",
  { shell: string; icon: string; clipIcon: boolean }
> = {
  xs: { shell: "size-2", icon: "size-2.5", clipIcon: true },
  sm: { shell: "size-[11px]", icon: "size-2.5", clipIcon: true },
  md: { shell: "size-[13px]", icon: "size-2.5", clipIcon: true },
  lg: { shell: "size-4", icon: "size-3", clipIcon: false },
};

export interface ProspectPlatformAvatarProps {
  platform?: ProspectPlatform;
  badgeSize?: keyof typeof BADGE;
  className?: string;
  children: React.ReactNode;
}

/** Theme tokens only: `bg-muted` + `ring-border` on the disc, `ring-background` halo, `foreground` icons. */
export function ProspectPlatformAvatar({
  platform,
  badgeSize = "sm",
  className,
  children,
}: ProspectPlatformAvatarProps) {
  const b = BADGE[badgeSize];

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      {children}
      {platform ? (
        <span
          className={cn(
            "ring-background absolute -right-0.5 -bottom-0.5 rounded-full ring-[3px]"
          )}
          aria-hidden
        >
          <span
            className={cn(
              "bg-muted ring-muted flex items-center justify-center rounded-full ring-1",
              b.clipIcon && "overflow-hidden",
              b.shell
            )}
          >
            {platform === "twitter" ? (
              <FilledTwitterIcon
                className={cn("text-foreground shrink-0", b.icon)}
              />
            ) : (
              <LinkedinIcon
                className={cn(
                  "text-foreground [&_path]:fill-foreground shrink-0",
                  b.icon
                )}
              />
            )}
          </span>
        </span>
      ) : null}
    </div>
  );
}
