"use client";
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Thread } from "@/features/threads/types";
import { RecentThreads } from "@/features/threads/ui/components/RecentThreads";
import { Skeleton } from "@/shared/ui/components/Skeleton";

export function LiveRecentThreads({
  excludeThreadId,
  count = 4,
  bordered = true,
  size = "md",
  className,
}: {
  excludeThreadId?: string;
  count?: number;
  bordered?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const threads = useQuery(api.socialdataMutations.getRecentThreads, {
    count,
    excludeThreadId,
  }) as Thread[] | undefined;

  const safeThreads = useMemo(() => threads ?? [], [threads]);

  if (!threads) {
    return (
      <div className={className}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="px-4 py-4 md:px-0 md:py-6">
            <div className="flex gap-4">
              <Skeleton className="h-9 w-9 rounded-full md:h-10 md:w-10" />
              <div className="grid w-full gap-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-40 md:h-5 md:w-56" />
                  <Skeleton className="h-4 w-16 md:h-4 md:w-20" />
                </div>
                <Skeleton className="h-5 w-[85%] md:h-6" />
                <Skeleton className="h-5 w-[65%] md:h-6" />
                <div className="mt-2 flex gap-4">
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-4 w-12" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <RecentThreads
      threads={safeThreads}
      bordered={bordered}
      size={size}
      className={className}
    />
  );
}
