import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./lib/functionBuilders";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { icpValidator } from "./validators";
import { requireUser } from "./lib/accessHelpers";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { getWorkspaceUseCase } from "../shared/lib/workspaceUseCases";
import {
  describeWorkspaceProfileChanges,
  normalizeWorkspaceProfiles,
  validateWorkspaceProfiles,
} from "./lib/workspaceProfileChangeCore";
import { applyWorkspaceSettingsUpdateCore } from "./lib/workspaceSettingsCore";

type ProfileChangeRequest = Doc<"workspaceProfileChangeRequests">;

async function getPendingForWorkspace(
  ctx: Pick<MutationCtx, "db">,
  workspaceId: Id<"workspaces">
): Promise<ProfileChangeRequest | null> {
  return ctx.db
    .query("workspaceProfileChangeRequests")
    .withIndex("by_workspace_id_and_status", (q) =>
      q.eq("workspaceId", workspaceId).eq("status", "pending_approval")
    )
    .unique();
}

async function applyProfileChangeRequest(
  ctx: MutationCtx,
  args: {
    request: ProfileChangeRequest;
    userId: Id<"users">;
    proposedIcps?: ProfileChangeRequest["proposedIcps"];
  }
) {
  const { request, userId } = args;
  if (request.userId !== userId) {
    throw new Error("Workspace profile proposal not found.");
  }
  if (request.status === "applied") {
    return { outcome: "applied" as const, requestId: request._id };
  }
  if (request.status !== "pending_approval") {
    return { outcome: request.status, requestId: request._id };
  }

  const workspace = await ctx.db.get("workspaces", request.workspaceId);
  if (!workspace || workspace.userId !== userId) {
    throw new Error("Workspace not found.");
  }

  if (workspace.updatedAt !== request.baseWorkspaceUpdatedAt) {
    const now = getCurrentUTCTimestamp();
    await ctx.db.patch("workspaceProfileChangeRequests", request._id, {
      status: "stale",
      resolvedAt: now,
      updatedAt: now,
    });
    return { outcome: "stale" as const, requestId: request._id };
  }

  const proposedIcps = args.proposedIcps
    ? normalizeWorkspaceProfiles(args.proposedIcps)
    : request.proposedIcps;
  validateWorkspaceProfiles(proposedIcps);
  const changes = describeWorkspaceProfileChanges({
    currentProfiles: workspace.icps ?? [],
    proposedProfiles: proposedIcps,
  });

  const result = await applyWorkspaceSettingsUpdateCore(ctx, {
    workspace,
    updates: { icps: proposedIcps },
  });
  const now = getCurrentUTCTimestamp();
  await ctx.db.patch("workspaceProfileChangeRequests", request._id, {
    status: "applied",
    proposedIcps: result.appliedIcps ?? proposedIcps,
    ...changes,
    resolvedAt: now,
    updatedAt: now,
  });

  return {
    outcome: "applied" as const,
    requestId: request._id,
    regenerationScheduledCount: result.regenerationScheduledCount,
  };
}

export const getPendingForWorkspaceInternal = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<ProfileChangeRequest | null> =>
    ctx.db
      .query("workspaceProfileChangeRequests")
      .withIndex("by_workspace_id_and_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "pending_approval")
      )
      .unique(),
});

export const upsertPendingInternal = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    threadId: v.string(),
    proposedIcps: v.array(icpValidator),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    requestId: Id<"workspaceProfileChangeRequests">;
    revision: number;
    addedTitles: string[];
    updatedTitles: string[];
    removedTitles: string[];
  }> => {
    const workspace = await ctx.db.get("workspaces", args.workspaceId);
    if (!workspace || workspace.userId !== args.userId) {
      throw new Error("Workspace not found.");
    }

    const proposedIcps = normalizeWorkspaceProfiles(args.proposedIcps);
    validateWorkspaceProfiles(proposedIcps);
    const changes = describeWorkspaceProfileChanges({
      currentProfiles: workspace.icps ?? [],
      proposedProfiles: proposedIcps,
    });
    if (
      changes.addedTitles.length === 0 &&
      changes.updatedTitles.length === 0 &&
      changes.removedTitles.length === 0
    ) {
      throw new Error("The proposed ideal profiles match the saved workspace.");
    }

    const existing = await getPendingForWorkspace(ctx, args.workspaceId);
    const now = getCurrentUTCTimestamp();
    if (existing) {
      await ctx.db.patch("workspaceProfileChangeRequests", existing._id, {
        lastUpdatedInThreadId: args.threadId,
        baseWorkspaceUpdatedAt: workspace.updatedAt,
        proposedIcps,
        ...changes,
        revision: existing.revision + 1,
        updatedAt: now,
      });
      return {
        requestId: existing._id,
        revision: existing.revision + 1,
        ...changes,
      };
    }

    const requestId = await ctx.db.insert("workspaceProfileChangeRequests", {
      workspaceId: workspace._id,
      userId: args.userId,
      createdInThreadId: args.threadId,
      lastUpdatedInThreadId: args.threadId,
      status: "pending_approval",
      baseWorkspaceUpdatedAt: workspace.updatedAt,
      proposedIcps,
      ...changes,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });

    return { requestId, revision: 1, ...changes };
  },
});

