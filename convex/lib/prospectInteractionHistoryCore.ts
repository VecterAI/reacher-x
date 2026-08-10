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
