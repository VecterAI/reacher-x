import type { Id } from "../_generated/dataModel";
import type { ActionCtx as ConvexActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  embedAgentMemoryQuery,
  getAgentMemoryRag,
  getWorkspaceNamespace,
} from "../agents/outreach/rag";
import { logger } from "../../shared/lib/logger";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import type { ParsedAgentMemory } from "./agentMemoryCore";
import { createStableHash } from "./memoryHelpers";
import { logRagSearch } from "./ragSearchHelpers";
import {
  getCachedSharedMemorySemanticIds,
  setCachedSharedMemorySemanticIds,
} from "./sharedMemorySemanticCache";
import {
  buildWorkspaceMemoryContext as buildCanonicalWorkspaceMemoryContext,
  type CanonicalWorkspaceMemory,
  type WorkspaceMemoryContext,
  type WorkspaceMemoryContextRequest,
} from "./workspaceMemoryCore";

const memoryRuntimeLogger = logger.withScope("Memory");

export const SHARED_MEMORY_SEMANTIC_THRESHOLD = 0.55;
export const SHARED_MEMORY_SEMANTIC_NAMESPACES = [
  "lessons",
  "patterns",
  "objections",
  "wins",
  "losses",
  "style",
] as const;

export type LegacyOperatorMemoryRow = {
  memoryId: string;
  createdAt: number;
  parsed: ParsedAgentMemory;
};

export type WorkspaceMemoryContextSnapshot = {
  workspaceId: string;
  userId: string;
  ownsWorkspace: boolean;
  candidates: CanonicalWorkspaceMemory[];
  candidatesComplete: boolean;
  exactMatches: CanonicalWorkspaceMemory[];
  legacyOperatorRows: LegacyOperatorMemoryRow[];
  canonicalLegacyIds: string[];
};

export type WorkspaceMemoryContextActionCtx = Pick<
  ConvexActionCtx,
  "runQuery" | "runAction"
>;

export function buildWorkspaceMemorySearchQuery(args: {
  title?: string | null;
  briefIntro?: string | null;
  matchedKeywords?: string[];
  painPoints?: string[];
  finance?: string | null;
  additionalContext?: string[];
}): string {
  return [
    args.title ?? "",
    args.briefIntro ?? "",
    args.finance ?? "",
    ...(args.matchedKeywords ?? []),
    ...(args.painPoints ?? []),
    ...(args.additionalContext ?? []),
  ]
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(" ");
}

function buildLegacyOperatorFallbacks(
  request: WorkspaceMemoryContextRequest,
  legacyOperatorRows: LegacyOperatorMemoryRow[],
  canonicalLegacyIdSet: Set<string>
): CanonicalWorkspaceMemory[] {
  return legacyOperatorRows
    .filter((memory) => !canonicalLegacyIdSet.has(memory.memoryId))
    .map((memory) => {
      const instruction = [
        memory.parsed.summary,
        memory.parsed.narrative,
        ...memory.parsed.evidence,
      ]
        .map((value) => value.trim())
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index)
        .join("\n");
      return {
        memoryId: `legacy:${memory.memoryId}`,
        workspaceId: request.workspaceId,
        userId: request.userId,
        identityKey: `legacy:${memory.memoryId}`,
        legacyMemoryId: memory.memoryId,
        authority: "operator" as const,
        source: "operator" as const,
        category: memory.parsed.category,
        status: "active" as const,
        indexStatus: "ready" as const,
        kind: memory.parsed.category,
        title: memory.parsed.title,
        summary: memory.parsed.summary,
        canonicalContent: instruction,
        canonicalSearchText: instruction,
        instruction,
        metadata: {
          evidence: memory.parsed.evidence,
          relatedQueries: memory.parsed.relatedQueries,
          verbatimRecovered: false,
        },
        precedence: 1_000,
        confidence: memory.parsed.confidence,
        impactScore: memory.parsed.impactScore,
        prospectId: memory.parsed.prospectId,
        provenanceKind: "legacy_backfill" as const,
        ragNamespace: memory.parsed.namespace,
        ragKey: `legacy:${memory.memoryId}`,
        contentHash: createStableHash(instruction),
        createdAt: memory.createdAt,
        updatedAt: memory.createdAt,
      } satisfies CanonicalWorkspaceMemory;
    });
}

