/**
 * ProspectCardSkeleton
 * Loading skeleton for ProspectCard — composition pattern.
 */
import { Skeleton } from "@/shared/ui/components/Skeleton";

export function ProspectCardSkeleton() {
  return (
    <article className="space-y-2 rounded-xl border px-4 py-3">
      <header className="flex items-start gap-3">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="size-6 shrink-0 rounded" />
      </header>
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <footer className="flex gap-2 pt-1">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-28 rounded-full" />
      </footer>
    </article>
  );
}
