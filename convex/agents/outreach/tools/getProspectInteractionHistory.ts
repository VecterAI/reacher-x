"use node";

// Shared Agent tool: reads the real platform interaction history for the
// selected prospect. Provider cursors remain backend-owned; the Agent receives
// evidence about freshness and coverage, not pagination implementation details.

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import {
  AGENT_PROVIDER_HISTORY_PAGE_SIZE,
  getAgentProviderHistoryPageBudget,
  getInteractionHistoryEvidenceSource,
  normalizeInteractionHistoryConnectionState,
  shouldContinueAgentProviderHistoryRead,
  type InteractionHistoryConnectionState,
  type InteractionHistoryEvidenceSource,
  type InteractionHistoryXChatEvidence,
  type InteractionHistoryProviderEvidence,
  type ProspectInteractionHistoryItem,
} from "../../../lib/prospectInteractionHistoryCore";
import type { XChatConversationHistoryEvidence } from "../../../lib/xChatConversationHistoryCore";
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

export const getProspectInteractionHistoryInputSchema = z
  .object({
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
        "Optional ISO-8601 lower time boundary. The backend may read up to four bounded provider pages to cover it."
      ),
  })
  .strict();

type Platform = "twitter" | "linkedin";

type ProviderDmMessage = {
  id: string;
  createdAt?: string;
  direction: "sent" | "received";
  text?: string;
  attachments?: unknown[];
};

type ProviderHistoryPage = {
  conversationId: string;
  messages: ProviderDmMessage[];
  history: {
    nextCursor?: string;
    hasMore: boolean;
    boundary?: "complete" | "x_30_day_limit";
  };
} | null;

type InteractionHistoryCoverage = {
  platform: Platform;
  hasConversation: boolean;
  lastSyncSuccessAt?: number;
  lastSyncAttemptAt?: number;
  syncError?: string;
  historyHasMore: boolean;
  historyBoundary?: "complete" | "x_30_day_limit";
  historyOldestLoadedAt?: number;
};

type ProspectInteractionHistoryResult = {
  prospect: {
    name: string;
    platform: "twitter" | "linkedin";
  };
  items: ProspectInteractionHistoryItem[];
  truncated: boolean;
  coverage: InteractionHistoryCoverage[];
  evidence: InteractionHistoryProviderEvidence[];
  queriedAt: number;
};

type GetProspectInteractionHistoryResult =
  | {
      success: true;
      history: ProspectInteractionHistoryResult;
    }
  | {
      success: false;
      history: null;
      error: string;
    };

type ProviderRead = {
  platform: Platform;
  items: ProspectInteractionHistoryItem[];
  source: InteractionHistoryEvidenceSource;
  connection: InteractionHistoryConnectionState;
  refreshAttempted: boolean;
  refreshSucceeded: boolean;
  conversationFound: boolean;
  pagesFetched: number;
  pageLimitReached: boolean;
  historyHasMore: boolean;
  boundary?: "complete" | "x_30_day_limit";
  error?: string;
};

function getPlatforms(platform: "all" | Platform): Platform[] {
  return platform === "all" ? ["twitter", "linkedin"] : [platform];
}

function normalizeProviderMessage(
  platform: Platform,
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

function getProviderErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "The provider could not refresh this conversation.";
}

function getUnavailableConnectionMessage(
  platform: Platform,
  connection: InteractionHistoryConnectionState
): string | undefined {
  if (connection === "connected" || connection === "unknown") {
    return undefined;
  }
  const label = platform === "twitter" ? "X/Twitter" : "LinkedIn";
  return connection === "reconnect_required"
    ? `${label} needs to be reconnected before this conversation can be verified.`
    : `${label} is ${connection}, so this conversation cannot be verified live.`;
}

async function getConnectionState(args: {
  ctx: ToolContext;
  userId: Id<"users">;
  platform: Platform;
}): Promise<InteractionHistoryConnectionState> {
  try {
    const account =
      args.platform === "twitter"
        ? await args.ctx.runQuery(internal.xStore.getXAccountForUserInternal, {
            userId: args.userId,
          })
        : await args.ctx.runQuery(
            internal.linkedinStore.getLinkedInAccountForUserInternal,
            { userId: args.userId }
          );
    return account
      ? normalizeInteractionHistoryConnectionState(account.status)
      : "disconnected";
  } catch {
    return "unknown";
  }
}

