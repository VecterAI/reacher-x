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
  ensureWorkspaceStyleReady,
  extractProspectThreadContext,
} from "./helpers";
import { X_LONG_FORM_POST_MAX_CHARS } from "../../../../shared/lib/twitter/xPostTextLimit";

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
    content: z.string().max(X_LONG_FORM_POST_MAX_CHARS).optional(),
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
 * Create a new outreach plan for a prospect.
 * Enforces single-plan-per-prospect rule.
 *
 * IDs are automatically extracted from the canonical thread relationship.
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
            "Unable to create plan - could not determine prospect. Please call this from a prospect thread.",
          error: "Missing prospect or workspace context",
        };
      }

      if (args.tasks.some((task) => task.type === "comment")) {
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
        plan: {
          id: planId,
          status: "draft",
          strategy: args.strategy,
          version: 1,
        },
        tasks: args.tasks.map((task, index) => ({
          id: `generated-task-${index + 1}`,
          order: index + 1,
          type: task.type,
          description: task.description,
          status: "pending",
          content: task.content,
          targetTweetId: task.targetTweetId,
        })),
        artifact: createPlanPreviewArtifact({
          planId,
          status: "draft",
          rationale: args.strategy.rationale,
          tasks: args.tasks.map((task, index) => ({
            _id: `generated-task-${index + 1}`,
            order: index + 1,
            type: task.type,
            description: task.description,
            status: "pending",
            content: task.content,
            targetTweetId: task.targetTweetId,
          })),
        }),
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
