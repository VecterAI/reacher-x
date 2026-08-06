"use node";

// convex/agents/outreach/tools/generatePlan.ts
// Agent tool for creating outreach plans
// Thin wrapper - Layer 1 following Three-Layer Architecture

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import {
  createPlanPreviewArtifact,
  type AgentArtifactEnvelope,
} from "../../../../shared/lib/json-render/agentArtifacts";
import {
  AMBIGUOUS_PROSPECT_SELECTION_MESSAGE,
  MISSING_PROSPECT_SELECTION_MESSAGE,
  ensureWorkspaceStyleReady,
  extractProspectThreadContext,
  resolveExecutionThreadId,
  type ToolContext,
} from "./helpers";
import { X_LONG_FORM_POST_MAX_CHARS } from "../../../../shared/lib/twitter/xPostTextLimit";
import { repairOverLimitCommentTasks } from "./xPostLimitHelpers";
import { getMediaCapabilityErrorMessage } from "../../../lib/mediaCapabilityCore";
import {
  applyLinkedInRelationshipTaskConstraints,
  isLinkedInDmEligible,
  linkedInDmBlockedMessage,
  type LinkedInRelationshipStatus,
} from "../../../lib/linkedinOutreachPlanCore";
import {
  attachmentRefsSchema,
  resolveTaskAttachmentReferences,
} from "./attachmentReferences";

// ============================================================================
// Schema
// ============================================================================

const taskSchema = z.object({
  type: z.enum(["comment", "dm", "react", "wait", "ask_human"]),
  description: z.string(),
  timing: z.object({
    type: z.enum(["immediate", "delay", "event", "best_time"]),
    value: z.string().optional(),
  }),
  targetTweetId: z.string().optional(),
  targetCommentId: z.string().optional(),
  reactionType: z
    .enum(["like", "celebrate", "support", "love", "insightful", "funny"])
    .optional(),
  content: z.string().max(X_LONG_FORM_POST_MAX_CHARS).optional(),
  attachmentRefs: attachmentRefsSchema,
  mediaUrls: z
    .array(z.url())
    .max(4)
    .optional()
    .describe(
      "Exact verified URLs already present in plan context, or explicitly supplied by a delegated system instruction. For newly selected files, use attachmentRefs instead."
    ),
  mediaDescriptions: z.array(z.string().max(1_000)).max(4).optional(),
  mediaKinds: z
    .array(z.enum(["image", "gif", "video"]))
    .max(4)
    .optional(),
});

const strategySchema = z.object({
  rationale: z
    .string()
    .describe(
      "A concise strategy explanation. Default to 1-2 short paragraphs, use bullets only when they improve clarity, and never return one oversized wall of text."
    ),
  targetTweetId: z.string().optional().describe("Tweet ID to engage with"),
  valueProposition: z.string().describe("The value we offer this prospect"),
  tone: z
    .string()
    .describe("Communication tone (e.g., 'friendly peer', 'helpful expert')"),
});

// ============================================================================
// Types
// ============================================================================

export interface GeneratePlanResult {
  success: boolean;
  /** User-friendly message (shown to user via LLM) */
  message: string;
  /** Internal plan reference (not exposed to user) */
  _internalPlanId?: string;
  plan?: {
    id: string;
    status: string;
    strategy: {
      rationale: string;
      targetTweetId?: string;
      valueProposition: string;
      tone: string;
    };
    version: number;
  };
  tasks?: Array<{
    id: string;
    order: number;
    type: string;
    description: string;
    status: string;
    content?: string;
    targetTweetId?: string;
    targetCommentId?: string;
    reactionType?: string;
    mediaUrls?: string[];
    mediaDescriptions?: string[];
    mediaKinds?: Array<"image" | "gif" | "video">;
  }>;
  artifact?: AgentArtifactEnvelope;
  error?: string;
}

type GeneratePlanTaskInput = z.infer<typeof taskSchema>;

function normalizeCommentTasks(
  tasks: GeneratePlanTaskInput[],
  strategyTargetTweetId?: string
) {
  return tasks.map((task) =>
    (task.type === "comment" || task.type === "react") &&
    !task.targetTweetId &&
    strategyTargetTweetId
      ? {
          ...task,
          targetTweetId: strategyTargetTweetId,
        }
      : task
  );
}

function allowsDeferredNextPostTarget(tasks: GeneratePlanTaskInput[]) {
  return tasks.some(
    (task) =>
      task.type === "wait" &&
      task.timing.type === "event" &&
      task.timing.value === "next_post"
  );
}

function toPlanPreviewTasks(
  tasks: Array<{
    id: string;
    order: number;
    type: string;
    description: string;
    status: string;
    content?: string;
    targetTweetId?: string;
    targetCommentId?: string;
    reactionType?: string;
  }>
) {
  return tasks.map((task) => ({
    _id: task.id,
    order: task.order,
    type: task.type,
    description: task.description,
    status: task.status,
    content: task.content,
    targetTweetId: task.targetTweetId,
    targetCommentId: task.targetCommentId,
    reactionType: task.reactionType,
  }));
}

