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
import { ApiResponseError } from "twitter-api-v2";

type OutreachFailureClass =
  | "reauth_required"
  | "scope_missing"
  | "duplicate_content"
  | "rate_limited"
  | "transient_network"
  | "api_policy_forbidden"
  | "content_too_long"
  | "target_not_found"
  | "unknown_error";

type StructuredOutreachError = {
  classification: OutreachFailureClass;
  message: string;
  retryable: boolean;
  suggestion?: string;
  code?: number;
  details?: unknown;
};

type ExecuteCommentTaskResult =
  | {
      success: true;
      tweetId: string;
      attemptId: string;
    }
  | {
      success: false;
      errorClass: OutreachFailureClass;
      errorMessage: string;
      retryable: boolean;
      attemptId: string;
    };

function getAttemptId(): string {
  return `${getCurrentUTCTimestamp()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getApiErrorMessage(error: ApiResponseError): string {
  const details = error.errors ?? [];
  for (const entry of details) {
    if ("detail" in entry && typeof entry.detail === "string" && entry.detail) {
      return entry.detail;
    }
    if (
      "message" in entry &&
      typeof entry.message === "string" &&
      entry.message
    ) {
      return entry.message;
    }
  }
  return error.message || "Unknown API error";
}

function hasErrorCode(error: ApiResponseError, code: number): boolean {
  const typed = error as ApiResponseError & {
    hasErrorCode?: (errorCode: number) => boolean;
    errors?: unknown[];
  };
  if (typeof typed.hasErrorCode === "function") {
    return typed.hasErrorCode(code);
  }
  return Boolean(
    typed.errors?.some((entry) => {
      if (!entry || typeof entry !== "object") return false;
      return (entry as { code?: number }).code === code;
    })
  );
}

function parseTwitterError(error: unknown): StructuredOutreachError {
  if (error instanceof ApiResponseError) {
    const message = getApiErrorMessage(error);
    const normalized = message.toLowerCase();

    if (error.rateLimitError || error.code === 429 || hasErrorCode(error, 88)) {
      return {
        classification: "rate_limited",
        message: "X rate limit exceeded. Retry after cooldown.",
        retryable: true,
        code: error.code,
      };
    }

    const scopeMissing =
      error.code === 403 &&
      (normalized.includes("scope") ||
        normalized.includes("tweet.write") ||
        normalized.includes("not permitted") ||
        normalized.includes("permission"));
    if (scopeMissing) {
      return {
        classification: "scope_missing",
        message:
          "X account is missing required write scope. Reconnect with tweet.write.",
        retryable: false,
        suggestion:
          "Reconnect your X account and ensure your X app has Read and write permissions.",
        code: error.code,
        details: error.errors,
      };
    }

    if (
      error.isAuthError ||
      error.code === 401 ||
      hasErrorCode(error, 32) ||
      hasErrorCode(error, 89) ||
      hasErrorCode(error, 99)
    ) {
      return {
        classification: "reauth_required",
        message: "X authentication failed. Reconnect your account.",
        retryable: false,
        code: error.code,
        details: error.errors,
      };
    }

    if (
      hasErrorCode(error, 187) ||
      normalized.includes("duplicate") ||
      normalized.includes("already been posted")
    ) {
      return {
        classification: "duplicate_content",
        message: "This reply content is a duplicate.",
        retryable: false,
        suggestion: "Rephrase the reply to make it unique.",
        code: error.code,
        details: error.errors,
      };
    }

    if (
      normalized.includes("length") ||
      normalized.includes("character") ||
      normalized.includes("too long")
    ) {
      return {
        classification: "content_too_long",
        message,
        retryable: false,
        suggestion: "Shorten the reply to 280 characters or less.",
        code: error.code,
        details: error.errors,
      };
    }

    if (error.code === 404 || normalized.includes("not found")) {
      return {
        classification: "target_not_found",
        message: "The target post is no longer available.",
        retryable: false,
        code: error.code,
        details: error.errors,
      };
    }

    if (error.code >= 500 || normalized.includes("temporarily unavailable")) {
      return {
        classification: "transient_network",
        message,
        retryable: true,
        code: error.code,
        details: error.errors,
      };
    }

    if (error.code === 403) {
      return {
        classification: "api_policy_forbidden",
        message,
        retryable: false,
        code: error.code,
        details: error.errors,
      };
    }

    return {
      classification: "unknown_error",
      message,
      retryable: false,
      code: error.code,
      details: error.errors,
    };
  }

  if (error instanceof Error) {
    const normalized = error.message.toLowerCase();
    if (
      normalized.includes("timeout") ||
      normalized.includes("timed out") ||
      normalized.includes("econnreset") ||
      normalized.includes("enotfound") ||
      normalized.includes("network")
    ) {
      return {
        classification: "transient_network",
        message: error.message,
        retryable: true,
      };
    }
    return {
      classification: "unknown_error",
      message: error.message,
      retryable: false,
    };
  }

  return {
    classification: "unknown_error",
    message: "An unknown error occurred",
    retryable: false,
  };
}

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
    workflowId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ExecuteCommentTaskResult> => {
    const attemptId = getAttemptId();
    const bridgeStatusMessage = async () => {
      try {
        await ctx.runAction(internal.chat.bridgeOutreachTaskStatusToThread, {
          taskId: args.taskId,
        });
      } catch (bridgeError) {
        console.warn(
          `[Outreach] Failed to bridge task status for task ${args.taskId}`,
          bridgeError
        );
      }
    };

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
      const errorDetails: StructuredOutreachError = {
        classification: "content_too_long",
        message: `Reply content is ${contentLength} characters. Twitter limit is 280.`,
        retryable: false,
        suggestion: "Shorten the reply to 280 characters or less.",
      };

      await ctx.runMutation(internal.outreach.updateTaskResult, {
        taskId: args.taskId,
        status: "failed",
        errorMessage: errorDetails.message,
        resultData: {
          error: {
            ...errorDetails,
            attemptId,
          },
        },
      });

      await bridgeStatusMessage();
      return {
        success: false,
        errorClass: errorDetails.classification,
        errorMessage: errorDetails.message,
        retryable: false,
        attemptId,
      };
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
      const errorDetails: StructuredOutreachError = {
        classification: "reauth_required",
        message: "No X account linked. Please connect your X account first.",
        retryable: false,
      };

      await ctx.runMutation(internal.outreach.updateTaskResult, {
        taskId: args.taskId,
        status: "failed",
        errorMessage: errorDetails.message,
        resultData: { error: { ...errorDetails, attemptId } },
      });

      await bridgeStatusMessage();
      return {
        success: false,
        errorClass: errorDetails.classification,
        errorMessage: errorDetails.message,
        retryable: false,
        attemptId,
      };
    }

    const refreshPreflight = await ctx.runAction(
      internal.socialAccounts.refreshXTokenForOutreachInternal,
      {
        accountId: account._id,
        refreshBufferMs: 120_000,
      }
    );
    if (!refreshPreflight.success) {
      const errorDetails: StructuredOutreachError = {
        classification: refreshPreflight.classification,
        message: refreshPreflight.message,
        retryable: refreshPreflight.retryable,
      };
      await ctx.runMutation(internal.outreach.updateTaskResult, {
        taskId: args.taskId,
        status: "failed",
        errorMessage: errorDetails.message,
        resultData: {
          error: {
            ...errorDetails,
            attemptId,
            source: "token_preflight",
          },
        },
      });

      if (errorDetails.retryable) {
        throw new Error(
          `transient_network:${args.planId}:${args.taskId}:${attemptId}:${errorDetails.message}`
        );
      }

      await bridgeStatusMessage();
      return {
        success: false,
        errorClass: errorDetails.classification,
        errorMessage: errorDetails.message,
        retryable: false,
        attemptId,
      };
    }

    const refreshedAccount = await ctx.runQuery(
      api.socialAccountsMutations.getXAccountByAccountId,
      { accountId: account._id }
    );
    if (!refreshedAccount) {
      const message = "X account disappeared during auth preflight.";
      await ctx.runMutation(internal.outreach.updateTaskResult, {
        taskId: args.taskId,
        status: "failed",
        errorMessage: message,
        resultData: {
          error: {
            classification: "reauth_required",
            message,
            retryable: false,
            attemptId,
          },
        },
      });
      await bridgeStatusMessage();
      return {
        success: false,
        errorClass: "reauth_required",
        errorMessage: message,
        retryable: false,
        attemptId,
      };
    }

    // Validate scope includes tweet.write permission
    const accountScope =
      typeof refreshedAccount.scope === "string" ? refreshedAccount.scope : "";
    if (!accountScope.includes("tweet.write")) {
      const errorDetails: StructuredOutreachError = {
        classification: "scope_missing",
        message:
          "Your X account doesn't have write permissions. Please reconnect with 'tweet.write' scope.",
        retryable: false,
        suggestion:
          "Go to Settings → Connected Accounts → Disconnect and reconnect your X account. Ensure your X App has 'Read and write' permissions in the Developer Portal.",
      };

      await ctx.runMutation(
        api.socialAccountsMutations.updateXTokensByAccountId,
        {
          accountId: refreshedAccount._id,
          connectionStatus: "scope_missing",
          reauthRequired: true,
          lastAuthError: errorDetails.message,
          lastAuthErrorAt: getCurrentUTCTimestamp(),
        }
      );

      await ctx.runMutation(internal.outreach.updateTaskResult, {
        taskId: args.taskId,
        status: "failed",
        errorMessage: errorDetails.message,
        resultData: {
          error: {
            ...errorDetails,
            currentScope: accountScope || "unknown",
            attemptId,
          },
        },
      });

      console.error(
        `[Outreach] Missing tweet.write scope. Current scope: ${accountScope}`
      );
      await bridgeStatusMessage();
      return {
        success: false,
        errorClass: "scope_missing",
        errorMessage: errorDetails.message,
        retryable: false,
        attemptId,
      };
    }

    // Decrypt access token
    const accessToken = await ctx.runAction(api.cryptoActions.decryptToken, {
      encryptedToken: refreshedAccount.accessToken,
    });

    // Create Twitter client after token preflight succeeds.
    const {
      createTwitterClient,
      uploadMediaFiles,
      attachMediaDescriptions,
      getMediaTypesFromUrls,
    } = await import("./twitterClient");

    const client = createTwitterClient(accessToken);

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
            name: refreshedAccount.name || undefined,
            screenName: refreshedAccount.screenName || undefined,
            profileImageUrl: refreshedAccount.profileImageUrl || undefined,
          },
          attemptId,
          // Backward-compatible field for existing consumers
          text: task.content,
        },
      });

      await ctx.runMutation(
        api.socialAccountsMutations.updateXTokensByAccountId,
        {
          accountId: refreshedAccount._id,
          connectionStatus: "connected",
          reauthRequired: false,
          lastAuthError: undefined,
          lastAuthErrorAt: undefined,
        }
      );

      console.info(
        `[Outreach] planId=${args.planId} workflowId=${args.workflowId ?? "unknown"} taskId=${args.taskId} attemptId=${attemptId} postedTweetId=${result.data.id}`
      );

      await bridgeStatusMessage();
      return {
        success: true,
        tweetId: result.data.id,
        attemptId,
      };
    } catch (error) {
      // Parse and structure the error for the agent
      const errorDetails = parseTwitterError(error);

      // Store error details on task for agent to retrieve
      await ctx.runMutation(internal.outreach.updateTaskResult, {
        taskId: args.taskId,
        status: "failed",
        errorMessage: errorDetails.message,
        resultData: {
          error: {
            ...errorDetails,
            attemptId,
          },
        },
      });

      console.error(
        `[Outreach] planId=${args.planId} workflowId=${args.workflowId ?? "unknown"} taskId=${args.taskId} attemptId=${attemptId} failed class=${errorDetails.classification} message=${errorDetails.message}`
      );

      if (errorDetails.retryable) {
        throw new Error(
          `${errorDetails.classification}:${args.planId}:${args.taskId}:${attemptId}:${errorDetails.message}`
        );
      }

      await bridgeStatusMessage();
      return {
        success: false,
        errorClass: errorDetails.classification,
        errorMessage: errorDetails.message,
        retryable: false,
        attemptId,
      };
    }
  },
});

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
