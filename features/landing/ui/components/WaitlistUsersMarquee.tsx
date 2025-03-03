"use client";

import * as React from "react";
import Marquee from "react-fast-marquee";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/shared/lib/utils/utils";
import { WaitlistUserCard } from "./WaitlistUserCard";
import { WaitlistUser } from "@/features/landing/hooks/useWaitlistUsers";

export interface WaitlistUsersMarqueeProps
  extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  profiles: WaitlistUser[];
}

export const WaitlistUsersMarquee = React.forwardRef<
  HTMLDivElement,
  WaitlistUsersMarqueeProps
>((props, ref) => {
  const { className, asChild, profiles, ...rest } = props;
  const Comp = asChild ? Slot : Marquee;

  return (
    <Comp
      gradient={false}
      speed={100}
      pauseOnHover={true}
      className={cn(className)}
      ref={ref}
      {...rest}
    >
      {profiles.map((profile) => (
        <WaitlistUserCard
          key={profile.username}
          avatarUrl={profile.avatarUrl}
          displayName={profile.displayName}
          username={profile.username}
          pro={profile.verified} // Maps verified to pro for WaitlistUserCard
          className="mr-12"
        />
      ))}
    </Comp>
  );
});

WaitlistUsersMarquee.displayName = "WaitlistUsersMarquee";