/**
 * Builds canonical + semantic workspace memory context inline inside any
 * Convex action (default V8 or `"use node"`), batching DB reads into a single
 * snapshot query and reusing one query embedding across all shared semantic
 * namespaces.
 */
export async function buildWorkspaceMemoryContextFromStore(
  ctx: WorkspaceMemoryContextActionCtx,
  request: WorkspaceMemoryContextRequest,
  {
    operatorOnly = false,
    preloadedSnapshot,
    skipSemanticWhenComplete = false,
  }: {
    operatorOnly?: boolean;
    preloadedSnapshot?: WorkspaceMemoryContextSnapshot;
    /**
     * Prompt-only callers (such as interactive Main/Setup chat) do not consume
     * `semanticMatches`. When every active workspace memory is already present
     * in `candidates`, semantic search cannot add any new candidate to `prompt`,
     * so skipping it avoids ~2 to 3s of embedding + vector search latency.
     */
    skipSemanticWhenComplete?: boolean;
  } = {}
): Promise<WorkspaceMemoryContext> {
  const ids = {
    workspaceId: request.workspaceId as Id<"workspaces">,
    userId: request.userId as Id<"users">,
  };

  const matchingPreloadedSnapshot =
    preloadedSnapshot &&
    preloadedSnapshot.workspaceId === request.workspaceId &&
    preloadedSnapshot.userId === request.userId
      ? preloadedSnapshot
      : undefined;

  const snapshot: WorkspaceMemoryContextSnapshot =
    matchingPreloadedSnapshot ??
    (await ctx.runQuery(
      internal.memory.loadWorkspaceMemoryContextSnapshotInternal,
      {
        ...ids,
        query: request.query,
      }
    ));

  if (!snapshot.ownsWorkspace) {
    return buildCanonicalWorkspaceMemoryContext({
      request,
      memories: [],
    });
  }

  const { candidates, exactMatches, legacyOperatorRows } = snapshot;
  const canonicalLegacyIds = new Set(snapshot.canonicalLegacyIds);
  const legacyOperatorFallbacks = buildLegacyOperatorFallbacks(
    request,
    legacyOperatorRows,
    canonicalLegacyIds
  );
  const rolloutCandidates = [...legacyOperatorFallbacks, ...candidates];

  if (operatorOnly) {
    // Learned memories (including semantic matches) are withheld entirely.
    return buildCanonicalWorkspaceMemoryContext({
      request,
      memories: [...exactMatches, ...rolloutCandidates].filter(
        (memory) => memory.authority === "operator"
      ),
    });
  }
  if (!request.query.trim()) {
    return buildCanonicalWorkspaceMemoryContext({
      request,
      memories: [...exactMatches, ...rolloutCandidates],
    });
  }

  // Semantic matches resolve through the canonical store, so a workspace with
  // no candidates and no legacy operator fallbacks cannot gain anything from
  // the shared namespace searches when all active rows were inspected. Skipping
  // them keeps qualification and outreach runs cheap for fresh/empty workspaces.
  if (rolloutCandidates.length === 0 && snapshot.candidatesComplete) {
    return buildCanonicalWorkspaceMemoryContext({
      request,
      memories: exactMatches,
    });
  }

  // Prompt-only callers do not use `semanticMatches`, and ranking only depends
  // on fields already on each candidate. When all active workspace memories
  // fit inside the candidate snapshot without truncation, semantic search
  // cannot add any memory to the rendered prompt.
  if (skipSemanticWhenComplete && snapshot.candidatesComplete) {
    const byId = new Map<string, CanonicalWorkspaceMemory>();
    for (const memory of [...exactMatches, ...rolloutCandidates]) {
      byId.set(memory.memoryId, memory);
    }
    return buildCanonicalWorkspaceMemoryContext({
      request,
      memories: [...byId.values()],
    });
  }

  const now = getCurrentUTCTimestamp();
  let semanticMemoryIds = getCachedSharedMemorySemanticIds({
    workspaceId: request.workspaceId,
    query: request.query,
    nowMs: now,
  });

  if (semanticMemoryIds) {
    logRagSearch({
      caller: "shared_workspace_memory_context",
      workspaceId: request.workspaceId,
      namespace: "shared",
      limit: 0,
      resultCount: semanticMemoryIds.length,
      durationMs: 0,
      outcome: "cache_hit",
    });
  } else {
    const embedStartedAt = getCurrentUTCTimestamp();
    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await embedAgentMemoryQuery(request.query);
    } catch (error) {
      logRagSearch({
        caller: "shared_workspace_memory_context",
        workspaceId: request.workspaceId,
        namespace: "shared",
        limit: 4,
        resultCount: 0,
        durationMs: getCurrentUTCTimestamp() - embedStartedAt,
        outcome: "error",
      });
      memoryRuntimeLogger.warn(
        "Shared workspace memory query embedding failed",
        {
          workspaceId: request.workspaceId,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }

    if (queryEmbedding) {
      const namespaceGroups = await Promise.all(
        SHARED_MEMORY_SEMANTIC_NAMESPACES.map(async (namespace) => {
          const searchStartedAt = getCurrentUTCTimestamp();
          try {
            const result = await getAgentMemoryRag().search(ctx, {
              namespace: getWorkspaceNamespace(request.workspaceId, namespace),
              query: queryEmbedding,
              limit: 4,
              vectorScoreThreshold: SHARED_MEMORY_SEMANTIC_THRESHOLD,
            });
            logRagSearch({
              caller: "shared_workspace_memory_context",
              workspaceId: request.workspaceId,
              namespace,
              limit: 4,
              resultCount: result.entries.length,
              durationMs: getCurrentUTCTimestamp() - searchStartedAt,
              outcome: "success",
            });
            return {
              memoryIds: result.entries
                .map((entry) => entry.metadata?.memoryItemId)
                .filter(
                  (memoryId): memoryId is string =>
                    typeof memoryId === "string" && memoryId.length > 0
                ),
              succeeded: true,
            };
          } catch (error) {
            logRagSearch({
              caller: "shared_workspace_memory_context",
              workspaceId: request.workspaceId,
              namespace,
              limit: 4,
              resultCount: 0,
              durationMs: getCurrentUTCTimestamp() - searchStartedAt,
              outcome: "error",
            });
            memoryRuntimeLogger.warn(
              "Shared workspace memory semantic search failed",
              {
                workspaceId: request.workspaceId,
                namespace,
                error: error instanceof Error ? error.message : String(error),
              }
            );
            return { memoryIds: [] as string[], succeeded: false };
          }
        })
      );

      const flattenedIds = [
        ...new Set(namespaceGroups.flatMap((group) => group.memoryIds)),
      ].slice(0, 64);
      if (namespaceGroups.every((group) => group.succeeded)) {
        setCachedSharedMemorySemanticIds({
          workspaceId: request.workspaceId,
          query: request.query,
          memoryIds: flattenedIds,
          nowMs: getCurrentUTCTimestamp(),
        });
      }
      semanticMemoryIds = flattenedIds;
    } else {
      semanticMemoryIds = [];
    }
  }

  const semanticMemories: CanonicalWorkspaceMemory[] = semanticMemoryIds.length
    ? await ctx.runQuery(
        internal.memory.getCanonicalWorkspaceMemoriesByIdsInternal,
        {
          ...ids,
          memoryIds: semanticMemoryIds,
        }
      )
    : [];

  const byId = new Map<string, CanonicalWorkspaceMemory>();
  for (const memory of [
    ...rolloutCandidates,
    ...exactMatches,
    ...semanticMemories,
  ]) {
    byId.set(memory.memoryId, memory);
  }
  const base = buildCanonicalWorkspaceMemoryContext({
    request,
    memories: [...byId.values()],
  });
  const applicableMemoryIds = new Set(base.memoryIds);
  const semanticMatches = semanticMemories
    .filter((memory) => applicableMemoryIds.has(memory.memoryId))
    .map((memory) => (byId.get(memory.memoryId) ?? memory).canonicalContent)
    .slice(0, 8);

  return {
    ...base,
    semanticMatches,
  };
}
