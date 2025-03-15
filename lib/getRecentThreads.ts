// lib/getRecentThreads.ts
import { unstable_cache } from "next/cache";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Thread } from "@/app/(landing)/threads/types";

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
  ["recentThreads"],
  { revalidate: 60, tags: ["recentThreads"] }
);
