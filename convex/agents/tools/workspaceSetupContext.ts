import { type ToolCtx } from "@convex-dev/agent";
import { components, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import {
  getFallbackSetupThreadDraftState,
  parseSetupThreadState,
} from "../../lib/setupThreadHelpers";
import {
  DEFAULT_WORKSPACE_USE_CASE_KEY,
  type WorkspaceUseCaseKey,
} from "../../../shared/lib/workspaceUseCases";

export async function resolveSetupThreadState(
  ctx: ToolCtx,
  threadId: string | undefined
): Promise<{
  mode: "default" | "newWorkspace";
  useCaseKey: WorkspaceUseCaseKey;
} | null> {
  if (!threadId) {
    return null;
  }

  const thread = await ctx.runQuery(components.agent.threads.getThread, {
    threadId,
  });
  if (!thread) {
    return null;
  }

  const parsedState = parseSetupThreadState(thread.title);
  if (!parsedState) {
    const fallbackState = getFallbackSetupThreadDraftState();
    return {
      mode: fallbackState.mode,
      useCaseKey: fallbackState.useCaseKey,
    };
  }

  if (parsedState.kind === "draft") {
    return {
      mode: parsedState.mode,
      useCaseKey: parsedState.useCaseKey,
    };
  }

  const workspace = await ctx.runQuery(internal.workspaces.getById, {
    workspaceId: parsedState.workspaceId as Id<"workspaces">,
  });

  return {
    mode: "default",
    useCaseKey: workspace?.useCaseKey ?? DEFAULT_WORKSPACE_USE_CASE_KEY,
  };
}
