"use node";

// Shared agent tool: reads the real platform interaction history for the
// selected prospect. Thin Layer 1 wrapper over platform sync actions and the
// normalized Layer 3 interaction read model.

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import type { ProspectInteractionHistoryItem } from "../../../lib/prospectInteractionHistoryCore";
import { isCurrentConversationHistoryCursor } from "../../../lib/conversationHistoryPaginationCore";
import { parseIsoToTimestamp } from "../../../../shared/lib/utils/time/timeUtils";
import {
  AMBIGUOUS_PROSPECT_SELECTION_MESSAGE,
  MISSING_PROSPECT_SELECTION_MESSAGE,
  resolveSelectedThreadContext,
  type ToolContext,
} from "./helpers";

/**
 * NOTE: These Zod enums mirror the Convex validators in validators.ts.
 * This duplication is intentional because @convex-dev/agent requires Zod.
 */
const platformSchema = z.enum(["all", "twitter", "linkedin"]);
const kindSchema = z.enum(["dm", "comment", "reply"]);
const directionSchema = z.enum(["all", "sent", "received"]);
const MAX_AGENT_PROVIDER_HISTORY_PAGES = 4;
const AGENT_PROVIDER_HISTORY_PAGE_SIZE = 25;

type ProviderDmMessage = {
  id: string;
  createdAt?: string;
  direction: "sent" | "received";
  text?: string;
  attachments?: unknown[];
};

type ProviderHistoryPage = {
  messages: ProviderDmMessage[];
  history: {
    nextCursor?: string;
    hasMore: boolean;
    boundary?: "complete" | "x_30_day_limit";
  };
} | null;

type InteractionHistoryCoverage = {
  platform: "twitter" | "linkedin";
  hasConversation: boolean;
  lastSyncSuccessAt?: number;
  lastSyncAttemptAt?: number;
  syncError?: string;
  historyNextCursor?: string;
  historyHasMore: boolean;
  historyBoundary?: "complete" | "x_30_day_limit";
  historyOldestLoadedAt?: number;
  providerPagesFetched?: number;
  providerPageLimitReached?: boolean;
};

type ProspectInteractionHistoryResult = {
  prospect: {
    name: string;
    platform: "twitter" | "linkedin";
  };
  items: ProspectInteractionHistoryItem[];
  truncated: boolean;
  coverage: InteractionHistoryCoverage[];
  queriedAt: number;
};

type GetProspectInteractionHistoryResult =
  | {
      success: true;
      history: ProspectInteractionHistoryResult;
      refreshWarnings: string[];
    }
  | {
      success: false;
      history: null;
      error: string;
    };

function normalizeProviderMessage(
  platform: "twitter" | "linkedin",
  message: ProviderDmMessage
): ProspectInteractionHistoryItem {
  return {
    id: `${platform}:${message.id}`,
    kind: "dm",
    platform,
    direction: message.direction,
    occurredAt: message.createdAt
      ? (parseIsoToTimestamp(message.createdAt) ?? 0)
      : 0,
    text: message.text?.trim() || undefined,
    attachmentCount: Array.isArray(message.attachments)
      ? message.attachments.length
      : 0,
  };
}

function mergeHistoryItems(args: {
  cached: ProspectInteractionHistoryItem[];
  provider: ProspectInteractionHistoryItem[];
  direction: "all" | "sent" | "received";
  limit: number;
}) {
  const deduplicated = new Map<string, ProspectInteractionHistoryItem>();
  for (const item of [...args.cached, ...args.provider]) {
    // Cached DM ids are provider ids, while live page ids include the platform
    // prefix. Normalize both forms before merging the two sources.
    const normalizedId = item.id.includes(":")
      ? item.id
      : `${item.platform}:${item.id}`;
    deduplicated.set(normalizedId, { ...item, id: normalizedId });
  }
  const items = [...deduplicated.values()]
    .filter(
      (item) => args.direction === "all" || item.direction === args.direction
    )
    .sort((left, right) => right.occurredAt - left.occurredAt);

  return {
    items: items.slice(0, args.limit),
    truncated: items.length > args.limit,
  };
}