async function getProviderHistoryPage(args: {
  ctx: ToolContext;
  userId: Id<"users">;
  prospectId: Id<"prospects">;
  platform: Platform;
  cursor?: string;
  sinceMs?: number;
}): Promise<ProviderHistoryPage> {
  const pageArgs = {
    userId: args.userId,
    prospectId: args.prospectId,
    limit: AGENT_PROVIDER_HISTORY_PAGE_SIZE,
    ...(args.cursor ? { cursor: args.cursor } : {}),
    ...(typeof args.sinceMs === "number" ? { sinceMs: args.sinceMs } : {}),
  };
  return args.platform === "twitter"
    ? await args.ctx.runAction(
        internal.x.getDmConversationHistoryPageInternal,
        pageArgs
      )
    : await args.ctx.runAction(
        internal.linkedin.getLinkedInConversationHistoryPageInternal,
        pageArgs
      );
}

async function readLiveProviderHistory(args: {
  ctx: ToolContext;
  userId: Id<"users">;
  prospectId: Id<"prospects">;
  platform: Platform;
  sinceMs?: number;
  hasCachedConversation: boolean;
}): Promise<ProviderRead> {
  const connectionPromise = getConnectionState(args);
  const pageBudget = getAgentProviderHistoryPageBudget(args.sinceMs);
  const items: ProspectInteractionHistoryItem[] = [];
  let cursor: string | undefined;
  let lastPage: ProviderHistoryPage = null;
  let pagesFetched = 0;

  try {
    do {
      const page = await getProviderHistoryPage({
        ...args,
        cursor,
      });
      pagesFetched += 1;
      if (!page) {
        const connection = await connectionPromise;
        const error = getUnavailableConnectionMessage(
          args.platform,
          connection
        );
        const refreshSucceeded = !error;
        return {
          platform: args.platform,
          items,
          source: getInteractionHistoryEvidenceSource({
            liveSucceeded: refreshSucceeded,
            hasCachedConversation: args.hasCachedConversation,
          }),
          connection,
          refreshAttempted: true,
          refreshSucceeded,
          conversationFound: items.length > 0,
          pagesFetched,
          pageLimitReached: false,
          historyHasMore: false,
          error,
        };
      }

      lastPage = page;
      items.push(
        ...page.messages.map((message) =>
          normalizeProviderMessage(args.platform, message)
        )
      );
      cursor = page.history.nextCursor;
    } while (
      shouldContinueAgentProviderHistoryRead({
        sinceMs: args.sinceMs,
        pagesFetched,
        nextCursor: cursor,
        hasMore: lastPage?.history.hasMore ?? false,
      })
    );

    const connection = await connectionPromise;
    return {
      platform: args.platform,
      items,
      source: "live",
      connection,
      refreshAttempted: true,
      refreshSucceeded: true,
      conversationFound: Boolean(lastPage),
      pagesFetched,
      pageLimitReached:
        pagesFetched >= pageBudget && lastPage?.history.hasMore === true,
      historyHasMore: lastPage?.history.hasMore ?? false,
      boundary: lastPage?.history.boundary,
    };
  } catch (error) {
    const connection = await connectionPromise;
    return {
      platform: args.platform,
      items,
      source: getInteractionHistoryEvidenceSource({
        liveSucceeded: false,
        hasCachedConversation: args.hasCachedConversation,
      }),
      connection,
      refreshAttempted: true,
      refreshSucceeded: false,
      conversationFound: items.length > 0,
      pagesFetched,
      pageLimitReached: false,
      historyHasMore: false,
      error: getProviderErrorMessage(error),
    };
  }
}

