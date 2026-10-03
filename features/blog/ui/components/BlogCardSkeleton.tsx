import { Skeleton } from "@/shared/ui/components/Skeleton";

/**
 * Loading placeholder matching the featured BlogCard layout: metadata row,
 * two-line title, description paragraph, and the author footer, with the
 * same paddings so the real card swaps in without a layout jump.
 */
export function BlogCardSkeleton() {
  return (
    <article aria-label="Loading ReacherX guide" className="h-full min-w-0">
      <div className="blog-card bg-background relative flex h-full flex-col p-6 dark:bg-neutral-950">
        <div className="text-muted-foreground flex items-center gap-x-2 text-sm">
          <Skeleton className="h-4 w-20" />
          <span aria-hidden="true">·</span>
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="mt-5 space-y-2">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-7 w-2/5" />
        </div>
        <div className="mt-auto space-y-2 pt-6">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-5/6" />
        </div>
        <footer className="pt-6">
          <div className="flex items-center gap-x-2 text-sm leading-5">
            <Skeleton className="size-4 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <span aria-hidden="true" className="text-muted-foreground">
              ·
            </span>
            <Skeleton className="h-4 w-28" />
          </div>
        </footer>
      </div>
    </article>
  );
}
