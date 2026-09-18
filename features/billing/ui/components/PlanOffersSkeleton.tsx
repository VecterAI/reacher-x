import { Skeleton } from "@/shared/ui/components/Skeleton";

export function PlanOffersSkeleton() {
  return (
    <div role="status" aria-label="Loading plans" className="space-y-4">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-72 w-full" />
      <span className="sr-only">Loading plans…</span>
    </div>
  );
}
