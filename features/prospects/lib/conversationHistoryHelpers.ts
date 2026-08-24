import { parseIsoToTimestamp } from "@/shared/lib/utils/time/timeUtils";

type ConversationMessageLike = {
  id: string;
  createdAt?: string;
};

type ConversationHistoryContext<
  TMessage extends ConversationMessageLike,
  THistory,
> = {
  conversationId?: string;
  messages: TMessage[];
  history?: THistory;
};

export const CONVERSATION_HISTORY_PRELOAD_DISTANCE_PX = 160;
export const INITIAL_CONVERSATION_HISTORY_PAGE_BUDGET = 3;

type ConversationHistoryRequestState = {
  hasMore: boolean;
  historyRequestKey?: string;
  isLoading: boolean;
  hasError: boolean;
};

/** A one-pixel tolerance avoids treating fractional layout rounding as overflow. */
export function isConversationViewportScrollable(args: {
  scrollHeight: number;
  clientHeight: number;
}): boolean {
  return args.scrollHeight - args.clientHeight > 1;
}

/**
 * Fill only the first visible viewport before revealing it. The page budget
 * prevents short provider pages from silently draining an entire transcript.
 */
export function shouldRequestInitialConversationHistory(
  args: ConversationHistoryRequestState & {
    isScrollable: boolean;
    requestsStarted: number;
    requestBudget?: number;
  }
): boolean {
  return Boolean(
    !args.isScrollable &&
    args.hasMore &&
    args.historyRequestKey &&
    !args.isLoading &&
    !args.hasError &&
    args.requestsStarted <
      (args.requestBudget ?? INITIAL_CONVERSATION_HISTORY_PAGE_BUDGET)
  );
}

/** Older pages are requested only after a real upward reader interaction. */
export function shouldRequestOlderConversationHistory(
  args: ConversationHistoryRequestState & {
    hasUserIntent: boolean;
    scrollTop: number;
    preloadDistance?: number;
  }
): boolean {
  return Boolean(
    args.hasUserIntent &&
    args.scrollTop <=
      (args.preloadDistance ?? CONVERSATION_HISTORY_PRELOAD_DISTANCE_PX) &&
    args.hasMore &&
    args.historyRequestKey &&
    !args.isLoading &&
    !args.hasError
  );
}

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

/**
 * Apply a refreshed newest page without discarding pages the reader already
 * loaded. Provider data wins for overlapping IDs so edits, reactions, and
 * delivery state stay current while the existing continuation cursor remains
 * at the oldest loaded boundary.
 */
export function reconcileConversationHistoryRefresh<
  TMessage extends ConversationMessageLike,
  THistory,
  TContext extends ConversationHistoryContext<TMessage, THistory>,
>(current: TContext | null, refreshed: TContext | null): TContext | null {
  if (!current || !refreshed) {
    return refreshed;
  }

  if (
    current.conversationId &&
    refreshed.conversationId &&
    current.conversationId !== refreshed.conversationId
  ) {
    return refreshed;
  }

  return {
    ...refreshed,
    messages: mergeConversationHistoryMessages(
      refreshed.messages,
      current.messages
    ),
    history: current.history ?? refreshed.history,
  };
}
