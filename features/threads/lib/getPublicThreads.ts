import { ConvexHttpClient } from "convex/browser";
import { unstable_cache } from "next/cache";
import { connection } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Thread } from "@/features/threads/types";
import { logger } from "@/shared/lib/logger";

type PublicThreadResponse = {
  thread: Thread | null;
  threadNumber: number | null;
  totalThreads: number;
};

function createConvexHttpClient() {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "", {
    logger: false,
  });
}

const PUBLIC_THREADS_REVALIDATE_SECONDS = 60 * 5;

const getCachedPublicThreads = unstable_cache(
  async (limit?: number, excludeThreadId?: string) => {
    if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
      return [] as Thread[];
    }

    const convex = createConvexHttpClient();
    try {
      const response = await convex.action(api.publicSocial.getPublicThreads, {
        excludeThreadId,
        limit,
      });
      return response.threads as Thread[];
    } catch (error) {
      logger.error("[getPublicThreads] Failed to fetch public threads", error);
      return [] as Thread[];
    }
  },
  ["public-threads"],
  {
    revalidate: PUBLIC_THREADS_REVALIDATE_SECONDS,
  }
);

export async function getPublicThreads(options?: {
  limit?: number;
  excludeThreadId?: string;
}) {
  return await getCachedPublicThreads(options?.limit, options?.excludeThreadId);
}

export async function getPublicThread(threadId: string) {
  await connection();

  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return {
      thread: null,
      threadNumber: null,
      totalThreads: 0,
    } satisfies PublicThreadResponse;
  }

  const convex = createConvexHttpClient();
  try {
    return (await convex.action(api.publicSocial.getPublicThread, {
      threadId,
    })) as PublicThreadResponse;
  } catch (error) {
    logger.error("[getPublicThread] Failed to fetch public thread", error);
    return {
      thread: null,
      threadNumber: null,
      totalThreads: 0,
    } satisfies PublicThreadResponse;
  }
}
