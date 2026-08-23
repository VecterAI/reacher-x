import { getCurrentUTCTimestamp } from "../../../shared/lib/utils/time/timeUtils";
import { createClientRequestId } from "../../../shared/lib/utils/core/clientRequestId";

const XCHAT_PENDING_SEND_STORAGE_VERSION = 1;
// Stay inside the server's 30-day idempotency window. Expired operations are
// never reused automatically; a later submit is a fresh user intent.
export const XCHAT_PENDING_SEND_MAX_AGE_MS = 29 * 24 * 60 * 60 * 1000;

type XChatPendingSendStorage = Pick<
  Storage,
  "getItem" | "removeItem" | "setItem"
>;

export type StoredXChatPendingSend = {
  clientRequestId: string;
  messageId: string;
  encodedMessageCreateEvent: string;
  encodedMessageEventSignature: string;
  textDigest: string;
  expiresAt: number;
};

function getStorageKey(args: {
  prospectId: string;
  conversationId: string;
}): string {
  return `reacherx:xchat:pending-send:${JSON.stringify([
    args.prospectId,
    args.conversationId,
  ])}`;
}

function getBrowserSessionStorage(): XChatPendingSendStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function parseStoredXChatPendingSend(
  raw: string,
  now = getCurrentUTCTimestamp()
): StoredXChatPendingSend | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value !== "object" ||
      value === null ||
      !("version" in value) ||
      value.version !== XCHAT_PENDING_SEND_STORAGE_VERSION ||
      !("clientRequestId" in value) ||
      typeof value.clientRequestId !== "string" ||
      !("messageId" in value) ||
      typeof value.messageId !== "string" ||
      !("encodedMessageCreateEvent" in value) ||
      typeof value.encodedMessageCreateEvent !== "string" ||
      !("encodedMessageEventSignature" in value) ||
      typeof value.encodedMessageEventSignature !== "string" ||
      !("textDigest" in value) ||
      typeof value.textDigest !== "string" ||
      !("expiresAt" in value) ||
      typeof value.expiresAt !== "number" ||
      !Number.isFinite(value.expiresAt) ||
      value.expiresAt <= now
    ) {
      return null;
    }
    const record = {
      clientRequestId: value.clientRequestId,
      messageId: value.messageId,
      // Preserve the SDK strings byte-for-byte. The server permanently binds
      // these values to clientRequestId during its idempotency window.
      encodedMessageCreateEvent: value.encodedMessageCreateEvent,
      encodedMessageEventSignature: value.encodedMessageEventSignature,
      textDigest: value.textDigest.trim(),
      expiresAt: value.expiresAt,
    };
    return Object.values(record).some(
      (entry) => typeof entry === "string" && !entry.trim()
    )
      ? null
      : record;
  } catch {
    return null;
  }
}

export function readStoredXChatPendingSend(args: {
  prospectId: string;
  conversationId: string;
  storage?: XChatPendingSendStorage | null;
  now?: number;
}): StoredXChatPendingSend | null {
  const storage = args.storage ?? getBrowserSessionStorage();
  if (!storage) return null;
  const key = getStorageKey(args);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const record = parseStoredXChatPendingSend(
      raw,
      args.now ?? getCurrentUTCTimestamp()
    );
    if (!record) storage.removeItem(key);
    return record;
  } catch {
    return null;
  }
}

/** Returns false rather than allowing a send without reload-safe idempotency. */
export function writeStoredXChatPendingSend(args: {
  prospectId: string;
  conversationId: string;
  record: Omit<StoredXChatPendingSend, "expiresAt">;
  storage?: XChatPendingSendStorage | null;
  now?: number;
}): boolean {
  const storage = args.storage ?? getBrowserSessionStorage();
  if (!storage) return false;
  try {
    storage.setItem(
      getStorageKey(args),
      JSON.stringify({
        version: XCHAT_PENDING_SEND_STORAGE_VERSION,
        ...args.record,
        expiresAt:
          (args.now ?? getCurrentUTCTimestamp()) +
          XCHAT_PENDING_SEND_MAX_AGE_MS,
      })
    );
    return true;
  } catch {
    return false;
  }
}

export function clearStoredXChatPendingSend(args: {
  prospectId: string;
  conversationId: string;
  clientRequestId: string;
  storage?: XChatPendingSendStorage | null;
  now?: number;
}): void {
  const storage = args.storage ?? getBrowserSessionStorage();
  if (!storage) return;
  const key = getStorageKey(args);
  try {
    const current = storage.getItem(key);
    if (!current) return;
    const record = parseStoredXChatPendingSend(
      current,
      args.now ?? getCurrentUTCTimestamp()
    );
    if (!record || record.clientRequestId === args.clientRequestId) {
      storage.removeItem(key);
    }
  } catch {
    // The provider has confirmed the send. A storage failure cannot undo it.
  }
}

export async function digestXChatComposerText(text: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("This browser cannot safely prepare an encrypted retry.");
  }
  const bytes = new TextEncoder().encode(text.trim());
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export function createXChatClientRequestId(): string {
  return createClientRequestId();
}
