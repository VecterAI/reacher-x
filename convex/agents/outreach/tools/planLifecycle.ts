"use node";

// convex/agents/outreach/tools/planLifecycle.ts
// Agent tools: pause / resume / cancel / delete the prospect's active plan.
// Thin wrappers - Layer 1. Plan is resolved from thread context (never
// from LLM-provided IDs).

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../../_generated/api";
import { extractPlanIdFromThread, type ToolContext } from "./helpers";

export interface PlanLifecycleResult {
  success: boolean;
  status?: string;
  error?: string;
}

async function runPlanLifecycleAction(
  ctx: ToolContext,
  moduleName: string,
  action: "pause" | "resume" | "cancel"
): Promise<PlanLifecycleResult> {
  try {
    const planId = await extractPlanIdFromThread(
      ctx,
      moduleName,
      internal.outreach.getActivePlanForProspect
    );

    if (!planId) {
      return {
        success: false,
        error:
          "No active plan found for this prospect. Nothing to " + action + ".",
      };
    }

    const result = await ctx.runMutation(
      internal.outreach.setPlanLifecycleInternal,
      { planId, action }
    );

    return { success: true, status: result.status };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function runDeletePlanAction(
  ctx: ToolContext,
  moduleName: string
): Promise<PlanLifecycleResult> {
  try {
    const planId = await extractPlanIdFromThread(
      ctx,
      moduleName,
      internal.outreach.getActivePlanForProspect
    );

    if (!planId) {
      return {
        success: false,
        error: "No active plan found for this profile. Nothing to delete.",
      };
    }

    await ctx.runMutation(internal.outreach.deletePlanInternal, { planId });
    return { success: true, status: "deleted" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Pause the executing plan for this prospect.
 */
export const pausePlan = createTool({
  description:
    "Pause the currently executing outreach plan for this prospect. Remaining tasks stop until the plan is resumed. Use when the user asks to hold off or when circumstances changed. The plan is resolved automatically from the thread.",
  inputSchema: z.object({}),
  execute: async (ctx): Promise<PlanLifecycleResult> =>
    runPlanLifecycleAction(ctx, "pausePlan", "pause"),
});

/**
 * Resume a paused/blocked plan for this prospect.
 */
export const resumePlan = createTool({
  description:
    "Resume a paused or blocked outreach plan for this prospect. Execution restarts from the next pending task. The plan is resolved automatically from the thread.",
  inputSchema: z.object({}),
  execute: async (ctx): Promise<PlanLifecycleResult> =>
    runPlanLifecycleAction(ctx, "resumePlan", "resume"),
});

/**
 * Cancel the active plan for this prospect.
 */
export const cancelPlan = createTool({
  description:
    "Cancel (abandon but keep) the active outreach plan for this prospect. Use when the user wants to stop pursuing this plan without permanently deleting its record. The plan is resolved automatically from the thread.",
  inputSchema: z.object({}),
  execute: async (ctx): Promise<PlanLifecycleResult> =>
    runPlanLifecycleAction(ctx, "cancelPlan", "cancel"),
});

/**
 * Permanently delete the active plan for this prospect.
 */
export const deletePlan = createTool({
  description:
    "Permanently delete the active outreach plan for this prospect, including its tasks and pending approval state. Use when the user explicitly asks to delete or remove the plan entirely. The plan is resolved automatically from the thread.",
  inputSchema: z.object({}),
  execute: async (ctx): Promise<PlanLifecycleResult> =>
    runDeletePlanAction(ctx, "deletePlan"),
});
