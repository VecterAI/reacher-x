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
    const result = await args.addReaction();
    if (!result.success) {
      throw new LinkedInMessageReactionRequestError(result);
    }
    if (args.isCurrent()) {
      await args.refresh();
    }
    return "added";
  } catch (error) {
    if (args.isCurrent()) {
      args.setData(previousData);
    }
    throw error;
  } finally {
    args.inFlightOperations.delete(args.operationKey);
    args.setPending(false);
  }
}
