"use node";

// convex/outreachActions.ts
// Node.js runtime actions for outreach system
// Contains Composio-backed task execution for outreach actions
// Contains auto plan generation for high-score prospects (>= 90)

import { v } from "convex/values";
import { action, internalAction } from "./lib/functionBuilders";
import { internal, api, components } from "./_generated/api";
import { createThread } from "@convex-dev/agent";
import { outreachAgent } from "./agents/outreach";
import { buildOutreachAgentPrompt } from "./agents/prompts";
import { persistRawModelResponse } from "./lib/modelTelemetry";
import { outreachPlanPool } from "./lib/outreachPlanPool";
import { AUTO_PLAN_GENERATION_THRESHOLD } from "./lib/outreachCore";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { getWorkspaceUseCase } from "../shared/lib/workspaceUseCases";
import {
  getXConnectionStatusForUser,
  getXProviderContextForUser,
} from "./lib/xdkAuth";
import {
  executeCuratedTwitterAction,
  getXExecutionFailure,
} from "./lib/xdkTwitterProvider";
import { getTwitterActionCatalogEntry } from "./lib/twitterActionCatalog";
import {
  buildTwitterPostUrl,
  getTwitterConversationId,
  getTwitterPostId,
  summarizeTwitterPost,
  type TwitterPostRef,
} from "../shared/lib/twitter/contracts";
import {
  X_LONG_FORM_POST_MAX_CHARS,
  X_POST_WEIGHTED_MAX,
  getPostTextLimitError,
  hasDmBody,
  hasPostBody,
} from "../shared/lib/twitter/xPostTextLimit";
import { logger } from "../shared/lib/logger";

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

