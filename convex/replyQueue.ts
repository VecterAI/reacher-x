"use node";

import { action } from "./_generated/server";
import { logger } from "../shared/lib/logger";
import { v } from "convex/values";
import { api } from "./_generated/api";
import {
  createTwitterClient,
  uploadMediaFiles,
  attachMediaDescriptions,
  handleTwitterError,
  getMediaTypesFromUrls,
} from "./twitterClient";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
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
      logger.info(`Reply ${args.queueId} is not pending, skipping processing`);
      return;
    }

    try {
      // Update status to processing
      await ctx.runMutation(api.replyQueueMutations.updateReplyStatus, {
        id: args.queueId,
        status: "processing",
      });

      // Create notification state for processing
      await ctx.runMutation(api.notifications.createNotificationState, {
        replyId: args.queueId,
        userId: reply.userId,
        status: "processing",
        originalTweetAuthor: reply.originalTweetAuthor,
        replyPreview: reply.replyPreview,
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

      // Decrypt refresh token for plugin usage and persist updates on refresh
      const decryptedRefreshToken = account.refreshToken
        ? await ctx.runAction(api.cryptoActions.decryptToken, {
            encryptedToken: account.refreshToken,
          })
        : undefined;

      const client = createTwitterClient(accessToken, {
        refreshToken: decryptedRefreshToken,
        onTokenUpdate: async ({
          accessToken: at,
          refreshToken: rt,
          expiresIn,
        }) => {
          // Re-encrypt tokens before persisting
          const encryptedAccessToken = await ctx.runAction(
            api.cryptoActions.encryptToken,
            { token: at }
          );
          const encryptedRefreshToken = rt
            ? await ctx.runAction(api.cryptoActions.encryptToken, { token: rt })
            : undefined;

          await ctx.runMutation(
            api.socialAccountsMutations.updateXTokensByAccountId,
            {
              accountId: account._id,
              accessToken: encryptedAccessToken,
              refreshToken: encryptedRefreshToken,
              expiresAt: expiresIn
                ? getCurrentUTCTimestamp() + expiresIn * 1000
                : undefined,
            }
          );
        },
      });

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

        // Attach media descriptions only for image/GIF media IDs
        if (reply.mediaDescriptions && reply.mediaDescriptions.length > 0) {
          await ctx.runMutation(api.replyQueueMutations.addLog, {
            queueId: args.queueId,
            level: "info",
            message: `Preparing to attach descriptions to supported media`,
          });

          try {
            // Determine content types for uploaded URLs to filter out videos
            const contentTypes = await getMediaTypesFromUrls(reply.mediaUrls);

            // Align mediaIds with mediaUrls one-to-one; filter to images/GIFs
            const supportedIds: string[] = [];
            const supportedDescriptions: string[] = [];

            for (
              let i = 0;
              i < mediaIds.length && i < contentTypes.length;
              i++
            ) {
              const ct = contentTypes[i] || "application/octet-stream";
              const desc = reply.mediaDescriptions[i] || "";
              const isVideo = ct.startsWith("video/");

              if (!isVideo) {
                supportedIds.push(mediaIds[i]);
                supportedDescriptions.push(desc);
              } else if (desc && desc.trim().length > 0) {
                // Log that a video description was intentionally skipped
                await ctx.runMutation(api.replyQueueMutations.addLog, {
                  queueId: args.queueId,
                  level: "info",
                  message: `Skipping description for video media index ${i}`,
                });
              }
            }

            if (supportedIds.length > 0) {
              await attachMediaDescriptions(
                client,
                supportedIds,
                supportedDescriptions
              );
            }

            await ctx.runMutation(api.replyQueueMutations.addLog, {
              queueId: args.queueId,
              level: "info",
              message: `Descriptions attached where supported (images/GIFs)`,
            });
          } catch (error) {
            await ctx.runMutation(api.replyQueueMutations.addLog, {
              queueId: args.queueId,
              level: "warn",
              message: `Failed to attach some descriptions, continuing with tweet posting`,
              metadata: {
                error: error instanceof Error ? error.message : "Unknown error",
              },
            });
            // Don't throw - continue with tweet posting even if descriptions fail
          }
        }
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
        processedAt: getCurrentUTCTimestamp(),
      });

      // Create notification state for completion
      await ctx.runMutation(api.notifications.createNotificationState, {
        replyId: args.queueId,
        userId: reply.userId,
        status: "completed",
        originalTweetAuthor: reply.originalTweetAuthor,
        replyPreview: reply.replyPreview,
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
        logger.error("Twitter API error in reply processing:", handledError);
      }

      // Create notification state for failure
      await ctx.runMutation(api.notifications.createNotificationState, {
        replyId: args.queueId,
        userId: reply.userId,
        status: "failed",
        originalTweetAuthor: reply.originalTweetAuthor,
        replyPreview: reply.replyPreview,
      });

      await handleReplyError(ctx, args.queueId, error);
    }
  },
});

/**
 * Handle reply errors with retry logic
 */

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
    const fiveMinutesAgo = getCurrentUTCTimestamp() - 5 * 60 * 1000;

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
    const oneDayAgo = getCurrentUTCTimestamp() - 24 * 60 * 60 * 1000;

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
