import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, query } from "./lib/functionBuilders";
import {
  requireOwnedProspect,
  requireOwnedWorkspace,
  requireUser,
} from "./lib/accessHelpers";
import {
  discoveryEdgeContextValidator,
  discoveryEdgeTypeValidator,
  discoveryGraphNodeValidator,
  prospectDiscoverySourceValidator,
} from "./validators";
import { buildDiscoveryNodeKey, upsertDiscoveryEdgeInDb } from "./lib/discoveryEdgesCore";

export const upsertDiscoveryEdgeInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    edgeType: discoveryEdgeTypeValidator,
    discoverySource: prospectDiscoverySourceValidator,
    sourceNode: discoveryGraphNodeValidator,
    targetNode: discoveryGraphNodeValidator,
    context: v.optional(discoveryEdgeContextValidator),
  },
  handler: async (ctx, args) => {
    return await upsertDiscoveryEdgeInDb(ctx.db, args);
  },
});

export const listWorkspaceDiscoveryEdges = query({
  args: {
    workspaceId: v.id("workspaces"),
    edgeType: v.optional(discoveryEdgeTypeValidator),
    discoverySource: v.optional(prospectDiscoverySourceValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Workspace not found",
    });

    let edges =
      args.edgeType !== undefined
        ? await ctx.db
            .query("discoveryEdges")
            .withIndex("by_workspace_edge_type", (q) =>
              q.eq("workspaceId", args.workspaceId).eq("edgeType", args.edgeType!)
            )
            .collect()
        : await ctx.db
            .query("discoveryEdges")
            .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
            .collect();

    if (args.discoverySource) {
      edges = edges.filter(
        (edge) => edge.discoverySource === args.discoverySource
      );
    }

    return edges.sort((left, right) => left.createdAt - right.createdAt);
  },
});

export const getProspectDiscoveryTrace = query({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const prospect = await requireOwnedProspect(ctx, args.prospectId, {
      user,
      notFoundMessage: "Prospect not found",
      notAuthorizedMessage: "Prospect not found",
    });

    const prospectKey = buildDiscoveryNodeKey({
      kind: "prospect",
      platform: prospect.platform,
      internalId: String(args.prospectId),
      externalId: prospect.externalId,
      label: prospect.displayName ?? undefined,
    });

    const collected = new Map<string, Doc<"discoveryEdges">>();
    const queue: Array<{ targetKey: string; depth: number }> = [
      { targetKey: prospectKey, depth: 0 },
    ];
    const visitedTargets = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visitedTargets.has(current.targetKey) || current.depth > 4) {
        continue;
      }

      visitedTargets.add(current.targetKey);
      const edges = await ctx.db
        .query("discoveryEdges")
        .withIndex("by_workspace_target_key", (q) =>
          q
            .eq("workspaceId", prospect.workspaceId)
            .eq("targetKey", current.targetKey)
        )
        .collect();

      for (const edge of edges) {
        collected.set(String(edge._id), edge);
        if (!visitedTargets.has(edge.sourceKey)) {
          queue.push({ targetKey: edge.sourceKey, depth: current.depth + 1 });
        }
      }
    }

    return Array.from(collected.values()).sort(
      (left, right) => left.createdAt - right.createdAt
    );
  },
});
