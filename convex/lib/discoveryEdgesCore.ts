import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { buildChangedPatchWithUpdatedAt } from "./patchHelpers";

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

function sanitizeDiscoveryString(
  value: string | undefined
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = Array.from(makeStringWellFormed(value))
    .filter((char) => {
      const codePoint = char.codePointAt(0);
      if (codePoint === undefined) {
        return false;
      }

      const isAsciiControl =
        (codePoint >= 0x00 && codePoint <= 0x08) ||
        codePoint === 0x0b ||
        codePoint === 0x0c ||
        (codePoint >= 0x0e && codePoint <= 0x1f) ||
        codePoint === 0x7f;

      return !isAsciiControl;
    })
    .join("")
    .trim();

  return normalized.length > 0 ? normalized : undefined;
}

function makeStringWellFormed(value: string): string {
  let normalized = "";

  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);

    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit =
        index + 1 < value.length ? value.charCodeAt(index + 1) : undefined;

      if (
        nextCodeUnit !== undefined &&
        nextCodeUnit >= 0xdc00 &&
        nextCodeUnit <= 0xdfff
      ) {
        normalized += value[index] + value[index + 1];
        index += 1;
      } else {
        normalized += "\uFFFD";
      }
      continue;
    }

    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      normalized += "\uFFFD";
      continue;
    }

    normalized += value[index];
  }

  return normalized;
}

function sanitizeDiscoveryStringArray(
  values: string[] | undefined
): string[] | undefined {
  if (!Array.isArray(values)) {
    return undefined;
  }

  const sanitized = values
    .map((value) => sanitizeDiscoveryString(value))
    .filter((value): value is string => Boolean(value));

  return sanitized.length > 0 ? sanitized : undefined;
}

function sanitizeDiscoveryNode(node: DiscoveryGraphNode): DiscoveryGraphNode {
  return {
    kind: node.kind,
    platform: node.platform,
    internalId: sanitizeDiscoveryString(node.internalId),
    externalId: sanitizeDiscoveryString(node.externalId),
    label: sanitizeDiscoveryString(node.label),
    summary: sanitizeDiscoveryString(node.summary),
  };
}

function sanitizeDiscoveryEdgeContext(
  context: DiscoveryEdgeContext | undefined
): DiscoveryEdgeContext | undefined {
  if (!context) {
    return undefined;
  }

  return {
    matchedQueries: sanitizeDiscoveryStringArray(context.matchedQueries),
    matchedReason: sanitizeDiscoveryString(context.matchedReason),
    score: context.score,
    searchQuery: sanitizeDiscoveryString(context.searchQuery),
    rootTweetId: sanitizeDiscoveryString(context.rootTweetId),
    replyTweetId: sanitizeDiscoveryString(context.replyTweetId),
    twitterUserId: sanitizeDiscoveryString(context.twitterUserId),
    acceptanceReason: sanitizeDiscoveryString(context.acceptanceReason),
    discardReason: sanitizeDiscoveryString(context.discardReason),
  };
}

export function buildDiscoveryNodeKey(node: DiscoveryGraphNode): string {
  const sanitizedNode = sanitizeDiscoveryNode(node);
  return [
    sanitizedNode.kind,
    sanitizedNode.platform ?? "_",
    sanitizedNode.internalId ?? "_",
    sanitizedNode.externalId ?? "_",
  ].join(":");
}

function mergeUniqueStrings(
  left?: string[],
  right?: string[]
): string[] | undefined {
  return sanitizeDiscoveryStringArray(
    Array.from(new Set([...(left ?? []), ...(right ?? [])].filter(Boolean)))
  );
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
    matchedReason: sanitizeDiscoveryString(
      incoming?.matchedReason ?? current?.matchedReason
    ),
    searchQuery: sanitizeDiscoveryString(
      incoming?.searchQuery ?? current?.searchQuery
    ),
    rootTweetId: sanitizeDiscoveryString(
      incoming?.rootTweetId ?? current?.rootTweetId
    ),
    replyTweetId: sanitizeDiscoveryString(
      incoming?.replyTweetId ?? current?.replyTweetId
    ),
    twitterUserId: sanitizeDiscoveryString(
      incoming?.twitterUserId ?? current?.twitterUserId
    ),
    acceptanceReason: sanitizeDiscoveryString(
      incoming?.acceptanceReason ?? current?.acceptanceReason
    ),
    discardReason: sanitizeDiscoveryString(
      incoming?.discardReason ?? current?.discardReason
    ),
    score: incoming?.score !== undefined ? incoming.score : current?.score,
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
    discoverySource: "search_post" | "search_people" | "conversation_reply";
    sourceNode: DiscoveryGraphNode;
    targetNode: DiscoveryGraphNode;
    context?: DiscoveryEdgeContext;
  }
) {
  const sanitizedSourceNode = sanitizeDiscoveryNode(args.sourceNode);
  const sanitizedTargetNode = sanitizeDiscoveryNode(args.targetNode);
  const sanitizedContext = sanitizeDiscoveryEdgeContext(args.context);
  const sourceKey = buildDiscoveryNodeKey(sanitizedSourceNode);
  const targetKey = buildDiscoveryNodeKey(sanitizedTargetNode);
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
    const patch = buildChangedPatchWithUpdatedAt(
      existing as unknown as Record<string, unknown>,
      {
        sourceNode: sanitizedSourceNode,
        targetNode: sanitizedTargetNode,
        discoverySource: args.discoverySource,
        context: mergeDiscoveryEdgeContext(existing.context, sanitizedContext),
      },
      now
    );
    if (patch) {
      await db.patch(existing._id, patch);
    }
    return existing._id;
  }

  return await db.insert("discoveryEdges", {
    workspaceId: args.workspaceId,
    userId: args.userId,
    edgeType: args.edgeType,
    discoverySource: args.discoverySource,
    sourceKey,
    targetKey,
    sourceNode: sanitizedSourceNode,
    targetNode: sanitizedTargetNode,
    context: sanitizedContext,
    createdAt: now,
    updatedAt: now,
  });
}
