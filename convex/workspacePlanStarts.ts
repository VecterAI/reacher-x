import { v } from "convex/values";
import { internalMutation, query } from "./lib/functionBuilders";
import { requireOwnedWorkspace, requireUser } from "./lib/accessHelpers";
import {
  confirmLatestWorkspacePlanStartRun,
  getWorkspacePlanStartPreview,
  prepareWorkspacePlanStartRun,
  processWorkspacePlanStartBatch,
  releasePendingApprovalsBatch,
} from "./lib/workspacePlanStartCore";

export const getWorkspacePlanStartPreviewQuery = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to view this workspace",
    });
    return await getWorkspacePlanStartPreview(ctx, workspaceId);
  },
});

export const prepareWorkspacePlanStartRunInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    sourceThreadId: v.string(),
  },
  handler: async (ctx, args) =>
    await prepareWorkspacePlanStartRun(ctx, {
      ...args,
      source: "agent_command",
      requireConfirmation: true,
    }),
});

export const confirmLatestWorkspacePlanStartRunInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    sourceThreadId: v.string(),
  },
  handler: async (ctx, args) =>
    await confirmLatestWorkspacePlanStartRun(ctx, args),
});

export const processWorkspacePlanStartBatchInternal = internalMutation({
  args: {
    runId: v.id("workspacePlanStartRuns"),
  },
  handler: async (ctx, { runId }) => {
    await processWorkspacePlanStartBatch(ctx, runId);
    return null;
  },
});

export const releasePendingApprovalsBatchInternal = internalMutation({
  args: {
    runId: v.id("workspacePlanStartRuns"),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    await releasePendingApprovalsBatch(ctx, args);
    return null;
  },
});
