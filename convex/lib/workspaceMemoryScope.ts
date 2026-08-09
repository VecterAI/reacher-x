"use node";

import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { components, internal } from "../_generated/api";
import { parseSetupThreadState } from "./setupThreadHelpers";

export type ResolvedWorkspaceMemoryScope = {
  userId: Id<"users">;
  workspaceId: Id<"workspaces"> | null;
  prospectId: Id<"prospects"> | null;
};

type WorkspaceMemoryScopeReader = Pick<ActionCtx, "runQuery">;

export async function resolveWorkspaceMemoryScope(
  ctx: WorkspaceMemoryScopeReader,
  args: {
    userId: Id<"users">;
    threadId?: string;
    allowDefaultWorkspace?: boolean;
    onWarning?: (message: string) => void;
  }
): Promise<ResolvedWorkspaceMemoryScope> {
  let workspaceId: Id<"workspaces"> | null = null;
  let prospectId: Id<"prospects"> | null = null;
  const warn = args.onWarning ?? (() => undefined);

  if (args.threadId) {
    try {
      const context = await ctx.runQuery(
        internal.prospectThreads.getThreadProspectContext,
        { threadId: args.threadId }
      );
      if (context?.workspaceId && context.prospectId) {
        workspaceId = context.workspaceId;
        prospectId = context.prospectId;
      }
    } catch {
      warn("Failed to resolve prospect thread context");
    }
  }

  if (!workspaceId && args.threadId) {
    try {
      const session = await ctx.runQuery(
        internal.setupSessions.getByThreadIdInternal,
        { threadId: args.threadId }
      );
      workspaceId =
        session?.targetWorkspaceId ?? session?.existingWorkspaceId ?? null;
    } catch {
      warn("Failed to resolve setup session context");
    }
  }

  if (!workspaceId && args.threadId) {
    try {
      const context = await ctx.runQuery(
        internal.workspaceThreads.getThreadWorkspaceContext,
        { threadId: args.threadId }
      );
      workspaceId = context?.workspaceId ?? null;
    } catch {
      warn("Failed to resolve workspace thread context");
    }
  }

  if (!workspaceId && args.threadId) {
    try {
      const thread = await ctx.runQuery(components.agent.threads.getThread, {
        threadId: args.threadId,
      });
      const parsed = parseSetupThreadState(thread?.title);
      if (parsed?.kind === "workspace" && parsed.workspaceId) {
        workspaceId = parsed.workspaceId as Id<"workspaces">;
      }
    } catch {
      warn("Failed to resolve workspace from setup thread title");
    }
  }

  if (!workspaceId && args.allowDefaultWorkspace === true) {
    try {
      const workspace = await ctx.runQuery(
        internal.workspaces.getDefaultWorkspaceInternal,
        { userId: args.userId }
      );
      workspaceId = workspace?._id ?? null;
    } catch {
      warn("Failed to resolve the user's default workspace");
    }
  }

  return { userId: args.userId, workspaceId, prospectId };
}
