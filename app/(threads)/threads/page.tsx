// app/(threads)/threads/page.tsx
import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
// Use next/link directly in server component to avoid client boundary wrapping
import { UserProfileCard } from "@/features/landing/ui/components/UserProfileCard";
import { Skeleton } from "@/shared/ui/components/Skeleton";

import { ThreadCard } from "@/features/threads/ui/components/ThreadCard";
import { getPublicThreads } from "@/features/threads/lib/getPublicThreads";
import type { Thread } from "@/features/threads/types";

export const metadata = {
  title: "Threads",
  description: "Browse recent threads to stay updated on ReacherX.",
  openGraph: {
    title: "🆁 | Threads",
    description: "Browse recent threads to stay updated on ReacherX.",
    images: ["/og-default.jpg"],
    url: "https://reacherx.com/threads",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "🆁 | Threads",
    description: "Browse recent threads to stay updated on ReacherX.",
    images: ["/og-default.jpg"],
  },
};

// Dynamic content component wrapped in Suspense
async function ThreadsContent({
  threadsPromise,
}: {
  threadsPromise: Promise<Thread[]>;
}) {
  // Signal dynamic rendering - required for Convex fetch with cacheComponents
  await connection();

  const staticThreads = await threadsPromise;

  // Sidebar author seeded from the first available thread (optional)
  const firstThread = staticThreads[0];
  const firstTweet = firstThread?.tweets?.[0];
  const user = firstTweet?.user;

  return (
    <aside className="space-y-6">
      <section className="px-4 pb-6 md:px-0 md:pb-0">
        <h3 className="text-2xl font-medium">Author.</h3>
        <UserProfileCard
          className="mt-4"
          profileImageUrlHttps={user?.profile_image_url_https}
          name={user?.name}
          screenName={user?.screen_name}
          verified={user?.verified}
          description={user?.description}
          followersCount={user?.followers_count}
          friendsCount={user?.friends_count}
          url={user?.url}
        />
      </section>
    </aside>
  );
}

async function ThreadsListSection({
  threadsPromise,
}: {
  threadsPromise: Promise<Thread[]>;
}) {
  const threads = await threadsPromise;

  if (threads.length === 0) {
    return (
      <p className="text-muted-foreground mt-4 px-4 md:px-0">
        No threads available.
      </p>
    );
  }

  return (
    <>
      {threads.map((thread) => (
        <ThreadCard
          key={thread.threadId}
          className="px-4 py-4 md:px-0 md:py-6"
          staticTweet={thread.tweets[0]}
          characterLimit={166}
          size="lg"
          bordered={true}
          showThread={false}
          clickHref={`/threads/${thread.threadId}`}
        />
      ))}
    </>
  );
}

// Loading fallback for Suspense
function ThreadsContentSkeleton() {
  return (
    <aside className="space-y-6">
      <section className="px-4 pb-6 md:px-0 md:pb-0">
        <h3 className="text-2xl font-medium">Author.</h3>
        <div className="mt-4 space-y-3">
          <Skeleton className="size-12 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </section>
    </aside>
  );
}

function ThreadsListSkeleton() {
  return (
    <div className="px-4 md:px-0">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="py-4 md:py-6">
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

export default function ThreadsPage() {
  const threadsPromise = getPublicThreads();

  return (
    <div className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] mx-auto mt-4 w-full max-w-[1288px] duration-300 md:mt-12 md:px-4">
      <Link href="/home" className="ml-4 block w-fit md:ml-0">
        <h1 className="font-pixel-square text-2xl font-medium md:text-3xl">
          <span className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] text-muted-foreground inline-block rotate-180 transform-gpu duration-300 hover:translate-x-1">
            ➞
          </span>{" "}
          Threads.
        </h1>
      </Link>
      <div className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] grid grid-cols-1 gap-6 duration-300 md:mt-12 md:grid-cols-[calc(66.47%-1.5rem)_calc(33.53%-1.5rem)] md:gap-12 md:pb-56">
        <section className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] @container duration-300">
          <Suspense fallback={<ThreadsListSkeleton />}>
            <ThreadsListSection threadsPromise={threadsPromise} />
          </Suspense>
        </section>

        {/* Wrap dynamic content in Suspense for better UX */}
        <Suspense fallback={<ThreadsContentSkeleton />}>
          <ThreadsContent threadsPromise={threadsPromise} />
        </Suspense>
      </div>
    </div>
  );
}
