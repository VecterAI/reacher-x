"use node";

// convex/agents/tools/enrichProspect.ts
// Agent tool for prospect enrichment
// THIN WRAPPER - triggers the enrichment workflow
// All business logic is in convex/lib/enrichmentCore.ts (Layer 3)
// Orchestration is in convex/workflows/enrichment.ts (Layer 2)

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

export interface EnrichProspectResult {
  success: boolean;
  prospectId: string;
  enrichmentStatus:
    | "enriched"
    | "partial"
    | "failed"
    | "pending"
    | "already_enriched";
  prospectType?: string;
  painPointsCount: number;
  hasFinance: boolean;
  error?: string;
}

// ============================================================================
// Tool
// ============================================================================

/**
 * Agent tool for enriching a prospect with additional data.
 * THIN WRAPPER - triggers the enrichment workflow.
 *
 * Layer 1 (Agent Tool): Validate args, trigger workflow, format response
 * Layer 2 (Workflow): convex/workflows/enrichment.ts
 * Layer 3 (Core Logic): convex/lib/enrichmentCore.ts
 */
export const enrichProspect = createTool({
  description:
    "Enrich a prospect with detailed information including type detection, title generation, pain point extraction, and solution matching. Use this after a prospect has been qualified.",
  args: z.object({
    prospectId: z.string().describe("The ID of the prospect to enrich"),
    workspaceId: z
      .string()
      .describe("The workspace ID for getting ICPs and solution matching"),
  }),
  handler: async (ctx, args): Promise<EnrichProspectResult> => {
    try {
      // 1. Validate prospect exists
      const prospect = await ctx.runQuery(api.prospects.getProspect, {
        prospectId: args.prospectId as Id<"prospects">,
      });

      if (!prospect) {
        return {
          success: false,
          prospectId: args.prospectId,
          enrichmentStatus: "failed",
          painPointsCount: 0,
          hasFinance: false,
          error: "Prospect not found",
        };
      }

      // 2. Validate prospect belongs to the specified workspace (prevents cross-workspace access)
      if (prospect.workspaceId !== args.workspaceId) {
        return {
          success: false,
          prospectId: args.prospectId,
          enrichmentStatus: "failed",
          painPointsCount: 0,
          hasFinance: false,
          error: "Prospect does not belong to this workspace",
        };
      }

      // 3. Skip if already enriched
      if (prospect.enrichmentStatus === "enriched") {
        return {
          success: true,
          prospectId: args.prospectId,
          enrichmentStatus: "already_enriched",
          prospectType: prospect.prospectType,
          painPointsCount: prospect.painPoints?.length || 0,
          hasFinance: !!prospect.finance,
        };
      }

      // 3. Trigger the enrichment workflow (delegates to Layer 2)
      await ctx.runAction(internal.workflows.enrichment.startEnrichment, {
        prospectId: args.prospectId as Id<"prospects">,
        workspaceId: args.workspaceId as Id<"workspaces">,
      });

      console.info(
        `[enrichProspect] Triggered enrichment workflow for ${args.prospectId}`
      );

      return {
        success: true,
        prospectId: args.prospectId,
        enrichmentStatus: "pending",
        painPointsCount: 0,
        hasFinance: false,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[enrichProspect] Failed for ${args.prospectId}:`,
        errorMessage
      );

      return {
        success: false,
        prospectId: args.prospectId,
        enrichmentStatus: "failed",
        painPointsCount: 0,
        hasFinance: false,
        error: errorMessage,
      };
    }
  },
});
