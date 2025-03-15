import { unstable_cache } from "next/cache";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Thread } from "./threads/types";
import { Badge } from "@/shared/ui/components/Badge";
import { WaitlistUsers } from "@/features/landing/ui/components/WaitlistUsers";
import { WaitlistDrawer } from "@/features/landing/ui/components/WaitlistDrawer";
import { RecentThreads } from "@/features/landing/ui/components/RecentThreads";
import Link from "next/link";
import { WaitlistSection } from "@/features/landing/ui/components/WaitlistSection";

// Define a cached data fetching function
export const getRecentThreads = unstable_cache(
  async () => {
    try {
      const convex = new ConvexHttpClient(
        process.env.NEXT_PUBLIC_CONVEX_URL || ""
      );
      const rawThreads = await convex.query(api.socialdata.getRecentThreads, {
        count: 3,
      });
      const recentThreads: Thread[] = rawThreads.map((thread) => ({
        ...thread,
        tweets: thread.tweets.map((tweet) => ({
          ...tweet,
          entities: {
            ...tweet.entities,
            urls: tweet.entities?.urls?.map((url) => ({
              ...url,
              indices: [url.indices[0], url.indices[1]] as [number, number],
            })),
          },
        })),
      }));
      return recentThreads;
    } catch (error) {
      console.error("Error fetching recent threads:", error);
      return [];
    }
  },
  ["recentThreads"], // Cache key
  { revalidate: 60, tags: ["recentThreads"] } // Revalidate every 60 seconds
);

// Async page component
export default async function Home() {
  const recentThreads = await getRecentThreads();

  return (
    <div>
      <section
        id="hero"
        aria-labelledby="hero-heading"
        className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 pb-6 pt-6 duration-300 md:px-28 md:pb-52 md:pt-12"
      >
        <Badge variant="outline">✶ Launching April 2025</Badge>
        <hgroup className="mt-4 max-w-2xl space-y-4">
          <h1 id="hero-heading" className="text-4xl font-medium md:text-5xl">
            A search engine—to find customers.
          </h1>
          <p>Join the wait-list for early access and updates!</p>
        </hgroup>
        <WaitlistDrawer />
        <WaitlistUsers className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] mt-6 duration-300 md:mt-12" />
      </section>

      <section
        id="recent-thread"
        aria-labelledby="recent-thread-heading"
        className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] space-y-6 duration-300 @container md:space-y-12"
      >
        <div className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] flex items-center justify-between px-4 duration-300 md:px-28">
          <h2 id="recent-thread-heading" className="text-3xl font-medium">
            Recent threads.
          </h2>
          <Link
            href="/threads"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            View all
          </Link>
        </div>
        <RecentThreads
          className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-0 duration-300 md:px-28"
          threads={recentThreads}
          size="lg"
          bordered={true}
        />
      </section>

      <WaitlistSection />
    </div>
  );
}
