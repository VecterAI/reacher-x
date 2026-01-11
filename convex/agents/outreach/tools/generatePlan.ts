"use node";

// convex/agents/outreach/tools/generatePlan.ts
// Agent tool for creating outreach plans
// Thin wrapper - Layer 1 following Three-Layer Architecture

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../../_generated/api";
import { components } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";

// ============================================================================
// Schema
// ============================================================================

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

export interface GeneratePlanResult {
  success: boolean;
  /** User-friendly message (shown to user via LLM) */
  message: string;
  /** Internal plan reference (not exposed to user) */
  _internalPlanId?: string;
  error?: string;
}

// ============================================================================
// Helper: Extract IDs from thread title
// ============================================================================

/**
 * Extracts prospectId and workspaceId from thread context.
 * This prevents LLM from hallucinating/modifying IDs.
 */
async function extractIdsFromThread(
  ctx: Parameters<Parameters<typeof createTool>[0]["handler"]>[0]
): Promise<{
  prospectId: Id<"prospects"> | null;
  workspaceId: Id<"workspaces"> | null;
}> {
  const threadId = ctx.threadId;
  if (!threadId) return { prospectId: null, workspaceId: null };

  try {
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId,
    });

    if (!thread?.title?.startsWith("outreach:")) {
      return { prospectId: null, workspaceId: null };
    }

    const prospectId = thread.title.replace("outreach:", "") as Id<"prospects">;

    // Get workspace from prospect
    const prospect = await ctx.runQuery(
      internal.prospects.getProspectInternal,
      { prospectId }
    );

    if (prospect) {
      return {
        prospectId,
        workspaceId: prospect.workspaceId as Id<"workspaces">,
      };
    }

    return { prospectId, workspaceId: null };
  } catch (error) {
    console.warn("[generatePlan] Failed to extract IDs from thread:", error);
    return { prospectId: null, workspaceId: null };
  }
}

// ============================================================================
// Tool
// ============================================================================

/**
 * Create a new outreach plan for a prospect.
 * Enforces single-plan-per-prospect rule.
 *
 * IDs are automatically extracted from the thread context to prevent LLM hallucination.
 */
export const generatePlan = createTool({
  description:
    "Create a new outreach plan for a prospect. This creates a draft plan that needs approval before execution. Only one active plan per prospect is allowed. IDs are automatically extracted from the thread - you don't need to provide them.",
  args: z.object({
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
  handler: async (ctx, args): Promise<GeneratePlanResult> => {
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

      // Extract IDs from thread (preferred) or use provided (fallback)
      const extractedIds = await extractIdsFromThread(ctx);
      const prospectId = extractedIds.prospectId;
      const workspaceId = extractedIds.workspaceId;

      if (!prospectId || !workspaceId) {
        return {
          success: false,
          message:
            "Unable to create plan - could not determine prospect. Please call this from a prospect thread.",
          error: "Missing prospect or workspace context",
        };
      }

      const planId = await ctx.runMutation(internal.outreach.createPlan, {
        prospectId,
        workspaceId,
        userId,
        strategy: args.strategy,
        tasks: args.tasks,
        threadId: ctx.threadId ?? undefined,
      });

      return {
        success: true,
        message:
          "Plan created successfully! The prospect now has a draft outreach plan ready for your review.",
        _internalPlanId: planId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      return {
        success: false,
        message: `Unable to create plan: ${errorMessage}`,
        error: errorMessage,
      };
    }
  },
});
