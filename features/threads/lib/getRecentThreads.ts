import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { logger } from "@/shared/lib/logger";
import { Thread } from "@/features/threads/types";
import { connection } from "next/server";

export const getRecentThreads = async (count: number) => {
  // Signal to Next.js that this function should be dynamically rendered
  // This is needed because ConvexHttpClient uses Math.random() internally
  await connection();
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");
  try {
    const rawThreads = await convex.query(
      api.socialapiMutations.getRecentThreads,
      {
        count,
      }
    );
    const recentThreads: Thread[] = (rawThreads as Thread[]).map(
      (thread: Thread) => ({
        ...thread,
        tweets: thread.tweets.map((tweet: Thread["tweets"][number]) => ({
          ...tweet,
          // Normalize display_text_range from number[] to tuple [number, number]
          display_text_range:
            Array.isArray(tweet.display_text_range) &&
            tweet.display_text_range.length === 2
              ? [tweet.display_text_range[0], tweet.display_text_range[1]]
              : undefined,
          entities: {
            ...tweet.entities,
            urls: tweet.entities?.urls?.map(
              (
                url: NonNullable<
                  NonNullable<Thread["tweets"][number]["entities"]>["urls"]
                >[number]
              ) => ({
                ...url,
                indices: [url.indices[0], url.indices[1]] as [number, number],
              })
            ),
          },
        })),
      })
    );
    return recentThreads;
  } catch (error) {
    logger.error("Error fetching recent threads:", error);
    return [];
  }
};
