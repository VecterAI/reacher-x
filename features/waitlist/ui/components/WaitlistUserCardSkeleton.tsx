"use client";

import * as React from "react";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { cn } from "@/shared/lib/utils";

export interface WaitlistUserCardSkeletonProps {
  className?: string;
}

export const WaitlistUserCardSkeleton: React.FC<
  WaitlistUserCardSkeletonProps
> = ({ className }) => {
  return (
    <div className={cn("flex items-center gap-4 p-4", className)}>
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
};
