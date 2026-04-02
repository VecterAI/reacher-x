"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { FilledTwitterIcon, LinkedinIcon } from "@/shared/ui/components/icons";

export type ProspectPlatform = "twitter" | "linkedin";

/** ~30–35% of common avatar sizes (Figma): 24 / 32 / 40 / 48 px parents. */
const BADGE: Record<
  "xs" | "sm" | "md" | "lg",
  { shell: string; icon: string }
> = {
  xs: { shell: "size-2", icon: "size-1.5" },
  sm: { shell: "size-[11px]", icon: "size-[7px]" },
  md: { shell: "size-[13px]", icon: "size-2.5" },
  lg: { shell: "size-4", icon: "size-3" },
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
              "bg-muted ring-border flex items-center justify-center rounded-full ring-1",
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
