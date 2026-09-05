import { v } from "convex/values";
import { query } from "./lib/functionBuilders";
import { requireOwnedWorkspace, requireUser } from "./lib/accessHelpers";
import { getWorkspaceReportingRollout } from "./lib/workspaceReportingRollout";
import { isSupportedWorkspaceReportingVersion } from "./lib/workspaceReportingAggregate";
import { getUserByIdentity } from "./lib/accessHelpers";
import { filterReportableWorkspaces } from "./lib/workspaceSetup";

export const getWorkspaceReportingStatus = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Workspace not found",
    });
    const rollout = await getWorkspaceReportingRollout(
      ctx.db,
      args.workspaceId
    );
    const ready =
      rollout?.status === "verified" &&
      isSupportedWorkspaceReportingVersion(rollout.aggregateVersion);

    return {
      ready,
      status: rollout?.status ?? "not_started",
      aggregateVersion: rollout?.aggregateVersion ?? null,
      updatedAt: rollout?.updatedAt ?? null,
    };
  },
});

export const getUserWorkspaceReportingStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { ready: false, workspaceCount: 0 };
    const user = await getUserByIdentity(ctx, identity);
    if (!user) return { ready: false, workspaceCount: 0 };
    const workspaces = filterReportableWorkspaces(
      await ctx.db
        .query("workspaces")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .take(100)
    );
    const rollouts = await Promise.all(
      workspaces.map((workspace) =>
        getWorkspaceReportingRollout(ctx.db, workspace._id)
      )
    );
    return {
      ready: rollouts.every(
        (rollout) =>
          rollout?.status === "verified" &&
          isSupportedWorkspaceReportingVersion(rollout.aggregateVersion)
      ),
      workspaceCount: workspaces.length,
    };
  },
});