function unavailableXChatEvidence(args: {
  connection: InteractionHistoryConnectionState;
  error?: string;
}): InteractionHistoryXChatEvidence {
  return {
    source: "failed",
    connection: args.connection,
    refreshAttempted: true,
    refreshSucceeded: false,
    conversationFound: false,
    conversationLookupComplete: false,
    encrypted: false,
    contentState: "unavailable",
    conversationPagesFetched: 0,
    eventPagesFetched: 0,
    eventCount: 0,
    inboundEventCount: 0,
    outboundEventCount: 0,
    unattributedEventCount: 0,
    hasMore: false,
    pageLimitReached: false,
    ...(args.error ? { error: args.error } : {}),
  };
}

/**
 * XChat evidence is intentionally separate from legacy DMs. The provider
 * action returns only encrypted-envelope metadata, never ciphertext or text.
 */
async function readLiveXChatEvidence(args: {
  ctx: ToolContext;
  userId: Id<"users">;
  prospectId: Id<"prospects">;
  sinceMs?: number;
}): Promise<InteractionHistoryXChatEvidence> {
  const connectionPromise = getConnectionState({
    ctx: args.ctx,
    userId: args.userId,
    platform: "twitter",
  });

  try {
    const result: XChatConversationHistoryEvidence | null =
      await args.ctx.runAction(
        internal.x.getXChatConversationHistoryEvidenceInternal,
        {
          userId: args.userId,
          prospectId: args.prospectId,
          limit: AGENT_PROVIDER_HISTORY_PAGE_SIZE,
          ...(typeof args.sinceMs === "number"
            ? { sinceMs: args.sinceMs }
            : {}),
        }
      );
    const connection = await connectionPromise;
    if (!result) {
      return unavailableXChatEvidence({
        connection,
        error:
          getUnavailableConnectionMessage("twitter", connection) ??
          "XChat history could not be verified for this prospect.",
      });
    }

    return {
      ...result,
      source: "live",
      connection,
      refreshAttempted: true,
      refreshSucceeded: true,
    };
  } catch (error) {
    const connection = await connectionPromise;
    return unavailableXChatEvidence({
      connection,
      error: getProviderErrorMessage(error),
    });
  }
}

function readCachedProviderHistory(args: {
  platform: Platform;
  hasCachedConversation: boolean;
  connection: InteractionHistoryConnectionState;
}): ProviderRead {
  return {
    platform: args.platform,
    items: [],
    source: "cached",
    connection: args.connection,
    refreshAttempted: false,
    refreshSucceeded: false,
    conversationFound: args.hasCachedConversation,
    pagesFetched: 0,
    pageLimitReached: false,
    historyHasMore: false,
  };
}

