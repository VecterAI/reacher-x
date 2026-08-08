"use node";

// convex/outreachActions.ts
// Node.js runtime actions for outreach system
// Contains Composio-backed task execution for outreach actions
// Contains auto plan generation for high-score prospects (>= 80)

import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { action, internalAction } from "./lib/functionBuilders";
import { internal, api } from "./_generated/api";
import { getOutreachPlanPool } from "./lib/outreachPlanPool";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import {
  getXConnectionStatusForUser,
  getXProviderContextForUser,
} from "./lib/xdkAuth";
import {
  executeCuratedTwitterAction,
  formatXWriteActionError,
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
import { getLinkedInFailure } from "./lib/unipileClient";
import { getMediaCapabilityErrorMessage } from "./lib/mediaCapabilityCore";
import { isOutreachExecutionLeaseCurrent } from "./lib/outreachExecutionCore";
import {
  executeOutreachReaction,
  isSameOutreachReactionTarget,
} from "./lib/outreachReactionCore";

type OutreachFailureClass =
  | "reauth_required"
  | "scope_missing"
  | "duplicate_content"
  | "rate_limited"
  | "transient_network"
  | "api_policy_forbidden"
  | "content_too_long"
  | "target_not_found"
  | "not_connected"
  | "already_connected"
  | "already_invited_recently"
  | "user_unreachable"
  | "action_required"
  | "feature_unavailable"
  | "feature_not_subscribed"
  | "subscription_required"
  | "forbidden"
  | "unprocessable"
  | "service_unavailable"
  | "superseded"
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
      tweetId?: string;
      commentId?: string;
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
      recoveryStarted?: boolean;
    };

