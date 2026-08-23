import type { Infer } from "convex/values";
import type { platformConversationPlatformValidator } from "../validators";

export type PlatformConversationMediaPlatform = Infer<
  typeof platformConversationPlatformValidator
>;

export const PLATFORM_CONVERSATION_MEDIA_CACHE_TTL_MS = 30 * 60 * 1000;
export const MAX_PLATFORM_CONVERSATION_MEDIA_BYTES = 100 * 1024 * 1024;

const MAX_MEDIA_IDENTIFIER_LENGTH = 1_024;

function normalizeMediaIdentifier(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is missing.`);
  }
  if (normalized.length > MAX_MEDIA_IDENTIFIER_LENGTH) {
    throw new Error(`${label} is too long.`);
  }
  return normalized;
}

/**
 * Length-prefixed segments avoid delimiter collisions without storing a hash
 * that would make provider/media incidents harder to inspect operationally.
 */
export function buildPlatformConversationMediaCacheKey(args: {
  platform: PlatformConversationMediaPlatform;
  conversationId: string;
  providerMessageId?: string;
  attachmentId: string;
}): string {
  const segments = [
    args.platform,
    normalizeMediaIdentifier(args.conversationId, "Conversation ID"),
    args.providerMessageId?.trim() || "",
    normalizeMediaIdentifier(args.attachmentId, "Attachment ID"),
  ];
  return segments.map((segment) => `${segment.length}:${segment}`).join("|");
}

/** Unipile's attachment endpoint expects its message `id`, not `provider_id`. */
export function resolveUnipileMediaMessageId(args: {
  messageId: string;
  providerMessageId?: string;
}): string {
  return normalizeMediaIdentifier(args.messageId, "Unipile message ID");
}

export function assertCacheableProviderMedia(args: {
  size: number;
  maxBytes?: number;
}): void {
  const maxBytes = args.maxBytes ?? MAX_PLATFORM_CONVERSATION_MEDIA_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error("Provider media byte limit is invalid.");
  }
  if (!Number.isSafeInteger(args.size) || args.size <= 0) {
    throw new Error("Provider media did not contain any bytes.");
  }
  if (args.size > maxBytes) {
    throw new Error("Provider media exceeds the supported attachment limit.");
  }
}

export function sanitizeProviderMediaFileName(
  value: string | undefined
): string | undefined {
  const normalized = value
    ?.trim()
    .replaceAll("\\", "_")
    .replaceAll("/", "_")
    .split("")
    .filter((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && codePoint > 31 && codePoint !== 127;
    })
    .join("")
    .slice(0, 255);
  return normalized || undefined;
}
