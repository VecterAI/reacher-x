"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import {
  createTwitterClient,
  uploadMediaFiles,
  handleTwitterError,
} from "./twitterClient";
// import { getUserIdFromIdentity } from "./lib/userUtils";

/**
 * Process a specific reply from the queue
 */
export const processReply = action({
  args: { queueId: v.id("replyQueue") },
  handler: async (ctx, args) => {
    const reply = await ctx.runQuery(api.replyQueueMutations.getReplyById, {
      id: args.queueId,
    });

    if (!reply || reply.status !== "pending") {
      console.log(`Reply ${args.queueId} is not pending, skipping processing`);
      return;
    }

    try {
      // Update status to processing
      await ctx.runMutation(api.replyQueueMutations.updateReplyStatus, {
        id: args.queueId,
        status: "processing",
      });

      // Log processing start
      await ctx.runMutation(api.replyQueueMutations.addLog, {
        queueId: args.queueId,
        level: "info",
        message: "Starting reply processing",
      });

      // Get user's Twitter account using the userId from the reply
      const account = await ctx.runAction(
        api.socialAccountsMutations.getXAccountByUserIdAction,
        {
          userId: reply.userId,
        }
      );
      if (!account) throw new Error("X account not linked");

      // Create Twitter client
      const accessToken = await ctx.runAction(api.cryptoActions.decryptToken, {
        encryptedToken: account.accessToken,
      });

      const client = createTwitterClient(accessToken, account.refreshToken);

      // Upload media if present
      let mediaIds: string[] = [];
      if (reply.mediaUrls && reply.mediaUrls.length > 0) {
        await ctx.runMutation(api.replyQueueMutations.addLog, {
          queueId: args.queueId,
          level: "info",
          message: `Uploading ${reply.mediaUrls.length} media files`,
        });

        mediaIds = await uploadMediaFiles(client, reply.mediaUrls);

        await ctx.runMutation(api.replyQueueMutations.addLog, {
          queueId: args.queueId,
          level: "info",
          message: `Successfully uploaded ${mediaIds.length} media files`,
        });
      }

      // Post reply using twitter-api-v2
      await ctx.runMutation(api.replyQueueMutations.addLog, {
        queueId: args.queueId,
        level: "info",
        message: "Posting reply to Twitter",
      });

      const result = await client.v2.tweet({
        text: reply.text,
        reply: { in_reply_to_tweet_id: reply.tweetId },
        media:
          mediaIds.length > 0
            ? {
                media_ids: mediaIds.slice(0, 4) as
                  | [string]
                  | [string, string]
                  | [string, string, string]
                  | [string, string, string, string],
              }
            : undefined,
      });

      // Update queue item as completed
      await ctx.runMutation(api.replyQueueMutations.updateReplyStatus, {
        id: args.queueId,
        status: "completed",
        twitterReplyId: result.data.id,
        processedAt: Date.now(),
      });

      // Log success
      await ctx.runMutation(api.replyQueueMutations.addLog, {
        queueId: args.queueId,
        level: "info",
        message: "Reply posted successfully",
        metadata: { twitterReplyId: result.data.id },
      });
    } catch (error) {
      // Use enhanced error handling for Twitter API errors
      try {
        handleTwitterError(error);
      } catch (handledError) {
        console.error("Twitter API error in reply processing:", handledError);
      }

      await handleReplyError(ctx, args.queueId, error);
    }
  },
});

/**
 * Handle reply errors with retry logic
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleReplyError(ctx: any, queueId: string, error: any) {
  const reply = await ctx.runQuery(api.replyQueueMutations.getReplyById, {
    id: queueId,
  });
  if (!reply) return;

  const retryCount = reply.retryCount + 1;
  const shouldRetry = retryCount < reply.maxRetries;

  await ctx.runMutation(api.replyQueueMutations.updateReplyStatus, {
    id: queueId,
    status: shouldRetry ? "retrying" : "failed",
    retryCount,
    errorMessage: error.message,
  });

  // Log error
  await ctx.runMutation(api.replyQueueMutations.addLog, {
    queueId,
    level: "error",
    message: `Reply failed: ${error.message}`,
    metadata: { retryCount, shouldRetry, error: error.toString() },
  });

  // Schedule retry if applicable
  if (shouldRetry) {
    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Exponential backoff, max 30s
    await ctx.scheduler.runAfter(retryDelay, api.replyQueue.processReply, {
      queueId,
    });

    await ctx.runMutation(api.replyQueueMutations.addLog, {
      queueId,
      level: "info",
      message: `Scheduled retry ${retryCount}/${reply.maxRetries} in ${retryDelay}ms`,
    });
  }
}

/**
 * Process stuck replies (for cron job)
 */
export const processStuckReplies = action({
  args: {},
  handler: async (ctx): Promise<{ processed: number }> => {
    // Find replies that have been processing for more than 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stuckReplies: any[] = await ctx.runQuery(
      api.replyQueueMutations.getStuckReplies,
      {
        beforeTime: fiveMinutesAgo,
      }
    );

    for (const reply of stuckReplies) {
      await ctx.runMutation(api.replyQueueMutations.addLog, {
        queueId: reply._id,
        level: "warn",
        message: "Reply was stuck, resetting to pending",
      });

      await ctx.runMutation(api.replyQueueMutations.updateReplyStatus, {
        id: reply._id,
        status: "pending",
      });

      // Schedule immediate processing
      await ctx.scheduler.runAfter(0, api.replyQueue.processReply, {
        queueId: reply._id,
      });
    }

    return { processed: stuckReplies.length };
  },
});

/**
 * Clean up old completed replies
 */
export const cleanupOldReplies = action({
  args: {},
  handler: async (ctx): Promise<{ cleaned: number }> => {
    // Delete completed replies older than 24 hours
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oldReplies: any[] = await ctx.runQuery(
      api.replyQueueMutations.getOldCompletedReplies,
      {
        beforeTime: oneDayAgo,
      }
    );

    for (const reply of oldReplies) {
      // Delete associated logs first
      const logs = await ctx.runQuery(
        api.replyQueueMutations.getLogsByQueueId,
        {
          queueId: reply._id,
        }
      );

      for (const log of logs) {
        await ctx.runMutation(api.replyQueueMutations.deleteLog, {
          id: log._id,
        });
      }

      // Delete the reply
      await ctx.runMutation(api.replyQueueMutations.deleteReply, {
        id: reply._id,
      });
    }

    return { cleaned: oldReplies.length };
  },
});
