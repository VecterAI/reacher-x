"use node";

// convex/agents/outreach/tools/refinePlan.ts
// Agent tool for updating outreach plans based on feedback
// Thin wrapper - Layer 1 following Three-Layer Architecture

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../../_generated/api";
import {
  ensureWorkspaceStyleReady,
  extractPlanIdFromThread,
  extractProspectThreadContext,
} from "./helpers";
import {
  createPlanPreviewArtifact,
  type AgentArtifactEnvelope,
} from "../../../../shared/lib/json-render/agentArtifacts";
import { X_LONG_FORM_POST_MAX_CHARS } from "../../../../shared/lib/twitter/xPostTextLimit";
import type { Id } from "../../../_generated/dataModel";
import { repairOverLimitCommentTasks } from "./xPostLimitHelpers";

// ============================================================================
// Schema
// ============================================================================

/**
 * Zod schemas for agent tool validation.
 *
 * NOTE: These Zod schemas duplicate the Convex validators in validators.ts.
 * This is intentional because @convex-dev/agent requires Zod for tool args.
 * Values are aligned with validators.ts - if you add/remove values there,
 * update these schemas too.
 *
 * See: outreachTaskTypeValidator, outreachTaskTimingTypeValidator,
 *      outreachStrategyValidator in convex/validators.ts
 */
const taskSchema = z.object({
  type: z.enum(["comment", "dm", "wait", "ask_human"]),
  description: z.string(),
  timing: z.object({
    type: z.enum(["immediate", "delay", "event", "best_time"]),
    value: z.string().optional(),
  }),
  targetTweetId: z.string().optional(),
  content: z.string().max(X_LONG_FORM_POST_MAX_CHARS).optional(),
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

export interface RefinePlanResult {
  success: boolean;
  message: string;
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
  }>;
  artifact?: AgentArtifactEnvelope;
  error?: string;
}

type RefinePlanTaskInput = z.infer<typeof taskSchema>;

function normalizeCommentTasks(
  tasks: RefinePlanTaskInput[],
  strategyTargetTweetId?: string
) {
  return tasks.map((task) =>
    task.type === "comment" && !task.targetTweetId && strategyTargetTweetId
      ? {
          ...task,
          targetTweetId: strategyTargetTweetId,
        }
      : task
  );
}

function allowsDeferredNextPostTarget(tasks: RefinePlanTaskInput[]) {
  return tasks.some(
    (task) =>
      task.type === "wait" &&
      task.timing.type === "event" &&
      task.timing.value === "next_post"
  );
}

// ============================================================================
// Tool
// ============================================================================

/**
 * Update an existing outreach plan based on user feedback.
 * Can update strategy, tasks, or both.
 *
 * NOTE: This tool does NOT accept planId from LLM to prevent ID hallucination.
 * The active plan is automatically found from thread context.
 * Per AGENT_CONTEXT.txt line 419-423.
 */
export const refinePlan = createTool({
  description:
    "Update the existing outreach plan based on user feedback. Use this when the user asks to change the plan, make adjustments, or refine the approach. Can update the strategy, tasks, or both. The plan is automatically found from context - no plan ID needed.",
  args: z.object({
    strategy: strategySchema.optional().describe("Updated strategy (optional)"),
    tasks: z
      .array(taskSchema)
      .optional()
      .describe("Updated list of tasks (optional - replaces all tasks)"),
  }),
  handler: async (ctx, args): Promise<RefinePlanResult> => {
    try {
      // Validate at least one update is provided
      if (!args.strategy && !args.tasks) {
        return {
          success: false,
          message:
            "Please specify what you'd like to change - the strategy, tasks, or both.",
          error: "Must provide either strategy or tasks to update",
        };
      }

      const normalizedTasks = args.tasks
        ? normalizeCommentTasks(args.tasks, args.strategy?.targetTweetId)
        : undefined;
      const userId = ctx.userId as Id<"users"> | null;
      if (!userId) {
        return {
          success: false,
          message: "Unable to update plan - not authenticated.",
          error: "User not authenticated",
        };
      }
      const repairedTaskResult = normalizedTasks
        ? await repairOverLimitCommentTasks({
            ctx,
            userId,
            tasks: normalizedTasks,
          })
        : null;
      const candidateTasks = repairedTaskResult?.tasks ?? normalizedTasks;
      const canDeferCommentTarget = candidateTasks
        ? allowsDeferredNextPostTarget(candidateTasks)
        : false;
      const invalidCommentTask = candidateTasks?.find(
        (task) =>
          task.type === "comment" &&
          (!task.content || (!task.targetTweetId && !canDeferCommentTarget))
      );
      if (invalidCommentTask) {
        return {
          success: false,
          message:
            "Unable to update the plan because at least one comment task is missing reply content or a target post. Select a specific post first, or use an explicit wait-for-next-post strategy on X before the comment task.",
          error:
            "Comment tasks require content and either targetTweetId or an explicit next_post wait strategy",
        };
      }

      if (candidateTasks?.some((task) => task.type === "comment")) {
        const threadContext = await extractProspectThreadContext(
          ctx,
          "refinePlan"
        );
        const styleReady = await ensureWorkspaceStyleReady(
          ctx,
          "refinePlan",
          threadContext.workspaceId
        );
        if (!styleReady.ready) {
          return {
            success: false,
            message: styleReady.message,
            error: styleReady.error,
          };
        }
      }

      // Extract planId from thread context
      const planId = await extractPlanIdFromThread(
        ctx,
        "refinePlan",
        internal.outreach.getActivePlanForProspect
      );

      if (!planId) {
        return {
          success: false,
          message:
            "Could not find an active plan to update. Please generate a plan first.",
          error: "No active plan found in thread context",
        };
      }

      await ctx.runMutation(internal.outreach.updatePlan, {
        planId,
        strategy: args.strategy,
        tasks: candidateTasks,
      });

      const updatedPlanData = await ctx.runQuery(
        internal.outreach.getPlanInternal,
        {
          planId,
        }
      );

      console.info(`[refinePlan] Plan ${planId} updated successfully`);
      const updatedTasks = updatedPlanData?.tasks ?? [];

      return {
        success: true,
        message:
          (repairedTaskResult?.repairedCount ?? 0) > 0
            ? "Plan updated successfully. I also tightened one or more X reply drafts so they fit the connected account's posting limit."
            : "Plan updated successfully! The changes have been applied.",
        plan: updatedPlanData
          ? {
              id: updatedPlanData.plan._id,
              status: updatedPlanData.plan.status,
              strategy: updatedPlanData.plan.strategy,
              version: updatedPlanData.plan.version,
            }
          : undefined,
        tasks: updatedTasks.map((task: (typeof updatedTasks)[number]) => ({
          id: task._id,
          order: task.order,
          type: task.type,
          description: task.description,
          status: task.status,
          content: task.content,
          targetTweetId: task.targetTweetId,
        })),
        artifact: updatedPlanData
          ? createPlanPreviewArtifact({
              planId: updatedPlanData.plan._id,
              status: updatedPlanData.plan.status,
              rationale: updatedPlanData.plan.strategy.rationale,
              tasks: updatedTasks.map(
                (task: (typeof updatedTasks)[number]) => ({
                  _id: task._id,
                  order: task.order,
                  type: task.type,
                  description: task.description,
                  status: task.status,
                  content: task.content,
                  targetTweetId: task.targetTweetId,
                })
              ),
            })
          : undefined,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error("[refinePlan] Failed:", errorMessage);

      return {
        success: false,
        message: `Unable to update plan: ${errorMessage}`,
        error: errorMessage,
      };
    }
  },
});