type ExecuteDmTaskResult =
  | {
      success: true;
      conversationId?: string;
      messageId?: string;
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

const outreachActionsLogger = logger.withScope("OutreachActions");

function parseTwitterError(error: unknown): StructuredOutreachError {
  const xFailure = getXExecutionFailure(error);
  if (xFailure) {
    return {
      classification: xFailure.classification,
      message: xFailure.message,
      retryable: xFailure.retryable,
      suggestion: xFailure.suggestion,
      code: xFailure.code,
      details: xFailure.details,
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
        outreachActionsLogger.warn(
          "Failed to bridge task status",
          { taskId: String(args.taskId), planId: String(args.planId) },
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

    const mediaUrls = task.mediaUrls || [];
    if (!task.targetTweetId || !hasPostBody(task.content, mediaUrls)) {
      throw new Error("Task missing required data for comment");
    }

    const planData = await ctx.runQuery(internal.outreach.getPlanInternal, {
      planId: args.planId,
    });
    const plan = planData?.plan;
    if (!plan) {
      throw new Error("Plan not found");
    }
    const planUserId = plan.userId;
    const limit = await ctx.runQuery(
      internal.xPostLimits.getEffectivePostLimitInternal,
      { userId: planUserId }
    );
    const postLimitErr = task.content
      ? getPostTextLimitError(task.content, limit)
      : null;
    if (postLimitErr) {
      const errorDetails: StructuredOutreachError = {
        classification: "content_too_long",
        message: postLimitErr,
        retryable: false,
        suggestion:
          limit.mode === "short"
            ? `Shorten the reply to at most ${X_POST_WEIGHTED_MAX} weighted characters (URLs count as fewer raw characters on X).`
            : `Shorten the reply to at most ${X_LONG_FORM_POST_MAX_CHARS} characters.`,
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
    try {
      const entry = getTwitterActionCatalogEntry("reply_to_post");
      const provider = await getXProviderContextForUser(ctx, internal.xStore, {
        userId: plan.userId,
        requiredScopes: entry.requiredScopes,
      });
      const result = await executeCuratedTwitterAction(provider, {
        actionKey: "reply_to_post",
        toolSlug: entry.toolSlug,
        toolVersion: entry.toolVersion,
        tweetId: task.targetTweetId,
        text: task.content || "",
        mediaUrls,
        mediaDescriptions: task.mediaDescriptions || [],
      });

      if (!result.createdTweetId) {
        throw new Error(
          "Composio reply succeeded but did not return a created tweet id."
        );
      }

      await ctx.runMutation(internal.outreach.updateTaskResult, {
        taskId: args.taskId,
        status: "waiting_response",
        resultData: {
          postedTweetId: result.createdTweetId,
          postedAt: getCurrentUTCTimestamp(),
          postedText: result.postedText || task.content || "",
          postedMediaUrls: mediaUrls,
          postedMediaDescriptions: task.mediaDescriptions || [],
          postedMediaKinds: task.mediaKinds || [],
          postedBy: {
            name: "You",
          },
          attemptId,
          text: result.postedText || task.content || "",
          xdk: {
            toolSlug: result.toolSlug,
            toolVersion: result.toolVersion,
          },
        },
      });

      const connectionStatus = await getXConnectionStatusForUser(
        ctx,
        internal.xStore,
        plan.userId
      );
      const sourcePostRef =
        task.approvalContext?.sourcePostRef ??
        ({
          platform: "twitter",
          postId: task.targetTweetId,
          conversationId:
            task.approvalContext?.sourcePostRef?.conversationId ??
            task.targetTweetId,
        } satisfies TwitterPostRef);
      const replyPostRef = {
        platform: "twitter" as const,
        postId: result.createdTweetId,
        conversationId:
          sourcePostRef.conversationId ??
          getTwitterConversationId(sourcePostRef),
        authorHandle: connectionStatus.screenName,
        url: buildTwitterPostUrl({
          postId: result.createdTweetId,
          authorHandle: connectionStatus.screenName,
        }),
      };

      await ctx.runMutation(internal.outreach.upsertTwitterInteraction, {
        userId: plan.userId,
        prospectId: plan.prospectId,
        sourcePostRef,
        sourcePostSummary: task.approvalContext?.sourcePostSummary,
        replyPostRef,
        replyPostSummary: {
          platform: "twitter",
          ref: replyPostRef,
          url: replyPostRef.url!,
          textPreview: result.postedText || task.content || "",
          createdAt: getCurrentUTCTimestamp(),
          author:
            connectionStatus.screenName || connectionStatus.name
              ? {
                  handle: connectionStatus.screenName,
                  name: connectionStatus.name,
                  avatarUrl: connectionStatus.profileImageUrl,
                }
              : undefined,
        },
        threadId: sourcePostRef.conversationId ?? sourcePostRef.postId,
        repliedAt: getCurrentUTCTimestamp(),
        origin: "agent",
        discoveredVia: "outreach_task",
        participants: [
          {
            handle: connectionStatus.screenName,
            name: connectionStatus.name ?? "You",
            avatarUrl: connectionStatus.profileImageUrl,
            isViewer: true,
          },
        ],
      });

      await bridgeStatusMessage();
      return {
        success: true,
        tweetId: result.createdTweetId,
        attemptId,
      };
    } catch (error) {
      const errorDetails = parseTwitterError(error);

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

      outreachActionsLogger.error("Comment task execution failed", {
        planId: String(args.planId),
        workflowId: args.workflowId ?? "unknown",
        taskId: String(args.taskId),
        attemptId,
        classification: errorDetails.classification,
        errorMessage: errorDetails.message,
      });

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

export const executeDmTask = internalAction({
  args: {
    taskId: v.id("outreachTasks"),
    planId: v.id("outreachPlans"),
  },
  handler: async (ctx, args): Promise<ExecuteDmTaskResult> => {
    const attemptId = getAttemptId();
    const bridgeStatusMessage = async () => {
      try {
        await ctx.runAction(internal.chat.bridgeOutreachTaskStatusToThread, {
          taskId: args.taskId,
        });
      } catch (bridgeError) {
        outreachActionsLogger.warn(
          "Failed to bridge DM task status",
          { taskId: String(args.taskId), planId: String(args.planId) },
          bridgeError
        );
      }
    };

    const task = await ctx.runQuery(internal.outreach.getTaskInternal, {
      taskId: args.taskId,
    });
    if (!task) {
      throw new Error("Task not found");
    }

    const mediaUrls = task.mediaUrls || [];
    if (!hasDmBody(task.content, mediaUrls)) {
      throw new Error("Task missing required data for DM");
    }

    const planData = await ctx.runQuery(internal.outreach.getPlanInternal, {
      planId: args.planId,
    });
    const plan = planData?.plan;
    if (!plan) {
      throw new Error("Plan not found");
    }
    const planUserId = plan.userId;

    const platform = task.approvalContext?.platform ?? "twitter";

    const previousResult =
      typeof task.resultData === "object" && task.resultData !== null
        ? (task.resultData as Record<string, unknown>)
        : null;

    try {
      let conversationId: string | undefined;
      let messageId: string | undefined;

      if (platform === "linkedin") {
        const result = await ctx.runAction(
          internal.linkedin.sendLinkedInMessageInternal,
          {
            userId: planUserId,
            prospectId: plan.prospectId,
            conversationId:
              typeof previousResult?.conversationId === "string"
                ? previousResult.conversationId
                : undefined,
            text: task.content || "",
            mediaUrls,
          }
        );
        conversationId = result?.conversationId;
        messageId =
          typeof result?.messageId === "string" ? result.messageId : undefined;
      } else {
        const result = await ctx.runAction(internal.x.sendDmMessageInternal, {
          userId: planUserId,
          prospectId: plan.prospectId,
          conversationId:
            typeof previousResult?.conversationId === "string"
              ? previousResult.conversationId
              : undefined,
          text: task.content || "",
          mediaUrls,
          mediaDescriptions: task.mediaDescriptions || [],
        });
        conversationId =
          typeof result?.conversationId === "string"
            ? result.conversationId
            : undefined;
        messageId =
          typeof result?.messageId === "string" ? result.messageId : undefined;
      }

      await ctx.runMutation(internal.outreach.updateTaskResult, {
        taskId: args.taskId,
        status: "completed",
        resultData: {
          conversationId,
          messageId,
          postedAt: getCurrentUTCTimestamp(),
          postedText: task.content || "",
          postedMediaUrls: mediaUrls,
          postedMediaDescriptions: task.mediaDescriptions || [],
          postedMediaKinds: task.mediaKinds || [],
          postedBy: {
            name: "You",
          },
          attemptId,
          text: task.content || "",
          platform,
        },
      });

      await bridgeStatusMessage();

      return {
        success: true,
        conversationId,
        messageId,
        attemptId,
      };
    } catch (error) {
      const structured = parseTwitterError(error);
      await ctx.runMutation(internal.outreach.updateTaskResult, {
        taskId: args.taskId,
        status: "failed",
        errorMessage: structured.message,
        resultData: {
          error: {
            ...structured,
            attemptId,
          },
          platform,
        },
      });

      await bridgeStatusMessage();

      return {
        success: false,
        errorClass: structured.classification,
        errorMessage: structured.message,
        retryable: structured.retryable,
        attemptId,
      };
    }
  },
});

async function fetchConversationTweets(
  ctx: any,
  originalTweetId: string
): Promise<unknown[]> {
  const threadResult = await ctx.runAction(
    internal.integrations.twitter.getThread.getThread,
    { threadId: originalTweetId }
  );
  const originalTweet =
    threadResult.success && threadResult.tweets?.length
      ? threadResult.tweets[0]
      : null;

  const searchResult = await ctx.runAction(
    internal.integrations.twitter.searchPosts.searchInternal,
    { query: `conversation_id:${originalTweetId}` }
  );

  const replies =
    searchResult.success && Array.isArray(searchResult.posts)
      ? searchResult.posts
      : [];

  const combined: unknown[] = [];
  if (originalTweet) {
    combined.push(originalTweet);
  }
  combined.push(...replies);

  const deduped = new Map<string, unknown>();
  for (const tweet of combined) {
    const tweetId = getTwitterPostId(tweet);
    if (!tweetId || deduped.has(tweetId)) {
      continue;
    }
    deduped.set(tweetId, tweet);
  }

  return Array.from(deduped.values()).sort((a, b) => {
    const aSummary = summarizeTwitterPost(a);
    const bSummary = summarizeTwitterPost(b);
    return (aSummary?.createdAt ?? 0) - (bSummary?.createdAt ?? 0);
  });
}

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
      return {
        success: true,
        tweets: await fetchConversationTweets(ctx, originalTweetId),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      outreachActionsLogger.error(
        "Error fetching conversation replies",
        {
          originalTweetId,
          prospectId: prospectId ? String(prospectId) : undefined,
        },
        error instanceof Error ? error : new Error(String(errorMessage))
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
    const limitState = await ctx.runQuery(
      internal.workflows.prospecting.checkProspectLimitInternal,
      {
        workspaceId: args.workspaceId,
      }
    );
    if (limitState.limitReached) {
      await ctx.runAction(
        internal.workspaces.reconcileWorkspaceCapacityStateInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
      return { workId: "" };
    }

    const workId = await outreachPlanPool.enqueueAction(
      ctx,
      internal.outreachActions.runAutoPlanGeneration,
      args
    );

    return { workId: workId.toString() };
  },
});

export const enqueueEligibleAutoPlansForWorkspace = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<{ enqueuedCount: number }> => {
    const limitState = await ctx.runQuery(
      internal.workflows.prospecting.checkProspectLimitInternal,
      {
        workspaceId: args.workspaceId,
      }
    );
    if (limitState.limitReached) {
      return { enqueuedCount: 0 };
    }

    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (
      !workspace ||
      workspace.styleProfileStatus !== "ready" ||
      typeof workspace.styleProfileVersion !== "number" ||
      workspace.styleProfileVersion <= 0
    ) {
      return { enqueuedCount: 0 };
    }

    const prospects = await ctx.runQuery(
      internal.prospects.listAutoPlanEligibleProspectsForWorkspace,
      {
        workspaceId: args.workspaceId,
      }
    );

    let enqueuedCount = 0;
    for (const prospect of prospects) {
      if (prospect.userId !== args.userId) {
        continue;
      }

      const existingPlan = await ctx.runQuery(
        internal.outreach.getProspectActivePlanInternal,
        { prospectId: prospect._id }
      );

      if (existingPlan || prospect.planGenerationStatus === "generating") {
        continue;
      }

      await ctx.runMutation(internal.prospects.updatePlanGenerationStatus, {
        prospectId: prospect._id,
        status: "generating",
      });

      await outreachPlanPool.enqueueAction(
        ctx,
        internal.outreachActions.runAutoPlanGeneration,
        {
          prospectId: prospect._id,
          workspaceId: args.workspaceId,
          userId: args.userId,
        }
      );
      enqueuedCount++;
    }

    return { enqueuedCount };
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
      const limitState = await ctx.runQuery(
        internal.workflows.prospecting.checkProspectLimitInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
      if (limitState.limitReached) {
        await ctx.runAction(
          internal.workspaces.reconcileWorkspaceCapacityStateInternal,
          {
            workspaceId: args.workspaceId,
          }
        );
        return { success: false, reason: "Prospect limit reached" };
      }

      // 1. Verify prospect still qualifies for auto plan generation
      const prospect = await ctx.runQuery(
        internal.prospects.getProspectInternal,
        { prospectId: args.prospectId }
      );

      if (!prospect) {
        throw new Error("Prospect not found");
      }

      if (prospect.status === "archived") {
        await ctx.runMutation(internal.prospects.updatePlanGenerationStatus, {
          prospectId: args.prospectId,
          status: "idle",
        });
        return { success: false, reason: "Prospect archived" };
      }

      // Skip if score is below threshold (could have been updated)
      if (
        prospect.qualificationScore === undefined ||
        prospect.qualificationScore < AUTO_PLAN_GENERATION_THRESHOLD
      ) {
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
        await ctx.runMutation(internal.prospects.updatePlanGenerationStatus, {
          prospectId: args.prospectId,
          status: "completed",
        });
        return { success: true, planId: existingPlan.plan._id };
      }

      const workspace = await ctx.runQuery(internal.workspaces.getById, {
        workspaceId: args.workspaceId,
      });
      if (
        !workspace ||
        workspace.styleProfileStatus !== "ready" ||
        typeof workspace.styleProfileVersion !== "number" ||
        workspace.styleProfileVersion <= 0
      ) {
        await ctx.runMutation(internal.prospects.updatePlanGenerationStatus, {
          prospectId: args.prospectId,
          status: "idle",
        });
        return { success: false, reason: "Writing style not ready" };
      }

      const useCase = getWorkspaceUseCase(workspace?.useCaseKey);
      const entitySingularLower = useCase.entitySingular.toLowerCase();

      // 3. Create thread for prospect
      const threadId = await createThread(ctx, components.agent, {
        userId: args.userId,
        title: `outreach:${args.prospectId}`,
        summary: `Auto-generated outreach plan for high-match ${entitySingularLower}`,
      });

      await ctx.runMutation(internal.prospectThreads.ensureThreadLink, {
        prospectId: args.prospectId,
        threadId,
        userId: args.userId,
        threadStatus: "active",
        threadSummary: `Auto-generated outreach plan for high-match ${entitySingularLower}`,
      });

      // 4. Generate plan using outreach agent
      const prospectName = prospect.displayName || "this prospect";
      const prospectTitle = prospect.title || "prospect";

      const prompt = `Generate an outreach plan for ${prospectName} (${prospectTitle}).

This is a high-match ${entitySingularLower} with a ${prospect.qualificationScore}% fit score. Create a personalized, non-spammy engagement strategy for the "${useCase.displayName}" workspace.

Please:
1. First use getProspectPlan to check whether an active plan already exists
2. Then use getSocialContext with mode:"prospect_profile" to understand their background and pain points
3. Only if a reply target is actually needed, use getSocialContext with mode:"posts" and selection:"best_for_reply"
4. Finally use generatePlan to create a tailored outreach plan with specific, personalized content, or refinePlan if an active plan already exists

Remember: Quality over quantity. The goal is genuine connection, not spam, and success in this workspace means ${useCase.promptContext.successDefinition}.`;

      let finishReason: string | undefined;
      const result = await outreachAgent.streamText(
        ctx,
        { threadId },
        {
          prompt,
          system: buildOutreachAgentPrompt(useCase),
        },
        {
          saveStreamDeltas: {
            chunking: "word",
            throttleMs: 100,
          },
        }
      );
      await result.consumeStream();
      await persistRawModelResponse(ctx, {
        userId: prospect.userId,
        threadId,
        agentName: "Outreach Agent",
        request: result.request,
        response: result.response,
        providerMetadata: result.providerMetadata,
      });
      finishReason = await result.finishReason;

      // 5. Update status to completed
      await ctx.runMutation(internal.prospects.updatePlanGenerationStatus, {
        prospectId: args.prospectId,
        status: "completed",
      });

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

      outreachActionsLogger.error(
        "Auto plan generation failed",
        {
          prospectId: String(args.prospectId),
          workspaceId: String(args.workspaceId),
          durationMs: duration,
          errorMessage,
        },
        error instanceof Error ? error : new Error(String(errorMessage))
      );

      // Re-throw for Workpool retry
      throw error;
    }
  },
});
