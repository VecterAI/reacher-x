"use node";

import type { ContextHandler } from "@convex-dev/agent";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { getLatestPlanBatchUserPrompt } from "../lib/planBatchCore";
import { resolveWorkspaceMemoryScope } from "../lib/workspaceMemoryScope";

export function createWorkspaceMemoryContextHandler(
  surface: string
): ContextHandler {
  return async (ctx, args) => {
    if (!args.userId) {
      return args.allMessages;
    }

    try {
      const scope = await resolveWorkspaceMemoryScope(ctx, {
        userId: args.userId as Id<"users">,
        threadId: args.threadId,
        allowDefaultWorkspace: surface === "main",
        onWarning: (message) =>
          console.warn(`[WorkspaceMemoryContext] ${message}`),
      });
      if (!scope.workspaceId) {
        return args.allMessages;
      }

      const query =
        getLatestPlanBatchUserPrompt(args.inputPrompt) ??
        getLatestPlanBatchUserPrompt(args.allMessages) ??
        `${surface} workspace policy`;
      const memoryContext = await ctx.runAction(
        internal.memory.buildWorkspaceMemoryContextInternal,
        {
          workspaceId: scope.workspaceId,
          userId: scope.userId,
          query,
          surface,
          prospectId: scope.prospectId ?? undefined,
        }
      );
      if (!memoryContext.prompt) {
        return args.allMessages;
      }

      return [
        { role: "system" as const, content: memoryContext.prompt },
        ...args.allMessages,
      ];
    } catch (error) {
      console.warn(
        "[WorkspaceMemoryContext] Failed to inject workspace memory",
        error
      );
      return args.allMessages;
    }
  };
}
