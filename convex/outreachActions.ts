"use node";

// convex/outreachActions.ts
// Node.js runtime actions for outreach system
// Contains executeCommentTask which requires twitter-api-v2 (Node.js dep)
// Contains auto plan generation for high-score prospects (>= 90)

import { v } from "convex/values";
import { internalAction, action } from "./_generated/server";
import { internal, api, components } from "./_generated/api";
import { createThread } from "@convex-dev/agent";
import { outreachAgent } from "./agents/outreach";
import { outreachPlanPool } from "./lib/outreachPlanPool";
import { AUTO_PLAN_GENERATION_THRESHOLD } from "./lib/outreachCore";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

/**
 * Execute comment task (internal action, for workflow).
 *
 * Posts a reply to a target tweet using the user's linked X account.
 * Handles errors gracefully and stores detailed error information
 * for the agent to retrieve and potentially fix.
 */
export const executeCommentTask = internalAction({
  args: {
    taskId: v.id("outreachTasks"),
    planId: v.id("outreachPlans"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; tweetId?: string }> => {
    // Get task details
    const task = await ctx.runQuery(internal.outreach.getTaskInternal, {
      taskId: args.taskId,
    });

    if (!task) {
      throw new Error("Task not found");
    }

    if (!task.targetTweetId || !task.content) {
      throw new Error("Task missing required data for comment");
    }

    // Validate content length (Twitter limit is 280 characters)
    const contentLength = task.content.length;
    if (contentLength > 280) {
      const errorDetails = {
        type: "content_too_long",
        message: `Reply content is ${contentLength} characters. Twitter limit is 280.`,
        currentLength: contentLength,
        maxLength: 280,
        excessCharacters: contentLength - 280,
        fixable: true,
        suggestion: "Shorten the reply to 280 characters or less.",
      };

      // Store error details on task for agent to retrieve
      await ctx.runMutation(internal.outreach.updateTaskResult, {
        taskId: args.taskId,
        status: "failed",
        errorMessage: errorDetails.message,
        resultData: { error: errorDetails },
      });

      throw new Error(
        `Content too long: ${contentLength} chars (max 280). The agent can retrieve this error and fix it.`
      );
    }

    // Get plan for user context
    const planData = await ctx.runQuery(internal.outreach.getPlanInternal, {
      planId: args.planId,
    });

    if (!planData) {
      throw new Error("Plan not found");
    }

    const { plan } = planData;

    // Get user's X account
    const account = await ctx.runAction(
      api.socialAccountsMutations.getXAccountByUserIdAction,
      { userId: plan.userId }
    );

    if (!account) {
      const errorDetails = {
        type: "no_x_account",
        message: "No X account linked. Please connect your X account first.",
        fixable: false,
      };

      await ctx.runMutation(internal.outreach.updateTaskResult, {
        taskId: args.taskId,
        status: "failed",
        errorMessage: errorDetails.message,
        resultData: { error: errorDetails },
      });

      throw new Error("No X account linked");
    }

    // Validate scope includes tweet.write permission
    const accountScope = typeof account.scope === "string" ? account.scope : "";
    if (!accountScope.includes("tweet.write")) {
      const errorDetails = {
        type: "missing_write_scope",
        message:
          "Your X account doesn't have write permissions. Please reconnect with 'tweet.write' scope.",
        fixable: true,
        suggestion:
          "Go to Settings → Connected Accounts → Disconnect and reconnect your X account. Ensure your X App has 'Read and write' permissions in the Developer Portal.",
        currentScope: accountScope || "unknown",
      };

      await ctx.runMutation(internal.outreach.updateTaskResult, {
        taskId: args.taskId,
        status: "failed",
        errorMessage: errorDetails.message,
        resultData: { error: errorDetails },
      });

      console.error(
        `[Outreach] Missing tweet.write scope. Current scope: ${accountScope}`
      );
      throw new Error("Missing tweet.write permission");
    }

    // Decrypt access token
    const accessToken = await ctx.runAction(api.cryptoActions.decryptToken, {
      encryptedToken: account.accessToken,
    });

    // Decrypt refresh token for auto-refresh
    const decryptedRefreshToken = account.refreshToken
      ? await ctx.runAction(api.cryptoActions.decryptToken, {
          encryptedToken: account.refreshToken,
        })
      : undefined;

    // Create Twitter client with token refresh support
    const {
      createTwitterClient,
      uploadMediaFiles,
      attachMediaDescriptions,
      getMediaTypesFromUrls,
    } = await import("./twitterClient");

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

    try {
      let mediaIds: string[] = [];

      if (task.mediaUrls && task.mediaUrls.length > 0) {
        mediaIds = await uploadMediaFiles(client, task.mediaUrls);

        if (task.mediaDescriptions && task.mediaDescriptions.length > 0) {
          try {
            const contentTypes = await getMediaTypesFromUrls(task.mediaUrls);
            const supportedIds: string[] = [];
            const supportedDescriptions: string[] = [];

            for (
              let i = 0;
              i < mediaIds.length && i < contentTypes.length;
              i++
            ) {
              const contentType = contentTypes[i] || "application/octet-stream";
              if (contentType.startsWith("video/")) continue;
              supportedIds.push(mediaIds[i]);
              supportedDescriptions.push(task.mediaDescriptions[i] || "");
            }

            if (supportedIds.length > 0) {
              await attachMediaDescriptions(
                client,
                supportedIds,
                supportedDescriptions
              );
            }
          } catch (descriptionError) {
            console.warn(
              "[Outreach] Failed to attach some media descriptions",
              descriptionError
            );
          }
        }
      }

      // Post the reply
      console.info(
        `[Outreach] Posting reply to tweet ${task.targetTweetId}: "${task.content.substring(0, 50)}..."`
      );

      const result = await client.v2.tweet({
        text: task.content,
        reply: { in_reply_to_tweet_id: task.targetTweetId },
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

      // Store successful result
      await ctx.runMutation(internal.outreach.updateTaskResult, {
        taskId: args.taskId,
        status: "waiting_response",
        resultData: {
          postedTweetId: result.data.id,
          postedAt: getCurrentUTCTimestamp(),
          postedText: task.content,
          postedMediaUrls: task.mediaUrls || [],
          postedMediaDescriptions: task.mediaDescriptions || [],
          postedBy: {
            name: account.name || undefined,
            screenName: account.screenName || undefined,
            profileImageUrl: account.profileImageUrl || undefined,
          },
          // Backward-compatible field for existing consumers
          text: task.content,
        },
      });

      console.info(
        `[Outreach] Successfully posted reply ${result.data.id} to tweet ${task.targetTweetId}`
      );

      return {
        success: true,
        tweetId: result.data.id,
      };
    } catch (error) {
      // Parse and structure the error for the agent
      const errorDetails = parseTwitterError(error);

      // Store error details on task for agent to retrieve
      await ctx.runMutation(internal.outreach.updateTaskResult, {
        taskId: args.taskId,
        status: "failed",
        errorMessage: errorDetails.message,
        resultData: { error: errorDetails },
      });

      console.error(`[Outreach] Failed to post reply:`, errorDetails);

      // Re-throw with structured error for workflow
      throw new Error(`Twitter API error: ${errorDetails.message}`);
    }
  },
});

/**
 * Parse Twitter API errors into structured format for the agent.
 */
function parseTwitterError(error: unknown): {
  type: string;
  message: string;
  fixable: boolean;
  suggestion?: string;
  code?: number;
  details?: unknown;
} {
  // Check if it's an ApiResponseError from twitter-api-v2
  if (error && typeof error === "object" && "code" in error) {
    const apiError = error as {
      code: number;
      message?: string;
      errors?: Array<{ message?: string; detail?: string }>;
    };
    const errorMessage =
      apiError.errors?.[0]?.message ||
      apiError.errors?.[0]?.detail ||
      apiError.message ||
      "Unknown API error";

    // Rate limit error
    if (apiError.code === 429) {
      return {
        type: "rate_limit",
        message: "Rate limit exceeded. Please wait before trying again.",
        fixable: false,
        code: 429,
      };
    }

    // Authentication error
    if (apiError.code === 401 || apiError.code === 403) {
      return {
        type: "auth_error",
        message:
          "Authentication failed. The user may need to reconnect their X account.",
        fixable: false,
        code: apiError.code,
      };
    }

    // Duplicate tweet (Twitter doesn't allow duplicate tweets)
    if (errorMessage.toLowerCase().includes("duplicate")) {
      return {
        type: "duplicate_content",
        message: "This content has already been posted.",
        fixable: true,
        suggestion: "Rephrase the reply to make it unique.",
      };
    }

    // Content-related errors
    if (
      errorMessage.toLowerCase().includes("length") ||
      errorMessage.toLowerCase().includes("character")
    ) {
      return {
        type: "content_too_long",
        message: errorMessage,
        fixable: true,
        suggestion: "Shorten the reply to 280 characters or less.",
      };
    }

    // Tweet not found (reply target deleted)
    if (
      apiError.code === 404 ||
      errorMessage.toLowerCase().includes("not found")
    ) {
      return {
        type: "target_not_found",
        message: "The target tweet was not found. It may have been deleted.",
        fixable: false,
      };
    }

    // Generic API error
    return {
      type: "api_error",
      message: errorMessage,
      fixable: false,
      code: apiError.code,
      details: apiError.errors,
    };
  }

  // Network or unknown errors
  if (error instanceof Error) {
    return {
      type: "network_error",
      message: error.message,
      fixable: false,
    };
  }

  return {
    type: "unknown_error",
    message: "An unknown error occurred",
    fixable: false,
  };
}

// ============================================================================
// Public Actions
// ============================================================================

/**
 * Raw interaction data from getProspectInteractions query
 */
interface RawInteraction {
  id: string;
  threadId: string;
  originalPostId: string;
  repliedAt: number;
  ourTweetId: string;
  planId: string;
  postedBy?: {
    name: string;
    screenName: string;
    profileImageUrl?: string;
  };
  hasProspectResponse: boolean;
}

/**
 * Participant in a prospect interaction
 */
interface InteractionParticipant {
  name: string;
  username: string;
  avatarUrl?: string;
}

/**
 * Formatted interaction for UI
 */
interface FormattedInteraction {
  id: string;
  originalPost: unknown;
  participants: InteractionParticipant[];
  threadId: string;
  repliedAt: number;
}

/**
 * Get prospect interactions with full tweet data.
 *
 * Fetches raw interactions from DB, then enriches each with the original
 * tweet from SocialAPI thread endpoint. Participants are built from stored
 * DB data (not parsed from thread tweets) so they accurately reflect who
 * has actually interacted.
 */
export const getProspectInteractionsWithTweets = internalAction({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }): Promise<FormattedInteraction[]> => {
    const rawInteractions = (await ctx.runQuery(
      api.outreach.getProspectInteractions,
      { prospectId }
    )) as RawInteraction[];

    if (!rawInteractions || rawInteractions.length === 0) {
      return [];
    }

    const formattedInteractions: FormattedInteraction[] = [];

    for (const raw of rawInteractions) {
      try {
        const threadResult = await ctx.runAction(
          internal.integrations.twitter.getThread.getThread,
          { threadId: raw.originalPostId }
        );

        if (!threadResult.success || !threadResult.tweets?.length) {
          console.warn(
            `[Outreach] Could not fetch thread for interaction ${raw.id}`
          );
          continue;
        }

        const originalPost = threadResult.tweets[0];

        // Build participants from stored data (deterministic and correct)
        const participants: InteractionParticipant[] = [];

        // 1. Always include the user who posted the reply
        participants.push({
          name: raw.postedBy?.name || "You",
          username: raw.postedBy?.screenName || "",
          avatarUrl: raw.postedBy?.profileImageUrl,
        });

        // 2. Include prospect only if they have responded
        if (raw.hasProspectResponse) {
          const postData = originalPost as Record<string, unknown>;
          const postUser = postData.user as Record<string, unknown> | undefined;
          if (postUser && typeof postUser.screen_name === "string") {
            participants.push({
              name:
                typeof postUser.name === "string"
                  ? postUser.name
                  : postUser.screen_name,
              username: postUser.screen_name,
              avatarUrl:
                typeof postUser.profile_image_url_https === "string"
                  ? postUser.profile_image_url_https
                  : undefined,
            });
          }
        }

        formattedInteractions.push({
          id: raw.id,
          originalPost,
          participants,
          threadId: raw.threadId,
          repliedAt: raw.repliedAt,
        });
      } catch (error) {
        console.error(
          `[Outreach] Error fetching tweet for interaction ${raw.id}:`,
          error
        );
      }
    }

    return formattedInteractions;
  },
});

/**
 * Public action to fetch prospect interactions with tweet data.
 * This is the public wrapper that UI components call.
 */
export const fetchProspectInteractions = action({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }): Promise<FormattedInteraction[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const prospect = await ctx.runQuery(api.prospects.getProspect, {
      prospectId,
    });
    if (!prospect) {
      throw new Error("Not authorized to view this prospect");
    }

    return await ctx.runAction(
      internal.outreachActions.getProspectInteractionsWithTweets,
      { prospectId }
    );
  },
});