async function readProviderDmPages(args: {
  ctx: ToolContext;
  userId: Id<"users">;
  prospectId: Id<"prospects">;
  platform: "all" | "twitter" | "linkedin";
  cursor?: string;
  sinceMs?: number;
  cachedCoverage: InteractionHistoryCoverage[];
}) {
  const platforms =
    args.platform === "all"
      ? (["twitter", "linkedin"] as const)
      : ([args.platform] as const);
  const providerItems: ProspectInteractionHistoryItem[] = [];
  const pagination = new Map<
    "twitter" | "linkedin",
    Pick<
      InteractionHistoryCoverage,
      | "historyNextCursor"
      | "historyHasMore"
      | "historyBoundary"
      | "providerPagesFetched"
      | "providerPageLimitReached"
    >
  >();

  for (const platform of platforms) {
    const cached = args.cachedCoverage.find(
      (coverage) => coverage.platform === platform
    );
    let cursor = args.cursor ?? cached?.historyNextCursor;
    let pagesFetched = 0;
    let page: ProviderHistoryPage = null;
    const pageBudget =
      typeof args.sinceMs === "number" ? MAX_AGENT_PROVIDER_HISTORY_PAGES : 1;

    // A recent cached page already satisfies an ordinary read. We only issue
    // provider requests for an explicit continuation or date-range request.
    if (!args.cursor && typeof args.sinceMs !== "number") {
      continue;
    }
    if (!cursor) {
      pagination.set(platform, {
        historyNextCursor: undefined,
        historyHasMore: false,
        historyBoundary: cached?.historyBoundary,
        providerPagesFetched: 0,
      });
      continue;
    }

    while (cursor && pagesFetched < pageBudget) {
      page =
        platform === "twitter"
          ? await args.ctx.runAction(
              internal.x.getDmConversationHistoryPageInternal,
              {
                userId: args.userId,
                prospectId: args.prospectId,
                cursor,
                limit: AGENT_PROVIDER_HISTORY_PAGE_SIZE,
                ...(typeof args.sinceMs === "number"
                  ? { sinceMs: args.sinceMs }
                  : {}),
              }
            )
          : await args.ctx.runAction(
              internal.linkedin.getLinkedInConversationHistoryPageInternal,
              {
                userId: args.userId,
                prospectId: args.prospectId,
                cursor,
                limit: AGENT_PROVIDER_HISTORY_PAGE_SIZE,
                ...(typeof args.sinceMs === "number"
                  ? { sinceMs: args.sinceMs }
                  : {}),
              }
            );
      pagesFetched += 1;
      if (!page) {
        break;
      }
      providerItems.push(
        ...page.messages.map((message) =>
          normalizeProviderMessage(platform, message)
        )
      );
      cursor = page.history.nextCursor;
      if (typeof args.sinceMs !== "number" || !page.history.hasMore) {
        break;
      }
    }

    pagination.set(platform, {
      historyNextCursor: page?.history.nextCursor,
      historyHasMore: page?.history.hasMore ?? false,
      historyBoundary: page?.history.boundary ?? cached?.historyBoundary,
      providerPagesFetched: pagesFetched,
      providerPageLimitReached: Boolean(cursor) && pagesFetched >= pageBudget,
    });
  }

  return { providerItems, pagination };
}

