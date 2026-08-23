import { getNestedRecord, getStringProperty, isRecord } from "./typeGuards";
import {
  getProviderPageCursor,
  getProviderPageHasMore,
} from "./conversationHistoryPaginationCore";

export type XChatSigningKey = {
  userId: string;
  publicKeyVersion: string;
  publicKey: string;
  identityPublicKey: string;
  identityPublicKeySignature: string;
};

export type XChatPublicKeyRecord = XChatSigningKey & {
  juiceboxConfig?: Record<string, unknown>;
};

export type XChatEncryptedEvent = {
  id?: string;
  conversationId?: string;
  senderId?: string;
  createdAtMs?: number;
  encodedEvent: string;
};

function readProperty(
  value: Record<string, unknown>,
  camelCase: string,
  snakeCase: string
): unknown {
  return value[camelCase] ?? value[snakeCase];
}

function readStringProperty(
  value: Record<string, unknown>,
  camelCase: string,
  snakeCase: string
): string | undefined {
  const result = readProperty(value, camelCase, snakeCase);
  return typeof result === "string" && result.trim()
    ? result.trim()
    : undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed)
    ? parsed
    : undefined;
}

export function normalizeXChatPublicKeyRecords(
  payload: unknown,
  fallbackUserId?: string
): XChatPublicKeyRecord[] {
  const root = isRecord(payload) ? payload : undefined;
  if (!Array.isArray(root?.data)) {
    return [];
  }

  return root.data.flatMap((value) => {
    if (!isRecord(value)) {
      return [];
    }
    const userId =
      readStringProperty(value, "userId", "user_id") ?? fallbackUserId;
    const publicKeyVersion =
      readStringProperty(value, "publicKeyVersion", "public_key_version") ??
      readStringProperty(value, "version", "version");
    const identityPublicKey = readStringProperty(
      value,
      "publicKey",
      "public_key"
    );
    const publicKey = readStringProperty(
      value,
      "signingPublicKey",
      "signing_public_key"
    );
    const identityPublicKeySignature = readStringProperty(
      value,
      "identityPublicKeySignature",
      "identity_public_key_signature"
    );
    if (
      !userId ||
      !publicKeyVersion ||
      !identityPublicKey ||
      !publicKey ||
      !identityPublicKeySignature
    ) {
      return [];
    }

    const juiceboxValue = readProperty(
      value,
      "juiceboxConfig",
      "juicebox_config"
    );
    return [
      {
        userId,
        publicKeyVersion,
        publicKey,
        identityPublicKey,
        identityPublicKeySignature,
        ...(isRecord(juiceboxValue) ? { juiceboxConfig: juiceboxValue } : {}),
      },
    ];
  });
}

/**
 * Return only the Juicebox realm topology/threshold config required by the
 * browser SDK. Per-realm auth tokens are deliberately omitted and fetched
 * separately when the SDK invokes getAuthToken.
 */
export function buildSanitizedXChatJuiceboxConfig(
  record: XChatPublicKeyRecord
): string | null {
  const config = record.juiceboxConfig;
  if (!config) {
    return null;
  }

  const sdkConfig = readStringProperty(config, "sdkConfig", "sdk_config");
  const keyStoreTokenMapJson = readStringProperty(
    config,
    "keyStoreTokenMapJson",
    "key_store_token_map_json"
  );
  const maxGuessCount = readFiniteNumber(
    readProperty(config, "maxGuessCount", "max_guess_count")
  );
  if (!sdkConfig && !keyStoreTokenMapJson) {
    return null;
  }

  return JSON.stringify({
    ...(sdkConfig ? { sdk_config: sdkConfig } : {}),
    ...(keyStoreTokenMapJson
      ? { key_store_token_map_json: keyStoreTokenMapJson }
      : {}),
    ...(typeof maxGuessCount === "number"
      ? { max_guess_count: maxGuessCount }
      : {}),
  });
}

export function getXChatRealmAuthToken(
  record: XChatPublicKeyRecord,
  realmId: string
): string | null {
  const config = record.juiceboxConfig;
  if (!config) {
    return null;
  }
  const tokenMap = readProperty(config, "tokenMap", "token_map");
  if (!Array.isArray(tokenMap)) {
    return null;
  }

  const normalizedRealmId = realmId.trim().toLowerCase();
  for (const entry of tokenMap) {
    if (!isRecord(entry)) {
      continue;
    }
    const key = getStringProperty(entry, "key")?.trim().toLowerCase();
    const value = getNestedRecord(entry, "value");
    const token = getStringProperty(value, "token")?.trim();
    if (key === normalizedRealmId && token) {
      return token;
    }
  }
  return null;
}

export function normalizeXChatEncryptedEventPage(payload: unknown): {
  events: XChatEncryptedEvent[];
  nextCursor?: string;
  hasMore: boolean;
} {
  const root = isRecord(payload) ? payload : undefined;
  const messageEvents = Array.isArray(root?.data)
    ? root.data.flatMap((value) => {
        if (!isRecord(value)) {
          return [];
        }
        const encodedEvent = readStringProperty(
          value,
          "encodedEvent",
          "encoded_event"
        );
        if (!encodedEvent) {
          return [];
        }
        const id = readStringProperty(value, "id", "id");
        const conversationId = readStringProperty(
          value,
          "conversationId",
          "conversation_id"
        );
        const senderId = readStringProperty(value, "senderId", "sender_id");
        const createdAtMs = readFiniteNumber(
          readProperty(value, "createdAtMsec", "created_at_msec")
        );
        return [
          {
            encodedEvent,
            ...(id ? { id } : {}),
            ...(conversationId ? { conversationId } : {}),
            ...(senderId ? { senderId } : {}),
            ...(typeof createdAtMs === "number" ? { createdAtMs } : {}),
          },
        ];
      })
    : [];
  // XChat sends the signed key-change envelopes separately from message data.
  // decryptEvents must receive both; otherwise it cannot recover the specific
  // conversation key later referenced by an attachment's keyVersion.
  const meta = isRecord(root?.meta) ? root.meta : undefined;
  const keyEventPayload = meta
    ? readProperty(meta, "conversationKeyEvents", "conversation_key_events")
    : undefined;
  const keyEvents = Array.isArray(keyEventPayload)
    ? keyEventPayload.flatMap((value) => {
        if (typeof value !== "string" || !value.trim()) {
          return [];
        }
        return [{ encodedEvent: value.trim() }];
      })
    : [];
  const seenEncodedEvents = new Set<string>();
  const events = [...keyEvents, ...messageEvents].filter((event) => {
    if (seenEncodedEvents.has(event.encodedEvent)) {
      return false;
    }
    seenEncodedEvents.add(event.encodedEvent);
    return true;
  });
  const nextCursor = getProviderPageCursor(payload);
  return {
    events,
    ...(nextCursor ? { nextCursor } : {}),
    hasMore: getProviderPageHasMore(payload),
  };
}
