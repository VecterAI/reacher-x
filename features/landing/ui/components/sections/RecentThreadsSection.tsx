import { Suspense } from "react";
import Link from "next/link";
import { RecentThreads } from "@/features/threads/ui/components/RecentThreads";
import type { Thread } from "@/features/threads/types";
import { buttonVariants } from "@/shared/ui/components/Button";
import { cn } from "@/shared/lib/utils";
import { ArrowForwardIcon } from "@/shared/ui/components/icons";
import { RecentThreadsSectionSkeleton } from "./RecentThreadsSectionSkeleton";

export function RecentThreadsSection({
  threadsPromise,
}: {
  threadsPromise: Promise<Thread[]>;
}) {
  return (
    <section
      aria-labelledby="recent-threads-heading"
      className="px-4 py-16 md:py-24"
    >
      <h2
        id="recent-threads-heading"
        className="mb-12 text-center text-3xl font-medium md:mb-16 md:text-4xl"
      >
        Recent threads.
      </h2>

      <Suspense fallback={<RecentThreadsSectionSkeleton />}>
        <RecentThreadsSectionContent threadsPromise={threadsPromise} />
      </Suspense>

      <div className="mt-8 text-center">
        <Link
          href="/home/threads"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "rounded-full"
          )}
        >
          View all threads
          <ArrowForwardIcon className="size-4 fill-current" />
        </Link>
      </div>
    </section>
  );
}

async function RecentThreadsSectionContent({
  threadsPromise,
}: {
  threadsPromise: Promise<Thread[]>;
}) {
  const recentThreads = await threadsPromise;

  if (recentThreads.length === 0) {
    return (
      <p className="text-muted-foreground text-center">
        Fresh public threads will appear here as soon as they&apos;re available.
      </p>
    );
  }

  return <RecentThreads threads={recentThreads} size="md" bordered={false} />;
}
