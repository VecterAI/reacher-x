"use client";

import * as React from "react";
import { WaitlistUserCardSkeleton } from "./WaitlistUserCardSkeleton";
import { cn } from "@/shared/lib/utils";

export interface WaitlistUsersMarqueeSkeletonProps {
  className?: string;
}

export const WaitlistUsersMarqueeSkeleton: React.FC<
  WaitlistUsersMarqueeSkeletonProps
> = ({ className }) => {
  return (
    <div className={cn("flex gap-12 overflow-hidden", className)}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
        <WaitlistUserCardSkeleton key={i} />
      ))}
    </div>
  );
};