export const getProspectInteractionHistory = createTool({
  description:
    "Read the actual interaction history between the workspace user and the selected prospect: X/Twitter or LinkedIn DMs, comments, and replies, including direction and timestamps. Use this before answering what was said, what happened, who replied, or how the relationship has progressed. Each item's attachmentCount reports media that exists in the conversation, but the attachment contents are not provided to the Agent. The backend owns provider pagination: a normal read fetches the latest bounded DM page, and a since read may fetch up to four bounded pages. Never ask for or provide provider cursors. Inspect history.evidence before drawing conclusions: live means the provider read succeeded now; cached means a live read could not be verified and the items are previously synced; failed means no trustworthy DM evidence was available. X/Twitter evidence separates readable legacyDm coverage from optional encrypted xChat metadata; encrypted_locked XChat evidence has counts, direction, timestamps, and pagination coverage but no readable message text. Disclose an X/Twitter x_30_day_limit boundary when present. The selected prospect is resolved from the current prospect thread or an explicit tag in the main workspace thread.",
  inputSchema: getProspectInteractionHistoryInputSchema,
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
      const sinceMs = args.since ? parseIsoToTimestamp(args.since) : undefined;
      if (args.since && typeof sinceMs !== "number") {
        return {
          success: false as const,
          history: null,
          error: "The since value must be a valid ISO-8601 timestamp.",
        };
      }

      const cachedHistory: Omit<
        ProspectInteractionHistoryResult,
        "evidence"
      > | null = await ctx.runQuery(
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
      if (!cachedHistory) {
        return {
          success: false as const,
          history: null,
          error: "Prospect not found or unavailable to the current user.",
        };
      }

      const platforms = getPlatforms(args.platform);
      const [providerReads, xChatEvidence] = await Promise.all([
        args.kinds.includes("dm")
          ? Promise.all(
              platforms.map((platform) =>
                readLiveProviderHistory({
                  ctx,
                  userId,
                  prospectId,
                  platform,
                  sinceMs,
                  hasCachedConversation: Boolean(
                    cachedHistory.coverage.find(
                      (coverage) => coverage.platform === platform
                    )?.hasConversation
                  ),
                })
              )
            )
          : Promise.all(
              platforms.map(async (platform) =>
                readCachedProviderHistory({
                  platform,
                  hasCachedConversation: Boolean(
                    cachedHistory.coverage.find(
                      (coverage) => coverage.platform === platform
                    )?.hasConversation
                  ),
                  connection: await getConnectionState({
                    ctx,
                    userId,
                    platform,
                  }),
                })
              )
            ),
        args.kinds.includes("dm") && platforms.includes("twitter")
          ? readLiveXChatEvidence({
              ctx,
              userId,
              prospectId,
              sinceMs,
            })
          : Promise.resolve(undefined),
      ]);

      const history: Omit<ProspectInteractionHistoryResult, "evidence"> | null =
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

      const readsByPlatform = new Map(
        providerReads.map((read) => [read.platform, read] as const)
      );
      const merged = mergeHistoryItems({
        cached: history.items,
        provider: providerReads.flatMap((read) => read.items),
        direction: args.direction,
        limit: args.limit,
      });
      const coverage = history.coverage.map((coverageItem) => {
        const read = readsByPlatform.get(coverageItem.platform);
        return {
          ...coverageItem,
          historyHasMore: read?.historyHasMore ?? coverageItem.historyHasMore,
          historyBoundary: read?.boundary ?? coverageItem.historyBoundary,
          providerPagesFetched: read?.pagesFetched ?? 0,
          providerPageLimitReached: read?.pageLimitReached ?? false,
        };
      });
      const evidence = coverage.map((coverageItem) => {
        const read = readsByPlatform.get(coverageItem.platform);
        const lastSuccessfulSyncAt = coverageItem.lastSyncSuccessAt;
        return {
          platform: coverageItem.platform,
          source: read?.source ?? "cached",
          connection: read?.connection ?? "unknown",
          refreshAttempted: read?.refreshAttempted ?? false,
          refreshSucceeded: read?.refreshSucceeded ?? false,
          conversationFound:
            read?.conversationFound ?? coverageItem.hasConversation,
          pagesFetched: read?.pagesFetched ?? 0,
          pageLimitReached: read?.pageLimitReached ?? false,
          lastSuccessfulSyncAt,
          lastSyncAttemptAt: coverageItem.lastSyncAttemptAt,
          staleForMs:
            typeof lastSuccessfulSyncAt === "number"
              ? Math.max(0, history.queriedAt - lastSuccessfulSyncAt)
              : undefined,
          boundary: read?.boundary ?? coverageItem.historyBoundary,
          error: read?.error ?? coverageItem.syncError,
          legacyDm: {
            source: read?.source ?? "cached",
            conversationFound:
              read?.conversationFound ?? coverageItem.hasConversation,
            pagesFetched: read?.pagesFetched ?? 0,
            pageLimitReached: read?.pageLimitReached ?? false,
            hasMore: read?.historyHasMore ?? coverageItem.historyHasMore,
            boundary: read?.boundary ?? coverageItem.historyBoundary,
            error: read?.error ?? coverageItem.syncError,
          },
          ...(coverageItem.platform === "twitter" && xChatEvidence
            ? { xChat: xChatEvidence }
            : {}),
        } satisfies InteractionHistoryProviderEvidence;
      });

      return {
        success: true as const,
        history: {
          ...history,
          ...merged,
          truncated:
            history.truncated ||
            merged.truncated ||
            coverage.some(
              (coverageItem) =>
                coverageItem.historyHasMore ||
                coverageItem.providerPageLimitReached
            ) ||
            xChatEvidence?.hasMore === true ||
            xChatEvidence?.pageLimitReached === true,
          coverage,
          evidence,
        },
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
