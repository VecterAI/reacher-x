import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalQuery, query } from "./lib/functionBuilders";
import { buildProspectSummaryRecord } from "./lib/readModelHelpers";
import {
  requireOwnedProspect,
  requireOwnedWorkspace,
  requireUser,
} from "./lib/accessHelpers";
import {
  prospectPlatformValidator,
  prospectStatusValidator,
} from "./validators";

export type SummaryDb = QueryCtx["db"] | MutationCtx["db"];
export type PaginationOpts = {
  cursor: string | null;
  numItems: number;
};

export type ListWorkspaceProspectSummariesArgs = {
  workspaceId: Id<"workspaces">;
  platform?: Doc<"prospects">["platform"];
  status?: Doc<"prospects">["status"];
  qualifiedOnly?: boolean;
  paginationOpts: PaginationOpts;
};

async function getProspectSummaryOrFallback(
  db: SummaryDb,
  prospectId: Id<"prospects">
) {
  const summary = await db
    .query("prospectSummaries")
    .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
    .first();

  if (summary) {
    return summary;
  }

  const prospect = await db.get(prospectId);
  return prospect ? buildProspectSummaryRecord(prospect) : null;
}

export async function listWorkspaceProspectSummariesPage(
  db: SummaryDb,
  args: ListWorkspaceProspectSummariesArgs
) {
  const { workspaceId, paginationOpts } = args;
  const platform = args.platform;
  const status = args.status;
  const qualifiedOnly = args.qualifiedOnly === true;

  if (platform && status && qualifiedOnly) {
    return await db
      .query("prospectSummaries")
      .withIndex("by_workspace_platform_status_ready_score", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("platform", platform)
          .eq("status", status)
          .eq("readyQualifiedEnriched", true)
      )
      .order("desc")
      .paginate(paginationOpts);
  }

  if (platform && status) {
    return await db
      .query("prospectSummaries")
      .withIndex("by_workspace_platform_status_score", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("platform", platform)
          .eq("status", status)
      )
      .order("desc")
      .paginate(paginationOpts);
  }

  if (platform && qualifiedOnly) {
    return await db
      .query("prospectSummaries")
      .withIndex("by_workspace_platform_ready_score", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("platform", platform)
          .eq("readyQualifiedEnriched", true)
      )
      .order("desc")
      .paginate(paginationOpts);
  }

  if (status && qualifiedOnly) {
    return await db
      .query("prospectSummaries")
      .withIndex("by_workspace_status_ready_score", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("status", status)
          .eq("readyQualifiedEnriched", true)
      )
      .order("desc")
      .paginate(paginationOpts);
  }

  if (platform) {
    return await db
      .query("prospectSummaries")
      .withIndex("by_workspace_platform_score", (q) =>
        q.eq("workspaceId", workspaceId).eq("platform", platform)
      )
      .order("desc")
      .paginate(paginationOpts);
  }

  if (status) {
    return await db
      .query("prospectSummaries")
      .withIndex("by_workspace_status_score", (q) =>
        q.eq("workspaceId", workspaceId).eq("status", status)
      )
      .order("desc")
      .paginate(paginationOpts);
  }

  if (qualifiedOnly) {
    return await db
      .query("prospectSummaries")
      .withIndex("by_workspace_ready_score", (q) =>
        q.eq("workspaceId", workspaceId).eq("readyQualifiedEnriched", true)
      )
      .order("desc")
      .paginate(paginationOpts);
  }

  return await db
    .query("prospectSummaries")
    .withIndex("by_workspace_score", (q) => q.eq("workspaceId", workspaceId))
    .order("desc")
    .paginate(paginationOpts);
}

export const getProspectSummaryInternal = internalQuery({
  args: {
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, { prospectId }) => {
    return await getProspectSummaryOrFallback(ctx.db, prospectId);
  },
});

export const getProspectSummary = query({
  args: {
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, { prospectId }) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedProspect(ctx, prospectId, {
      user,
      notFoundMessage: "Prospect not found",
      notAuthorizedMessage: "Not authorized to view this prospect",
    });

    return await getProspectSummaryOrFallback(ctx.db, prospectId);
  },
});

export const listWorkspaceProspectSummariesInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    platform: v.optional(prospectPlatformValidator),
    status: v.optional(prospectStatusValidator),
    qualifiedOnly: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return await listWorkspaceProspectSummariesPage(ctx.db, args);
  },
});

export const listWorkspaceProspectSummaries = query({
  args: {
    workspaceId: v.id("workspaces"),
    platform: v.optional(prospectPlatformValidator),
    status: v.optional(prospectStatusValidator),
    qualifiedOnly: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to view this workspace",
    });

    return await listWorkspaceProspectSummariesPage(ctx.db, args);
  },
});