// ============================================================================
// Tool
// ============================================================================

/**
 * Create a new outreach plan for a prospect.
 * Enforces single-plan-per-prospect rule.
 *
 * IDs are automatically extracted from the canonical thread relationship.
 */
export const generatePlan = createTool({
  description:
    "Create a new outreach plan for a prospect. In review mode the plan stays draft for approval; in autonomous mode it starts automatically. Only one active plan per prospect is allowed. IDs are automatically extracted from the thread - you don't need to provide them.",
  inputSchema: z.object({
    strategy: strategySchema,
    tasks: z.array(taskSchema).min(1).describe("List of tasks in order"),
    // Keep these optional for backwards compatibility but extract from thread
    prospectId: z
      .string()
      .optional()
      .describe("Optional: Extracted automatically from thread"),
    workspaceId: z
      .string()
      .optional()
      .describe("Optional: Extracted automatically from thread"),
  }),
  execute: async (ctx: ToolContext, args): Promise<GeneratePlanResult> => {
    let mediaFailureContext: {
      userId: Id<"users">;
      workspaceId: Id<"workspaces">;
      prospectId: Id<"prospects">;
      threadId?: string;
    } | null = null;
    try {
      // Get current user from context
      const userId = ctx.userId as Id<"users"> | null;
      if (!userId) {
        return {
          success: false,
          message: "Unable to create plan - not authenticated.",
          error: "User not authenticated",
        };
      }

      const paidEligibility = await ctx.runQuery(
        internal.plans.getPaidFeatureEligibilityByUserId,
        { userId }
      );
      if (!paidEligibility.allowed) {
        return {
          success: false,
          message:
            paidEligibility.reason ?? "Upgrade plan to create outreach plans.",
          error: "Plan required",
        };
      }

      const threadContext = await extractProspectThreadContext(
        ctx,
        "generatePlan"
      );
      const prospectId = threadContext.prospectId;
      const workspaceId = threadContext.workspaceId;

      if (!prospectId || !workspaceId) {
        return {
          success: false,
          message:
            "Unable to create plan - " + MISSING_PROSPECT_SELECTION_MESSAGE,
          error: "Missing prospect or workspace context",
        };
      }
      const prospect = await ctx.runQuery(
        internal.prospects.getProspectInternal,
        { prospectId }
      );
      const prospectPlatform =
        prospect?.platform === "linkedin" ? "linkedin" : "twitter";

      const existingPlan = await ctx.runQuery(
        internal.outreach.getProspectActivePlanInternal,
        {
          prospectId,
        }
      );
      if (existingPlan) {
        const existingTasks = existingPlan.tasks.map(
          (task: (typeof existingPlan.tasks)[number]) => ({
            id: task._id,
            order: task.order,
            type: task.type,
            description: task.description,
            status: task.status,
            content: task.content,
            targetTweetId: task.targetTweetId,
            targetCommentId: task.targetCommentId,
            reactionType: task.reactionType,
          })
        );

        return {
          success: true,
          message:
            "An active outreach plan already exists for this prospect. Review or refine the existing plan instead of generating a new one.",
          _internalPlanId: existingPlan.plan._id,
          plan: {
            id: existingPlan.plan._id,
            status: existingPlan.plan.status,
            strategy: existingPlan.plan.strategy,
            version: existingPlan.plan.version,
          },
          tasks: existingTasks,
          artifact: createPlanPreviewArtifact({
            planId: existingPlan.plan._id,
            prospectId: existingPlan.plan.prospectId,
            status: existingPlan.plan.status,
            rationale: existingPlan.plan.strategy.rationale,
            tasks: toPlanPreviewTasks(existingTasks),
          }),
        };
      }

      const normalizedTasks = normalizeCommentTasks(
        args.tasks,
        args.strategy.targetTweetId
      );
      const resolvedTasks = await resolveTaskAttachmentReferences(
        ctx,
        normalizedTasks
      );
      const repairedTasks =
        prospectPlatform === "twitter"
          ? (
              await repairOverLimitCommentTasks({
                ctx,
                userId,
                tasks: resolvedTasks,
              })
            ).tasks
          : resolvedTasks;

      let linkedinRelationship: LinkedInRelationshipStatus | null = null;
      if (prospectPlatform === "linkedin") {
        try {
          const relationship = await ctx.runAction(
            internal.linkedin.getLinkedInProspectRelationshipInternal,
            {
              userId,
              prospectId,
            }
          );
          linkedinRelationship = relationship.status;
        } catch {
          linkedinRelationship = "unknown";
        }
      }
      const constrainedTasks = applyLinkedInRelationshipTaskConstraints({
        platform: prospectPlatform,
        relationship: linkedinRelationship,
        tasks: repairedTasks,
      });
      if (
        constrainedTasks.removedDmCount > 0 &&
        linkedinRelationship &&
        !isLinkedInDmEligible(linkedinRelationship)
      ) {
        const hasConcreteOutreach = constrainedTasks.tasks.some(
          (task) =>
            task.type === "comment" ||
            task.type === "dm" ||
            task.type === "react"
        );
        if (!hasConcreteOutreach) {
          return {
            success: false,
            message: linkedInDmBlockedMessage(linkedinRelationship),
            error: "LinkedIn DM blocked without connection",
          };
        }
      }
      const planTasks = constrainedTasks.tasks;

      const canDeferCommentTarget = allowsDeferredNextPostTarget(planTasks);
      const invalidCommentTask = planTasks.find(
        (task) =>
          task.type === "comment" &&
          ((!task.content &&
            (prospectPlatform === "linkedin" || !task.mediaUrls?.length)) ||
            (!task.targetTweetId && !canDeferCommentTarget))
      );
      if (invalidCommentTask) {
        return {
          success: false,
          message:
            prospectPlatform === "linkedin"
              ? "Unable to create plan because a LinkedIn comment task is missing text or a target post."
              : "Unable to create plan because at least one reply task is missing text/media or a target post. Select a specific post first, or use an explicit wait-for-next-post strategy on X before the reply task.",
          error:
            "Comment tasks require supported content and either a target post or an explicit next-post wait strategy",
        };
      }
      const invalidReactionTask = planTasks.find(
        (task) =>
          task.type === "react" &&
          (!task.targetTweetId ||
            Boolean(task.content) ||
            Boolean(task.mediaUrls?.length))
      );
      if (invalidReactionTask) {
        return {
          success: false,
          message:
            "Unable to create plan because a reaction task needs a target post and cannot contain message content or media.",
          error:
            "Reaction tasks require a target post and cannot contain content or media",
        };
      }

      if (planTasks.some((task) => task.type === "comment")) {
        const styleReady = await ensureWorkspaceStyleReady(
          ctx,
          "generatePlan",
          workspaceId
        );
        if (!styleReady.ready) {
          return {
            success: false,
            message: styleReady.message,
            error: styleReady.error,
          };
        }
      }

      const executionThreadId = await resolveExecutionThreadId(
        ctx,
        "generatePlan"
      );
      if (!executionThreadId) {
        return {
          success: false,
          message: AMBIGUOUS_PROSPECT_SELECTION_MESSAGE,
          error: "Ambiguous prospect context",
        };
      }
      mediaFailureContext = {
        userId,
        workspaceId,
        prospectId,
        threadId: executionThreadId,
      };

      const planId = await ctx.runMutation(internal.outreach.createPlan, {
        prospectId,
        workspaceId,
        userId,
        strategy: args.strategy,
        tasks: planTasks,
        threadId: executionThreadId,
        planBatchItemId: ctx.planBatchItemId,
      });
      const createdPlanData = await ctx.runQuery(
        internal.outreach.getPlanInternal,
        { planId }
      );
      const createdTasks = createdPlanData?.tasks ?? [];
      const createdPlanStatus = createdPlanData?.plan.status ?? "draft";
      const startedAutomatically = createdPlanStatus !== "draft";

      return {
        success: true,
        message: startedAutomatically
          ? "Plan created successfully and started automatically because this workspace is autonomous."
          : "Plan created successfully! The prospect now has a draft outreach plan ready for your review.",
        _internalPlanId: planId,
        plan: {
          id: planId,
          status: createdPlanStatus,
          strategy: args.strategy,
          version: 1,
        },
        tasks: createdTasks.map((task: (typeof createdTasks)[number]) => ({
          id: task._id,
          order: task.order,
          type: task.type,
          description: task.description,
          status: task.status,
          content: task.content,
          targetTweetId: task.targetTweetId,
          targetCommentId: task.targetCommentId,
          reactionType: task.reactionType,
          mediaUrls: task.mediaUrls,
          mediaDescriptions: task.mediaDescriptions,
          mediaKinds: task.mediaKinds,
        })),
        artifact: createPlanPreviewArtifact({
          planId,
          prospectId,
          status: createdPlanStatus,
          rationale: args.strategy.rationale,
          tasks: createdTasks.map((task: (typeof createdTasks)[number]) => ({
            _id: task._id,
            order: task.order,
            type: task.type,
            description: task.description,
            status: task.status,
            content: task.content,
            targetTweetId: task.targetTweetId,
            targetCommentId: task.targetCommentId,
            reactionType: task.reactionType,
          })),
        }),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const mediaErrorMessage = getMediaCapabilityErrorMessage(error);
      if (mediaErrorMessage && mediaFailureContext) {
        try {
          await ctx.runMutation(
            internal.outreach.createPlanMediaCapabilityNotification,
            {
              ...mediaFailureContext,
              message: mediaErrorMessage,
            }
          );
        } catch (notificationError) {
          console.warn(
            "[generatePlan] Could not create media capability notification",
            notificationError
          );
        }
      }

      return {
        success: false,
        message: `Unable to create plan: ${mediaErrorMessage ?? errorMessage}`,
        error: mediaErrorMessage ?? errorMessage,
      };
    }
  },
});
