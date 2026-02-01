// features/analytics/ui/components/StatCardSkeleton.tsx
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { cn } from "@/shared/lib/utils";

export interface StatCardSkeletonProps {
  className?: string;
}

export function StatCardSkeleton({ className }: StatCardSkeletonProps) {
  return (
    <article
      className={cn(
        "bg-card text-card-foreground rounded-lg border p-4",
        className
      )}
    >
      {/* Header: Title + Icon */}
      <div className="flex items-start justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="size-4" />
      </div>

      {/* Value */}
      <div className="mt-2">
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Trend Indicator */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-16" />
      </div>
    </article>
  );
}