export const approvePendingForWorkspaceInternal = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    | { outcome: "missing" }
    | {
        outcome: "applied" | "rejected" | "stale";
        requestId: Id<"workspaceProfileChangeRequests">;
        regenerationScheduledCount?: number;
      }
  > => {
    const request = await getPendingForWorkspace(ctx, args.workspaceId);
    if (!request) {
      return { outcome: "missing" as const };
    }
    return applyProfileChangeRequest(ctx, { request, userId: args.userId });
  },
});

export const rejectPendingForWorkspaceInternal = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    | { outcome: "missing" }
    | {
        outcome: "rejected";
        requestId: Id<"workspaceProfileChangeRequests">;
      }
  > => {
    const request = await getPendingForWorkspace(ctx, args.workspaceId);
    if (!request) {
      return { outcome: "missing" as const };
    }
    if (request.userId !== args.userId) {
      throw new Error("Workspace profile proposal not found.");
    }
    const now = getCurrentUTCTimestamp();
    await ctx.db.patch("workspaceProfileChangeRequests", request._id, {
      status: "rejected",
      resolvedAt: now,
      updatedAt: now,
    });
    return { outcome: "rejected" as const, requestId: request._id };
  },
});

export const getWorkspaceProfileChange = query({
  args: { requestId: v.id("workspaceProfileChangeRequests") },
  handler: async (
    ctx,
    args
  ): Promise<{
    requestId: Id<"workspaceProfileChangeRequests">;
    status: ProfileChangeRequest["status"];
    revision: number;
    profileLabelPlural: string;
    proposedProfiles: Array<{
      title: string;
      description: string;
      painPoints: string[];
      channels: string[];
    }>;
    addedTitles: string[];
    updatedTitles: string[];
    removedTitles: string[];
    workspaceName: string;
    removedProfiles: Array<{
      title: string;
      description: string;
      painPoints: string[];
      channels: string[];
    }>;
  } | null> => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    const request = await ctx.db.get(
      "workspaceProfileChangeRequests",
      args.requestId
    );
    if (!request || request.userId !== user._id) {
      return null;
    }
    const workspace = await ctx.db.get("workspaces", request.workspaceId);
    if (!workspace || workspace.userId !== user._id) {
      return null;
    }
    const useCase = getWorkspaceUseCase(workspace.useCaseKey);
    return {
      requestId: request._id,
      status: request.status,
      revision: request.revision,
      profileLabelPlural: useCase.profileLabelPlural,
      workspaceName: workspace.name,
      proposedProfiles: request.proposedIcps.map(
        ({ title, description, painPoints, channels }) => ({
          title,
          description,
          painPoints,
          channels,
        })
      ),
      addedTitles: request.addedTitles,
      updatedTitles: request.updatedTitles,
      removedTitles: request.removedTitles,
      removedProfiles: (workspace.icps ?? [])
        .filter((profile) => request.removedTitles.includes(profile.title))
        .map(({ title, description, painPoints, channels }) => ({
          title,
          description,
          painPoints,
          channels,
        })),
    };
  },
});

export const approveWorkspaceProfileChange = mutation({
  args: {
    requestId: v.id("workspaceProfileChangeRequests"),
    expectedRevision: v.optional(v.number()),
    proposedIcps: v.optional(v.array(icpValidator)),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    outcome: "applied" | "rejected" | "stale" | "superseded";
    requestId: Id<"workspaceProfileChangeRequests">;
    regenerationScheduledCount?: number;
  }> => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    const request = await ctx.db.get(
      "workspaceProfileChangeRequests",
      args.requestId
    );
    if (!request) {
      throw new Error("Workspace profile proposal not found.");
    }
    if (
      args.expectedRevision !== undefined &&
      request.revision !== args.expectedRevision
    ) {
      return { outcome: "superseded" as const, requestId: request._id };
    }
    return applyProfileChangeRequest(ctx, {
      request,
      userId: user._id,
      proposedIcps: args.proposedIcps,
    });
  },
});

export const rejectWorkspaceProfileChange = mutation({
  args: { requestId: v.id("workspaceProfileChangeRequests") },
  handler: async (
    ctx,
    args
  ): Promise<{
    outcome: "applied" | "rejected" | "stale";
    requestId: Id<"workspaceProfileChangeRequests">;
  }> => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    const request = await ctx.db.get(
      "workspaceProfileChangeRequests",
      args.requestId
    );
    if (!request || request.userId !== user._id) {
      throw new Error("Workspace profile proposal not found.");
    }
    if (request.status !== "pending_approval") {
      return { outcome: request.status, requestId: request._id };
    }
    const now = getCurrentUTCTimestamp();
    await ctx.db.patch("workspaceProfileChangeRequests", request._id, {
      status: "rejected",
      resolvedAt: now,
      updatedAt: now,
    });
    return { outcome: "rejected" as const, requestId: request._id };
  },
});
