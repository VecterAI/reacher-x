"use node";

import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { agentMemoryRag, getWorkspaceNamespace } from "./agents/outreach/rag";
import { action } from "./lib/functionBuilders";
import { mergeTierOrderedProspectIds } from "./lib/prospectSearchMerge";
import { prospectStatusValidator } from "./validators";

const CURSOR_PREFIX = "psu1:";
const SEMANTIC_RAG_LIMIT = 120;
const FT_PAGE_BUFFER = 40;
const VECTOR_THRESHOLD = 0.32;

type UnifiedCursorV1 = {
  v: 1;
  q: string;
  ftCursor: string | null;
  sem: string[];
  pen: string[];
  del: string[];
  ftDone: boolean;
};

function encodeUnifiedCursor(state: UnifiedCursorV1): string {
  return `${CURSOR_PREFIX}${Buffer.from(JSON.stringify(state), "utf8").toString("base64url")}`;
}

function decodeUnifiedCursor(raw: string | undefined): UnifiedCursorV1 | null {
  if (!raw?.startsWith(CURSOR_PREFIX)) {
    return null;
  }
  try {
    const json = Buffer.from(
      raw.slice(CURSOR_PREFIX.length),
      "base64url"
    ).toString("utf8");
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const p = parsed as Record<string, unknown>;
    const stringIdList = (x: unknown) =>
      Array.isArray(x) && x.every((id) => typeof id === "string");
    if (
      p.v !== 1 ||
      typeof p.q !== "string" ||
      (p.ftCursor !== null && typeof p.ftCursor !== "string") ||
      typeof p.ftDone !== "boolean" ||
      !stringIdList(p.sem) ||
      !stringIdList(p.pen) ||
      !stringIdList(p.del)
    ) {
      return null;
    }
    return p as UnifiedCursorV1;
  } catch {
    return null;
  }
}

type UnifiedSearchResult = {
  page: Doc<"prospectSummaries">[];
  isDone: boolean;
  continueCursor: string;
};

export const searchProspectsUnified = action({
  args: {
    workspaceId: v.id("workspaces"),
    status: prospectStatusValidator,
    fitScoreMin: v.optional(v.number()),
    fitScoreMax: v.optional(v.number()),
    searchQuery: v.string(),
    paginationOpts: paginationOptsValidator,
    unifiedCursor: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<UnifiedSearchResult> => {
    const q = args.searchQuery.trim();
    if (!q) {
      throw new Error("searchQuery is required");
    }

    const numItems = args.paginationOpts.numItems;
    const prev = decodeUnifiedCursor(args.unifiedCursor);

    if (prev && prev.q !== q) {
      throw new Error("Search query changed; clear cursor");
    }

    let semanticOrderedIds: Id<"prospects">[] =
      (prev?.sem.map((s) => s as Id<"prospects">) as Id<"prospects">[]) ?? [];
    let ftCursor: string | null = prev?.ftCursor ?? null;
    const pending: string[] = prev?.pen ? [...prev.pen] : [];
    const pendingSet = new Set<string>(pending);
    const delivered = new Set<string>(prev?.del ?? []);
    let ftDone = prev?.ftDone ?? false;

    if (!prev) {
      try {
        const rag = await agentMemoryRag.search(ctx, {
          namespace: getWorkspaceNamespace(
            String(args.workspaceId),
            "prospect_search"
          ),
          query: q,
          limit: SEMANTIC_RAG_LIMIT,
          vectorScoreThreshold: VECTOR_THRESHOLD,
        });

        const seen = new Set<string>();
        semanticOrderedIds = [];
        for (const entry of rag.entries) {
          let pid = entry.metadata?.prospectId;
          if (
            typeof pid !== "string" &&
            entry.key?.startsWith("prospect-search:")
          ) {
            pid = entry.key.slice("prospect-search:".length);
          }
          if (typeof pid === "string" && pid.length > 0 && !seen.has(pid)) {
            seen.add(pid);
            semanticOrderedIds.push(pid as Id<"prospects">);
          }
        }
      } catch {
        semanticOrderedIds = [];
      }
    }

    const pushMerged = (ftPage: Doc<"prospectSummaries">[]) => {
      const merged = mergeTierOrderedProspectIds(ftPage, semanticOrderedIds);
      for (const id of merged) {
        const sid = String(id);
        if (!delivered.has(sid) && !pendingSet.has(sid)) {
          pendingSet.add(sid);
          pending.push(sid);
        }
      }
    };

    let guard = 0;
    while (pending.length < numItems && !ftDone && guard < 25) {
      guard += 1;
      const ftRes = (await ctx.runQuery(
        api.prospectSummaries.listWorkspaceProspectSummaries,
        {
          workspaceId: args.workspaceId,
          status: args.status,
          fitScoreMin: args.fitScoreMin,
          fitScoreMax: args.fitScoreMax,
          searchQuery: q,
          paginationOpts: {
            cursor: ftCursor,
            numItems: FT_PAGE_BUFFER,
          },
        }
      )) as {
        page: Doc<"prospectSummaries">[];
        isDone: boolean;
        continueCursor: string;
      };

      pushMerged(ftRes.page);
      ftCursor = ftRes.continueCursor || null;
      ftDone = ftRes.isDone;
      if (ftRes.page.length === 0 && ftRes.isDone) {
        break;
      }
    }

    const pageIds: Id<"prospects">[] = [];
    while (pageIds.length < numItems && pending.length > 0) {
      const next = pending.shift()!;
      pendingSet.delete(next);
      if (!delivered.has(next)) {
        delivered.add(next);
        pageIds.push(next as Id<"prospects">);
      }
    }

    const rows: Doc<"prospectSummaries">[] =
      pageIds.length === 0
        ? []
        : ((await ctx.runQuery(
            internal.prospectSummaries
              .getProspectSummariesByProspectIdsInternal,
            {
              workspaceId: args.workspaceId,
              prospectIds: pageIds,
            }
          )) as Doc<"prospectSummaries">[]);

    const byId = new Map(
      rows.map((r: Doc<"prospectSummaries">) => [String(r.prospectId), r])
    );
    const page: Doc<"prospectSummaries">[] = pageIds
      .map((id) => byId.get(String(id)))
      .filter((x): x is Doc<"prospectSummaries"> => x !== undefined);

    const isDone = ftDone && pending.length === 0;
    const continueCursor = isDone
      ? ""
      : encodeUnifiedCursor({
          v: 1,
          q,
          ftCursor,
          sem: semanticOrderedIds.map(String),
          pen: pending,
          del: [...delivered],
          ftDone,
        });

    return {
      page,
      isDone,
      continueCursor,
    };
  },
});
