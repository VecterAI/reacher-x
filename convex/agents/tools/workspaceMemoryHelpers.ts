"use node";

// convex/agents/tools/workspaceMemoryHelpers.ts
// Shared helpers for workspace-scoped memory tools
//
// Follows AGENT_CONTEXT three-layer architecture:
// - This module lives in the Agent Tools layer and only contains thin
//   helpers for resolving workspace/prospect context from the current thread.

import type { ToolCtx } from "@convex-dev/agent";
import type { Id } from "../../_generated/dataModel";
import { resolveWorkspaceMemoryScope } from "../../lib/workspaceMemoryScope";
import type { ConvexWideEventLogger } from "../../lib/wideEventLogger";

export type ToolContext = ToolCtx;
type ToolContextWithPromptMessageId = ToolContext & {
  promptMessageId?: string;
};

export type WorkspaceMemoryContext = {
  userId: Id<"users"> | null;
  workspaceId: string | null;
  prospectId: string | null;
};

/**
 * The installed Agent component currently exposes the prompt message as
 * `promptMessageId` at runtime while its public ToolCtx type documents
 * `messageId`. Support both names centrally until the component aligns them.
 */
export function getToolPromptMessageId(ctx: ToolContext): string | undefined {
  return (
    ctx.messageId ?? (ctx as ToolContextWithPromptMessageId).promptMessageId
  );
}

/**
 * Resolve the current workspace + optional prospect context for a thread.
 *
 * Resolution order:
 * 1. Prospect threads via prospectThreads.getThreadProspectContext
 * 2. Setup sessions via setupSessions.getByThreadIdInternal
 * 3. Setup thread titles via parseSetupThreadState("setup:{workspaceId}")
 * The helper intentionally does not fall back to a default workspace. An
 * unresolved setup/new-workspace thread must never inherit another workspace.
 */
export async function resolveWorkspaceMemoryContext(
  ctx: ToolContext,
  moduleName: string,
  logEvent?: ConvexWideEventLogger | null
): Promise<WorkspaceMemoryContext> {
  const userId =
    typeof ctx.userId === "string" ? (ctx.userId as Id<"users">) : null;
  const threadId = ctx.threadId ?? null;

  if (!userId) {
    logEvent?.warn("Missing userId in tool context", {
      agent_tool: {
        module: moduleName,
      },
    });
    return { userId: null, workspaceId: null, prospectId: null };
  }

  const scope = await resolveWorkspaceMemoryScope(ctx, {
    userId,
    threadId: threadId ?? undefined,
    onWarning: (message) =>
      logEvent?.warn(message, {
        agent_tool: { module: moduleName },
        user: { id: userId },
      }),
  });
  return {
    userId: scope.userId,
    workspaceId: scope.workspaceId ? String(scope.workspaceId) : null,
    prospectId: scope.prospectId ? String(scope.prospectId) : null,
  };
}
