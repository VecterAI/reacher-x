"use node";

// convex/agents/outreach/tools/likePost.ts
// Agent tool for liking a Twitter post via the XDK-backed action layer

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../../_generated/api";

/**
 * Like a specific X (Twitter) post on behalf of the current user.
 *
 * This is a thin Agent tool wrapper around the internal Convex helper that
 * executes the XDK-backed provider on behalf of the user who owns the
 * current thread.
 *
 * The recommended pattern is:
 * 1. Call `displayPost` to show a tweet and get its `targetTweetId`.
 * 2. Call `likePost` with `tweetId` set to that `targetTweetId`.
 */
export const likePost = createTool({
  description:
    "Like a specific X (Twitter) post using the user's connected X account. Always pass a trusted tweetId, typically the `targetTweetId` returned from the displayPost tool.",
  args: z.object({
    tweetId: z
      .string()
      .min(1)
      .describe(
        "The tweet ID of the post to like. Prefer using the `targetTweetId` field returned by the displayPost tool."
      ),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      // Tools run inside a specific agent thread. We resolve the thread id
      // from the tool context so we can execute the like on behalf of the
      // user who owns that thread, without depending on Convex auth.
      const threadId =
        (ctx as any)?.threadId ??
        (ctx as any)?.thread?.threadId ??
        (ctx as any)?.thread?.id;

      if (!threadId || typeof threadId !== "string") {
        throw new Error(
          "[likePost] Missing threadId in tool context; cannot resolve user for likeTweet."
        );
      }

      await ctx.runAction(internal.x.likeTweetForThreadUser, {
        threadId,
        tweetId: args.tweetId,
      });

      return {
        success: true,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error liking tweet.";

      console.warn("[likePost] Failed to like tweet via X provider:", error);

      return {
        success: false,
        error: message,
      };
    }
  },
});