type ExecuteReactionTaskResult =
  | {
      success: true;
      attemptId: string;
      reactionTargetId: string;
      duplicate: boolean;
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

function shouldNotifyTaskExecutionFailure(
  classification: OutreachFailureClass
): boolean {
  return (
    classification !== "reauth_required" && classification !== "scope_missing"
  );
}

function parseTwitterError(
  error: unknown,
  options?: { platform?: "twitter" | "linkedin" }
): StructuredOutreachError {
  const mediaErrorMessage = getMediaCapabilityErrorMessage(error);
  if (mediaErrorMessage) {
    return {
      classification: "unprocessable",
      message: mediaErrorMessage,
      retryable: false,
    };
  }

  if (options?.platform === "linkedin") {
    const failure = getLinkedInFailure(error);
    return {
      classification: normalizeLinkedInFailureClass(failure.classification),
      message: failure.message,
      retryable: failure.retryable,
      code: failure.status,
      details: failure.type,
    };
  }

  const xFailure = getXExecutionFailure(error);
  if (xFailure) {
    const formattedMessage = formatXWriteActionError(error).message;
    return {
      classification: xFailure.classification,
      message: formattedMessage,
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

function normalizeLinkedInFailureClass(
  classification: string
): OutreachFailureClass {
  switch (classification) {
    case "reauth_required":
    case "rate_limited":
    case "target_not_found":
    case "not_connected":
    case "already_connected":
    case "already_invited_recently":
    case "user_unreachable":
    case "action_required":
    case "feature_unavailable":
    case "feature_not_subscribed":
    case "subscription_required":
    case "forbidden":
    case "unprocessable":
    case "service_unavailable":
      return classification;
    default:
      return "unknown_error";
  }
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
    executionGeneration: v.number(),
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

    let mediaUrls = task.mediaUrls || [];
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
    if (
      !isOutreachExecutionLeaseCurrent({
        plan,
        task,
        expectedExecutionGeneration: args.executionGeneration,
      })
    ) {
      return {
        success: false,
        errorClass: "superseded",
        errorMessage: "A newer plan superseded this outreach action.",
        retryable: false,
        attemptId,
      };
    }
    const planUserId = plan.userId;
    const prospect = await ctx.runQuery(
      internal.prospects.getProspectInternal,
      { prospectId: plan.prospectId }
    );
    const platform = prospect
      ? prospect.platform === "linkedin"
        ? "linkedin"
        : "twitter"
      : (task.approvalContext?.platform ?? "twitter");

    if (platform === "twitter") {
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

        await ctx.runMutation(
          internal.outreach.createTaskExecutionFailureNotification,
          {
            taskId: args.taskId,
            attemptId,
            message: errorDetails.message,
          }
        );

        await bridgeStatusMessage();
        return {
          success: false,
          errorClass: errorDetails.classification,
          errorMessage: errorDetails.message,
          retryable: false,
          attemptId,
        };
      }
    }
    try {
      const mediaValidation = await ctx.runQuery(
        internal.outreach.validateTaskMediaForExecution,
        { taskId: args.taskId }
      );
      mediaUrls = mediaValidation.mediaUrls;

      if (platform === "linkedin") {
        const result = await ctx.runAction(
          internal.linkedin.commentOnLinkedInPostInternal,
          {
            userId: planUserId,
            prospectId: plan.prospectId,
            postId: task.targetTweetId,
            commentId: task.targetCommentId,
            text: task.content || "",
            mediaUrls,
          }
        );
        if (!result.success) {
          throw {
            body: {
              status: result.status,
              type: result.type,
              detail: result.message,
            },
          };
        }

        await ctx.runMutation(internal.outreach.updateTaskResult, {
          taskId: args.taskId,
          status: "waiting_response",
          resultData: {
            commentId: result.commentId,
            messageId: result.commentId,
            postedAt: getCurrentUTCTimestamp(),
            postedText: result.postedTextPreview || task.content || "",
            postedMediaUrls: mediaUrls,
            postedMediaDescriptions: task.mediaDescriptions || [],
            postedMediaKinds: task.mediaKinds || [],
            postedBy: { name: "You" },
            attemptId,
            text: result.postedTextPreview || task.content || "",
            platform,
            resolvedSocialId: result.resolvedSocialId,
          },
        });

        await bridgeStatusMessage();
        return {
          success: true,
          commentId: result.commentId,
          attemptId,
        };
      }

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
      const errorDetails = parseTwitterError(error, { platform });

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

      let manualRecovery: { started: boolean } = { started: false };
      if (
        platform === "twitter" &&
        errorDetails.classification === "api_policy_forbidden"
      ) {
        try {
          manualRecovery = await ctx.runAction(
            internal.outreachRecovery.beginTwitterManualReplyRecovery,
            {
              taskId: args.taskId,
              planId: args.planId,
              errorMessage: errorDetails.message,
            }
          );
        } catch (recoveryError) {
          outreachActionsLogger.warn(
            "Could not start automatic manual-reply recovery",
            {
              planId: String(args.planId),
              taskId: String(args.taskId),
              attemptId,
            },
            recoveryError
          );
        }
      }

      if (
        !manualRecovery.started &&
        shouldNotifyTaskExecutionFailure(errorDetails.classification)
      ) {
        await ctx.runMutation(
          internal.outreach.createTaskExecutionFailureNotification,
          {
            taskId: args.taskId,
            attemptId,
            message: errorDetails.message,
          }
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

/**
 * Executes an approved reaction task against the prospect's platform.
 *
 * The workflow owns retries and approval. This action owns the provider call,
 * idempotent plan-level duplicate detection, and durable result recording.
 */
export const executeReactionTask = internalAction({
  args: {
    taskId: v.id("outreachTasks"),
    planId: v.id("outreachPlans"),
    executionGeneration: v.number(),
    workflowId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ExecuteReactionTaskResult> => {
    const attemptId = getAttemptId();
    const bridgeStatusMessage = async () => {
      try {
        await ctx.runAction(internal.chat.bridgeOutreachTaskStatusToThread, {
          taskId: args.taskId,
        });
      } catch (bridgeError) {
        outreachActionsLogger.warn(
          "Failed to bridge reaction task status",
          { taskId: String(args.taskId), planId: String(args.planId) },
          bridgeError
        );
      }
    };

    const task = await ctx.runQuery(internal.outreach.getTaskInternal, {
      taskId: args.taskId,
    });
    if (!task || task.type !== "react" || !task.targetTweetId) {
      throw new Error("Reaction task is missing required data");
    }

    const planData = await ctx.runQuery(internal.outreach.getPlanInternal, {
      planId: args.planId,
    });
    const plan = planData?.plan;
    if (!plan) {
      throw new Error("Plan not found");
    }
    if (
      !isOutreachExecutionLeaseCurrent({
        plan,
        task,
        expectedExecutionGeneration: args.executionGeneration,
      })
    ) {
      return {
        success: false,
        errorClass: "superseded",
        errorMessage: "A newer plan superseded this outreach action.",
        retryable: false,
        attemptId,
      };
    }

    const prospect = await ctx.runQuery(
      internal.prospects.getProspectInternal,
      { prospectId: plan.prospectId }
    );
    const platform =
      prospect?.platform === "linkedin"
        ? "linkedin"
        : task.approvalContext?.platform === "linkedin"
          ? "linkedin"
          : "twitter";
    const reactionTarget = {
      platform,
      targetPostId: task.targetTweetId,
      targetCommentId: task.targetCommentId,
      reactionType: task.reactionType,
    } as const;
    const duplicateTask = planData.tasks.find(
      (candidate) =>
        candidate._id !== task._id &&
        candidate.type === "react" &&
        candidate.status === "completed" &&
        Boolean(candidate.targetTweetId) &&
        isSameOutreachReactionTarget(reactionTarget, {
          platform,
          targetPostId: candidate.targetTweetId!,
          targetCommentId: candidate.targetCommentId,
          reactionType: candidate.reactionType,
        })
    );

    if (duplicateTask) {
      const reactionTargetId = task.targetCommentId ?? task.targetTweetId;
      await ctx.runMutation(internal.outreach.updateTaskResult, {
        taskId: args.taskId,
        status: "completed",
        resultData: {
          reactionTargetId,
          targetPostId: task.targetTweetId,
          targetCommentId: task.targetCommentId,
          reactionType: task.reactionType ?? "like",
          platform,
          duplicate: true,
          duplicateOfTaskId: duplicateTask._id,
          reactedAt: getCurrentUTCTimestamp(),
          attemptId,
        },
      });
      await bridgeStatusMessage();
      return {
        success: true,
        attemptId,
        reactionTargetId,
        duplicate: true,
      };
    }

    try {
      const executed = await executeOutreachReaction(reactionTarget, {
        likeXPost: async ({ postId }) => {
          const entry = getTwitterActionCatalogEntry("like_post");
          const provider = await getXProviderContextForUser(
            ctx,
            internal.xStore,
            {
              userId: plan.userId,
              requiredScopes: entry.requiredScopes,
            }
          );
          await executeCuratedTwitterAction(provider, {
            actionKey: "like_post",
            toolSlug: entry.toolSlug,
            toolVersion: entry.toolVersion,
            tweetId: postId,
          });
          await ctx.runMutation(
            internal.twitterEngagement.upsertPostEngagementInternal,
            {
              userId: plan.userId,
              postId,
              patch: { liked: true },
            }
          );
        },
        reactToLinkedIn: async ({ postId, commentId, reactionType }) => {
          await ctx.runAction(internal.linkedin.reactToLinkedInPostInternal, {
            userId: plan.userId,
            prospectId: plan.prospectId,
            postId,
            commentId,
            reactionType,
          });
        },
      });
      const reactionTargetId =
        executed.targetCommentId ?? executed.targetPostId;

      await ctx.runMutation(internal.outreach.updateTaskResult, {
        taskId: args.taskId,
        status: "completed",
        resultData: {
          reactionTargetId,
          targetPostId: executed.targetPostId,
          targetCommentId: executed.targetCommentId,
          reactionType: executed.reactionType,
          platform: executed.platform,
          provider: executed.provider,
          duplicate: false,
          reactedAt: getCurrentUTCTimestamp(),
          attemptId,
        },
      });
      await bridgeStatusMessage();
      return {
        success: true,
        attemptId,
        reactionTargetId,
        duplicate: false,
      };
    } catch (error) {
      const structured = parseTwitterError(error, { platform });
      await ctx.runMutation(internal.outreach.updateTaskResult, {
        taskId: args.taskId,
        status: "failed",
        errorMessage: structured.message,
        resultData: {
          error: { ...structured, attemptId },
          platform,
        },
      });

      outreachActionsLogger.error("Reaction task execution failed", {
        planId: String(args.planId),
        workflowId: args.workflowId ?? "unknown",
        taskId: String(args.taskId),
        attemptId,
        classification: structured.classification,
        errorMessage: structured.message,
      });

      if (structured.retryable) {
        throw new Error(
          `${structured.classification}:${args.planId}:${args.taskId}:${attemptId}:${structured.message}`
        );
      }
      if (shouldNotifyTaskExecutionFailure(structured.classification)) {
        await ctx.runMutation(
          internal.outreach.createTaskExecutionFailureNotification,
          {
            taskId: args.taskId,
            attemptId,
            message: structured.message,
          }
        );
      }
      await bridgeStatusMessage();
      return {
        success: false,
        errorClass: structured.classification,
        errorMessage: structured.message,
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
    executionGeneration: v.number(),
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

    let mediaUrls = task.mediaUrls || [];
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
    if (
      !isOutreachExecutionLeaseCurrent({
        plan,
        task,
        expectedExecutionGeneration: args.executionGeneration,
      })
    ) {
      return {
        success: false,
        errorClass: "superseded",
        errorMessage: "A newer plan superseded this outreach action.",
        retryable: false,
        attemptId,
      };
    }
    const planUserId = plan.userId;

    const prospect = await ctx.runQuery(
      internal.prospects.getProspectInternal,
      { prospectId: plan.prospectId }
    );
    const platform = prospect
      ? prospect.platform === "linkedin"
        ? "linkedin"
        : "twitter"
      : (task.approvalContext?.platform ?? "twitter");

    const previousResult =
      typeof task.resultData === "object" && task.resultData !== null
        ? (task.resultData as Record<string, unknown>)
        : null;

    try {
      const mediaValidation = await ctx.runQuery(
        internal.outreach.validateTaskMediaForExecution,
        { taskId: args.taskId }
      );
      mediaUrls = mediaValidation.mediaUrls;

      let conversationId: string | undefined;
      let messageId: string | undefined;

      if (platform === "linkedin") {
        const result = await ctx.runAction(
          internal.linkedin.sendLinkedInMessageForOutreachInternal,
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
        if (!result.success) {
          throw {
            body: {
              status: result.status,
              type: result.type,
              detail: result.message,
            },
          };
        }
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
      const structured = parseTwitterError(error, { platform });
      if (
        platform === "linkedin" &&
        structured.classification === "not_connected"
      ) {
        const recovery = await ctx.runAction(
          internal.outreachRecovery.beginLinkedInConnectionThenDmRecovery,
          {
            taskId: args.taskId,
            planId: args.planId,
            errorMessage: structured.message,
          }
        );
        if (recovery.started) {
          await bridgeStatusMessage();
          return {
            success: false,
            errorClass: structured.classification,
            errorMessage:
              "A LinkedIn connection is required. ReacherX is managing the connection request and will send the approved DM automatically after acceptance.",
            retryable: false,
            attemptId,
            recoveryStarted: true,
          };
        }
      }

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

      if (structured.retryable) {
        throw new Error(
          `${structured.classification}:${args.planId}:${args.taskId}:${attemptId}:${structured.message}`
        );
      }

      if (shouldNotifyTaskExecutionFailure(structured.classification)) {
        await ctx.runMutation(
          internal.outreach.createTaskExecutionFailureNotification,
          {
            taskId: args.taskId,
            attemptId,
            message: structured.message,
          }
        );
      }

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
// Auto Outreach Plan Generation (for >= 80 score prospects)
// ============================================================================

async function enqueueAutoPlanGeneration(
  ctx: ActionCtx,
  args: {
    prospectId: Id<"prospects">;
    workspaceId: Id<"workspaces">;
    userId: Id<"users">;
  }
): Promise<string> {
  const claim = await ctx.runMutation(
    internal.prospects.claimAutoPlanGeneration,
    args
  );
  if (!claim.claimed) {
    return "";
  }
  if (!claim.runId) {
    throw new Error("Auto plan claim did not create a durable run");
  }

  try {
    const workId = await getOutreachPlanPool().enqueueAction(
      ctx,
      internal.autoPlanActions.generateGroundedAutoPlanDraft,
      { ...args, runId: claim.runId },
      {
        onComplete: internal.workflows.autoPlan.handleAutoPlanWorkComplete,
        context: { prospectId: args.prospectId, runId: claim.runId },
        retry: true,
      }
    );
    await ctx.runMutation(internal.autoPlanRuns.attachAutoPlanWorkId, {
      runId: claim.runId,
      workId: String(workId),
    });
    return String(workId);
  } catch (error) {
    await ctx.runMutation(internal.autoPlanRuns.failAutoPlanRunToStart, {
      runId: claim.runId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/** Start durable, idempotent automatic plan generation for one prospect. */
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

    return { workId: await enqueueAutoPlanGeneration(ctx, args) };
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

    let enqueuedCount = 0;
    let cursor: string | null = null;
    while (true) {
      const prospectsPage: {
        page: Array<{
          _id: Id<"prospects">;
          userId: Id<"users">;
          planGenerationStatus?: "idle" | "generating" | "completed" | "failed";
        }>;
        continueCursor: string;
        isDone: boolean;
      } = await ctx.runQuery(
        internal.prospects.listAutoPlanEligibleProspectsForWorkspace,
        {
          workspaceId: args.workspaceId,
          paginationOpts: { cursor, numItems: 100 },
        }
      );

      for (const prospect of prospectsPage.page) {
        if (prospect.userId !== args.userId) {
          continue;
        }

        const workId = await enqueueAutoPlanGeneration(ctx, {
          prospectId: prospect._id,
          workspaceId: args.workspaceId,
          userId: args.userId,
        });
        if (workId) {
          enqueuedCount++;
        }
      }

      if (prospectsPage.isDone) {
        break;
      }
      cursor = prospectsPage.continueCursor;
    }

    return { enqueuedCount };
  },
});
