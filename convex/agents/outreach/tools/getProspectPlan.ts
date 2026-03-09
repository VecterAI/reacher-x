"use node";

// convex/agents/outreach/tools/getProspectPlan.ts
// Agent tool for cross-thread plan access
// Thin wrapper - Layer 1 following Three-Layer Architecture

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { api } from "../../../_generated/api";
import type { Doc } from "../../../_generated/dataModel";
import { extractProspectIdWithFallback } from "./helpers";
import {
  createPlanPreviewArtifact,
  type AgentArtifactEnvelope,
} from "../../../../shared/lib/json-render/agentArtifacts";

// ============================================================================
// Types
// ============================================================================

export interface GetProspectPlanResult {
  success: boolean;
  hasPlan: boolean;
  plan: {
    id: string;
    status: string;
    strategy: {
      rationale: string;
      targetTweetId?: string;
      valueProposition: string;
      tone: string;
    };
    version: number;
  } | null;
  tasks: Array<{
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
 * Get existing outreach plan for a prospect.
 * Enables cross-thread context - any chat can access the current plan.
 */
export const getProspectPlan = createTool({
  description:
    "Get the existing outreach plan for a prospect. Use this to check if a plan exists before generating a new one, or to get plan details from any conversation thread. The prospectId is automatically extracted from the thread - you don't need to provide it.",
  args: z.object({
    prospectId: z
      .string()
      .optional()
      .describe(
        "Optional: The ID of the prospect. If not provided, extracted from thread context."
      ),
  }),
  handler: async (ctx, args): Promise<GetProspectPlanResult> => {
    try {
      // Extract prospectId from thread if not provided or invalid
      const prospectId = await extractProspectIdWithFallback(
        ctx,
        "getProspectPlan",
        args.prospectId
      );

      if (!prospectId) {
        return {
          success: false,
          hasPlan: false,
          plan: null,
          tasks: [],
          error:
            "Could not determine prospect. Please call this from a prospect thread.",
        };
      }

      const result = await ctx.runQuery(api.outreach.getProspectPlan, {
        prospectId,
      });

      if (!result) {
        return {
          success: true,
          hasPlan: false,
          plan: null,
          tasks: [],
        };
      }

      return {
        success: true,
        hasPlan: true,
        plan: {
          id: result.plan._id,
          status: result.plan.status,
          strategy: result.plan.strategy,
          version: result.plan.version,
        },
        tasks: result.tasks.map((t: Doc<"outreachTasks">) => ({
          id: t._id,
          order: t.order,
          type: t.type,
          description: t.description,
          status: t.status,
          content: t.content,
          targetTweetId: t.targetTweetId,
        })),
        artifact: createPlanPreviewArtifact({
          planId: result.plan._id,
          status: result.plan.status,
          rationale: result.plan.strategy.rationale,
          tasks: result.tasks.map((t: Doc<"outreachTasks">) => ({
            _id: t._id,
            order: t.order,
            type: t.type,
            description: t.description,
            status: t.status,
            content: t.content,
            targetTweetId: t.targetTweetId,
          })),
        }),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      return {
        success: false,
        hasPlan: false,
        plan: null,
        tasks: [],
        error: errorMessage,
      };
    }
  },
});
