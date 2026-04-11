import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type DiscoveryGraphNode = {
  kind: "search_query" | "conversation_seed" | "reply_post" | "prospect";
  platform?: "twitter" | "linkedin";
  internalId?: string;
  externalId?: string;
  label?: string;
  summary?: string;
};

export type DiscoveryEdgeContext = {
  matchedQueries?: string[];
  matchedReason?: string;
  score?: number;
  searchQuery?: string;
  rootTweetId?: string;
  replyTweetId?: string;
  twitterUserId?: string;
  acceptanceReason?: string;
  discardReason?: string;
};

export function buildDiscoveryNodeKey(node: DiscoveryGraphNode): string {
  return [
    node.kind,
    node.platform ?? "_",
    node.internalId ?? "_",
    node.externalId ?? "_",
  ].join(":");
}

function mergeUniqueStrings(
  left?: string[],
  right?: string[]
): string[] | undefined {
  const merged = Array.from(
    new Set([...(left ?? []), ...(right ?? [])].filter(Boolean))
  );

  return merged.length > 0 ? merged : undefined;
}

function mergeDiscoveryEdgeContext(
  current: DiscoveryEdgeContext | undefined,
  incoming: DiscoveryEdgeContext | undefined
): DiscoveryEdgeContext | undefined {
  if (!current && !incoming) {
    return undefined;
  }

  return {
    ...current,
    ...incoming,
    matchedQueries: mergeUniqueStrings(
      current?.matchedQueries,
      incoming?.matchedQueries
    ),
    matchedReason: incoming?.matchedReason ?? current?.matchedReason,
    searchQuery: incoming?.searchQuery ?? current?.searchQuery,
    rootTweetId: incoming?.rootTweetId ?? current?.rootTweetId,
    replyTweetId: incoming?.replyTweetId ?? current?.replyTweetId,
    twitterUserId: incoming?.twitterUserId ?? current?.twitterUserId,
    acceptanceReason: incoming?.acceptanceReason ?? current?.acceptanceReason,
    discardReason: incoming?.discardReason ?? current?.discardReason,
    score:
      incoming?.score !== undefined ? incoming.score : current?.score,
  };
}

export async function upsertDiscoveryEdgeInDb(
  db: MutationCtx["db"],
  args: {
    workspaceId: Id<"workspaces">;
    userId: Id<"users">;
    edgeType:
      | "search_query_to_prospect"
      | "matched_query_to_seed"
      | "seed_to_reply"
      | "reply_to_prospect";
    discoverySource: "search_post" | "conversation_reply";
    sourceNode: DiscoveryGraphNode;
    targetNode: DiscoveryGraphNode;
    context?: DiscoveryEdgeContext;
  }
) {
  const sourceKey = buildDiscoveryNodeKey(args.sourceNode);
  const targetKey = buildDiscoveryNodeKey(args.targetNode);
  const now = Date.now();

  const existing = await db
    .query("discoveryEdges")
    .withIndex("by_workspace_edge_keys", (q) =>
      q
        .eq("workspaceId", args.workspaceId)
        .eq("edgeType", args.edgeType)
        .eq("sourceKey", sourceKey)
        .eq("targetKey", targetKey)
    )
    .first();

  if (existing) {
    await db.patch(existing._id, {
      sourceNode: args.sourceNode,
      targetNode: args.targetNode,
      discoverySource: args.discoverySource,
      context: mergeDiscoveryEdgeContext(existing.context, args.context),
      updatedAt: now,
    });
    return existing._id;
  }

  return await db.insert("discoveryEdges", {
    workspaceId: args.workspaceId,
    userId: args.userId,
    edgeType: args.edgeType,
    discoverySource: args.discoverySource,
    sourceKey,
    targetKey,
    sourceNode: args.sourceNode,
    targetNode: args.targetNode,
    context: args.context,
    createdAt: now,
    updatedAt: now,
  });
}
