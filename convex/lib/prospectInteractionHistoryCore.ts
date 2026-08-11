import type { Doc } from "../_generated/dataModel";
import type { Infer } from "convex/values";
import type {
  prospectInteractionHistoryDirectionValidator,
  prospectInteractionHistoryKindValidator,
  prospectInteractionHistoryPlatformValidator,
} from "../validators";

export type ProspectInteractionHistoryPlatform = Infer<
  typeof prospectInteractionHistoryPlatformValidator
>;
export type ProspectInteractionHistoryKind = Infer<
  typeof prospectInteractionHistoryKindValidator
>;
export type ProspectInteractionHistoryDirection = Infer<
  typeof prospectInteractionHistoryDirectionValidator
>;

export type ProspectInteractionHistoryItem = {
  /** Stable provider/document id used to deduplicate cached and live pages. */
  id: string;
  kind: ProspectInteractionHistoryKind;
  platform: "twitter" | "linkedin";
  direction: "sent" | "received";
  occurredAt: number;
  text?: string;
  context?: string;
  url?: string;
  status?: string;
  attachmentCount: number;
};

export const AGENT_PROVIDER_HISTORY_PAGE_SIZE = 25;
export const MAX_AGENT_PROVIDER_HISTORY_PAGES = 4;

export type InteractionHistoryEvidenceSource = "live" | "cached" | "failed";

export type InteractionHistoryConnectionState =
  | "connected"
  | "disconnected"
  | "reconnect_required"
  | "action_required"
  | "restricted"
  | "unknown";

export type InteractionHistoryProviderEvidence = {
  platform: "twitter" | "linkedin";
  source: InteractionHistoryEvidenceSource;
  connection: InteractionHistoryConnectionState;
  refreshAttempted: boolean;
  refreshSucceeded: boolean;
  conversationFound: boolean;
  pagesFetched: number;
  pageLimitReached: boolean;
  lastSuccessfulSyncAt?: number;
  lastSyncAttemptAt?: number;
  staleForMs?: number;
  boundary?: "complete" | "x_30_day_limit";
  error?: string;
};

/** Normalize provider-specific account statuses for Agent-facing evidence. */
export function normalizeInteractionHistoryConnectionState(
  status?: string
): InteractionHistoryConnectionState {
  switch (status) {
    case "connected":
      return "connected";
    case "reconnect_required":
    case "expired":
      return "reconnect_required";
    case "action_required":
      return "action_required";
    case "restricted":
      return "restricted";
    case "disconnected":
      return "disconnected";
    default:
      return "unknown";
  }
}

/** Latest reads use one bounded page; date-range reads may walk a small budget. */
export function getAgentProviderHistoryPageBudget(sinceMs?: number): number {
  return typeof sinceMs === "number" ? MAX_AGENT_PROVIDER_HISTORY_PAGES : 1;
}

/** Provider cursors stay backend-owned for Agent reads. */
export function shouldContinueAgentProviderHistoryRead(args: {
  sinceMs?: number;
  pagesFetched: number;
  nextCursor?: string;
  hasMore: boolean;
}): boolean {
  return (
    typeof args.sinceMs === "number" &&
    args.pagesFetched < MAX_AGENT_PROVIDER_HISTORY_PAGES &&
    args.hasMore &&
    typeof args.nextCursor === "string" &&
    args.nextCursor.length > 0
  );
}

/** Preserve whether the Agent is reasoning over live data or a fallback. */
export function getInteractionHistoryEvidenceSource(args: {
  liveSucceeded: boolean;
  hasCachedConversation: boolean;
}): InteractionHistoryEvidenceSource {
  if (args.liveSucceeded) {
    return "live";
  }
  return args.hasCachedConversation ? "cached" : "failed";
}

type ConversationMessage = Pick<
  Doc<"platformConversationMessages">,
  | "platform"
  | "direction"
  | "createdAtMs"
  | "text"
  | "attachments"
  | "readAt"
  | "deliveredAt"
  | "messageId"
>;

type PublicInteraction = Pick<
  Doc<"prospectInteractions">,
  | "platform"
  | "interactionType"
  | "direction"
  | "repliedAt"
  | "replyText"
  | "sourcePostSummary"
  | "replyPostSummary"
  | "replyPostRef"
  | "sourceUrl"
  | "status"
  | "_id"
>;

function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeConversationMessage(
  message: ConversationMessage
): ProspectInteractionHistoryItem {
  const status =
    message.direction === "sent"
      ? typeof message.readAt === "number"
        ? "read"
        : typeof message.deliveredAt === "number"
          ? "delivered"
          : "sent"
      : "received";

  return {
    id: message.messageId,
    kind: "dm",
    platform: message.platform,
    direction: message.direction,
    occurredAt: message.createdAtMs,
    text: normalizeOptionalText(message.text),
    status,
    attachmentCount: message.attachments?.length ?? 0,
  };
}

export function normalizePublicInteraction(
  interaction: PublicInteraction
): ProspectInteractionHistoryItem {
  const kind = interaction.interactionType?.includes("comment")
    ? "comment"
    : "reply";
  const direction = interaction.direction === "incoming" ? "received" : "sent";

  return {
    id: String(interaction._id),
    kind,
    platform: interaction.platform,
    direction,
    occurredAt: interaction.repliedAt,
    text: normalizeOptionalText(
      interaction.replyText ?? interaction.replyPostSummary?.textPreview
    ),
    context: normalizeOptionalText(interaction.sourcePostSummary?.textPreview),
    url: interaction.replyPostRef?.url ?? interaction.sourceUrl,
    status: interaction.status ?? "active",
    attachmentCount: 0,
  };
}

export function filterProspectInteractionHistory(args: {
  items: ProspectInteractionHistoryItem[];
  platform: ProspectInteractionHistoryPlatform;
  kinds: ProspectInteractionHistoryKind[];
  direction: ProspectInteractionHistoryDirection;
  limit: number;
}) {
  const kinds = new Set(args.kinds);
  const matchingItems = args.items
    .filter(
      (item) => args.platform === "all" || item.platform === args.platform
    )
    .filter((item) => kinds.has(item.kind))
    .filter(
      (item) => args.direction === "all" || item.direction === args.direction
    )
    .sort((left, right) => right.occurredAt - left.occurredAt);

  return {
    items: matchingItems.slice(0, args.limit),
    truncated: matchingItems.length > args.limit,
  };
}
