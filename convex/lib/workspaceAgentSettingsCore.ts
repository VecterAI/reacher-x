import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type WorkspaceAgentSettingsCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

export const DEFAULT_WORKSPACE_AGENT_AUTONOMY_MODE = "review_required" as const;

export async function getWorkspaceAgentSettingsRow(
  ctx: WorkspaceAgentSettingsCtx,
  workspaceId: Doc<"workspaces">["_id"]
) {
  return await ctx.db
    .query("workspaceAgentSettings")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .first();
}

export function getDefaultWorkspaceAgentSettings(
  workspace: Pick<Doc<"workspaces">, "_id" | "userId">
) {
  return {
    workspaceId: workspace._id,
    userId: workspace.userId,
    autonomyMode: DEFAULT_WORKSPACE_AGENT_AUTONOMY_MODE,
  };
}

export async function getResolvedWorkspaceAgentSettings(
  ctx: WorkspaceAgentSettingsCtx,
  workspace: Pick<Doc<"workspaces">, "_id" | "userId">
) {
  return (
    (await getWorkspaceAgentSettingsRow(ctx, workspace._id)) ??
    getDefaultWorkspaceAgentSettings(workspace)
  );
}
