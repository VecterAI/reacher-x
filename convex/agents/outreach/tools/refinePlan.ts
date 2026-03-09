"use node";

// convex/agents/outreach/tools/refinePlan.ts
// Agent tool for updating outreach plans based on feedback
// Thin wrapper - Layer 1 following Three-Layer Architecture

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../../_generated/api";
import { extractPlanIdFromThread } from "./helpers";
import {
  createPlanPreviewArtifact,
  type AgentArtifactEnvelope,
} from "../../../../shared/lib/json-render/agentArtifacts";

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
const taskSchema = z
  .object({
    type: z.enum(["comment", "wait", "ask_human"]),
    description: z.string(),
    timing: z.object({
      type: z.enum(["immediate", "delay", "event", "best_time"]),
      value: z.string().optional(),
    }),
    targetTweetId: z.string().optional(),
    content: z.string().optional(),
  })
  .refine(
    (task) => {
      if (task.type === "comment") {
        return !!task.content && !!task.targetTweetId;
      }
      return true;
    },
    {
      message:
        "Comment tasks require both 'content' (the reply text) and 'targetTweetId' (the tweet to reply to)",
    }
  );

const strategySchema = z.object({
  rationale: z
    .string()
    .describe("Why this approach will work for this prospect"),
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
        tasks: args.tasks,
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
        message: "Plan updated successfully! The changes have been applied.",
        plan: updatedPlanData
          ? {
              id: updatedPlanData.plan._id,
              status: updatedPlanData.plan.status,
              strategy: updatedPlanData.plan.strategy,
              version: updatedPlanData.plan.version,
            }
          : undefined,
        tasks: updatedTasks.map((task) => ({
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
              tasks: updatedTasks.map((task) => ({
                _id: task._id,
                order: task.order,
                type: task.type,
                description: task.description,
                status: task.status,
                content: task.content,
                targetTweetId: task.targetTweetId,
              })),
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
