"use client";

import * as React from "react";
import Marquee from "react-fast-marquee";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/shared/lib/utils";
import { WaitlistUserCard } from "./WaitlistUserCard";
import { WaitlistUser } from "../../types";

export interface WaitlistUsersMarqueeProps
  extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  users: WaitlistUser[];
}

export const WaitlistUsersMarquee = React.forwardRef<
  HTMLDivElement,
  WaitlistUsersMarqueeProps
>((props, ref) => {
  const { className, asChild, users, ...rest } = props;
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
      {users.map((user) => (
        <WaitlistUserCard
          key={user.screen_name}
          user={user}
          className="mr-12"
        />
      ))}
    </Comp>
  );
});

WaitlistUsersMarquee.displayName = "WaitlistUsersMarquee";
