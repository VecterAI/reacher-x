/**
 * XChat media reaches the browser as opaque ciphertext. It is cached in
 * Convex storage instead of serialized as a Convex Bytes value, so ordinary
 * image/video attachments are not constrained by the 1 MiB value limit.
 */
import { computeOneToOneDmConversationId } from "../../shared/lib/twitter/dm";

export const MAX_XCHAT_ENCRYPTED_MEDIA_BYTES = 100 * 1024 * 1024;

const MAX_XCHAT_MEDIA_IDENTIFIER_LENGTH = 512;

function requireBoundedIdentifier(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`XChat ${label} is missing.`);
  }
  if (normalized.length > MAX_XCHAT_MEDIA_IDENTIFIER_LENGTH) {
    throw new Error(`XChat ${label} is too long.`);
  }
  return normalized;
}

/**
 * Canonicalize direct XChat IDs at the provider boundary. Activity payloads
 * use colon-separated participant IDs while the REST API and our existing
 * conversation rows use sorted, hyphen-separated IDs.
 */
export function normalizeXChatConversationId(conversationId: string): string {
  const normalized = requireBoundedIdentifier(
    conversationId,
    "conversation ID"
  );
  const participantIds = normalized.split(/[:-]/u);
  if (
    participantIds.length === 2 &&
    participantIds.every((participantId) => /^\d+$/u.test(participantId))
  ) {
    return computeOneToOneDmConversationId(
      participantIds[0]!,
      participantIds[1]!
    );
  }
  return normalized.replaceAll(":", "-");
}

/** This mirrors xurl's ChatConversationPathID helper. */
export function toXChatConversationPathId(conversationId: string): string {
  return normalizeXChatConversationId(conversationId);
}

/** XChat media request bodies use the colon form embedded in chat events. */
export function toXChatConversationEventId(conversationId: string): string {
  return normalizeXChatConversationId(conversationId).replaceAll("-", ":");
}

export function normalizeXChatMediaHashKey(mediaHashKey: string): string {
  return requireBoundedIdentifier(mediaHashKey, "media hash key");
}

function parseDeclaredContentLength(response: Response): number | undefined {
  const rawValue = response.headers.get("content-length");
  if (!rawValue) {
    return undefined;
  }
  const parsed = Number(rawValue);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function isBinaryMediaResponse(response: Response): boolean {
  const contentType = response.headers.get("content-type")?.toLowerCase();
  return !contentType || contentType.startsWith("application/octet-stream");
}

/**
 * Read binary ciphertext with a hard per-action ceiling. Do not use
 * Response.arrayBuffer(): it would allocate the full provider body before the
 * application can enforce its own limit.
 */
export async function readBoundedXChatEncryptedMedia(
  response: Response,
  maxBytes = MAX_XCHAT_ENCRYPTED_MEDIA_BYTES
): Promise<ArrayBuffer> {
  if (!response.ok) {
    throw new Error(
      `XChat media request failed (${response.status} ${response.statusText}).`
    );
  }
  if (!isBinaryMediaResponse(response)) {
    throw new Error("XChat media response had an unexpected content type.");
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error("XChat media byte limit is invalid.");
  }

  const declaredLength = parseDeclaredContentLength(response);
  if (typeof declaredLength === "number" && declaredLength > maxBytes) {
    throw new Error("XChat media exceeds the supported download limit.");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("XChat media response did not include ciphertext.");
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value || value.byteLength === 0) {
        continue;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new Error("XChat media exceeds the supported download limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const ciphertext = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    ciphertext.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return ciphertext.buffer;
}

export async function readXChatEncryptedMediaBlob(
  response: Response,
  maxBytes = MAX_XCHAT_ENCRYPTED_MEDIA_BYTES
): Promise<Blob> {
  const bytes = await readBoundedXChatEncryptedMedia(response, maxBytes);
  return new Blob([bytes], { type: "application/octet-stream" });
}
