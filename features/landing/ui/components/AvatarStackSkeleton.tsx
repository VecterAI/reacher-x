"use client";

import * as React from "react";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { cn } from "@/shared/lib/utils";

export interface AvatarStackSkeletonProps {
  className?: string;
}

export const AvatarStackSkeleton: React.FC<AvatarStackSkeletonProps> = ({
  className,
}) => {
  return (
    <div className={cn("flex items-center", className)}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="relative -ml-3 first:ml-0">
          <Skeleton className="ring-main h-10 w-10 animate-none rounded-full ring-4" />
        </div>
      ))}
    </div>
  );
};
