type ConversationMessageLike = {
  id: string;
  createdAt?: string;
};

function toConversationMessageTimestamp(createdAt?: string): number {
  return createdAt ? (parseIsoToTimestamp(createdAt) ?? 0) : 0;
}

/** Merge overlapping provider pages while preserving chronological rendering. */
export function mergeConversationHistoryMessages<
  T extends ConversationMessageLike,
>(current: T[], incoming: T[]): T[] {
  const messagesById = new Map<string, T>();

  for (const message of incoming) {
    messagesById.set(message.id, message);
  }
  for (const message of current) {
    messagesById.set(message.id, message);
  }

  return [...messagesById.values()].sort((left, right) => {
    const timestampDifference =
      toConversationMessageTimestamp(left.createdAt) -
      toConversationMessageTimestamp(right.createdAt);
    return timestampDifference || left.id.localeCompare(right.id);
  });
}
import { parseIsoToTimestamp } from "@/shared/lib/utils/time/timeUtils";