/**
 * Result from fetchConversationReplies
 */
interface ConversationResult {
  success: boolean;
  tweets: unknown[];
  error?: string;
}

/**
 * Fetch a full conversation (original tweet + all replies) using the
 * SocialAPI `conversation_id:TWEET_ID` search operator.
 *
 * This returns cross-user replies (our reply + prospect's response),
 * unlike the thread endpoint which only returns same-author threads.
 */
export const fetchConversationReplies = action({
  args: {
    originalTweetId: v.string(),
    prospectId: v.optional(v.id("prospects")),
  },
  handler: async (
    ctx,
    { originalTweetId, prospectId }
  ): Promise<ConversationResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, tweets: [], error: "Not authenticated" };
    }

    if (prospectId) {
      const prospect = await ctx.runQuery(api.prospects.getProspect, {
        prospectId,
      });
      if (!prospect) {
        return {
          success: false,
          tweets: [],
          error: "Not authorized to view this prospect",
        };
      }
    }

    try {
      // 1. Fetch original tweet via thread endpoint (first tweet)
      const threadResult = await ctx.runAction(
        internal.integrations.twitter.getThread.getThread,
        { threadId: originalTweetId }
      );

      const originalTweet =
        threadResult.success && threadResult.tweets?.length
          ? threadResult.tweets[0]
          : null;

      // 2. Fetch all replies using conversation_id search operator
      const searchResult = await ctx.runAction(
        internal.integrations.twitter.searchPosts.searchInternal,
        { query: `conversation_id:${originalTweetId}` }
      );

      const replies =
        searchResult.success && Array.isArray(searchResult.posts)
          ? searchResult.posts
          : [];

      // 3. Combine and deduplicate by stable tweet ID, then sort chronologically
      const combined: unknown[] = [];
      if (originalTweet) combined.push(originalTweet);
      combined.push(...replies);

      const seen = new Set<string>();
      const dedupedTweets: unknown[] = [];
      for (const tweet of combined) {
        const t = tweet as Record<string, unknown>;
        const tweetId =
          typeof t.id_str === "string"
            ? t.id_str
            : typeof t.id === "string"
              ? t.id
              : typeof t.id === "number"
                ? String(t.id)
                : undefined;
        if (!tweetId || seen.has(tweetId)) continue;
        seen.add(tweetId);
        dedupedTweets.push(tweet);
      }

      dedupedTweets.sort((a, b) => {
        const aTime = new Date(
          (a as Record<string, unknown>).tweet_created_at as string | number
        ).getTime();
        const bTime = new Date(
          (b as Record<string, unknown>).tweet_created_at as string | number
        ).getTime();
        return aTime - bTime;
      });

      return { success: true, tweets: dedupedTweets };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[Outreach] Error fetching conversation for ${originalTweetId}:`,
        errorMessage
      );
      return { success: false, tweets: [], error: errorMessage };
    }
  },
});

// ============================================================================
// Auto Outreach Plan Generation (for >= 90 score prospects)
// ============================================================================

/**
 * Enqueue auto plan generation via Workpool.
 * Called by enrichment workflow for >= 90 score prospects.
 * This is the entry point - follows startQualification/startEnrichment pattern.
 *
 * Per AGENT_CONTEXT.txt lines 140-148: Uses *Pool.ts naming convention
 */
export const startAutoPlanGeneration = internalAction({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<{ workId: string }> => {
    const workId = await outreachPlanPool.enqueueAction(
      ctx,
      internal.outreachActions.runAutoPlanGeneration,
      args
    );

    console.info(
      `[OutreachPlan] Enqueued workId ${workId} for prospect ${args.prospectId}`
    );

    return { workId: workId.toString() };
  },
});

/** Return type for runAutoPlanGeneration */
type AutoPlanGenerationResult =
  | { success: false; reason: string }
  | {
      success: true;
      planId?: string;
      threadId?: string;
      finishReason?: string;
    };

/**
 * Execute auto plan generation for a single prospect.
 * Called by Workpool - runs in parallel with other plan generations.
 *
 * Flow:
 * 1. Create thread for prospect (title: "outreach:{prospectId}")
 * 2. Generate plan using outreach agent
 * 3. Update status to completed/failed
 */
export const runAutoPlanGeneration = internalAction({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<AutoPlanGenerationResult> => {
    const startTime = getCurrentUTCTimestamp();

    try {
      // 1. Verify prospect still qualifies for auto plan generation
      const prospect = await ctx.runQuery(
        internal.prospects.getProspectInternal,
        { prospectId: args.prospectId }
      );

      if (!prospect) {
        throw new Error("Prospect not found");
      }

      // Skip if score is below threshold (could have been updated)
      if (
        prospect.qualificationScore === undefined ||
        prospect.qualificationScore < AUTO_PLAN_GENERATION_THRESHOLD
      ) {
        console.info(
          `[OutreachPlan] Skipping auto plan for prospect ${args.prospectId} - score ${prospect.qualificationScore} below threshold ${AUTO_PLAN_GENERATION_THRESHOLD}`
        );
        await ctx.runMutation(internal.prospects.updatePlanGenerationStatus, {
          prospectId: args.prospectId,
          status: "idle",
        });
        return { success: false, reason: "Score below threshold" };
      }

      // 2. Check if plan already exists
      const existingPlan = await ctx.runQuery(
        internal.outreach.getProspectActivePlanInternal,
        { prospectId: args.prospectId }
      );

      if (existingPlan) {
        console.info(
          `[OutreachPlan] Plan already exists for prospect ${args.prospectId}`
        );
        await ctx.runMutation(internal.prospects.updatePlanGenerationStatus, {
          prospectId: args.prospectId,
          status: "completed",
        });
        return { success: true, planId: existingPlan.plan._id };
      }

      // 3. Create thread for prospect
      const threadId = await createThread(ctx, components.agent, {
        userId: args.userId,
        title: `outreach:${args.prospectId}`,
        summary: "Auto-generated outreach plan for high-match prospect",
      });

      console.info(
        `[OutreachPlan] Created thread ${threadId} for prospect ${args.prospectId}`
      );

      // 4. Generate plan using outreach agent
      const prospectName = prospect.displayName || "this prospect";
      const prospectTitle = prospect.title || "prospect";

      const prompt = `Generate an outreach plan for ${prospectName} (${prospectTitle}). 

This is a high-match prospect with a ${prospect.qualificationScore}% fit score who is a strong ICP match. Create a personalized, non-spammy engagement strategy.

Please:
1. First use getProspectContext to understand their background and pain points
2. Then use analyzeBestEngagement to find the best tweet to engage with
3. Finally use generatePlan to create a tailored outreach plan with specific, personalized content

Remember: Quality over quantity. The goal is genuine connection, not spam.`;

      let finishReason: string | undefined;
      try {
        const result = await outreachAgent.streamText(
          ctx,
          { threadId },
          { prompt },
          {
            saveStreamDeltas: {
              chunking: "word",
              throttleMs: 100,
            },
          }
        );
        await result.consumeStream();
        finishReason = await result.finishReason;
      } catch (generationError) {
        const generationMessage =
          generationError instanceof Error
            ? generationError.message
            : String(generationError);
        const isProviderMetadataValidationError = generationMessage.includes(
          "providerMetadata.openrouter.annotations"
        );

        if (!isProviderMetadataValidationError) {
          throw generationError;
        }

        console.warn(
          `[OutreachPlan] Metadata validation failed, retrying without message persistence for prospect ${args.prospectId}`
        );

        const fallbackResult = await outreachAgent.generateText(
          ctx,
          { threadId },
          {
            prompt,
          },
          {
            storageOptions: { saveMessages: "none" },
          }
        );
        finishReason = fallbackResult.finishReason;
      }

      // 5. Update status to completed
      await ctx.runMutation(internal.prospects.updatePlanGenerationStatus, {
        prospectId: args.prospectId,
        status: "completed",
      });

      const duration = getCurrentUTCTimestamp() - startTime;
      console.info(
        `[OutreachPlan] Auto-generated plan for prospect ${args.prospectId} in ${duration}ms`
      );

      return {
        success: true,
        threadId,
        finishReason,
      };
    } catch (error) {
      // Update status to failed
      await ctx.runMutation(internal.prospects.updatePlanGenerationStatus, {
        prospectId: args.prospectId,
        status: "failed",
      });

      const duration = getCurrentUTCTimestamp() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error(
        `[OutreachPlan] Failed for prospect ${args.prospectId} after ${duration}ms:`,
        errorMessage
      );

      // Re-throw for Workpool retry
      throw error;
    }
  },
});
