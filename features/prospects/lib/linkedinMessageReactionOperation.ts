import type { LinkedInConversationPanelContext } from "../../../shared/lib/linkedin/conversation";
import {
  isLinkedInMessageReaction,
  type LinkedInMessageReactionResult,
} from "../../../shared/lib/linkedin/messageReaction";
import {
  applyLinkedInViewerReaction,
  isViewerReactionSelected,
} from "./conversationReactionHelpers";

export class LinkedInMessageReactionRequestError extends Error {
  readonly code: string;
  readonly recovery: string;
  readonly retryable: boolean;

  constructor(
    result: Extract<LinkedInMessageReactionResult, { success: false }>
  ) {
    super(result.message);
    this.name = "LinkedInMessageReactionRequestError";
    this.code = result.code;
    this.recovery = result.recovery;
    this.retryable = result.retryable;
  }
}

export async function runLinkedInMessageReactionOperation(args: {
  operationKey: string;
  messageId: string;
  emoji: string;
  inFlightOperations: Set<string>;
  getData: () => LinkedInConversationPanelContext | null;
  isCurrent: () => boolean;
  setData: (data: LinkedInConversationPanelContext | null) => void;
  setPending: (pending: boolean) => void;
  addReaction: () => Promise<LinkedInMessageReactionResult>;
  refresh: () => Promise<unknown>;
}): Promise<"added" | "already_selected" | "deduplicated"> {
  if (!isLinkedInMessageReaction(args.emoji)) {
    throw new Error("This reaction is not supported on LinkedIn.");
  }
  if (args.inFlightOperations.has(args.operationKey)) {
    return "deduplicated";
  }

  const previousData = args.getData();
  const currentMessage = previousData?.messages.find(
    (message) => message.id === args.messageId
  );
  if (isViewerReactionSelected(currentMessage?.reactions, args.emoji)) {
    return "already_selected";
  }

  args.inFlightOperations.add(args.operationKey);
  args.setPending(true);
  if (previousData && args.isCurrent()) {
    args.setData({
      ...previousData,
      messages: previousData.messages.map((message) =>
        message.id === args.messageId
          ? {
              ...message,
              reactions: applyLinkedInViewerReaction(
                message.reactions,
                args.emoji
              ),
            }
          : message
      ),
    });
  }

  try {
    try {
      const result = await args.addReaction();
      if (!result.success) {
        throw new LinkedInMessageReactionRequestError(result);
      }
    } catch (error) {
      const latestData = args.getData();
      if (previousData && latestData && args.isCurrent()) {
        args.setData({
          ...latestData,
          messages: latestData.messages.map((message) =>
            message.id === args.messageId
              ? { ...message, reactions: currentMessage?.reactions }
              : message
          ),
        });
      }
      throw error;
    }

    try {
      if (args.isCurrent()) {
        await args.refresh();
      }
    } catch (error) {
      // The provider mutation already succeeded. Keep the optimistic state and
      // let the next webhook or panel refresh reconcile it instead of reporting
      // a false send failure and restoring a stale conversation snapshot.
      console.warn(
        "[LinkedInMessageReactionOperation] Reaction succeeded but refresh failed",
        error instanceof Error ? error.message : String(error)
      );
    }

    return "added";
  } finally {
    args.inFlightOperations.delete(args.operationKey);
    args.setPending(false);
  }
}