export const getProspectInteractionHistory = createTool({
  description:
    "Read the actual interaction history between the workspace user and the selected prospect: X/Twitter or LinkedIn DMs, comments, and replies, including direction and timestamps. Use this before answering what was said, what happened, who replied, or how the relationship has progressed. For older DMs, pass the opaque cursor returned in coverage with exactly one platform; for a date range, pass since and inspect coverage for provider limits. You must disclose x_30_day_limit when X/Twitter coverage reports it. The selected prospect is resolved from the current prospect thread or an explicit tag in the main workspace thread.",
  inputSchema: z.object({
    platform: platformSchema
      .optional()
      .default("all")
      .describe("Read X, LinkedIn, or both platforms."),
    kinds: z
      .array(kindSchema)
      .min(1)
      .optional()
      .default(["dm", "comment", "reply"])
      .describe("Interaction types to include."),
    direction: directionSchema
      .optional()
      .default("all")
      .describe("Read sent interactions, received interactions, or both."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(20)
      .describe("Maximum number of interactions to return."),
    since: z
      .string()
      .datetime({ offset: true })
      .optional()
      .describe(
        "Optional ISO-8601 lower time boundary. The tool deliberately reads up to four bounded older DM pages to reach it."
      ),
    cursor: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Opaque older-DM cursor returned in coverage. Only valid with one platform and when DMs are included."
      ),
    refresh: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        "Refresh connected-platform DM snapshots before reading when possible."
      ),
  }),
  execute: async (ctx, args): Promise<GetProspectInteractionHistoryResult> => {
    try {
      const selected = await resolveSelectedThreadContext(
        ctx,
        "getProspectInteractionHistory"
      );
      if (!selected?.prospectId) {
        return {
          success: false as const,
          history: null,
          error:
            selected && selected.ambiguousProspectIds.length > 1
              ? AMBIGUOUS_PROSPECT_SELECTION_MESSAGE
              : MISSING_PROSPECT_SELECTION_MESSAGE,
        };
      }
      if (typeof ctx.userId !== "string") {
        return {
          success: false as const,
          history: null,
          error: "Could not resolve the current user.",
        };
      }

      const userId = ctx.userId as Id<"users">;
      const prospectId = selected.prospectId;
      if (args.cursor && args.platform === "all") {
        return {
          success: false as const,
          history: null,
          error:
            "An older-DM cursor is scoped to one platform. Choose X/Twitter or LinkedIn.",
        };
      }
      if (args.cursor && !args.kinds.includes("dm")) {
        return {
          success: false as const,
          history: null,
          error: "An older-DM cursor can only be used when DMs are included.",
        };
      }
      const sinceMs = args.since ? parseIsoToTimestamp(args.since) : undefined;
      if (args.since && typeof sinceMs !== "number") {
        return {
          success: false as const,
          history: null,
          error: "The since value must be a valid ISO-8601 timestamp.",
        };
      }
      const refreshWarnings: string[] = [];
      if (args.refresh && !args.cursor && args.kinds.includes("dm")) {
        const refreshes: Array<Promise<unknown>> = [];
        if (args.platform === "all" || args.platform === "twitter") {
          refreshes.push(
            ctx.runAction(internal.x.refreshProspectDmConversationInternal, {
              userId,
              prospectId,
            })
          );
        }
        if (args.platform === "all" || args.platform === "linkedin") {
          refreshes.push(
            ctx.runAction(
              internal.linkedin.getProspectLinkedInMessageStateInternal,
              { userId, prospectId }
            )
          );
        }

        const refreshResults = await Promise.allSettled(refreshes);
        for (const result of refreshResults) {
          if (result.status === "rejected") {
            refreshWarnings.push(
              result.reason instanceof Error
                ? result.reason.message
                : "A platform conversation refresh failed."
            );
          }
        }
      }

      const history: ProspectInteractionHistoryResult | null =
        await ctx.runQuery(
          internal.interactions.getProspectInteractionHistoryInternal,
          {
            userId,
            prospectId,
            platform: args.platform,
            kinds: args.kinds,
            direction: args.direction,
            limit: args.limit,
            sinceMs,
          }
        );
      if (!history) {
        return {
          success: false as const,
          history: null,
          error: "Prospect not found or unavailable to the current user.",
        };
      }

      if (args.cursor) {
        if (
          args.platform === "all" ||
          !isCurrentConversationHistoryCursor({
            cursor: args.cursor,
            platform: args.platform,
            coverage: history.coverage,
          })
        ) {
          return {
            success: false as const,
            history: null,
            error:
              "That older-DM cursor is no longer valid. Start a fresh history read.",
          };
        }
      }

      const providerRead = await readProviderDmPages({
        ctx,
        userId,
        prospectId,
        platform: args.platform,
        cursor: args.cursor,
        sinceMs,
        cachedCoverage: history.coverage,
      });
      const merged = mergeHistoryItems({
        cached: history.items,
        provider: providerRead.providerItems,
        direction: args.direction,
        limit: args.limit,
      });
      const coverage = history.coverage.map((coverageItem) => {
        const providerPagination = providerRead.pagination.get(
          coverageItem.platform
        );
        return providerPagination
          ? { ...coverageItem, ...providerPagination }
          : coverageItem;
      });

      return {
        success: true as const,
        history: {
          ...history,
          ...merged,
          truncated:
            history.truncated ||
            merged.truncated ||
            coverage.some((coverageItem) => coverageItem.historyHasMore),
          coverage,
        },
        refreshWarnings,
      };
    } catch (error) {
      return {
        success: false as const,
        history: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
