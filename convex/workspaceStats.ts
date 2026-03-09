import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalQuery, query } from "./lib/functionBuilders";
import { createEmptyWorkspaceStatsRecord } from "./lib/readModelHelpers";
import { requireOwnedWorkspace, requireUser } from "./lib/accessHelpers";

type WorkspaceStatsDb = QueryCtx["db"] | MutationCtx["db"];
export type WorkspaceStatsSnapshot = ReturnType<
  typeof createEmptyWorkspaceStatsRecord
>;

export async function getWorkspaceStatsSnapshot(args: {
  db: WorkspaceStatsDb;
  workspace: Pick<Doc<"workspaces">, "_id" | "userId">;
}): Promise<WorkspaceStatsSnapshot> {
  const existing = await args.db
    .query("workspaceStats")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspace._id))
    .first();

  if (existing) {
    return existing;
  }

  const emptyRecord = createEmptyWorkspaceStatsRecord({
    workspaceId: args.workspace._id,
    userId: args.workspace.userId,
  });
  return {
    ...emptyRecord,
    updatedAt: 0,
  };
}

export const getWorkspaceStatsInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) {
      return null;
    }

    return await getWorkspaceStatsSnapshot({ db: ctx.db, workspace });
  },
});

export const getWorkspaceStats = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    const workspace = await requireOwnedWorkspace(ctx, workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to view this workspace",
    });

    return await getWorkspaceStatsSnapshot({ db: ctx.db, workspace });
  },
});
