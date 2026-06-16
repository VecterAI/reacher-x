"use node";

// convex/agents/outreach/tools/helpers.ts
// Shared helper functions for outreach agent tools
// Single source of truth for ID extraction (per AGENT_CONTEXT.txt line 29-33)

import type { ToolCtx } from "@convex-dev/agent";
import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import type { ConvexWideEventLogger } from "../../../lib/wideEventLogger";

// ============================================================================
// Types
// ============================================================================

/**
 * Tool context type - extracted from createTool handler signature.
 * Used by all tools that need to extract IDs from thread context.
 */
export type ToolContext = ToolCtx;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Resolves prospect and workspace context from the canonical thread relationship.
 *
 * This prevents LLM from hallucinating/modifying IDs.
 *
 * Per AGENT_CONTEXT.txt line 419-423:
 * "All tools extract IDs from thread context, NOT from LLM (prevents hallucination)"
 *
 * @param ctx - Tool context
 * @param moduleName - Module name for logging (e.g., "approveTask")
 * @returns The resolved prospect/workspace IDs or nulls if not found
 */
export async function extractProspectThreadContext(
  ctx: ToolContext,
  moduleName: string,
  logEvent?: ConvexWideEventLogger | null
): Promise<{
  prospectId: Id<"prospects"> | null;
  workspaceId: Id<"workspaces"> | null;
}> {
  const threadId = ctx.threadId;
  if (!threadId) {
    return { prospectId: null, workspaceId: null };
  }

  try {
    const threadContext = await ctx.runQuery(
      internal.prospectThreads.getThreadProspectContext,
      {
        threadId,
      }
    );

    if (!threadContext) {
      return { prospectId: null, workspaceId: null };
    }

    return {
      prospectId: threadContext.prospectId,
      workspaceId: threadContext.workspaceId,
    };
  } catch {
    logEvent?.warn("Failed to resolve prospect thread context", {
      agent_tool: {
        module: moduleName,
      },
    });
    return { prospectId: null, workspaceId: null };
  }
}

export async function ensureWorkspaceStyleReady(
  ctx: ToolContext,
  moduleName: string,
  workspaceId: Id<"workspaces"> | null,
  logEvent?: ConvexWideEventLogger | null
): Promise<
  | { ready: true }
  | {
      ready: false;
      message: string;
      error: string;
    }
> {
  if (!workspaceId) {
    return {
      ready: false,
      message:
        "Writing style is unavailable because this conversation is not linked to a workspace.",
      error: "Missing workspace context",
    };
  }

  try {
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId,
    });
    const isReady =
      !!workspace &&
      workspace.styleProfileStatus === "ready" &&
      typeof workspace.styleProfileVersion === "number" &&
      workspace.styleProfileVersion > 0;

    if (isReady) {
      return { ready: true };
    }

    return {
      ready: false,
      message:
        "Writing style is still learning. Wait until style learning is ready before generating outreach copy, replies, or DMs.",
      error: `Workspace style profile not ready in ${moduleName}`,
    };
  } catch {
    logEvent?.warn("Failed to verify workspace style status", {
      agent_tool: {
        module: moduleName,
      },
      workspace: {
        id: workspaceId ?? undefined,
      },
    });
    return {
      ready: false,
      message:
        "Writing style could not be verified right now. Try again after style learning finishes.",
      error: "Failed to verify workspace style status",
    };
  }
}

/**
 * Extracts prospectId from canonical thread context.
 *
 * This prevents LLM from hallucinating/modifying IDs.
 *
 * Per AGENT_CONTEXT.txt line 419-423:
 * "All tools extract IDs from thread context, NOT from LLM (prevents hallucination)"
 *
 * @param ctx - Tool context
 * @param moduleName - Module name for logging (e.g., "approveTask")
 * @returns The extracted prospectId or null if not found
 */
export async function extractProspectIdFromThread(
  ctx: ToolContext,
  moduleName: string,
  logEvent?: ConvexWideEventLogger | null
): Promise<Id<"prospects"> | null> {
  const threadContext = await extractProspectThreadContext(
    ctx,
    moduleName,
    logEvent
  );
  return threadContext.prospectId;
}

/**
 * Extracts prospectId from thread context, with optional fallback to provided ID.
 *
 * Use this variant when the tool accepts an optional prospectId argument
 * that should be used if valid.
 *
 * @param ctx - Tool context
 * @param moduleName - Module name for logging
 * @param providedProspectId - Optional prospectId from tool args
 * @returns The extracted prospectId or null if not found
 */
export async function extractProspectIdWithFallback(
  ctx: ToolContext,
  moduleName: string,
  _providedProspectId?: string,
  logEvent?: ConvexWideEventLogger | null
): Promise<Id<"prospects"> | null> {
  // IMPORTANT: We intentionally ignore any provided prospectId here.
  // These are agent tools (LLM-called), and accepting IDs from args enables ID hallucination.
  // Per AGENT_CONTEXT.txt: extract IDs from thread context, NOT from the LLM.
  return extractProspectIdFromThread(ctx, moduleName, logEvent);
}

/**
 * Extracts the active planId from thread context by first getting the prospectId
 * and then querying for the active plan.
 *
 * This prevents LLM from hallucinating/modifying IDs.
 *
 * Per AGENT_CONTEXT.txt line 419-423:
 * "All tools extract IDs from thread context, NOT from LLM (prevents hallucination)"
 *
 * @param ctx - Tool context
 * @param moduleName - Module name for logging
 * @param getActivePlanQuery - The query reference to get active plan for prospect
 * @returns The extracted planId or null if not found
 */
export async function extractPlanIdFromThread(
  ctx: ToolContext,
  moduleName: string,
  getActivePlanQuery: any, // Query function reference from internal API
  logEvent?: ConvexWideEventLogger | null
): Promise<Id<"outreachPlans"> | null> {
  const prospectId = await extractProspectIdFromThread(
    ctx,
    moduleName,
    logEvent
  );

  if (!prospectId) {
    return null;
  }

  try {
    // Get active plan for this prospect
    const plan = await ctx.runQuery(getActivePlanQuery, { prospectId });
    return plan?._id ?? null;
  } catch {
    logEvent?.warn("Failed to get active plan", {
      agent_tool: {
        module: moduleName,
      },
      prospect: {
        id: prospectId,
      },
    });
    return null;
  }
}
