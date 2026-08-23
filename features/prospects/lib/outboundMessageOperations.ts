import type { Id } from "@/convex/_generated/dataModel";
import type { outboundMessageMediaMetadataValidator } from "@/convex/validators";
import type { Infer } from "convex/values";
import type { MediaUpload } from "@/features/composer/types";
import type { RichConversationMessage } from "../ui/components/conversation-message/types";

export type OutboundMessageStatus = "queued" | "sending" | "sent" | "failed";
export type OutboundMessageMediaMetadata = Infer<
  typeof outboundMessageMediaMetadataValidator
>;

export function getOutboundMessageMediaMetadata(
  uploads: MediaUpload[] | undefined
): OutboundMessageMediaMetadata[] | undefined {
  if (!uploads?.length) return undefined;
  return uploads.map((upload) => ({
    ...(upload.width ? { width: upload.width } : {}),
    ...(upload.height ? { height: upload.height } : {}),
    ...(upload.durationMs ? { durationMs: upload.durationMs } : {}),
    ...(upload.file.type ? { mimeType: upload.file.type } : {}),
    ...(upload.file.size ? { fileSize: upload.file.size } : {}),
  }));
}

export type OutboundMessageOperation = {
  operationId?: Id<"outboundMessageOperations">;
  clientRequestId: string;
  prospectId: Id<"prospects">;
  platform: "twitter" | "linkedin";
  conversationId?: string;
  text: string;
  mediaUrls?: string[];
  mediaDescriptions?: string[];
  mediaKinds?: Array<"image" | "video" | "gif" | "file">;
  mediaFileNames?: string[];
  mediaMetadata?: OutboundMessageMediaMetadata[];
  quoteId?: string;
  status: OutboundMessageStatus;
  attemptCount: number;
  createdAt: number;
  updatedAt: number;
  sentAt?: number;
  providerMessageId?: string;
  errorMessage?: string;
};

function isCanonicalProviderMessage(
  message: RichConversationMessage & { providerMessageId?: string },
  operation: OutboundMessageOperation
) {
  const providerIdentityMatches = Boolean(
    operation.providerMessageId &&
    (message.id === operation.providerMessageId ||
      message.providerMessageId === operation.providerMessageId)
  );
  if (providerIdentityMatches) return true;
  if (
    !operation.providerMessageId ||
    message.direction !== "sent" ||
    message.text.trim() !== operation.text.trim() ||
    (message.attachments?.length ?? 0) !== (operation.mediaUrls?.length ?? 0)
  ) {
    return false;
  }
  const messageTime = message.createdAt
    ? new Date(message.createdAt).getTime()
    : Number.NaN;
  const operationTime =
    operation.sentAt ?? operation.updatedAt ?? operation.createdAt;
  return (
    Number.isFinite(messageTime) &&
    Math.abs(messageTime - operationTime) <= 2 * 60 * 1000
  );
}

export function mergeOutboundMessageOperations<
  TMessage extends RichConversationMessage,
>(
  messages: TMessage[],
  operations: OutboundMessageOperation[],
  fallbackConversationId: string
): Array<TMessage | RichConversationMessage> {
  const enrichedMessages = messages.map((message) => {
    const operation = operations.find((candidate) =>
      isCanonicalProviderMessage(message, candidate)
    );
    if (!operation?.mediaUrls?.length || !message.attachments?.length) {
      return message;
    }
    return {
      ...message,
      attachments: message.attachments.map((attachment, index) => {
        const kind = operation.mediaKinds?.[index];
        const metadata = operation.mediaMetadata?.[index];
        const isGenericType =
          !attachment.type ||
          attachment.type === "attachment" ||
          attachment.type === "file";
        return {
          ...attachment,
          type:
            kind && isGenericType
              ? kind === "gif"
                ? "image"
                : kind
              : attachment.type,
          fileName: operation.mediaFileNames?.[index] ?? attachment.fileName,
          altText: operation.mediaDescriptions?.[index] ?? attachment.altText,
          isGif: kind === "gif" ? true : attachment.isGif,
          width: metadata?.width ?? attachment.width,
          height: metadata?.height ?? attachment.height,
          durationMs: metadata?.durationMs ?? attachment.durationMs,
          mimeType: metadata?.mimeType ?? attachment.mimeType,
          fileSize: metadata?.fileSize ?? attachment.fileSize,
        };
      }),
    };
  });
  const queuedMessages = operations.flatMap((operation) => {
    if (
      enrichedMessages.some((message) =>
        isCanonicalProviderMessage(message, operation)
      )
    ) {
      return [];
    }
    const quotedMessage = operation.quoteId
      ? messages.find((message) => message.id === operation.quoteId)
      : undefined;
    const message: RichConversationMessage = {
      id: `outbound:${operation.clientRequestId}`,
      conversationId: operation.conversationId ?? fallbackConversationId,
      text: operation.text,
      createdAt: new Date(operation.createdAt).toISOString(),
      direction: "sent",
      attachments: operation.mediaUrls?.map((url, index) => ({
        type:
          operation.mediaKinds?.[index] === "gif"
            ? "image"
            : (operation.mediaKinds?.[index] ?? "attachment"),
        url,
        previewUrl: url,
        altText: operation.mediaDescriptions?.[index],
        fileName: operation.mediaFileNames?.[index],
        isGif: operation.mediaKinds?.[index] === "gif",
        width: operation.mediaMetadata?.[index]?.width,
        height: operation.mediaMetadata?.[index]?.height,
        durationMs: operation.mediaMetadata?.[index]?.durationMs,
        mimeType: operation.mediaMetadata?.[index]?.mimeType,
        fileSize: operation.mediaMetadata?.[index]?.fileSize,
      })),
      quotedMessageId: operation.quoteId,
      quotedMessage: quotedMessage
        ? {
            id: quotedMessage.id,
            text: quotedMessage.text,
            direction: quotedMessage.direction,
            attachmentType: quotedMessage.attachments?.[0]?.type,
            attachments: quotedMessage.attachments,
            sharedPost: quotedMessage.sharedPost,
          }
        : undefined,
      deliveryStatus: operation.status,
      deliveryError: operation.errorMessage,
      outboundOperationId: operation.operationId,
      outboundClientRequestId: operation.clientRequestId,
    };
    return [message];
  });

  return [...enrichedMessages, ...queuedMessages].sort((left, right) => {
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return leftTime - rightTime;
  });
}
