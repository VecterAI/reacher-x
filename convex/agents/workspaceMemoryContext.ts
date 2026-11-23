"use node";

import type { ContextHandler } from "@convex-dev/agent";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { buildSafeAgentContext } from "../lib/agentContextHelpers";
import { getLatestPlanBatchUserPrompt } from "../lib/planBatchCore";
import { buildWorkspaceMemoryContextFromStore } from "../lib/workspaceMemoryContextRuntime";

/**
 * Normalizes completed-turn reasoning for stateful Main/Setup threads and
 * injects applicable workspace memory inline (1 batched DB query + single-embed
 * semantic lookup) without an extra `ctx.runAction` hop.
 */
export function createWorkspaceMemoryContextHandler(
  surface: string
): ContextHandler {
  return async (ctx, args) => {
    const safeMessages = buildSafeAgentContext(args);
    if (!args.userId) {
      return safeMessages;
    }

    try {
      const query =
        getLatestPlanBatchUserPrompt(args.inputPrompt) ??
        getLatestPlanBatchUserPrompt(safeMessages) ??
        `${surface} workspace policy`;
      const loaded = await ctx.runQuery(
        internal.memory.loadWorkspaceMemoryContextSnapshotForThreadInternal,
        {
          userId: args.userId as Id<"users">,
          threadId: args.threadId,
          allowDefaultWorkspace: surface === "main",
          query,
        }
      );
      if (!loaded.scope.workspaceId || !loaded.snapshot) {
        return safeMessages;
      }

      const memoryContext = await buildWorkspaceMemoryContextFromStore(
        ctx,
        {
          workspaceId: String(loaded.scope.workspaceId),
          userId: String(loaded.scope.userId),
          query,
          surface,
          prospectId: loaded.scope.prospectId
            ? String(loaded.scope.prospectId)
            : undefined,
        },
        {
          preloadedSnapshot: loaded.snapshot,
          skipSemanticWhenComplete: true,
        }
      );
      if (!memoryContext.prompt) {
        return safeMessages;
      }

      return [
        { role: "system" as const, content: memoryContext.prompt },
        ...safeMessages,
      ];
    } catch (error) {
      console.warn(
        "[WorkspaceMemoryContext] Failed to inject workspace memory",
        error
      );
      return safeMessages;
    }
  };
}
