"use node";

// convex/agents/outreach/tools/helpers.ts
// Shared helper functions for outreach agent tools
// Single source of truth for ID extraction (per AGENT_CONTEXT.txt line 29-33)

import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import type { ConvexWideEventLogger } from "../../../lib/wideEventLogger";
import type { OutreachToolContext } from "../context";

// ============================================================================
// Types
// ============================================================================

/**
 * Tool context type - extracted from createTool handler signature.
 * Used by all tools that need to extract IDs from thread context.
 */
export type ToolContext = OutreachToolContext;
export type SelectedThreadContext = {
  routeKind: "prospect" | "workspace" | "setup" | "unknown";
  workspaceId: Id<"workspaces"> | null;
  prospectId: Id<"prospects"> | null;
  planId: Id<"outreachPlans"> | null;
  taskId: Id<"outreachTasks"> | null;
  postId: string | null;
  postPlatform: "twitter" | "linkedin" | null;
  postUrl: string | null;
  source: "thread" | "tagged" | "none";
  ambiguousProspectIds: string[];
};

export const MISSING_PROSPECT_SELECTION_MESSAGE =
  "Could not determine which prospect you mean. Tag a prospect, plan, task, or post, or open that prospect's thread.";

export const AMBIGUOUS_PROSPECT_SELECTION_MESSAGE =
  "Multiple prospects are selected right now. Narrow it to one prospect, or use the batch plan tools for multi-prospect changes.";

export async function resolveSelectedThreadContext(
  ctx: ToolContext,
  moduleName: string,
  logEvent?: ConvexWideEventLogger | null
): Promise<SelectedThreadContext | null> {
  const threadId = ctx.threadId;
  if (!threadId) {
    return null;
  }

  try {
    return await ctx.runQuery(
      internal.agentThreadContext.resolveSelectedContextForThread,
      {
        threadId,
      }
    );
  } catch {
    logEvent?.warn("Failed to resolve selected thread context", {
      agent_tool: {
        module: moduleName,
      },
    });
    return null;
  }
}

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

  const threadContext = await resolveSelectedThreadContext(
    ctx,
    moduleName,
    logEvent
  );

  if (!threadContext) {
    return { prospectId: null, workspaceId: null };
  }

  if (threadContext.ambiguousProspectIds.length > 1) {
    logEvent?.warn("Selected thread context is ambiguous", {
      agent_tool: {
        module: moduleName,
      },
      thread: {
        id: threadId,
      },
    });
    return {
      prospectId: null,
      workspaceId: threadContext.workspaceId,
    };
  }

  return {
    prospectId: threadContext.prospectId,
    workspaceId: threadContext.workspaceId,
  };
}

/**
 * Verifies the workspace style profile without hard-blocking outreach copy.
 *
 * Only a missing workspace link still blocks, because there is no context to
 * write for. A learning, syncing, or errored style profile proceeds with the
 * default voice (the agent prompt instructs the model to say so naturally and
 * to follow the outreach playbook), and the readiness outcome is returned so
 * callers can log or react to it.
 */
export async function ensureWorkspaceStyleReady(
  ctx: ToolContext,
  moduleName: string,
  workspaceId: Id<"workspaces"> | null,
  logEvent?: ConvexWideEventLogger | null
): Promise<
  | { ready: true; styleProfileReady: boolean }
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
    if (!workspace) {
      // The thread points at a workspace that no longer resolves. There is no
      // context to write for, so this still blocks.
      return {
        ready: false,
        message:
          "Writing style is unavailable because this conversation is not linked to a valid workspace.",
        error: "Missing workspace record",
      };
    }
    const styleProfileReady =
      workspace.styleProfileStatus === "ready" &&
      typeof workspace.styleProfileVersion === "number" &&
      workspace.styleProfileVersion > 0;

    if (!styleProfileReady) {
      logEvent?.info("Workspace style profile not ready; using default voice", {
        agent_tool: {
          module: moduleName,
        },
        workspace: {
          id: workspaceId,
        },
      });
    }

    return { ready: true, styleProfileReady };
  } catch {
    logEvent?.warn("Failed to verify workspace style status", {
      agent_tool: {
        module: moduleName,
      },
      workspace: {
        id: workspaceId ?? undefined,
      },
    });
    // Never block copy generation on a verification failure; the agent
    // proceeds with the default voice and the outreach playbook.
    return { ready: true, styleProfileReady: false };
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

export async function resolveExecutionThreadId(
  ctx: ToolContext,
  moduleName: string,
  logEvent?: ConvexWideEventLogger | null
): Promise<string | null> {
  if (!ctx.threadId) {
    return null;
  }

  const selectedContext = await resolveSelectedThreadContext(
    ctx,
    moduleName,
    logEvent
  );
  if (!selectedContext) {
    return ctx.threadId;
  }

  if (selectedContext.ambiguousProspectIds.length > 1) {
    logEvent?.warn("Cannot resolve execution thread with multiple prospects", {
      agent_tool: {
        module: moduleName,
      },
      thread: {
        id: ctx.threadId,
      },
    });
    return null;
  }

  const canonicalThreadContext = await ctx.runQuery(
    internal.prospectThreads.getThreadProspectContext,
    {
      threadId: ctx.threadId,
    }
  );
  if (
    canonicalThreadContext?.prospectId &&
    canonicalThreadContext.prospectId === selectedContext.prospectId
  ) {
    return ctx.threadId;
  }

  if (!selectedContext.prospectId) {
    return ctx.threadId;
  }

  try {
    const ensured = await ctx.runMutation(
      internal.prospectThreads.ensureActiveThreadForProspectInternal,
      {
        prospectId: selectedContext.prospectId,
      }
    );
    return ensured.threadId;
  } catch {
    logEvent?.warn("Failed to ensure canonical prospect execution thread", {
      agent_tool: {
        module: moduleName,
      },
      prospect: {
        id: selectedContext.prospectId,
      },
    });
    return null;
  }
}
