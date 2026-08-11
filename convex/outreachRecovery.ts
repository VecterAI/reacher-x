import { type Infer, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./lib/functionBuilders";
import { fetchSocialApi } from "./lib/socialApiFetch";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import {
  buildTwitterPostUrl,
  getTwitterPostId,
  summarizeTwitterPost,
} from "../shared/lib/twitter/contracts";
import { resolveProspectTwitterIdentity } from "../shared/lib/twitter/prospectTwitterIdentity";
import { normalizeLinkedInReadUrn } from "../shared/lib/linkedin/comments";
import { getNestedRecord, getStringProperty } from "./lib/typeGuards";
import {
  dismissNotificationsByKey,
  getProspectDisplayFields,
  upsertNotificationByKey,
} from "./lib/notificationHelpers";
import {
  getRecoveryNextCheckDelayMs,
  isSafeLinkedInCommentTargetRecoveryError,
  normalizeOutreachMessageText,
} from "./lib/outreachRecoveryCore";
import { getPostedOutreachArtifactId } from "./lib/outreachResultCore";
import {
  isLinkedInDmEligible,
  type LinkedInRelationshipStatus,
} from "./lib/linkedinOutreachPlanCore";
import { linkedInRecoveryCandidateValidator } from "./validators";

const SOCIALAPI_BASE_URL = "https://api.socialapi.me";
const RESPONSE_MONITOR_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const LINKEDIN_CONNECTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const internalRecovery = (internal as any).outreachRecovery;

type RecoveryMonitor = Doc<"outreachRecoveryMonitors">;
type LinkedInRecoveryCandidate = Infer<
  typeof linkedInRecoveryCandidateValidator
>;

type RecoveryMonitorPage = {
  page: RecoveryMonitor[];
  isDone: boolean;
  continueCursor: string;
};

type TwitterManualReplyMonitoringStatus =
  | "ready"
  | "reconnect_required"
  | "configuring";

type SocialApiSearchResponse = {
  tweets?: unknown[];
  message?: string;
};

const MANUAL_OUTBOUND_DETECTION_WINDOW_MS = 48 * 60 * 60 * 1000;
const TWITTER_ACTIVITY_RETRY_DELAY_MS = 15 * 60 * 1000;

/**
 * Repair a LinkedIn self-message webhook that was incorrectly recorded as a
 * prospect response. This is deliberately guarded by the outbound task's
 * persisted message ID and requires that no other non-ignored interaction
 * exists for the prospect.
 */
export const reconcileFalseLinkedInDmResponse = internalMutation({
  args: {
    eventId: v.id("outreachInteractionEvents"),
    prospectId: v.id("prospects"),
  },
  returns: v.object({
    applied: v.boolean(),
    reason: v.optional(v.string()),
    dismissedNotificationCount: v.number(),
    deletedActivityCount: v.number(),
    restoredProspect: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const emptyResult = {
      applied: false,
      dismissedNotificationCount: 0,
      deletedActivityCount: 0,
      restoredProspect: false,
    };
    const event = await ctx.db.get("outreachInteractionEvents", args.eventId);
    if (
      !event ||
      event.prospectId !== args.prospectId ||
      event.channel !== "linkedin_dm"
    ) {
      return { ...emptyResult, reason: "interaction_event_not_linkedin_dm" };
    }

    const plan = event.planId
      ? await ctx.db.get("outreachPlans", event.planId)
      : null;
    if (!plan || plan.prospectId !== args.prospectId) {
      return { ...emptyResult, reason: "outreach_plan_not_found" };
    }

    const tasks = await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan_order", (q) => q.eq("planId", plan._id))
      .take(50);
    const outboundTask = tasks.find(
      (task) =>
        task.type === "dm" &&
        getStringProperty(task.resultData, "messageId") ===
          event.responseMessageId
    );
    const outboundMessageText = outboundTask
      ? getStringProperty(outboundTask.resultData, "postedText")
      : undefined;
    const normalizedOutboundMessageText =
      normalizeOutreachMessageText(outboundMessageText);
    const normalizedResponseText = normalizeOutreachMessageText(
      event.responseText
    );
    if (
      !outboundTask ||
      (normalizedOutboundMessageText !== undefined &&
        normalizedResponseText !== undefined &&
        normalizedOutboundMessageText !== normalizedResponseText)
    ) {
      return { ...emptyResult, reason: "outbound_message_not_confirmed" };
    }

    const interactionEvents = await ctx.db
      .query("outreachInteractionEvents")
      .withIndex("by_prospect_and_created_at", (q) =>
        q.eq("prospectId", args.prospectId)
      )
      .take(50);
    const hasOtherInteraction = interactionEvents.some(
      (candidate) =>
        candidate._id !== event._id && candidate.status !== "ignored"
    );
    if (hasOtherInteraction) {
      return { ...emptyResult, reason: "other_interaction_requires_review" };
    }

    const now = getCurrentUTCTimestamp();
    let applied = event.status !== "ignored";
    if (event.status !== "ignored") {
      await ctx.db.patch("outreachInteractionEvents", event._id, {
        status: "ignored",
        decisionSummary:
          "Ignored because the provider event matched ReacherX's outbound LinkedIn DM.",
        completedAt: event.completedAt ?? now,
        updatedAt: now,
      });
    }

    let dismissedNotificationCount = 0;
    const notifications = await ctx.db
      .query("outreachNotifications")
      .withIndex("by_plan", (q) => q.eq("planId", plan._id))
      .take(50);
    for (const notification of notifications) {
      if (
        notification.prospectId !== args.prospectId ||
        notification.type !== "prospect_replied" ||
        notification.status === "dismissed" ||
        notification._creationTime < event.createdAt ||
        notification._creationTime > event.createdAt + 1000
      ) {
        continue;
      }
      await ctx.db.patch("outreachNotifications", notification._id, {
        status: "dismissed",
        dismissedAt: now,
      });
      applied = true;
      dismissedNotificationCount += 1;
    }

    let deletedActivityCount = 0;
    const activityEntries = await ctx.db
      .query("prospectActivityLog")
      .withIndex("by_prospect", (q) => q.eq("prospectId", args.prospectId))
      .take(50);
    for (const activity of activityEntries) {
      if (
        activity.type !== "responded" ||
        getStringProperty(activity.metadata, "responseDmMessageId") !==
          event.responseMessageId
      ) {
        continue;
      }
      await ctx.db.delete("prospectActivityLog", activity._id);
      applied = true;
      deletedActivityCount += 1;
    }

    const memoryEvents = await ctx.db
      .query("memoryWorkflowEvents")
      .withIndex("by_prospect_occurred_at", (q) =>
        q.eq("prospectId", args.prospectId)
      )
      .take(50);
    for (const memoryEvent of memoryEvents) {
      if (
        memoryEvent.eventType !== "prospect_responded" ||
        getStringProperty(memoryEvent.payload, "responseMessageId") !==
          event.responseMessageId
      ) {
        continue;
      }
      await ctx.db.patch("memoryWorkflowEvents", memoryEvent._id, {
        status: "ignored",
        processedAt: now,
      });
      applied = true;
    }

    const prospect = await ctx.db.get("prospects", args.prospectId);
    let restoredProspect = false;
    if (prospect?.status === "in_progress") {
      const timestamps = prospect.stageTimestamps;
      await ctx.db.patch("prospects", prospect._id, {
        status: "contacted",
        pipelineStage: "contacted",
        stageTimestamps: {
          new: timestamps?.new,
          contacted: timestamps?.contacted ?? now,
          converted: timestamps?.converted,
          archived: timestamps?.archived,
        },
        updatedAt: now,
      });
      applied = true;
      restoredProspect = true;
    }

    return {
      applied,
      dismissedNotificationCount,
      deletedActivityCount,
      restoredProspect,
    };
  },
});

/**
 * Lists only paused, failed LinkedIn DM/comment tasks. This is intentionally
 * bounded and read-only so the production recovery action can be dry-run
 * first without scanning or mutating the entire outreach history.
 */
export const listFailedLinkedInOutreachRecoveryCandidatesInternal =
  internalQuery({
    args: {
      limit: v.number(),
      workspaceId: v.optional(v.id("workspaces")),
    },
    returns: v.array(linkedInRecoveryCandidateValidator),
    handler: async (ctx, args): Promise<LinkedInRecoveryCandidate[]> => {
      const limit = Math.min(50, Math.max(1, Math.floor(args.limit)));
      const plans = args.workspaceId
        ? await ctx.db
            .query("outreachPlans")
            .withIndex("by_workspace_status", (q) =>
              q.eq("workspaceId", args.workspaceId!).eq("status", "paused")
            )
            .order("desc")
            .take(limit)
        : await ctx.db
            .query("outreachPlans")
            .withIndex("by_status", (q) => q.eq("status", "paused"))
            .order("desc")
            .take(limit);
      const candidates: LinkedInRecoveryCandidate[] = [];

      for (const plan of plans) {
        const prospect = await ctx.db.get("prospects", plan.prospectId);
        if (
          !prospect ||
          prospect.status === "archived" ||
          plan.archiveHold ||
          prospect.platform !== "linkedin"
        ) {
          continue;
        }

        const failedTasks = await ctx.db
          .query("outreachTasks")
          .withIndex("by_plan_status", (q) =>
            q.eq("planId", plan._id).eq("status", "failed")
          )
          .take(20);

        for (const task of failedTasks) {
          if (
            task.supersededAt !== undefined ||
            (task.type !== "dm" && task.type !== "comment")
          ) {
            continue;
          }
          const errorRecord = getNestedRecord(task.resultData, "error");
          const errorMessage =
            task.errorMessage ?? getStringProperty(errorRecord, "message");

          const activeRecoveryMonitor = await ctx.db
            .query("outreachRecoveryMonitors")
            .withIndex("by_task_and_kind", (q) => q.eq("taskId", task._id))
            .filter((q) => q.eq(q.field("status"), "active"))
            .first();

          candidates.push({
            planId: plan._id,
            taskId: task._id,
            prospectId: plan.prospectId,
            userId: plan.userId,
            taskType: task.type,
            targetTweetId: task.targetTweetId,
            errorMessage,
            hasActiveRecoveryMonitor: activeRecoveryMonitor !== null,
            hasPostedArtifact:
              getPostedOutreachArtifactId(task, task.resultData) !== null,
          });
          if (candidates.length >= limit) return candidates;
        }
      }

      return candidates;
    },
  });

export const resetFailedLinkedInDmForRecovery = internalMutation({
  args: {
    taskId: v.id("outreachTasks"),
    planId: v.id("outreachPlans"),
  },
  returns: v.object({ applied: v.boolean() }),
  handler: async (ctx, args) => {
    const task = await ctx.db.get("outreachTasks", args.taskId);
    const plan = await ctx.db.get("outreachPlans", args.planId);
    const prospect = plan
      ? await ctx.db.get("prospects", plan.prospectId)
      : null;
    if (
      !task ||
      !plan ||
      !prospect ||
      task.planId !== plan._id ||
      task.supersededAt !== undefined ||
      task.type !== "dm" ||
      task.status !== "failed" ||
      plan.status !== "paused" ||
      plan.archiveHold ||
      prospect.status === "archived"
    ) {
      return { applied: false };
    }
    if (getPostedOutreachArtifactId(task, task.resultData) !== null) {
      return { applied: false };
    }

    const activeMonitor = await ctx.db
      .query("outreachRecoveryMonitors")
      .withIndex("by_task_and_kind", (q) => q.eq("taskId", task._id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    if (activeMonitor) return { applied: false };

    await ctx.db.patch(task._id, {
      status: "pending",
      resultData: undefined,
      errorMessage: undefined,
      executedAt: undefined,
      scheduledAt: undefined,
      statusBridgeState: undefined,
      statusBridgeSentAt: undefined,
    });
    return { applied: true };
  },
});

export const updateLinkedInCommentTargetForRecovery = internalMutation({
  args: {
    taskId: v.id("outreachTasks"),
    planId: v.id("outreachPlans"),
    resolvedSocialId: v.string(),
  },
  returns: v.object({ applied: v.boolean() }),
  handler: async (ctx, args) => {
    const task = await ctx.db.get("outreachTasks", args.taskId);
    const plan = await ctx.db.get("outreachPlans", args.planId);
    const prospect = plan
      ? await ctx.db.get("prospects", plan.prospectId)
      : null;
    if (
      !task ||
      !plan ||
      !prospect ||
      task.planId !== plan._id ||
      task.supersededAt !== undefined ||
      task.type !== "comment" ||
      task.status !== "failed" ||
      plan.status !== "paused" ||
      plan.archiveHold ||
      prospect.status === "archived"
    ) {
      return { applied: false };
    }
    const resolvedSocialId = args.resolvedSocialId.trim();
    if (!resolvedSocialId || task.targetTweetId === resolvedSocialId) {
      return { applied: false };
    }

    await ctx.db.patch(task._id, {
      targetTweetId: resolvedSocialId,
    });
    return { applied: true };
  },
});

export const resetFailedLinkedInCommentForRecovery = internalMutation({
  args: {
    taskId: v.id("outreachTasks"),
    planId: v.id("outreachPlans"),
    resolvedSocialId: v.string(),
  },
  returns: v.object({ applied: v.boolean(), targetUpdated: v.boolean() }),
  handler: async (ctx, args) => {
    const task = await ctx.db.get("outreachTasks", args.taskId);
    const plan = await ctx.db.get("outreachPlans", args.planId);
    const prospect = plan
      ? await ctx.db.get("prospects", plan.prospectId)
      : null;
    const resolvedSocialId = args.resolvedSocialId.trim();
    const errorRecord = getNestedRecord(task?.resultData, "error");
    const errorMessage =
      task?.errorMessage ?? getStringProperty(errorRecord, "message");
    if (
      !task ||
      !plan ||
      !prospect ||
      !isSafeLinkedInCommentTargetRecoveryError(errorMessage) ||
      !resolvedSocialId ||
      task.planId !== plan._id ||
      task.supersededAt !== undefined ||
      task.type !== "comment" ||
      task.status !== "failed" ||
      plan.status !== "paused" ||
      plan.archiveHold ||
      prospect.status === "archived" ||
      getPostedOutreachArtifactId(task, task.resultData) !== null
    ) {
      return { applied: false, targetUpdated: false };
    }

    const activeRecoveryMonitor = await ctx.db
      .query("outreachRecoveryMonitors")
      .withIndex("by_task_and_kind", (q) => q.eq("taskId", task._id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    if (activeRecoveryMonitor || task.targetTweetId === resolvedSocialId) {
      return { applied: false, targetUpdated: false };
    }

    await ctx.db.patch(task._id, {
      status: "pending",
      targetTweetId: resolvedSocialId,
      resultData: undefined,
      errorMessage: undefined,
      executedAt: undefined,
      scheduledAt: undefined,
      statusBridgeState: undefined,
      statusBridgeSentAt: undefined,
    });
    return { applied: true, targetUpdated: true };
  },
});

export const resumeRecoveredLinkedInDmPlan = internalMutation({
  args: {
    planId: v.id("outreachPlans"),
  },
  returns: v.object({ resumed: v.boolean() }),
  handler: async (ctx, args) => {
    const plan = await ctx.db.get("outreachPlans", args.planId);
    if (!plan || plan.status !== "paused") return { resumed: false };
    const prospect = await ctx.db.get("prospects", plan.prospectId);
    if (!prospect || prospect.status === "archived" || plan.archiveHold) {
      return { resumed: false };
    }

    const tasks = await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan_order", (q) => q.eq("planId", plan._id))
      .take(101);
    if (tasks.length > 100) {
      return { resumed: false };
    }
    const activeTasks = tasks.filter((task) => task.supersededAt === undefined);
    if (
      activeTasks.some(
        (task) =>
          task.status === "waiting_connection" ||
          task.status === "waiting_manual" ||
          task.status === "waiting_response"
      )
    ) {
      return { resumed: false };
    }
    if (activeTasks.some((task) => task.status === "failed")) {
      return { resumed: false };
    }
    if (
      !activeTasks.some(
        (task) => task.status === "pending" || task.status === "scheduled"
      )
    ) {
      return { resumed: false };
    }

    const now = getCurrentUTCTimestamp();
    await ctx.db.patch(plan._id, {
      status: "approved",
      workflowId: undefined,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.workflows.outreach.startOutreachWorkflow,
      { planId: plan._id }
    );
    return { resumed: true };
  },
});

export const recoverFailedLinkedInOutreach = internalAction({
  args: {
    dryRun: v.boolean(),
    limit: v.optional(v.number()),
    workspaceId: v.optional(v.id("workspaces")),
  },
  returns: v.object({
    dryRun: v.boolean(),
    inspectedCount: v.number(),
    wouldResumeCount: v.number(),
    resumedCount: v.number(),
    commentTargetsUpdatedCount: v.number(),
    requiresReviewCount: v.number(),
    decisions: v.array(
      v.object({
        planId: v.id("outreachPlans"),
        taskId: v.id("outreachTasks"),
        taskType: v.union(v.literal("dm"), v.literal("comment")),
        outcome: v.union(
          v.literal("would_resume"),
          v.literal("resumed"),
          v.literal("comment_target_ready"),
          v.literal("comment_target_updated"),
          v.literal("requires_review"),
          v.literal("skipped")
        ),
        reason: v.string(),
        resolvedSocialId: v.optional(v.string()),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const candidates: LinkedInRecoveryCandidate[] = await ctx.runQuery(
      internalRecovery.listFailedLinkedInOutreachRecoveryCandidatesInternal,
      {
        limit: args.limit ?? 25,
        workspaceId: args.workspaceId,
      }
    );
    const decisions: Array<{
      planId: Id<"outreachPlans">;
      taskId: Id<"outreachTasks">;
      taskType: "dm" | "comment";
      outcome:
        | "would_resume"
        | "resumed"
        | "comment_target_ready"
        | "comment_target_updated"
        | "requires_review"
        | "skipped";
      reason: string;
      resolvedSocialId?: string;
    }> = [];
    const plansToResume = new Set<Id<"outreachPlans">>();
    const resetDecisionIndexesByPlan = new Map<Id<"outreachPlans">, number[]>();
    let wouldResumeCount = 0;
    let resumedCount = 0;
    let commentTargetsUpdatedCount = 0;
    let requiresReviewCount = 0;

    for (const candidate of candidates) {
      if (candidate.hasActiveRecoveryMonitor) {
        decisions.push({
          planId: candidate.planId,
          taskId: candidate.taskId,
          taskType: candidate.taskType,
          outcome: "skipped",
          reason: "An active LinkedIn recovery monitor already owns this task.",
        });
        continue;
      }

      if (candidate.hasPostedArtifact) {
        requiresReviewCount += 1;
        decisions.push({
          planId: candidate.planId,
          taskId: candidate.taskId,
          taskType: candidate.taskType,
          outcome: "requires_review",
          reason:
            "The provider recorded an external artifact for this task, so it was not retried automatically.",
        });
        continue;
      }

      if (candidate.taskType === "dm") {
        let relationship: {
          status: LinkedInRelationshipStatus;
          hasExistingConversation: boolean;
        };
        try {
          relationship = await ctx.runAction(
            internal.linkedin.getLinkedInProspectRelationshipInternal,
            {
              userId: candidate.userId,
              prospectId: candidate.prospectId,
            }
          );
        } catch (error) {
          relationship = {
            status: "unknown",
            hasExistingConversation: false,
          };
          console.warn("[OutreachRecovery] LinkedIn eligibility check failed", {
            taskId: String(candidate.taskId),
            error: error instanceof Error ? error.message : String(error),
          });
        }

        if (
          !isLinkedInDmEligible(
            relationship.status,
            relationship.hasExistingConversation
          )
        ) {
          requiresReviewCount += 1;
          decisions.push({
            planId: candidate.planId,
            taskId: candidate.taskId,
            taskType: candidate.taskType,
            outcome: "requires_review",
            reason:
              "The live LinkedIn relationship is not eligible for messaging, and no existing conversation was verified. The task was left failed and the plan remains paused.",
          });
          continue;
        }

        if (args.dryRun) {
          wouldResumeCount += 1;
          decisions.push({
            planId: candidate.planId,
            taskId: candidate.taskId,
            taskType: candidate.taskType,
            outcome: "would_resume",
            reason:
              "An accepted connection or existing LinkedIn conversation was verified. The failed task is safe to retry.",
          });
          continue;
        }

        const reset = await ctx.runMutation(
          internalRecovery.resetFailedLinkedInDmForRecovery,
          {
            taskId: candidate.taskId,
            planId: candidate.planId,
          }
        );
        if (!reset.applied) {
          decisions.push({
            planId: candidate.planId,
            taskId: candidate.taskId,
            taskType: candidate.taskType,
            outcome: "skipped",
            reason:
              "The task changed state before recovery applied; no duplicate retry was scheduled.",
          });
          continue;
        }
        plansToResume.add(candidate.planId);
        resumedCount += 1;
        const decisionIndexes =
          resetDecisionIndexesByPlan.get(candidate.planId) ?? [];
        decisionIndexes.push(decisions.length);
        resetDecisionIndexesByPlan.set(candidate.planId, decisionIndexes);
        decisions.push({
          planId: candidate.planId,
          taskId: candidate.taskId,
          taskType: candidate.taskType,
          outcome: "resumed",
          reason:
            "An accepted connection or existing LinkedIn conversation was verified, so the failed task was reset for one idempotent workflow retry.",
        });
        continue;
      }

      if (!candidate.targetTweetId) {
        requiresReviewCount += 1;
        decisions.push({
          planId: candidate.planId,
          taskId: candidate.taskId,
          taskType: candidate.taskType,
          outcome: "requires_review",
          reason:
            "The failed LinkedIn comment has no target post ID, so it was not changed or retried.",
        });
        continue;
      }

      try {
        const resolved = await ctx.runAction(
          internal.linkedin.resolveLinkedInPostSocialIdInternal,
          {
            userId: candidate.userId,
            prospectId: candidate.prospectId,
            postId: candidate.targetTweetId,
          }
        );
        if (args.dryRun) {
          const canRetry =
            isSafeLinkedInCommentTargetRecoveryError(candidate.errorMessage) &&
            resolved.resolvedSocialId !== candidate.targetTweetId;
          if (canRetry) {
            wouldResumeCount += 1;
            decisions.push({
              planId: candidate.planId,
              taskId: candidate.taskId,
              taskType: candidate.taskType,
              outcome: "would_resume",
              reason:
                "The failure was a pre-write LinkedIn target-resolution error. The canonical social_id was resolved, so the comment is safe to retry through the normal workflow.",
              resolvedSocialId: resolved.resolvedSocialId,
            });
          } else if (resolved.resolvedSocialId === candidate.targetTweetId) {
            requiresReviewCount += 1;
            decisions.push({
              planId: candidate.planId,
              taskId: candidate.taskId,
              taskType: candidate.taskType,
              outcome: "requires_review",
              reason:
                "The canonical LinkedIn social_id matches the failed target, so the comment was not retried automatically.",
              resolvedSocialId: resolved.resolvedSocialId,
            });
          } else {
            requiresReviewCount += 1;
            decisions.push({
              planId: candidate.planId,
              taskId: candidate.taskId,
              taskType: candidate.taskType,
              outcome: "comment_target_ready",
              reason:
                "The LinkedIn post resolved successfully. The canonical social_id is ready for a user-approved retry; the failure was not classified as a safe pre-write target error.",
              resolvedSocialId: resolved.resolvedSocialId,
            });
          }
          continue;
        }

        const canRetry =
          isSafeLinkedInCommentTargetRecoveryError(candidate.errorMessage) &&
          resolved.resolvedSocialId !== candidate.targetTweetId;
        if (canRetry) {
          const reset = await ctx.runMutation(
            internalRecovery.resetFailedLinkedInCommentForRecovery,
            {
              taskId: candidate.taskId,
              planId: candidate.planId,
              resolvedSocialId: resolved.resolvedSocialId,
            }
          );
          if (reset.applied) {
            commentTargetsUpdatedCount += 1;
            plansToResume.add(candidate.planId);
            resumedCount += 1;
            const decisionIndexes =
              resetDecisionIndexesByPlan.get(candidate.planId) ?? [];
            decisionIndexes.push(decisions.length);
            resetDecisionIndexesByPlan.set(candidate.planId, decisionIndexes);
            decisions.push({
              planId: candidate.planId,
              taskId: candidate.taskId,
              taskType: candidate.taskType,
              outcome: "resumed",
              reason:
                "The failure was a pre-write LinkedIn target-resolution error. The canonical social_id was stored and the comment was reset for one idempotent workflow retry.",
              resolvedSocialId: resolved.resolvedSocialId,
            });
          } else {
            decisions.push({
              planId: candidate.planId,
              taskId: candidate.taskId,
              taskType: candidate.taskType,
              outcome: "skipped",
              reason:
                "The task changed state before the safe comment retry applied; no duplicate retry was scheduled.",
              resolvedSocialId: resolved.resolvedSocialId,
            });
          }
        } else if (resolved.resolvedSocialId === candidate.targetTweetId) {
          requiresReviewCount += 1;
          decisions.push({
            planId: candidate.planId,
            taskId: candidate.taskId,
            taskType: candidate.taskType,
            outcome: "requires_review",
            reason:
              "The canonical LinkedIn social_id matches the failed target, so the comment was not retried automatically.",
            resolvedSocialId: resolved.resolvedSocialId,
          });
        } else {
          requiresReviewCount += 1;
          const updated = await ctx.runMutation(
            internalRecovery.updateLinkedInCommentTargetForRecovery,
            {
              taskId: candidate.taskId,
              planId: candidate.planId,
              resolvedSocialId: resolved.resolvedSocialId,
            }
          );
          if (updated.applied) commentTargetsUpdatedCount += 1;
          decisions.push({
            planId: candidate.planId,
            taskId: candidate.taskId,
            taskType: candidate.taskType,
            outcome: updated.applied
              ? "comment_target_updated"
              : "comment_target_ready",
            reason:
              "The canonical LinkedIn social_id was resolved and stored. The failed comment remains paused for review because the failure was not classified as a safe pre-write target error.",
            resolvedSocialId: resolved.resolvedSocialId,
          });
        }
      } catch (error) {
        requiresReviewCount += 1;
        decisions.push({
          planId: candidate.planId,
          taskId: candidate.taskId,
          taskType: candidate.taskType,
          outcome: "requires_review",
          reason: `The LinkedIn post could not be resolved safely: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }
    }

    if (!args.dryRun) {
      for (const planId of plansToResume) {
        const resumed = await ctx.runMutation(
          internalRecovery.resumeRecoveredLinkedInDmPlan,
          { planId }
        );
        if (!resumed.resumed) {
          const decisionIndexes = resetDecisionIndexesByPlan.get(planId) ?? [];
          resumedCount -= decisionIndexes.length;
          requiresReviewCount += decisionIndexes.length;
          for (const decisionIndex of decisionIndexes) {
            decisions[decisionIndex] = {
              ...decisions[decisionIndex],
              outcome: "requires_review",
              reason:
                "The task was reset safely, but another failed or waiting task remains in this plan. The plan stays paused to avoid skipping unresolved outreach.",
            };
          }
        }
      }
    }

    return {
      dryRun: args.dryRun,
      inspectedCount: candidates.length,
      wouldResumeCount,
      resumedCount,
      commentTargetsUpdatedCount,
      requiresReviewCount,
      decisions,
    };
  },
});

async function expireInactiveTwitterManualReplyMonitor(
  ctx: MutationCtx,
  monitor: RecoveryMonitor
) {
  if (monitor.status !== "active") return;

  const now = getCurrentUTCTimestamp();
  await ctx.db.patch("outreachRecoveryMonitors", monitor._id, {
    status: "expired",
    lastCheckedAt: now,
    nextCheckAt: undefined,
    completedAt: now,
    lastErrorMessage: "The outreach plan or task is no longer active.",
  });
  if (monitor.taskId) {
    await dismissNotificationsByKey(ctx, {
      userId: monitor.userId,
      workspaceId: monitor.workspaceId,
      notificationKey: `manual-x-reply:${monitor.taskId}`,
    });
  }
}

async function syncTwitterManualReplyNotification(
  ctx: MutationCtx,
  monitor: RecoveryMonitor,
  status: TwitterManualReplyMonitoringStatus
) {
  if (!monitor.taskId || !monitor.planId) {
    await expireInactiveTwitterManualReplyMonitor(ctx, monitor);
    return;
  }

  const [task, plan, prospect] = await Promise.all([
    ctx.db.get("outreachTasks", monitor.taskId),
    ctx.db.get("outreachPlans", monitor.planId),
    ctx.db.get("prospects", monitor.prospectId),
  ]);
  if (
    !task ||
    !plan ||
    task.status !== "waiting_manual" ||
    plan.status === "completed" ||
    plan.status === "abandoned"
  ) {
    await expireInactiveTwitterManualReplyMonitor(ctx, monitor);
    return;
  }

  if (plan.status !== "paused") {
    await ctx.db.patch("outreachPlans", plan._id, {
      status: "paused",
      updatedAt: getCurrentUTCTimestamp(),
    });
  }

  const postUrl = buildTwitterPostUrl({ postId: monitor.sourcePostId });
  const notificationKey = `manual-x-reply:${task._id}`;
  const copy =
    status === "ready"
      ? {
          type: "ask_human" as const,
          title: "Post this reply manually on X/Twitter",
          message: `X/Twitter blocked automatic posting. Open the post and publish the prepared reply: ${postUrl}\n\nReacherX will continue the plan automatically when your reply appears on X/Twitter.`,
          targetHref: undefined,
          actionLabel: undefined,
        }
      : status === "reconnect_required"
        ? {
            type: "error" as const,
            title: "Reconnect X/Twitter to continue",
            message: `Your plan is paused because ReacherX cannot watch for your manual reply until X/Twitter is connected. Reconnect X/Twitter, then publish the prepared reply: ${postUrl}`,
            targetHref: "/settings/connected-accounts",
            actionLabel: "Reconnect",
          }
        : {
            type: "error" as const,
            title: "X/Twitter monitoring is being set up",
            message: `Your plan is paused while ReacherX finishes setting up X/Twitter monitoring. We’ll try again automatically. You can publish the prepared reply here when ready: ${postUrl}`,
            targetHref: undefined,
            actionLabel: undefined,
          };
  const display = getProspectDisplayFields(prospect);
  const existing = await ctx.db
    .query("outreachNotifications")
    .withIndex("by_user_workspace_key", (q) =>
      q
        .eq("userId", monitor.userId)
        .eq("workspaceId", monitor.workspaceId)
        .eq("notificationKey", notificationKey)
    )
    .first();
  const isUnchanged =
    existing?.type === copy.type &&
    existing.title === copy.title &&
    existing.message === copy.message &&
    existing.targetHref === copy.targetHref &&
    existing.actionLabel === copy.actionLabel;
  if (isUnchanged) return;

  await upsertNotificationByKey(ctx, {
    userId: monitor.userId,
    workspaceId: monitor.workspaceId,
    type: copy.type,
    notificationKey,
    title: copy.title,
    message: copy.message,
    targetHref: copy.targetHref,
    actionLabel: copy.actionLabel,
    prospectId: monitor.prospectId,
    planId: monitor.planId,
    taskId: monitor.taskId,
    threadId: plan.threadId,
    contextPlatform: "twitter",
    ...display,
  });
}

async function resumeDmAfterLinkedInConnection(
  ctx: MutationCtx,
  monitor: RecoveryMonitor
) {
  if (!monitor.taskId || !monitor.planId) return;
  const task = await ctx.db.get("outreachTasks", monitor.taskId);
  const plan = await ctx.db.get("outreachPlans", monitor.planId);
  if (!task || !plan || task.planId !== plan._id) return;

  const now = getCurrentUTCTimestamp();
  await ctx.db.patch("outreachRecoveryMonitors", monitor._id, {
    status: "completed",
    detectedAt: now,
    completedAt: now,
    lastCheckedAt: now,
    nextCheckAt: undefined,
  });
  await ctx.db.patch("outreachTasks", task._id, {
    status: "pending",
    errorMessage: undefined,
    statusBridgeState: undefined,
    statusBridgeSentAt: undefined,
  });
  await ctx.db.patch("outreachPlans", plan._id, {
    status: "approved",
    workflowId: undefined,
    updatedAt: now,
  });
  await ctx.scheduler.runAfter(
    1_000,
    internal.workflows.outreach.startOutreachWorkflow,
    { planId: plan._id }
  );

  const prospect = await ctx.db.get("prospects", plan.prospectId);
  await upsertNotificationByKey(ctx, {
    userId: plan.userId,
    workspaceId: plan.workspaceId,
    type: "outreach_sent",
    notificationKey: `linkedin-connection-resumed:${task._id}`,
    title: "LinkedIn connection accepted",
    message: "ReacherX is sending the approved DM automatically.",
    prospectId: plan.prospectId,
    planId: plan._id,
    taskId: task._id,
    threadId: plan.threadId,
    contextPlatform: "linkedin",
    ...getProspectDisplayFields(prospect),
  });
}

async function fetchSocialApiJson<T>(
  ctx: ActionCtx,
  consumer: string,
  path: string,
  params?: URLSearchParams
): Promise<T> {
  const apiKey = process.env.SOCIALAPI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("SOCIALAPI_API_KEY is not set");
  }

  const response = await fetchSocialApi(
    ctx,
    consumer,
    `${SOCIALAPI_BASE_URL}${path}${params ? `?${params.toString()}` : ""}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    }
  );
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `SocialAPI request failed (${response.status}): ${body.slice(0, 500)}`
    );
  }
  return JSON.parse(body) as T;
}

function getTweetReplyTargetId(tweet: unknown): string | undefined {
  const record = getNestedRecord({ tweet }, "tweet");
  return (
    getStringProperty(record, "in_reply_to_status_id_str") ??
    getStringProperty(record, "inReplyToTweetId")
  );
}

export const beginTwitterManualReplyRecovery = internalAction({
  args: {
    taskId: v.id("outreachTasks"),
    planId: v.id("outreachPlans"),
    errorMessage: v.string(),
  },
  returns: v.object({
    started: v.boolean(),
    monitorId: v.optional(v.id("outreachRecoveryMonitors")),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    started: boolean;
    monitorId?: Id<"outreachRecoveryMonitors">;
  }> => {
    const planData = await ctx.runQuery(internal.outreach.getPlanInternal, {
      planId: args.planId,
    });
    const task = planData?.tasks.find(
      (candidate: Doc<"outreachTasks">) => candidate._id === args.taskId
    );
    if (!planData?.plan || !task?.targetTweetId) {
      return { started: false };
    }

    let monitoringStatus: TwitterManualReplyMonitoringStatus = "configuring";
    try {
      const connection = await ctx.runAction(
        internal.x.getTwitterConnectionIdentityInternal,
        { userId: planData.plan.userId }
      );
      if (!connection.isConnected || !connection.xUserId) {
        monitoringStatus = "reconnect_required";
      } else {
        const ensured = await ctx.runAction(
          internal.xActivity
            .ensurePostCreateActivitySubscriptionForUserInternal,
          { userId: planData.plan.userId }
        );
        monitoringStatus = ensured.ensured
          ? "ready"
          : ensured.reason === "missing_connection" ||
              ensured.reason === "missing_scopes"
            ? "reconnect_required"
            : "configuring";
      }
    } catch (error) {
      console.warn(
        "[OutreachRecovery] Unable to prepare X/Twitter monitoring",
        {
          taskId: String(args.taskId),
          userId: String(planData.plan.userId),
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }

    const monitorId = await ctx.runMutation(
      internalRecovery.startTwitterManualReplyRecovery,
      {
        taskId: args.taskId,
        planId: args.planId,
        errorMessage: args.errorMessage,
        monitoringStatus,
      }
    );
    if (monitoringStatus !== "ready") {
      await ctx.scheduler.runAfter(
        0,
        internalRecovery.ensureTwitterManualReplyRecoveryForUserInternal,
        { userId: planData.plan.userId }
      );
    }
    return { started: true, monitorId };
  },
});

export const beginLinkedInConnectionThenDmRecovery = internalAction({
  args: {
    taskId: v.id("outreachTasks"),
    planId: v.id("outreachPlans"),
    errorMessage: v.string(),
  },
  returns: v.object({ started: v.boolean() }),
  handler: async (ctx, args) => {
    const planData = await ctx.runQuery(internal.outreach.getPlanInternal, {
      planId: args.planId,
    });
    const task = planData?.tasks.find(
      (candidate: Doc<"outreachTasks">) => candidate._id === args.taskId
    );
    if (
      !planData?.plan ||
      !task ||
      task.type !== "dm" ||
      task.approvalContext?.platform !== "linkedin"
    ) {
      return { started: false };
    }

    const invitation = await ctx.runAction(
      internal.linkedin.sendLinkedInRecoveryInvitationInternal,
      {
        userId: planData.plan.userId,
        prospectId: planData.plan.prospectId,
      }
    );
    if (invitation.outcome === "failed") {
      console.warn(
        "[OutreachRecovery] LinkedIn connect-first recovery failed",
        {
          taskId: String(task._id),
          classification: invitation.errorClass,
          message: invitation.errorMessage,
        }
      );
      return { started: false };
    }

    if (invitation.outcome === "already_connected") {
      return { started: false };
    }

    await ctx.runMutation(
      internalRecovery.startLinkedInConnectionThenDmRecovery,
      {
        taskId: task._id,
        planId: planData.plan._id,
        sourcePostId:
          invitation.targetUserId ?? String(planData.plan.prospectId),
        errorMessage: args.errorMessage,
        invitationOutcome: invitation.outcome,
      }
    );
    return { started: true };
  },
});

export const startLinkedInConnectionThenDmRecovery = internalMutation({
  args: {
    taskId: v.id("outreachTasks"),
    planId: v.id("outreachPlans"),
    sourcePostId: v.string(),
    errorMessage: v.string(),
    invitationOutcome: v.union(
      v.literal("invitation_sent"),
      v.literal("invitation_pending")
    ),
  },
  returns: v.id("outreachRecoveryMonitors"),
  handler: async (ctx, args) => {
    const task = await ctx.db.get("outreachTasks", args.taskId);
    const plan = await ctx.db.get("outreachPlans", args.planId);
    if (!task || !plan || task.planId !== plan._id || task.type !== "dm") {
      throw new Error("LinkedIn DM task is unavailable for recovery");
    }

    const existing = (
      await ctx.db
        .query("outreachRecoveryMonitors")
        .withIndex("by_task_and_kind", (q) =>
          q.eq("taskId", task._id).eq("kind", "linkedin_connection_then_dm")
        )
        .order("desc")
        .take(5)
    ).find((monitor) => monitor.status === "active");
    if (existing) return existing._id;

    const now = getCurrentUTCTimestamp();
    const monitorId = await ctx.db.insert("outreachRecoveryMonitors", {
      userId: plan.userId,
      workspaceId: plan.workspaceId,
      prospectId: plan.prospectId,
      planId: plan._id,
      taskId: task._id,
      kind: "linkedin_connection_then_dm",
      stage: "awaiting_connection",
      status: "active",
      sourcePostId: args.sourcePostId,
      expectedText: task.content,
      startedAt: now,
      expiresAt: now + LINKEDIN_CONNECTION_WINDOW_MS,
      attemptCount: 0,
      nextCheckAt: now + getRecoveryNextCheckDelayMs("awaiting_connection", 0),
    });
    await ctx.db.patch("outreachTasks", task._id, {
      status: "waiting_connection",
      errorMessage: args.errorMessage,
      executedAt: now,
      statusBridgeState: undefined,
      statusBridgeSentAt: undefined,
    });
    await ctx.db.patch("outreachPlans", plan._id, {
      status: "paused",
      updatedAt: now,
    });

    const prospect = await ctx.db.get("prospects", plan.prospectId);
    const requestMessage =
      args.invitationOutcome === "invitation_pending"
        ? "The DM requires a connection. An existing LinkedIn connection request is still pending; ReacherX will send the approved DM automatically after acceptance."
        : "The DM requires a connection. ReacherX sent the connection request and will send the approved DM automatically after acceptance.";
    await upsertNotificationByKey(ctx, {
      userId: plan.userId,
      workspaceId: plan.workspaceId,
      type: "outreach_sent",
      notificationKey: `linkedin-connect-first:${task._id}`,
      title:
        args.invitationOutcome === "invitation_pending"
          ? "LinkedIn connection request pending"
          : "Connection request sent on LinkedIn",
      message: requestMessage,
      prospectId: plan.prospectId,
      planId: plan._id,
      taskId: task._id,
      threadId: plan.threadId,
      contextPlatform: "linkedin",
      ...getProspectDisplayFields(prospect),
    });
    await ctx.scheduler.runAfter(
      getRecoveryNextCheckDelayMs("awaiting_connection", 0),
      internalRecovery.checkRecoveryMonitor,
      { monitorId }
    );
    return monitorId;
  },
});

export const onLinkedInConnectionAccepted = internalMutation({
  args: { prospectId: v.id("prospects") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const monitors = await ctx.db
      .query("outreachRecoveryMonitors")
      .withIndex("by_prospect_and_status", (q) =>
        q.eq("prospectId", args.prospectId).eq("status", "active")
      )
      .take(20);
    const connectionMonitors = monitors.filter(
      (monitor) => monitor.kind === "linkedin_connection_then_dm"
    );
    for (const monitor of connectionMonitors) {
      await resumeDmAfterLinkedInConnection(ctx, monitor);
    }
    return connectionMonitors.length;
  },
});

export const startTwitterManualReplyRecovery = internalMutation({
  args: {
    taskId: v.id("outreachTasks"),
    planId: v.id("outreachPlans"),
    errorMessage: v.string(),
    monitoringStatus: v.optional(
      v.union(
        v.literal("ready"),
        v.literal("reconnect_required"),
        v.literal("configuring")
      )
    ),
  },
  returns: v.id("outreachRecoveryMonitors"),
  handler: async (ctx, args) => {
    const task = await ctx.db.get("outreachTasks", args.taskId);
    const plan = await ctx.db.get("outreachPlans", args.planId);
    if (!task || !plan || task.planId !== plan._id || !task.targetTweetId) {
      throw new Error("Outreach task is unavailable for manual recovery");
    }

    const existing = (
      await ctx.db
        .query("outreachRecoveryMonitors")
        .withIndex("by_task_and_kind", (q) =>
          q.eq("taskId", task._id).eq("kind", "twitter_manual_reply")
        )
        .order("desc")
        .take(5)
    ).find((monitor) => monitor.status === "active");
    const monitoringStatus = args.monitoringStatus ?? "ready";
    if (existing) {
      await syncTwitterManualReplyNotification(ctx, existing, monitoringStatus);
      return existing._id;
    }

    const now = getCurrentUTCTimestamp();
    const monitorId = await ctx.db.insert("outreachRecoveryMonitors", {
      userId: plan.userId,
      workspaceId: plan.workspaceId,
      prospectId: plan.prospectId,
      planId: plan._id,
      taskId: task._id,
      kind: "twitter_manual_reply",
      stage: "detecting_outbound",
      status: "active",
      sourcePostId: task.targetTweetId,
      startedAt: now,
      attemptCount: 0,
    });

    await ctx.db.patch("outreachTasks", task._id, {
      status: "waiting_manual",
      errorMessage: args.errorMessage,
      executedAt: now,
      statusBridgeState: undefined,
      statusBridgeSentAt: undefined,
    });
    await ctx.db.patch("outreachPlans", plan._id, {
      status: "paused",
      updatedAt: now,
    });

    const monitor = await ctx.db.get("outreachRecoveryMonitors", monitorId);
    if (monitor) {
      await syncTwitterManualReplyNotification(ctx, monitor, monitoringStatus);
    }

    // Detection is event-driven via X/Twitter Activity `post.create`. There is no
    // polling deadline while the task remains waiting_manual.
    return monitorId;
  },
});

export const startLinkedInCommentReplyMonitor = internalMutation({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    sourcePostId: v.string(),
    commentId: v.optional(v.string()),
    parentCommentId: v.optional(v.string()),
    expectedText: v.string(),
    planId: v.optional(v.id("outreachPlans")),
  },
  returns: v.id("outreachRecoveryMonitors"),
  handler: async (ctx, args) => {
    const prospect = await ctx.db.get("prospects", args.prospectId);
    if (!prospect || prospect.userId !== args.userId) {
      throw new Error("Prospect not found for LinkedIn comment monitoring");
    }

    const plan = args.planId
      ? await ctx.db.get("outreachPlans", args.planId)
      : (
          await ctx.db
            .query("outreachPlans")
            .withIndex("by_prospect", (q) =>
              q.eq("prospectId", args.prospectId)
            )
            .order("desc")
            .take(10)
        ).find(
          (candidate) =>
            candidate.status !== "completed" && candidate.status !== "abandoned"
        );
    const active = (
      await ctx.db
        .query("outreachRecoveryMonitors")
        .withIndex("by_prospect_and_status", (q) =>
          q.eq("prospectId", args.prospectId).eq("status", "active")
        )
        .order("desc")
        .take(20)
    ).find(
      (monitor) =>
        monitor.kind === "linkedin_comment_reply" &&
        monitor.sourcePostId === args.sourcePostId &&
        (monitor.outboundArtifactId === args.commentId ||
          (!args.commentId && monitor.expectedText === args.expectedText))
    );
    if (active) return active._id;

    const now = getCurrentUTCTimestamp();
    const monitorId = await ctx.db.insert("outreachRecoveryMonitors", {
      userId: args.userId,
      workspaceId: prospect.workspaceId,
      prospectId: prospect._id,
      planId: plan?._id,
      kind: "linkedin_comment_reply",
      stage: args.commentId ? "awaiting_response" : "detecting_outbound",
      status: "active",
      sourcePostId: args.sourcePostId,
      outboundArtifactId: args.commentId,
      outboundParentArtifactId: args.parentCommentId,
      expectedText: args.expectedText,
      startedAt: now,
      expiresAt:
        now +
        (args.commentId
          ? RESPONSE_MONITOR_WINDOW_MS
          : MANUAL_OUTBOUND_DETECTION_WINDOW_MS),
      attemptCount: 0,
      nextCheckAt: now + (args.commentId ? 5 * 60 * 1000 : 30_000),
    });
    await ctx.scheduler.runAfter(
      args.commentId ? 5 * 60 * 1000 : 30_000,
      internalRecovery.checkRecoveryMonitor,
      { monitorId }
    );
    return monitorId;
  },
});

export const getRecoveryMonitorInternal = internalQuery({
  args: { monitorId: v.id("outreachRecoveryMonitors") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) =>
    await ctx.db.get("outreachRecoveryMonitors", args.monitorId),
});

export const listActiveTwitterManualReplyMonitorsPageForUserInternal =
  internalQuery({
    args: {
      userId: v.id("users"),
      paginationOpts: paginationOptsValidator,
    },
    returns: v.any(),
    handler: async (ctx, args) =>
      await ctx.db
        .query("outreachRecoveryMonitors")
        .withIndex("by_user_kind_status_source_post", (q) =>
          q
            .eq("userId", args.userId)
            .eq("kind", "twitter_manual_reply")
            .eq("status", "active")
        )
        .filter((q) => q.eq(q.field("stage"), "detecting_outbound"))
        .paginate(args.paginationOpts),
  });

export const getActiveTwitterManualReplyMonitorForSourcePostInternal =
  internalQuery({
    args: {
      userId: v.id("users"),
      sourcePostId: v.string(),
    },
    returns: v.union(v.null(), v.any()),
    handler: async (ctx, args) =>
      await ctx.db
        .query("outreachRecoveryMonitors")
        .withIndex("by_user_kind_status_source_post", (q) =>
          q
            .eq("userId", args.userId)
            .eq("kind", "twitter_manual_reply")
            .eq("status", "active")
            .eq("sourcePostId", args.sourcePostId)
        )
        .filter((q) => q.eq(q.field("stage"), "detecting_outbound"))
        .order("desc")
        .first(),
  });

export const listTwitterManualReplyRecoveryMigrationPageInternal =
  internalQuery({
    args: {
      paginationOpts: paginationOptsValidator,
    },
    returns: v.any(),
    handler: async (ctx, args) =>
      await ctx.db
        .query("outreachRecoveryMonitors")
        .withIndex("by_kind_and_status", (q) =>
          q.eq("kind", "twitter_manual_reply").eq("status", "active")
        )
        .filter((q) => q.eq(q.field("stage"), "detecting_outbound"))
        .paginate(args.paginationOpts),
  });

export const migrateTwitterManualReplyMonitorsBatchInternal = internalMutation({
  args: {
    monitorIds: v.array(v.id("outreachRecoveryMonitors")),
    monitoringStatus: v.union(
      v.literal("ready"),
      v.literal("reconnect_required"),
      v.literal("configuring")
    ),
  },
  returns: v.object({ migratedCount: v.number() }),
  handler: async (ctx, args) => {
    let migratedCount = 0;
    for (const monitorId of args.monitorIds) {
      const monitor = await ctx.db.get("outreachRecoveryMonitors", monitorId);
      if (
        !monitor ||
        monitor.status !== "active" ||
        monitor.kind !== "twitter_manual_reply" ||
        monitor.stage !== "detecting_outbound"
      ) {
        continue;
      }
      if (!monitor.taskId || !monitor.planId) {
        await expireInactiveTwitterManualReplyMonitor(ctx, monitor);
        continue;
      }

      const [task, plan] = await Promise.all([
        ctx.db.get("outreachTasks", monitor.taskId),
        ctx.db.get("outreachPlans", monitor.planId),
      ]);
      if (
        !task ||
        !plan ||
        task.status !== "waiting_manual" ||
        plan.status === "completed" ||
        plan.status === "abandoned"
      ) {
        await expireInactiveTwitterManualReplyMonitor(ctx, monitor);
        continue;
      }

      await syncTwitterManualReplyNotification(
        ctx,
        monitor,
        args.monitoringStatus
      );
      await clearTwitterManualReplyMonitorDeadline(ctx, monitor);
      migratedCount += 1;
    }
    return { migratedCount };
  },
});

/**
 * One-shot, rerunnable migration for active Twitter manual-reply recoveries.
 * It moves each recovery to indefinite X/Twitter Activity monitoring without
 * performing any SocialAPI lookup.
 */
export const migrateTwitterManualReplyRecoveriesInternal = internalAction({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processedCount: v.number(),
    migratedCount: v.number(),
    continuationScheduled: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.max(
      1,
      Math.min(Math.floor(args.batchSize ?? 25), 50)
    );
    const page = (await ctx.runQuery(
      internalRecovery.listTwitterManualReplyRecoveryMigrationPageInternal,
      {
        paginationOpts: {
          cursor: args.cursor ?? null,
          numItems: batchSize,
        },
      }
    )) as {
      page: RecoveryMonitor[];
      isDone: boolean;
      continueCursor: string;
    };

    const monitorIdsByUser = new Map<
      Id<"users">,
      Id<"outreachRecoveryMonitors">[]
    >();
    for (const monitor of page.page) {
      const monitorIds = monitorIdsByUser.get(monitor.userId) ?? [];
      monitorIds.push(monitor._id);
      monitorIdsByUser.set(monitor.userId, monitorIds);
    }

    let migratedCount = 0;
    for (const [userId, monitorIds] of monitorIdsByUser) {
      let monitoringStatus: TwitterManualReplyMonitoringStatus = "configuring";
      try {
        const ensured = await ctx.runAction(
          internalRecovery.ensureTwitterManualReplyRecoveryForUserInternal,
          { userId }
        );
        monitoringStatus = ensured.monitoringStatus;
      } catch (error) {
        console.warn("[OutreachRecovery] Recovery migration setup failed", {
          userId: String(userId),
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const result = await ctx.runMutation(
        internalRecovery.migrateTwitterManualReplyMonitorsBatchInternal,
        {
          monitorIds,
          monitoringStatus,
        }
      );
      migratedCount += result.migratedCount;
    }

    const continuationScheduled = !page.isDone;
    if (continuationScheduled) {
      await ctx.scheduler.runAfter(
        0,
        internalRecovery.migrateTwitterManualReplyRecoveriesInternal,
        {
          cursor: page.continueCursor,
          batchSize,
        }
      );
    }

    return {
      processedCount: page.page.length,
      migratedCount,
      continuationScheduled,
    };
  },
});

export const syncTwitterManualReplyRecoveryStatusForUserInternal =
  internalMutation({
    args: {
      userId: v.id("users"),
      monitorIds: v.array(v.id("outreachRecoveryMonitors")),
      monitoringStatus: v.union(
        v.literal("ready"),
        v.literal("reconnect_required"),
        v.literal("configuring")
      ),
    },
    returns: v.object({ updatedCount: v.number() }),
    handler: async (ctx, args) => {
      const monitors = (
        await Promise.all(
          args.monitorIds.map((monitorId) =>
            ctx.db.get("outreachRecoveryMonitors", monitorId)
          )
        )
      ).filter(
        (monitor): monitor is RecoveryMonitor =>
          monitor !== null &&
          monitor.userId === args.userId &&
          monitor.status === "active"
      );
      let updatedCount = 0;
      for (const monitor of monitors) {
        if (
          monitor.kind !== "twitter_manual_reply" ||
          monitor.stage !== "detecting_outbound"
        ) {
          continue;
        }
        const [task, plan] = await Promise.all([
          monitor.taskId
            ? ctx.db.get("outreachTasks", monitor.taskId)
            : Promise.resolve(null),
          monitor.planId
            ? ctx.db.get("outreachPlans", monitor.planId)
            : Promise.resolve(null),
        ]);
        if (
          !task ||
          !plan ||
          task.status !== "waiting_manual" ||
          plan.status === "completed" ||
          plan.status === "abandoned"
        ) {
          await expireInactiveTwitterManualReplyMonitor(ctx, monitor);
          continue;
        }
        await syncTwitterManualReplyNotification(
          ctx,
          monitor,
          args.monitoringStatus
        );
        updatedCount += 1;
      }
      return { updatedCount };
    },
  });

export const ensureTwitterManualReplyRecoveryForUserInternal = internalAction({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    monitoredCount: v.number(),
    monitoringStatus: v.union(
      v.literal("ready"),
      v.literal("reconnect_required"),
      v.literal("configuring")
    ),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    monitoredCount: number;
    monitoringStatus: TwitterManualReplyMonitoringStatus;
  }> => {
    const monitors: RecoveryMonitor[] = [];
    let cursor: string | null = null;
    while (true) {
      const page: RecoveryMonitorPage = await ctx.runQuery(
        internalRecovery.listActiveTwitterManualReplyMonitorsPageForUserInternal,
        {
          userId: args.userId,
          paginationOpts: {
            cursor,
            numItems: 100,
          },
        }
      );
      monitors.push(...page.page);
      if (page.isDone) break;
      cursor = page.continueCursor;
    }
    if (monitors.length === 0) {
      return { monitoredCount: 0, monitoringStatus: "ready" as const };
    }

    const account = await ctx.runQuery(
      internal.xStore.getXAccountForUserInternal,
      { userId: args.userId }
    );
    if (!account || account.status !== "connected") {
      await ctx.runMutation(
        internalRecovery.syncTwitterManualReplyRecoveryStatusForUserInternal,
        {
          userId: args.userId,
          monitorIds: monitors.map((monitor) => monitor._id),
          monitoringStatus: "reconnect_required",
        }
      );
      return {
        monitoredCount: monitors.length,
        monitoringStatus: "reconnect_required" as const,
      };
    }

    const now = getCurrentUTCTimestamp();
    const isPendingRetryWindow =
      account.postActivitySubscriptionStatus === "pending_retry" &&
      typeof account.postActivitySubscriptionsNextRetryAt === "number" &&
      account.postActivitySubscriptionsNextRetryAt > now;
    if (isPendingRetryWindow) {
      await ctx.runMutation(
        internalRecovery.syncTwitterManualReplyRecoveryStatusForUserInternal,
        {
          userId: args.userId,
          monitorIds: monitors.map((monitor) => monitor._id),
          monitoringStatus: "configuring",
        }
      );
      await ctx.scheduler.runAfter(
        Math.max(
          0,
          account.postActivitySubscriptionsNextRetryAt! -
            getCurrentUTCTimestamp()
        ),
        internalRecovery.ensureTwitterManualReplyRecoveryForUserInternal,
        { userId: args.userId }
      );
      return {
        monitoredCount: monitors.length,
        monitoringStatus: "configuring" as const,
      };
    }

    let monitoringStatus: TwitterManualReplyMonitoringStatus = "configuring";
    try {
      const ensured: {
        ensured: boolean;
        reason?: "missing_connection" | "missing_scopes";
      } = await ctx.runAction(
        internal.xActivity.ensurePostCreateActivitySubscriptionForUserInternal,
        { userId: args.userId }
      );
      monitoringStatus = ensured.ensured
        ? "ready"
        : ensured.reason === "missing_connection" ||
            ensured.reason === "missing_scopes"
          ? "reconnect_required"
          : "configuring";
    } catch (error) {
      console.warn("[OutreachRecovery] X/Twitter monitoring retry failed", {
        userId: String(args.userId),
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await ctx.runMutation(
      internalRecovery.syncTwitterManualReplyRecoveryStatusForUserInternal,
      {
        userId: args.userId,
        monitorIds: monitors.map((monitor) => monitor._id),
        monitoringStatus,
      }
    );

    if (monitoringStatus === "configuring") {
      const latestAccount = await ctx.runQuery(
        internal.xStore.getXAccountForUserInternal,
        { userId: args.userId }
      );
      const retryAt =
        typeof latestAccount?.postActivitySubscriptionsNextRetryAt === "number"
          ? latestAccount.postActivitySubscriptionsNextRetryAt
          : now + TWITTER_ACTIVITY_RETRY_DELAY_MS;
      await ctx.scheduler.runAfter(
        Math.max(0, retryAt - getCurrentUTCTimestamp()),
        internalRecovery.ensureTwitterManualReplyRecoveryForUserInternal,
        { userId: args.userId }
      );
    }

    return {
      monitoredCount: monitors.length,
      monitoringStatus,
    };
  },
});

async function clearTwitterManualReplyMonitorDeadline(
  ctx: MutationCtx,
  monitor: RecoveryMonitor
) {
  if (
    monitor.status !== "active" ||
    monitor.kind !== "twitter_manual_reply" ||
    monitor.stage !== "detecting_outbound"
  ) {
    return;
  }

  const [task, plan] = await Promise.all([
    monitor.taskId
      ? ctx.db.get("outreachTasks", monitor.taskId)
      : Promise.resolve(null),
    monitor.planId
      ? ctx.db.get("outreachPlans", monitor.planId)
      : Promise.resolve(null),
  ]);
  const now = getCurrentUTCTimestamp();
  if (
    !task ||
    !plan ||
    task.status !== "waiting_manual" ||
    plan.status === "completed" ||
    plan.status === "abandoned"
  ) {
    await expireInactiveTwitterManualReplyMonitor(ctx, monitor);
    return;
  }

  await ctx.db.patch("outreachRecoveryMonitors", monitor._id, {
    expiresAt: undefined,
    lastCheckedAt: now,
    nextCheckAt: undefined,
    lastErrorMessage: undefined,
  });
}

export const expireTwitterManualReplyDetection = internalMutation({
  args: { monitorId: v.id("outreachRecoveryMonitors") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const monitor = await ctx.db.get(
      "outreachRecoveryMonitors",
      args.monitorId
    );
    if (!monitor) return null;
    if (
      monitor.kind !== "twitter_manual_reply" ||
      monitor.stage !== "detecting_outbound" ||
      monitor.status !== "active"
    ) {
      return null;
    }
    await clearTwitterManualReplyMonitorDeadline(ctx, monitor);
    return null;
  },
});

export const recordRecoveryCheck = internalMutation({
  args: {
    monitorId: v.id("outreachRecoveryMonitors"),
    errorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const monitor = await ctx.db.get(
      "outreachRecoveryMonitors",
      args.monitorId
    );
    if (!monitor || monitor.status !== "active") return null;

    const now = getCurrentUTCTimestamp();
    if (
      monitor.kind === "twitter_manual_reply" &&
      monitor.stage === "detecting_outbound"
    ) {
      await clearTwitterManualReplyMonitorDeadline(ctx, monitor);
      return null;
    }
    if (monitor.expiresAt !== undefined && now >= monitor.expiresAt) {
      await ctx.db.patch("outreachRecoveryMonitors", monitor._id, {
        status: "expired",
        lastCheckedAt: now,
        lastErrorMessage: args.errorMessage,
        nextCheckAt: undefined,
        completedAt: now,
      });

      if (monitor.stage === "detecting_outbound" && monitor.taskId) {
        const prospect = await ctx.db.get("prospects", monitor.prospectId);
        const display = getProspectDisplayFields(prospect);
        await upsertNotificationByKey(ctx, {
          userId: monitor.userId,
          workspaceId: monitor.workspaceId,
          type: "error",
          notificationKey: `manual-x-reply-expired:${monitor.taskId}`,
          title: "Manual X/Twitter reply was not detected",
          message:
            "ReacherX could not verify a new direct reply on the selected X/Twitter post. The outreach plan remains paused so it will not send a duplicate.",
          prospectId: monitor.prospectId,
          planId: monitor.planId,
          taskId: monitor.taskId,
          contextPlatform: "twitter",
          ...display,
        });
      } else if (
        monitor.stage === "detecting_outbound" &&
        monitor.kind === "linkedin_comment_reply"
      ) {
        const prospect = await ctx.db.get("prospects", monitor.prospectId);
        const display = getProspectDisplayFields(prospect);
        await upsertNotificationByKey(ctx, {
          userId: monitor.userId,
          workspaceId: monitor.workspaceId,
          type: "error",
          notificationKey: `linkedin-comment-monitor-expired:${monitor._id}`,
          title: "LinkedIn comment monitoring could not start",
          message:
            "The comment was posted, but ReacherX could not resolve its LinkedIn comment ID, so replies to it cannot be monitored automatically.",
          prospectId: monitor.prospectId,
          planId: monitor.planId,
          contextPlatform: "linkedin",
          ...display,
        });
      } else if (monitor.stage === "awaiting_connection" && monitor.taskId) {
        const task = await ctx.db.get("outreachTasks", monitor.taskId);
        if (task?.status === "waiting_connection") {
          await ctx.db.patch("outreachTasks", task._id, {
            status: "failed",
            errorMessage:
              "The LinkedIn connection request was not accepted within 30 days, so the DM could not be sent.",
            statusBridgeState: undefined,
            statusBridgeSentAt: undefined,
          });
          await ctx.scheduler.runAfter(
            0,
            internal.chat.bridgeOutreachTaskStatusToThread,
            { taskId: task._id }
          );
        }
        const prospect = await ctx.db.get("prospects", monitor.prospectId);
        await upsertNotificationByKey(ctx, {
          userId: monitor.userId,
          workspaceId: monitor.workspaceId,
          type: "error",
          notificationKey: `linkedin-connection-expired:${monitor.taskId}`,
          title: "LinkedIn connection was not accepted",
          message:
            "The approved DM was not sent. ReacherX stopped waiting after 30 days so this outreach will not remain stuck silently.",
          prospectId: monitor.prospectId,
          planId: monitor.planId,
          taskId: monitor.taskId,
          contextPlatform: "linkedin",
          ...getProspectDisplayFields(prospect),
        });
      }
      return null;
    }

    const nextAttemptCount = monitor.attemptCount + 1;
    const delayMs = getRecoveryNextCheckDelayMs(
      monitor.stage,
      nextAttemptCount,
      monitor.kind
    );
    await ctx.db.patch("outreachRecoveryMonitors", monitor._id, {
      attemptCount: nextAttemptCount,
      lastCheckedAt: now,
      lastErrorMessage: args.errorMessage,
      nextCheckAt: now + delayMs,
    });
    await ctx.scheduler.runAfter(
      delayMs,
      internalRecovery.checkRecoveryMonitor,
      { monitorId: monitor._id }
    );
    return null;
  },
});

export const confirmTwitterManualReply = internalMutation({
  args: {
    monitorId: v.id("outreachRecoveryMonitors"),
    replyPostId: v.string(),
    replyText: v.optional(v.string()),
    repliedAt: v.number(),
  },
  returns: v.union(v.null(), v.id("outreachTasks")),
  handler: async (ctx, args) => {
    const monitor = await ctx.db.get(
      "outreachRecoveryMonitors",
      args.monitorId
    );
    if (
      !monitor ||
      monitor.status !== "active" ||
      monitor.stage !== "detecting_outbound" ||
      !monitor.taskId ||
      !monitor.planId
    ) {
      return null;
    }
    const task = await ctx.db.get("outreachTasks", monitor.taskId);
    const plan = await ctx.db.get("outreachPlans", monitor.planId);
    if (!task || !plan) {
      await expireInactiveTwitterManualReplyMonitor(ctx, monitor);
      return null;
    }
    if (
      task.status !== "waiting_manual" ||
      plan.status === "completed" ||
      plan.status === "abandoned"
    ) {
      await expireInactiveTwitterManualReplyMonitor(ctx, monitor);
      return null;
    }

    const now = getCurrentUTCTimestamp();
    await ctx.db.patch("outreachTasks", task._id, {
      status: "waiting_response",
      resultData: {
        postedTweetId: args.replyPostId,
        postedAt: args.repliedAt,
        postedText: args.replyText ?? task.content ?? "",
        postedBy: { name: "You" },
        manuallyPosted: true,
        sentVia: "external_x",
      },
      errorMessage: undefined,
      executedAt: now,
      statusBridgeState: undefined,
      statusBridgeSentAt: undefined,
    });
    await ctx.db.patch("outreachRecoveryMonitors", monitor._id, {
      stage: "awaiting_response",
      outboundArtifactId: args.replyPostId,
      detectedAt: now,
      expiresAt: now + RESPONSE_MONITOR_WINDOW_MS,
      attemptCount: 0,
      lastCheckedAt: now,
      lastErrorMessage: undefined,
      nextCheckAt: now + 5 * 60 * 1000,
    });
    await ctx.db.patch("outreachPlans", plan._id, {
      status: "approved",
      workflowId: undefined,
      updatedAt: now,
    });

    const prospect = await ctx.db.get("prospects", monitor.prospectId);
    const display = getProspectDisplayFields(prospect);
    await dismissNotificationsByKey(ctx, {
      userId: monitor.userId,
      workspaceId: monitor.workspaceId,
      notificationKey: `manual-x-reply:${task._id}`,
    });
    await upsertNotificationByKey(ctx, {
      userId: monitor.userId,
      workspaceId: monitor.workspaceId,
      type: "outreach_sent",
      notificationKey: `manual-x-reply-detected:${task._id}`,
      title: "Manual X/Twitter reply detected",
      message:
        "Your reply was linked to this outreach plan. ReacherX is now monitoring the conversation for a response on X/Twitter.",
      prospectId: monitor.prospectId,
      planId: plan._id,
      taskId: task._id,
      threadId: plan.threadId,
      contextPlatform: "twitter",
      ...display,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.outreach.markProspectContactedFromSuccessfulComment,
      {
        prospectId: monitor.prospectId,
        workspaceId: monitor.workspaceId,
        description:
          "Posted a reply manually on X/Twitter after an API policy block.",
      }
    );
    await ctx.scheduler.runAfter(
      0,
      internal.workflows.outreach.startOutreachWorkflow,
      { planId: plan._id }
    );
    await ctx.scheduler.runAfter(
      5 * 60 * 1000,
      internalRecovery.checkRecoveryMonitor,
      { monitorId: monitor._id }
    );
    return task._id;
  },
});

export const completeRecoveryMonitor = internalMutation({
  args: { monitorId: v.id("outreachRecoveryMonitors") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const monitor = await ctx.db.get(
      "outreachRecoveryMonitors",
      args.monitorId
    );
    if (!monitor || monitor.status !== "active") return null;
    const now = getCurrentUTCTimestamp();
    await ctx.db.patch("outreachRecoveryMonitors", monitor._id, {
      status: "completed",
      completedAt: now,
      lastCheckedAt: now,
      nextCheckAt: undefined,
      lastErrorMessage: undefined,
    });
    return null;
  },
});

export const confirmLinkedInOutboundComment = internalMutation({
  args: {
    monitorId: v.id("outreachRecoveryMonitors"),
    commentId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const monitor = await ctx.db.get(
      "outreachRecoveryMonitors",
      args.monitorId
    );
    if (
      !monitor ||
      monitor.status !== "active" ||
      monitor.kind !== "linkedin_comment_reply" ||
      monitor.stage !== "detecting_outbound"
    ) {
      return false;
    }
    const now = getCurrentUTCTimestamp();
    await ctx.db.patch("outreachRecoveryMonitors", monitor._id, {
      stage: "awaiting_response",
      outboundArtifactId: args.commentId,
      detectedAt: now,
      expiresAt: now + RESPONSE_MONITOR_WINDOW_MS,
      attemptCount: 0,
      lastCheckedAt: now,
      lastErrorMessage: undefined,
      nextCheckAt: now + 5 * 60 * 1000,
    });
    await ctx.scheduler.runAfter(
      5 * 60 * 1000,
      internalRecovery.checkRecoveryMonitor,
      { monitorId: monitor._id }
    );
    return true;
  },
});

async function checkTwitterProspectResponse(
  ctx: ActionCtx,
  monitor: RecoveryMonitor
): Promise<boolean> {
  const prospect = await ctx.runQuery(internal.prospects.getProspectInternal, {
    prospectId: monitor.prospectId,
  });
  if (!prospect) throw new Error("Prospect not found");
  const prospectIdentity = resolveProspectTwitterIdentity(prospect);
  if (!prospectIdentity.username) {
    throw new Error("Prospect X/Twitter handle is unavailable");
  }

  const params = new URLSearchParams({
    query: `conversation_id:${monitor.sourcePostId} from:${prospectIdentity.username.replace(/^@/, "")}`,
    type: "Latest",
  });
  const payload = await fetchSocialApiJson<SocialApiSearchResponse>(
    ctx,
    "outreachRecovery.findProspectReply",
    "/twitter/search",
    params
  );
  const tweets = Array.isArray(payload.tweets) ? payload.tweets : [];
  const response = tweets.find(
    (tweet) =>
      getTweetReplyTargetId(tweet) === monitor.outboundArtifactId &&
      getTwitterPostId(tweet)
  );
  const responsePostId = response ? getTwitterPostId(response) : undefined;
  if (!response || !responsePostId) return false;

  const summary = summarizeTwitterPost(response);
  await ctx.runMutation(internal.outreach.onProspectResponse, {
    prospectId: monitor.prospectId,
    planId: monitor.planId,
    responseTweetId: responsePostId,
    responseText: summary?.textPreview,
    responseData: response,
  });
  await ctx.runMutation(internalRecovery.completeRecoveryMonitor, {
    monitorId: monitor._id,
  });
  return true;
}

async function checkLinkedInCommentResponse(
  ctx: ActionCtx,
  monitor: RecoveryMonitor
): Promise<boolean> {
  if (!monitor.outboundArtifactId) return false;
  const [account, prospect] = await Promise.all([
    ctx.runQuery(internal.linkedinStore.getLinkedInAccountForUserInternal, {
      userId: monitor.userId,
    }),
    ctx.runQuery(internal.prospects.getProspectInternal, {
      prospectId: monitor.prospectId,
    }),
  ]);
  if (!account?.accountId || account.status !== "connected") {
    throw new Error("Connected LinkedIn account is unavailable");
  }
  if (!prospect) throw new Error("Prospect not found");

  const response = await ctx.runAction(
    internal.linkedin.listLinkedInCommentRepliesInternal,
    {
      userId: monitor.userId,
      postId: monitor.sourcePostId,
      commentId: monitor.outboundArtifactId ?? monitor.outboundParentArtifactId,
    }
  );
  if (!monitor.outboundArtifactId) {
    const outbound = (response.items ?? []).find(
      (comment) =>
        comment.isViewer &&
        comment.text?.trim() === monitor.expectedText?.trim()
    );
    if (!outbound) return false;
    return await ctx.runMutation(
      internalRecovery.confirmLinkedInOutboundComment,
      {
        monitorId: monitor._id,
        commentId: outbound.id,
      }
    );
  }
  const prospectProviderIds = new Set(
    [
      prospect.linkedinUserUrn,
      prospect.socialProfiles?.linkedin?.urn,
      normalizeLinkedInReadUrn(prospect.linkedinUserUrn),
      normalizeLinkedInReadUrn(prospect.socialProfiles?.linkedin?.urn),
    ].filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0
    )
  );
  const reply = (response.items ?? []).find((comment) => {
    const authorId = comment.authorId?.trim();
    const normalizedAuthorId = normalizeLinkedInReadUrn(authorId);
    return Boolean(
      (authorId && prospectProviderIds.has(authorId)) ||
      (normalizedAuthorId && prospectProviderIds.has(normalizedAuthorId))
    );
  });
  if (!reply) return false;

  await ctx.runMutation(internal.outreach.onProspectLinkedInResponse, {
    prospectId: monitor.prospectId,
    planId: monitor.planId,
    responseType: "comment",
    responseMessageId: reply.id,
    responseText: reply.text,
    responseData: reply,
    conversationId: monitor.sourcePostId,
  });
  await ctx.runMutation(internalRecovery.completeRecoveryMonitor, {
    monitorId: monitor._id,
  });
  return true;
}

async function checkLinkedInConnection(
  ctx: ActionCtx,
  monitor: RecoveryMonitor
): Promise<boolean> {
  const relationship = await ctx.runAction(
    internal.linkedin.getLinkedInProspectRelationshipInternal,
    {
      userId: monitor.userId,
      prospectId: monitor.prospectId,
    }
  );
  if (
    !isLinkedInDmEligible(
      relationship.status,
      relationship.hasExistingConversation
    )
  ) {
    return false;
  }

  await ctx.runMutation(internalRecovery.onLinkedInConnectionAccepted, {
    prospectId: monitor.prospectId,
  });
  return true;
}

export const checkRecoveryMonitor = internalAction({
  args: { monitorId: v.id("outreachRecoveryMonitors") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const monitor = (await ctx.runQuery(
      internalRecovery.getRecoveryMonitorInternal,
      { monitorId: args.monitorId }
    )) as RecoveryMonitor | null;
    if (!monitor || monitor.status !== "active") return null;

    // X/Twitter manual outbound detection is event-driven via X/Twitter Activity
    // `post.create` and remains active while the task is waiting_manual.
    if (
      monitor.kind === "twitter_manual_reply" &&
      monitor.stage === "detecting_outbound"
    ) {
      return null;
    }

    try {
      const detected =
        monitor.kind === "twitter_manual_reply"
          ? await checkTwitterProspectResponse(ctx, monitor)
          : monitor.kind === "linkedin_connection_then_dm"
            ? await checkLinkedInConnection(ctx, monitor)
            : await checkLinkedInCommentResponse(ctx, monitor);
      if (!detected) {
        await ctx.runMutation(internalRecovery.recordRecoveryCheck, {
          monitorId: monitor._id,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown reconciliation error";
      console.warn("[OutreachRecovery] Recovery monitor check failed", {
        monitorId: String(monitor._id),
        kind: monitor.kind,
        message,
      });
      await ctx.runMutation(internalRecovery.recordRecoveryCheck, {
        monitorId: monitor._id,
        errorMessage: message,
      });
    }
    return null;
  },
});
