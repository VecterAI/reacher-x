"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type {
  ChatWithJuicebox,
  DecryptedMessage,
  SendPayload,
  SigningKeyEntry,
} from "@xdevplatform/chat-xdk";
import {
  applyXChatReadReceipts,
  hydrateXChatQuotedMessages,
  normalizeVerifiedXChatConversation,
  type BrowserDecryptedXChatAttachment,
  type BrowserDecryptedXChatMessage,
  type BrowserDecryptedXChatMessageUpdate,
} from "./xChatBrowserMessageNormalization";
import { getCurrentUTCTimestamp } from "../../../shared/lib/utils/time/timeUtils";
import { inferAttachmentMediaKind } from "../../../shared/lib/utils/media/inferAttachmentMediaKind";
import { mapWithConcurrency } from "../../../shared/lib/utils/core/mapWithConcurrency";
import {
  getNestedRecord,
  getNumberProperty,
  getStringProperty,
  isRecord,
} from "../../../convex/lib/typeGuards";
import {
  clearStoredXChatPendingSend,
  createXChatClientRequestId,
  digestXChatComposerText,
  readStoredXChatPendingSend,
  writeStoredXChatPendingSend,
} from "./xChatPendingSendStorage";
import {
  forgetRememberedXChatPin,
  readRememberedXChatPin,
  rememberXChatPinOnDevice,
} from "./xChatDeviceCredentialStorage";

export type { BrowserDecryptedXChatMessage } from "./xChatBrowserMessageNormalization";

export type XChatDecryptBundle = {
  viewerUserId: string;
  participantUserId: string;
  conversationId: string;
  signingKeyVersion: string;
  juiceboxConfig: string;
  signingKeys: SigningKeyEntry[];
  events: Array<{
    id?: string;
    conversationId?: string;
    senderId?: string;
    createdAtMs?: number;
    encodedEvent: string;
  }>;
  eventPagesFetched: number;
  nextCursor?: string;
  hasMore: boolean;
};

export type XChatDecryptBundleResponse =
  | {
      availability: "unavailable";
      reason: "viewer_not_configured" | "participant_not_configured";
    }
  | {
      availability: "blocked";
      reason: "xchat_access_denied" | "subscription_required" | "not_allowed";
    }
  | ({ availability: "available" } & XChatDecryptBundle);

const inFlightDecryptBundleRequests = new Map<
  string,
  Promise<XChatDecryptBundleResponse>
>();

type XChatDecryptResult = {
  messages: BrowserDecryptedXChatMessage[];
  decryptionErrorCount: number;
};

const inFlightBrowserDecryptRequests = new Map<
  string,
  Promise<XChatDecryptResult>
>();

/** Deduplicates Strict Mode/remount checks for the same XChat prospect. */
export function requestXChatDecryptBundleOnce(
  prospectId: string,
  request: () => Promise<XChatDecryptBundleResponse>
): Promise<XChatDecryptBundleResponse> {
  const existing = inFlightDecryptBundleRequests.get(prospectId);
  if (existing) {
    return existing;
  }

  const pending = Promise.resolve().then(request);
  inFlightDecryptBundleRequests.set(prospectId, pending);
  const clearIfCurrent = () => {
    if (inFlightDecryptBundleRequests.get(prospectId) === pending) {
      inFlightDecryptBundleRequests.delete(prospectId);
    }
  };
  void pending.then(clearIfCurrent, clearIfCurrent);
  return pending;
}

/**
 * Serializes the full Juicebox unlock + XDK decrypt for one browser session.
 * Responsive panel variants can mount together, while the SDK explicitly
 * requires Juicebox operations in one JS process to run sequentially.
 */
export function requestXChatBrowserDecryptOnce(
  operationKey: string,
  decrypt: () => Promise<XChatDecryptResult>
): Promise<XChatDecryptResult> {
  const existing = inFlightBrowserDecryptRequests.get(operationKey);
  if (existing) return existing;

  const pending = Promise.resolve().then(decrypt);
  inFlightBrowserDecryptRequests.set(operationKey, pending);
  const clearIfCurrent = () => {
    if (inFlightBrowserDecryptRequests.get(operationKey) === pending) {
      inFlightBrowserDecryptRequests.delete(operationKey);
    }
  };
  void pending.then(clearIfCurrent, clearIfCurrent);
  return pending;
}

export type XChatEncryptedEventPage = {
  conversationId: string;
  events: XChatDecryptBundle["events"];
  nextCursor?: string;
  hasMore: boolean;
};

/**
 * Verified XChat plaintext is intentionally browser-memory-only. It is never
 * persisted, sent to Convex, or included in Agent context without the explicit
 * Share with Agent action.
 */
export type BrowserXChatSession = {
  prospectId: string;
  viewerUserId: string;
  participantUserId: string;
  conversationId: string;
  signingKeyVersion: string;
  messages: BrowserDecryptedXChatMessage[];
  messageUpdates?: BrowserDecryptedXChatMessageUpdate[];
  /** Provider event IDs already represented by this decrypted snapshot. */
  loadedEventIds?: string[];
  decryptionErrorCount: number;
  eventPagesFetched: number;
  nextCursor?: string;
  hasMore: boolean;
};

export type XChatBrowserSessionTarget = {
  prospectId?: string | null;
  viewerUserId?: string | null;
  participantUserId?: string | null;
  conversationId?: string | null;
  signingKeyVersion?: string | null;
};

export type XChatBrowserSessionState =
  | { status: "unknown" }
  | { status: "checking" }
  | { status: "locked"; attemptsRemaining?: number }
  | { status: "attempts_exhausted" }
  | { status: "unlocking" }
  | { status: "unlocked" }
  | { status: "unavailable" }
  | { status: "configuration_required" }
  | {
      status: "dm_restricted";
      reason: "subscription_required" | "not_allowed";
    }
  | { status: "error"; message: string }
  | { status: "rate_limited"; message: string; retryAt?: number };

function getXChatErrorText(error: unknown): string {
  const errorRecord = isRecord(error) ? error : undefined;
  const data = getNestedRecord(errorRecord, "data");
  return (
    getStringProperty(data, "message") ??
    getStringProperty(errorRecord, "message") ??
    (error instanceof Error ? error.message : String(error))
  );
}

export type XChatUnlockFailure =
  | { kind: "invalid_pin"; attemptsRemaining?: number }
  | { kind: "other" };

export function getXChatUnlockFailure(error: unknown): XChatUnlockFailure {
  const message = getXChatErrorText(error);
  if (!/\binvalid[ _-]?pin\b|reason\s*=\s*invalidpin/iu.test(message)) {
    return { kind: "other" };
  }
  const remainingMatch = message.match(/guesses_remaining\s*=\s*(\d+)/iu);
  const attemptsRemaining = remainingMatch?.[1]
    ? Number.parseInt(remainingMatch[1], 10)
    : undefined;
  return {
    kind: "invalid_pin",
    ...(typeof attemptsRemaining === "number" &&
    Number.isFinite(attemptsRemaining)
      ? { attemptsRemaining }
      : {}),
  };
}

export function getXChatUnlockFailureState(
  error: unknown
): Extract<
  XChatBrowserSessionState,
  { status: "locked" | "attempts_exhausted" }
> {
  const failure = getXChatUnlockFailure(error);
  if (failure.kind === "invalid_pin" && failure.attemptsRemaining === 0) {
    return { status: "attempts_exhausted" };
  }
  return {
    status: "locked",
    ...(failure.kind === "invalid_pin" &&
    typeof failure.attemptsRemaining === "number"
      ? { attemptsRemaining: failure.attemptsRemaining }
      : {}),
  };
}

/** Converts SDK/provider unlock diagnostics into concise user-facing copy. */
export function getXChatUnlockErrorMessage(error: unknown): string {
  const failure = getXChatUnlockFailure(error);
  if (failure.kind === "invalid_pin") {
    const remaining = failure.attemptsRemaining ?? null;

    if (remaining === 0) {
      return "That PIN isn't correct. No attempts remain.";
    }
    if (remaining === 1) {
      return "That PIN isn't correct. You have 1 attempt left.";
    }
    if (remaining !== null && Number.isFinite(remaining)) {
      return `That PIN isn't correct. You have ${remaining} attempts left.`;
    }
    return "That PIN isn't correct. Try again.";
  }

  return "We couldn't unlock X/Twitter Chat. Try again.";
}

export async function decryptXChatWithRememberedPin(
  args: Omit<Parameters<typeof decryptXChatInBrowser>[0], "pin">
): Promise<
  | { status: "missing" }
  | { status: "unlocked" }
  | { status: "invalid"; attemptsRemaining?: number }
> {
  const target = {
    viewerUserId: args.bundle.viewerUserId,
    signingKeyVersion: args.bundle.signingKeyVersion,
  };
  const pin = await readRememberedXChatPin(target);
  if (!pin) return { status: "missing" };
  try {
    await decryptXChatInBrowser({ ...args, pin });
    return { status: "unlocked" };
  } catch (error) {
    const failure = getXChatUnlockFailure(error);
    if (failure.kind === "invalid_pin") {
      await forgetRememberedXChatPin(target);
      return {
        status: "invalid",
        ...(typeof failure.attemptsRemaining === "number"
          ? { attemptsRemaining: failure.attemptsRemaining }
          : {}),
      };
    }
    throw error;
  }
}

export async function rememberSuccessfulXChatPin(args: {
  bundle: XChatDecryptBundle;
  pin: string;
}): Promise<void> {
  await rememberXChatPinOnDevice({
    viewerUserId: args.bundle.viewerUserId,
    signingKeyVersion: args.bundle.signingKeyVersion,
    pin: args.pin,
  });
}

export function getXChatRateLimitState(
  error: unknown
): Extract<XChatBrowserSessionState, { status: "rate_limited" }> | null {
  const errorRecord = isRecord(error) ? error : undefined;
  const data = getNestedRecord(errorRecord, "data");
  const message = getXChatErrorText(error);
  const isRateLimited =
    getStringProperty(data, "code") === "XCHAT_RATE_LIMITED" ||
    /\b429\b|rate[ -]?limit|too many requests/iu.test(message);
  if (!isRateLimited) {
    return null;
  }
  const retryAt =
    getNumberProperty(data, "retryAt") ?? getCurrentUTCTimestamp() + 60_000;
  return { status: "rate_limited", message, retryAt };
}

export function useXChatRetryCooldown(retryAt?: number): boolean {
  const [now, setNow] = useState(() => getCurrentUTCTimestamp());
  useEffect(() => {
    if (!retryAt || retryAt <= getCurrentUTCTimestamp()) {
      return;
    }
    const timeoutId = window.setTimeout(
      () => setNow(getCurrentUTCTimestamp()),
      retryAt - getCurrentUTCTimestamp()
    );
    return () => window.clearTimeout(timeoutId);
  }, [retryAt]);
  return Boolean(retryAt && now < retryAt);
}

export type XChatEncryptedMediaResponse =
  | {
      availability?: "available";
      ciphertext?: ArrayBuffer;
      url?: string;
      size?: number;
      expiresAt?: number;
    }
  | { availability: "unavailable"; reason: "not_found" };

export type XChatEncryptedMediaFetcher = (
  mediaHashKey: string
) => Promise<XChatEncryptedMediaResponse>;

type XChatMediaKind = "audio" | "image" | "video" | "file";

type XChatMediaBinding = {
  prospectId: string;
  conversationId: string;
  messageId: string;
  mediaHashKey: string;
  expectedKind: XChatMediaKind;
  /** Preferred when the decrypted event exposes it; older SDK events omit it. */
  keyVersion?: string;
};

type ActiveXChatSession = {
  chat: ChatWithJuicebox;
  viewerUserId: string;
  signingKeyVersion: string;
  /** Never exposed through BrowserXChatSession or React state. */
  conversationKeys: Record<string, Uint8Array>;
  /** Latest key selected by chat-xdk for new message encryption. */
  latestConversationKeyVersion?: string;
  /** Verified message-to-media bindings for the currently unlocked session. */
  mediaBindings: Map<string, XChatMediaBinding>;
  /** Raw signed events stay private to the unlocked browser session. */
  replyTargetsByMessageId: Map<string, XChatRawReplyTarget>;
  rawEditEventsByMessageId: Map<string, string>;
  rawKeyChangeEventsByVersion: Map<string, string>;
};

type XChatRawReplyTarget = {
  encodedEvent: string;
  keyVersion?: string;
};

export type PreparedXChatTextMessage = {
  conversationId: string;
  messageId: string;
  encodedMessageCreateEvent: string;
  encodedMessageEventSignature: string;
};

export type PersistedPreparedXChatTextMessage = PreparedXChatTextMessage & {
  clientRequestId: string;
};

export type PreparedXChatEncryptedMedia = {
  conversationId: string;
  keyVersion: string;
  ciphertext: Uint8Array;
  fileName: string;
  fileSize: number;
  width: number;
  height: number;
  mediaType: number;
  durationMs?: number;
};

type PendingXChatTextMessage = {
  text: string;
  payload: SendPayload;
  conversationId: string;
};

/**
 * Merge keys returned by an incremental XChat decrypt without mutating either
 * input. chat-xdk can expose aliased Uint8Array views across decrypt calls.
 */
export function mergeXChatConversationKeys(
  current: Readonly<Record<string, Uint8Array>>,
  incoming: Readonly<Record<string, Uint8Array>>
): Record<string, Uint8Array> {
  return { ...current, ...incoming };
}

let activeSession: ActiveXChatSession | null = null;
const listeners = new Set<() => void>();
const decryptedSessions = new Map<string, BrowserXChatSession>();
const sessionKeysByProspectId = new Map<string, string>();
const objectUrlsBySessionKey = new Map<string, Set<string>>();
const encryptedMediaRequestsByBindingKey = new Map<
  string,
  Promise<XChatEncryptedMediaResponse>
>();
const encryptedMediaRetryAtByBindingKey = new Map<string, number>();
const XCHAT_MISSING_MEDIA_RETRY_MS = 30 * 60 * 1000;
const XCHAT_TRANSIENT_MEDIA_RETRY_MS = 5 * 1000;
const sessionStatesByProspectId = new Map<string, XChatBrowserSessionState>();
const pendingTextMessagesByProspectId = new Map<
  string,
  PendingXChatTextMessage
>();
const pendingPublishedMessagesByClientRequestId = new Map<
  string,
  { prospectId: string; payload: PersistedPreparedXChatTextMessage }
>();
const UNKNOWN_XCHAT_SESSION_STATE: XChatBrowserSessionState = {
  status: "unknown",
};

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function makeBrowserSessionKey(args: {
  prospectId: string;
  bundle: XChatDecryptBundle;
}): string {
  // JSON encoding keeps the key unambiguous even if an upstream identifier
  // contains a separator character.
  return JSON.stringify([
    args.prospectId,
    args.bundle.viewerUserId,
    args.bundle.signingKeyVersion,
    args.bundle.participantUserId,
    args.bundle.conversationId,
  ]);
}

function makeMediaBindingKey(args: {
  prospectId: string;
  conversationId: string;
  messageId: string;
  mediaHashKey: string;
}): string {
  return JSON.stringify([
    args.prospectId,
    args.conversationId,
    args.messageId,
    args.mediaHashKey,
  ]);
}

function getXChatMediaRetryAt(error: unknown): number {
  const now = getCurrentUTCTimestamp();
  const rateLimitState = getXChatRateLimitState(error);
  if (rateLimitState?.retryAt) {
    return rateLimitState.retryAt;
  }
  const errorRecord = isRecord(error) ? error : undefined;
  const data = getNestedRecord(errorRecord, "data");
  const status = getNumberProperty(data, "status");
  const message =
    getStringProperty(data, "message") ??
    getStringProperty(errorRecord, "message") ??
    (error instanceof Error ? error.message : String(error));
  return status === 404 || /\b404\b|not found/iu.test(message)
    ? now + XCHAT_MISSING_MEDIA_RETRY_MS
    : now + XCHAT_TRANSIENT_MEDIA_RETRY_MS;
}

function getEncryptedXChatMediaOnce(args: {
  bindingKey: string;
  mediaHashKey: string;
  getEncryptedMedia: XChatEncryptedMediaFetcher;
}): Promise<XChatEncryptedMediaResponse> {
  const existing = encryptedMediaRequestsByBindingKey.get(args.bindingKey);
  if (existing) {
    return existing;
  }
  const request = Promise.resolve().then(() =>
    args.getEncryptedMedia(args.mediaHashKey)
  );
  encryptedMediaRequestsByBindingKey.set(args.bindingKey, request);
  const clearRequest = () => {
    if (encryptedMediaRequestsByBindingKey.get(args.bindingKey) === request) {
      encryptedMediaRequestsByBindingKey.delete(args.bindingKey);
    }
  };
  void request.then(clearRequest, clearRequest);
  return request;
}

function revokeObjectUrls(sessionKey: string): void {
  const objectUrls = objectUrlsBySessionKey.get(sessionKey);
  if (!objectUrls) {
    return;
  }
  objectUrlsBySessionKey.delete(sessionKey);
  if (typeof URL === "undefined" || typeof URL.revokeObjectURL !== "function") {
    return;
  }
  for (const objectUrl of objectUrls) {
    URL.revokeObjectURL(objectUrl);
  }
}

function matchesSessionTarget(
  session: BrowserXChatSession,
  target: XChatBrowserSessionTarget
): boolean {
  return (
    (target.prospectId == null || session.prospectId === target.prospectId) &&
    (target.viewerUserId == null ||
      session.viewerUserId === target.viewerUserId) &&
    (target.participantUserId == null ||
      session.participantUserId === target.participantUserId) &&
    (target.conversationId == null ||
      session.conversationId === target.conversationId) &&
    (target.signingKeyVersion == null ||
      session.signingKeyVersion === target.signingKeyVersion)
  );
}

/** Returns the current verified plaintext snapshot without persisting it. */
export function getXChatBrowserSession(
  target: XChatBrowserSessionTarget
): BrowserXChatSession | null {
  if (
    !target.prospectId &&
    !target.viewerUserId &&
    !target.participantUserId &&
    !target.conversationId &&
    !target.signingKeyVersion
  ) {
    return null;
  }

  if (target.prospectId) {
    const sessionKey = sessionKeysByProspectId.get(target.prospectId);
    const session = sessionKey ? decryptedSessions.get(sessionKey) : undefined;
    if (session && matchesSessionTarget(session, target)) {
      return session;
    }
  }

  for (const session of decryptedSessions.values()) {
    if (matchesSessionTarget(session, target)) {
      return session;
    }
  }

  return null;
}

/**
 * Subscribe to one browser-only XChat session. The snapshot is stable until a
 * successful decrypt or explicit lock changes it.
 */
export function useXChatBrowserSession(
  target: XChatBrowserSessionTarget
): BrowserXChatSession | null {
  const {
    conversationId,
    participantUserId,
    prospectId,
    signingKeyVersion,
    viewerUserId,
  } = target;
  const getSnapshot = useCallback(
    () =>
      getXChatBrowserSession({
        conversationId,
        participantUserId,
        prospectId,
        signingKeyVersion,
        viewerUserId,
      }),
    [
      conversationId,
      participantUserId,
      prospectId,
      signingKeyVersion,
      viewerUserId,
    ]
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

/**
 * Returns the browser-only lifecycle for one XChat conversation. Keeping this
 * next to the verified plaintext store prevents the panel and Agent cards from
 * independently guessing whether legacy cached messages are safe to display.
 */
export function getXChatBrowserSessionState(
  prospectId: string | null | undefined
): XChatBrowserSessionState {
  if (!prospectId) {
    return UNKNOWN_XCHAT_SESSION_STATE;
  }
  return (
    sessionStatesByProspectId.get(prospectId) ?? UNKNOWN_XCHAT_SESSION_STATE
  );
}

export function useXChatBrowserSessionState(
  prospectId: string | null | undefined
): XChatBrowserSessionState {
  const getSnapshot = useCallback(
    () => getXChatBrowserSessionState(prospectId),
    [prospectId]
  );
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => UNKNOWN_XCHAT_SESSION_STATE
  );
}

function isSameXChatBrowserSessionState(
  previous: XChatBrowserSessionState | undefined,
  next: XChatBrowserSessionState
): boolean {
  if (!previous || previous.status !== next.status) {
    return false;
  }
  if (previous.status === "error" && next.status === "error") {
    return previous.message === next.message;
  }
  if (previous.status === "rate_limited" && next.status === "rate_limited") {
    return (
      previous.message === next.message && previous.retryAt === next.retryAt
    );
  }
  if (previous.status === "locked" && next.status === "locked") {
    return previous.attemptsRemaining === next.attemptsRemaining;
  }
  return true;
}

export function setXChatBrowserSessionState(
  prospectId: string,
  state: XChatBrowserSessionState
): void {
  const normalizedProspectId = prospectId.trim();
  if (!normalizedProspectId) {
    return;
  }
  const previous = sessionStatesByProspectId.get(normalizedProspectId);
  if (isSameXChatBrowserSessionState(previous, state)) {
    return;
  }
  sessionStatesByProspectId.set(normalizedProspectId, state);
  emitChange();
}

/**
 * Stores only already-verified plaintext and provider coverage metadata in
 * process memory. Callers must decrypt with rejectUnverified enabled first.
 */
export function cacheVerifiedXChatBrowserSession(args: {
  prospectId: string;
  bundle: XChatDecryptBundle;
  messages: BrowserDecryptedXChatMessage[];
  messageUpdates?: BrowserDecryptedXChatMessageUpdate[];
  decryptionErrorCount: number;
  /** URLs created from browser-decrypted media; revoke on replacement/lock. */
  objectUrls?: string[];
}): BrowserXChatSession {
  const session: BrowserXChatSession = {
    prospectId: args.prospectId,
    viewerUserId: args.bundle.viewerUserId,
    participantUserId: args.bundle.participantUserId,
    conversationId: args.bundle.conversationId,
    signingKeyVersion: args.bundle.signingKeyVersion,
    messages: args.messages,
    messageUpdates: args.messageUpdates,
    loadedEventIds: args.bundle.events.flatMap((event) =>
      event.id ? [event.id] : []
    ),
    decryptionErrorCount: args.decryptionErrorCount,
    eventPagesFetched: args.bundle.eventPagesFetched,
    nextCursor: args.bundle.nextCursor,
    hasMore: args.bundle.hasMore,
  };
  const sessionKey = makeBrowserSessionKey(args);
  const previousSessionKey = sessionKeysByProspectId.get(args.prospectId);

  revokeObjectUrls(sessionKey);
  if (previousSessionKey && previousSessionKey !== sessionKey) {
    revokeObjectUrls(previousSessionKey);
    decryptedSessions.delete(previousSessionKey);
  }
  decryptedSessions.set(sessionKey, session);
  sessionKeysByProspectId.set(args.prospectId, sessionKey);
  sessionStatesByProspectId.set(args.prospectId, { status: "unlocked" });
  const objectUrls = new Set(args.objectUrls ?? []);
  if (objectUrls.size > 0) {
    objectUrlsBySessionKey.set(sessionKey, objectUrls);
  }
  emitChange();
  return session;
}

/**
 * Apply best-effort attachment hydration to the current session without
 * replacing newer messages, cursor coverage, reactions, or delivery state
 * that may have arrived while media was downloading.
 */
function applyHydratedXChatMedia(args: {
  prospectId: string;
  sessionKey: string;
  conversationId: string;
  messages: BrowserDecryptedXChatMessage[];
  objectUrls: string[];
}): boolean {
  const session = decryptedSessions.get(args.sessionKey);
  if (
    !session ||
    sessionKeysByProspectId.get(args.prospectId) !== args.sessionKey ||
    session.conversationId !== args.conversationId
  ) {
    return false;
  }

  const hydratedMessagesById = new Map(
    args.messages.map((message) => [message.id, message])
  );
  const messages = session.messages.map((message) => {
    const hydrated = hydratedMessagesById.get(message.id);
    if (!hydrated) return message;

    return {
      ...message,
      attachments: hydrated.attachments ?? message.attachments,
      quotedMessage:
        message.quotedMessage && hydrated.quotedMessage
          ? {
              ...message.quotedMessage,
              attachments:
                hydrated.quotedMessage.attachments ??
                message.quotedMessage.attachments,
              attachmentType:
                hydrated.quotedMessage.attachmentType ??
                message.quotedMessage.attachmentType,
            }
          : message.quotedMessage,
    };
  });

  decryptedSessions.set(args.sessionKey, { ...session, messages });
  if (args.objectUrls.length > 0) {
    const currentUrls =
      objectUrlsBySessionKey.get(args.sessionKey) ?? new Set<string>();
    for (const objectUrl of args.objectUrls) {
      currentUrls.add(objectUrl);
    }
    objectUrlsBySessionKey.set(args.sessionKey, currentUrls);
  }
  pruneUnreferencedXChatObjectUrls(args.sessionKey, messages);
  emitChange();
  return true;
}

function isMatchingUnlockedSession(bundle: XChatDecryptBundle): boolean {
  return Boolean(
    activeSession?.chat.isUnlocked() &&
    activeSession.viewerUserId === bundle.viewerUserId &&
    activeSession.signingKeyVersion === bundle.signingKeyVersion
  );
}

export function hasUnlockedXChatSession(bundle: XChatDecryptBundle): boolean {
  return isMatchingUnlockedSession(bundle);
}

/**
 * Encrypt a text message with the active chat-xdk session. Failed network
 * attempts reuse the same signed payload so provider retries stay idempotent.
 */
function getXChatSendContext(prospectId: string) {
  const browserSession = getXChatBrowserSession({
    prospectId,
  });
  if (!browserSession) {
    throw new Error("Unlock this XChat conversation before sending.");
  }
  const current = activeSession;
  if (
    !current?.chat.isUnlocked() ||
    current.viewerUserId !== browserSession.viewerUserId ||
    current.signingKeyVersion !== browserSession.signingKeyVersion
  ) {
    throw new Error("Your XChat session expired. Unlock it again to send.");
  }
  return { browserSession, current };
}

function indexVerifiedXChatRawEvents(
  session: ActiveXChatSession,
  messages: DecryptedMessage[]
) {
  for (const { event, originalB64 } of messages) {
    const encodedEvent = originalB64?.trim();
    if (!encodedEvent || event.verified !== true) continue;

    if (event.type === "keyChange" && event.keyVersion) {
      session.rawKeyChangeEventsByVersion.set(event.keyVersion, encodedEvent);
      continue;
    }

    if (event.type !== "message") continue;
    const content = isRecord(event.content) ? event.content : undefined;
    const contentType =
      getStringProperty(content, "contentType") ??
      getStringProperty(content, "content_type");
    const editTargetId =
      getStringProperty(content, "targetMessageId") ??
      getStringProperty(content, "target_message_id");
    if (contentType === "edit" && editTargetId) {
      session.rawEditEventsByMessageId.set(editTargetId, encodedEvent);
      continue;
    }

    const target = {
      encodedEvent,
      ...(event.keyVersion ? { keyVersion: event.keyVersion } : {}),
    };
    if (event.id) session.replyTargetsByMessageId.set(event.id, target);
    if (event.sequenceId) {
      session.replyTargetsByMessageId.set(event.sequenceId, target);
    }
  }
}

function getProviderMessageId(messageId: string | undefined) {
  if (!messageId) return undefined;
  return messageId.startsWith("xchat:")
    ? messageId.slice(messageId.lastIndexOf(":") + 1)
    : messageId;
}

function getXChatReplyTarget(args: {
  current: ActiveXChatSession;
  messageId?: string;
  sequenceId?: string;
}) {
  const providerMessageId = getProviderMessageId(args.messageId);
  const lookupKeys = [args.sequenceId, providerMessageId].filter(
    (value): value is string => Boolean(value)
  );
  for (const key of lookupKeys) {
    const target = args.current.replyTargetsByMessageId.get(key);
    if (!target) continue;
    const replyToEditEvent =
      args.current.rawEditEventsByMessageId.get(key) ??
      (providerMessageId
        ? args.current.rawEditEventsByMessageId.get(providerMessageId)
        : undefined);
    const replyToCkce =
      target.keyVersion &&
      args.current.latestConversationKeyVersion &&
      target.keyVersion !== args.current.latestConversationKeyVersion
        ? args.current.rawKeyChangeEventsByVersion.get(target.keyVersion)
        : undefined;
    return {
      replyToEvent: target.encodedEvent,
      ...(replyToEditEvent ? { replyToEditEvent } : {}),
      ...(replyToCkce ? { replyToCkces: [replyToCkce] } : {}),
    };
  }
  throw new Error(
    "This XChat reply target is no longer available. Refresh the conversation and try again."
  );
}

function getXChatTextSendContext(args: { prospectId: string; text: string }) {
  const text = args.text.trim();
  if (!text) {
    throw new Error("Enter a message before sending.");
  }
  return { ...getXChatSendContext(args.prospectId), text };
}

export function prepareXChatTextMessageInBrowser(args: {
  prospectId: string;
  text: string;
}): PreparedXChatTextMessage {
  const { browserSession, current, text } = getXChatTextSendContext(args);

  const pending = pendingTextMessagesByProspectId.get(args.prospectId);
  const payload =
    pending?.text === text &&
    pending.conversationId === browserSession.conversationId
      ? pending.payload
      : withXChatEncryptionKey(current, (encryptionContext) =>
          current.chat.encryptMessage({
            conversationId: browserSession.conversationId,
            text,
            ...encryptionContext,
          })
        );
  pendingTextMessagesByProspectId.set(args.prospectId, {
    text,
    payload,
    conversationId: browserSession.conversationId,
  });

  return {
    conversationId: browserSession.conversationId,
    messageId: payload.messageId,
    encodedMessageCreateEvent: payload.encryptedContent,
    encodedMessageEventSignature: payload.encodedEventSignature,
  };
}

/**
 * Persist only the opaque signed SDK payload and a one-way text digest before
 * crossing the network boundary. Reload/navigation retries therefore reuse the
 * exact message ID and ciphertext required by X, while plaintext, PINs, and key
 * material remain browser-memory-only.
 */
export async function preparePersistedXChatTextMessageInBrowser(args: {
  prospectId: string;
  text: string;
}): Promise<PersistedPreparedXChatTextMessage> {
  const { browserSession, text } = getXChatTextSendContext(args);
  const textDigest = await digestXChatComposerText(text);
  const stored = readStoredXChatPendingSend({
    prospectId: args.prospectId,
    conversationId: browserSession.conversationId,
  });
  if (stored?.textDigest === textDigest) {
    return {
      clientRequestId: stored.clientRequestId,
      conversationId: browserSession.conversationId,
      messageId: stored.messageId,
      encodedMessageCreateEvent: stored.encodedMessageCreateEvent,
      encodedMessageEventSignature: stored.encodedMessageEventSignature,
    };
  }

  const prepared = prepareXChatTextMessageInBrowser({
    prospectId: args.prospectId,
    text,
  });
  const clientRequestId = createXChatClientRequestId();
  const persisted = writeStoredXChatPendingSend({
    prospectId: args.prospectId,
    conversationId: browserSession.conversationId,
    record: {
      clientRequestId,
      messageId: prepared.messageId,
      encodedMessageCreateEvent: prepared.encodedMessageCreateEvent,
      encodedMessageEventSignature: prepared.encodedMessageEventSignature,
      textDigest,
    },
  });
  if (!persisted) {
    throw new Error(
      "This browser could not safely save the encrypted send for retry."
    );
  }
  return { clientRequestId, ...prepared };
}

/** Encrypt a selected image, GIF, or video entirely in browser memory. */
export function getXChatAttachmentMediaType(mimeType: string): number {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === "image/gif") return 2;
  if (normalized === "image/svg+xml") return 6;
  if (normalized.startsWith("image/")) return 1;
  if (normalized.startsWith("video/")) return 3;
  if (normalized.startsWith("audio/")) return 4;
  return 5;
}

export function resolveXChatAttachmentMimeType(
  claimedMimeType: string,
  detectedMimeType: string | null | undefined
): string {
  const claimed = claimedMimeType.trim().toLowerCase();
  return claimed.startsWith("audio/")
    ? claimed
    : (detectedMimeType?.trim().toLowerCase() ?? claimed);
}

export async function prepareXChatEncryptedMediaInBrowser(args: {
  prospectId: string;
  file: File;
  durationMs?: number;
}): Promise<PreparedXChatEncryptedMedia> {
  if (args.file.size <= 0 || args.file.size > MAX_XCHAT_BROWSER_MEDIA_BYTES) {
    throw new Error("XChat attachments must be between 1 byte and 100 MB.");
  }
  const { browserSession, current } = getXChatSendContext(args.prospectId);
  const keyCandidate = copyXChatConversationKeyForEncryption({
    conversationKeys: current.conversationKeys,
    preferredKeyVersion: current.latestConversationKeyVersion,
  });
  if (!keyCandidate) {
    throw new Error("The XChat conversation key is unavailable. Unlock again.");
  }
  const plaintext = new Uint8Array(await args.file.arrayBuffer());
  const conversationKey = keyCandidate.conversationKey;
  try {
    const { detectImageDimensions, detectMimeType } =
      await import("@xdevplatform/chat-xdk");
    const dimensions = detectImageDimensions(plaintext);
    const detectedMimeType = detectMimeType(plaintext);
    // M4A and MP4 share an ISO-BMFF container. The SDK correctly recognizes
    // that container as video/mp4, but a browser-recorded audio/mp4 File must
    // stay AUDIO on XChat's wire enum or native X renders it as a video.
    const attachmentMimeType = resolveXChatAttachmentMimeType(
      args.file.type,
      detectedMimeType
    );
    const ciphertext = current.chat.encryptStream(plaintext, conversationKey);
    if (ciphertext.byteLength > MAX_XCHAT_BROWSER_MEDIA_BYTES) {
      ciphertext.fill(0);
      throw new Error("Encrypted XChat attachment exceeds 100 MB.");
    }
    return {
      conversationId: browserSession.conversationId,
      keyVersion: keyCandidate.conversationKeyVersion,
      ciphertext,
      fileName: args.file.name.trim().slice(0, 255) || "attachment",
      fileSize: args.file.size,
      width: dimensions?.width ?? 0,
      height: dimensions?.height ?? 0,
      mediaType: getXChatAttachmentMediaType(attachmentMimeType),
      durationMs: args.durationMs,
    };
  } finally {
    conversationKey.fill(0);
    plaintext.fill(0);
  }
}

export function buildXChatMediaAttachment(args: {
  mediaHashKey: string;
  media: Omit<PreparedXChatEncryptedMedia, "ciphertext">;
}) {
  return {
    attachment_type: "media" as const,
    media_hash_key: args.mediaHashKey,
    media_type: args.media.mediaType,
    width: args.media.width,
    height: args.media.height,
    filesize_bytes: args.media.fileSize,
    filename: args.media.fileName,
    ...(args.media.durationMs
      ? { duration_millis: Math.round(args.media.durationMs) }
      : {}),
  };
}

/** Encrypt the final message envelope after X returns the opaque media hash. */
export function prepareXChatMediaMessageInBrowser(args: {
  prospectId: string;
  text: string;
  mediaHashKey: string;
  media: Omit<PreparedXChatEncryptedMedia, "ciphertext">;
  clientRequestId?: string;
  replyToMessageId?: string;
  replyToSequenceId?: string;
}): PersistedPreparedXChatTextMessage {
  const { browserSession, current } = getXChatSendContext(args.prospectId);
  if (browserSession.conversationId !== args.media.conversationId) {
    throw new Error("The XChat conversation changed during media upload.");
  }
  const attachment = buildXChatMediaAttachment(args);
  const payload = withXChatEncryptionKey(
    current,
    (keyContext) => {
      if (keyContext.conversationKeyVersion !== args.media.keyVersion) {
        throw new Error(
          "The XChat conversation key changed. Try the upload again."
        );
      }
      const encryptionContext = {
        conversationId: browserSession.conversationId,
        text: args.text.trim(),
        ...keyContext,
        attachments: [attachment],
      };
      return args.replyToMessageId || args.replyToSequenceId
        ? current.chat.encryptReply({
            ...encryptionContext,
            ...getXChatReplyTarget({
              current,
              messageId: args.replyToMessageId,
              sequenceId: args.replyToSequenceId,
            }),
          })
        : current.chat.encryptMessage(encryptionContext);
    },
    args.media.keyVersion
  );
  return {
    clientRequestId: args.clientRequestId ?? createXChatClientRequestId(),
    conversationId: browserSession.conversationId,
    messageId: payload.messageId,
    encodedMessageCreateEvent: payload.encryptedContent,
    encodedMessageEventSignature: payload.encodedEventSignature,
  };
}

/** Publish an attachment local echo before encryption or upload work starts. */
export function publishPreparingXChatMessageInBrowser(args: {
  prospectId: string;
  text: string;
  attachments?: BrowserDecryptedXChatMessage["attachments"];
  quotedMessage?: BrowserDecryptedXChatMessage["quotedMessage"];
  /** Preview URLs whose lifetime is transferred from the composer to XChat. */
  objectUrls?: string[];
}): { clientRequestId: string; messageId: string } {
  const clientRequestId = createXChatClientRequestId();
  const messageId = `pending:${clientRequestId}`;
  const sessionKey = sessionKeysByProspectId.get(args.prospectId);
  const session = sessionKey ? decryptedSessions.get(sessionKey) : undefined;
  if (!session) {
    for (const objectUrl of args.objectUrls ?? []) {
      URL.revokeObjectURL(objectUrl);
    }
    return { clientRequestId, messageId };
  }

  const message: BrowserDecryptedXChatMessage = {
    id: messageId,
    senderId: session.viewerUserId,
    direction: "sent",
    occurredAt: getCurrentUTCTimestamp(),
    text: args.text.trim(),
    attachments: args.attachments,
    quotedMessage: args.quotedMessage,
    deliveryStatus: "sending",
    clientRequestId,
  };
  const messages = session.messages
    .filter((item) => item.id !== messageId)
    .concat(message)
    .sort((left, right) => left.occurredAt - right.occurredAt);
  decryptedSessions.set(sessionKey!, { ...session, messages });
  if (args.objectUrls?.length) {
    const currentUrls = objectUrlsBySessionKey.get(sessionKey!) ?? new Set();
    for (const objectUrl of args.objectUrls) currentUrls.add(objectUrl);
    objectUrlsBySessionKey.set(sessionKey!, currentUrls);
  }
  emitChange();
  return { clientRequestId, messageId };
}

/** Replace a preparing local identity with X's encrypted message identity. */
export function bindPreparedXChatMessageInBrowser(args: {
  prospectId: string;
  preparingMessageId: string;
  message: PersistedPreparedXChatTextMessage;
  attachmentMetadata?: Partial<BrowserDecryptedXChatAttachment>;
}): void {
  const sessionKey = sessionKeysByProspectId.get(args.prospectId);
  const session = sessionKey ? decryptedSessions.get(sessionKey) : undefined;
  if (!session) return;
  pendingPublishedMessagesByClientRequestId.set(args.message.clientRequestId, {
    prospectId: args.prospectId,
    payload: args.message,
  });
  const messages = session.messages.map((message) =>
    message.id === args.preparingMessageId
      ? {
          ...message,
          id: args.message.messageId,
          clientRequestId: args.message.clientRequestId,
          attachments: args.attachmentMetadata
            ? message.attachments?.map((attachment) => ({
                ...attachment,
                ...args.attachmentMetadata,
              }))
            : message.attachments,
        }
      : message
  );
  decryptedSessions.set(sessionKey!, { ...session, messages });
  emitChange();
}

export function prepareXChatReplyMessageInBrowser(args: {
  prospectId: string;
  text: string;
  replyToMessageId: string;
  replyToSequenceId?: string;
}): PersistedPreparedXChatTextMessage {
  const text = args.text.trim();
  if (!text || (!args.replyToMessageId && !args.replyToSequenceId)) {
    throw new Error("The XChat reply target is unavailable.");
  }
  const { browserSession, current } = getXChatSendContext(args.prospectId);
  const payload = withXChatEncryptionKey(current, (encryptionContext) =>
    current.chat.encryptReply({
      conversationId: browserSession.conversationId,
      text,
      ...encryptionContext,
      ...getXChatReplyTarget({
        current,
        messageId: args.replyToMessageId,
        sequenceId: args.replyToSequenceId,
      }),
    })
  );
  return {
    clientRequestId: createXChatClientRequestId(),
    conversationId: browserSession.conversationId,
    messageId: payload.messageId,
    encodedMessageCreateEvent: payload.encryptedContent,
    encodedMessageEventSignature: payload.encodedEventSignature,
  };
}

export async function preparePersistedXChatReplyMessageInBrowser(args: {
  prospectId: string;
  text: string;
  replyToMessageId: string;
  replyToSequenceId?: string;
}): Promise<PersistedPreparedXChatTextMessage> {
  const { browserSession } = getXChatSendContext(args.prospectId);
  const text = args.text.trim();
  const intentDigest = await digestXChatComposerText(
    JSON.stringify([
      "reply",
      text,
      getProviderMessageId(args.replyToMessageId),
      args.replyToSequenceId ?? null,
    ])
  );
  const stored = readStoredXChatPendingSend({
    prospectId: args.prospectId,
    conversationId: browserSession.conversationId,
  });
  if (stored?.textDigest === intentDigest) {
    return {
      clientRequestId: stored.clientRequestId,
      conversationId: browserSession.conversationId,
      messageId: stored.messageId,
      encodedMessageCreateEvent: stored.encodedMessageCreateEvent,
      encodedMessageEventSignature: stored.encodedMessageEventSignature,
    };
  }

  const prepared = prepareXChatReplyMessageInBrowser({ ...args, text });
  const persisted = writeStoredXChatPendingSend({
    prospectId: args.prospectId,
    conversationId: browserSession.conversationId,
    record: {
      clientRequestId: prepared.clientRequestId,
      messageId: prepared.messageId,
      encodedMessageCreateEvent: prepared.encodedMessageCreateEvent,
      encodedMessageEventSignature: prepared.encodedMessageEventSignature,
      textDigest: intentDigest,
    },
  });
  if (!persisted) {
    throw new Error(
      "This browser could not safely save the encrypted reply for retry."
    );
  }
  return prepared;
}

export function prepareXChatReactionInBrowser(args: {
  prospectId: string;
  targetMessageSequenceId: string;
  emoji: string;
  remove?: boolean;
}): PersistedPreparedXChatTextMessage {
  if (!args.targetMessageSequenceId || !args.emoji.trim()) {
    throw new Error("The XChat reaction target is unavailable.");
  }
  const { browserSession, current } = getXChatSendContext(args.prospectId);
  const encrypt = args.remove
    ? current.chat.encryptRemoveReaction.bind(current.chat)
    : current.chat.encryptAddReaction.bind(current.chat);
  const payload = withXChatEncryptionKey(current, (encryptionContext) =>
    encrypt({
      conversationId: browserSession.conversationId,
      targetMessageSequenceId: args.targetMessageSequenceId,
      emoji: args.emoji,
      ...encryptionContext,
    })
  );
  return {
    clientRequestId: createXChatClientRequestId(),
    conversationId: browserSession.conversationId,
    messageId: payload.messageId,
    encodedMessageCreateEvent: payload.encryptedContent,
    encodedMessageEventSignature: payload.encodedEventSignature,
  };
}

/** Apply a provider-confirmed reaction without waiting for a history refetch. */
export function confirmXChatReactionInBrowser(args: {
  prospectId: string;
  targetMessageSequenceId: string;
  emoji: string;
  remove: boolean;
}): void {
  const sessionKey = sessionKeysByProspectId.get(args.prospectId);
  const session = sessionKey ? decryptedSessions.get(sessionKey) : undefined;
  if (!session) return;

  let changed = false;
  const messages = session.messages.map((message) => {
    if (
      message.id !== args.targetMessageSequenceId &&
      message.sequenceId !== args.targetMessageSequenceId
    ) {
      return message;
    }
    const reactions = [...(message.reactions ?? [])];
    const index = reactions.findIndex(
      (reaction) => reaction.emoji === args.emoji
    );
    const existing = index >= 0 ? reactions[index] : undefined;

    if (args.remove) {
      if (!existing?.reactedByViewer) return message;
      if (existing.count <= 1) reactions.splice(index, 1);
      else {
        reactions[index] = {
          ...existing,
          count: existing.count - 1,
          reactedByViewer: false,
        };
      }
    } else if (!existing) {
      reactions.push({ emoji: args.emoji, count: 1, reactedByViewer: true });
    } else if (!existing.reactedByViewer) {
      reactions[index] = {
        ...existing,
        count: existing.count + 1,
        reactedByViewer: true,
      };
    } else {
      return message;
    }
    changed = true;
    return { ...message, reactions };
  });

  if (!changed) return;
  decryptedSessions.set(sessionKey!, { ...session, messages });
  emitChange();
}

/** Publish a browser-memory-only local echo before provider delivery. */
export function publishPendingXChatTextMessageInBrowser(args: {
  prospectId: string;
  message: PersistedPreparedXChatTextMessage;
  text: string;
  attachments?: BrowserDecryptedXChatMessage["attachments"];
  quotedMessage?: BrowserDecryptedXChatMessage["quotedMessage"];
}): void {
  const sessionKey = sessionKeysByProspectId.get(args.prospectId);
  if (!sessionKey) return;
  const session = decryptedSessions.get(sessionKey);
  if (!session || session.conversationId !== args.message.conversationId) {
    return;
  }
  const message: BrowserDecryptedXChatMessage = {
    id: args.message.messageId,
    senderId: session.viewerUserId,
    direction: "sent",
    occurredAt: getCurrentUTCTimestamp(),
    text: args.text.trim(),
    attachments: args.attachments,
    quotedMessageId: args.quotedMessage?.id,
    quotedMessage: args.quotedMessage,
    deliveryStatus: "sending",
    clientRequestId: args.message.clientRequestId,
  };
  pendingPublishedMessagesByClientRequestId.set(args.message.clientRequestId, {
    prospectId: args.prospectId,
    payload: args.message,
  });
  const messages = session.messages
    .filter((item) => item.id !== message.id)
    .concat(message)
    .sort((left, right) => left.occurredAt - right.occurredAt);
  decryptedSessions.set(sessionKey, { ...session, messages });
  emitChange();
}

export function getPendingXChatMessageForRetry(args: {
  prospectId: string;
  clientRequestId: string;
}): PersistedPreparedXChatTextMessage | null {
  const pending = pendingPublishedMessagesByClientRequestId.get(
    args.clientRequestId
  );
  return pending?.prospectId === args.prospectId ? pending.payload : null;
}

export function failPendingXChatTextMessageInBrowser(args: {
  prospectId: string;
  messageId: string;
  errorMessage: string;
}): void {
  const sessionKey = sessionKeysByProspectId.get(args.prospectId);
  const session = sessionKey ? decryptedSessions.get(sessionKey) : undefined;
  if (!session) return;
  const messages = session.messages.map((message) =>
    message.id === args.messageId
      ? {
          ...message,
          deliveryStatus: "failed" as const,
          deliveryError: args.errorMessage,
        }
      : message
  );
  decryptedSessions.set(sessionKey!, { ...session, messages });
  emitChange();
}

/** Publish a provider-confirmed local echo without persisting plaintext. */
export function confirmXChatTextMessageInBrowser(args: {
  prospectId: string;
  message: PreparedXChatTextMessage & { clientRequestId?: string };
  text: string;
}): void {
  const pending = pendingTextMessagesByProspectId.get(args.prospectId);
  if (pending?.payload.messageId === args.message.messageId) {
    pendingTextMessagesByProspectId.delete(args.prospectId);
  }
  if (args.message.clientRequestId) {
    pendingPublishedMessagesByClientRequestId.delete(
      args.message.clientRequestId
    );
    clearStoredXChatPendingSend({
      prospectId: args.prospectId,
      conversationId: args.message.conversationId,
      clientRequestId: args.message.clientRequestId,
    });
  }
  const sessionKey = sessionKeysByProspectId.get(args.prospectId);
  if (!sessionKey) {
    return;
  }
  const session = decryptedSessions.get(sessionKey);
  if (!session || session.conversationId !== args.message.conversationId) {
    return;
  }
  const pendingMessage = session.messages.find(
    (item) => item.id === args.message.messageId
  );
  const message: BrowserDecryptedXChatMessage = pendingMessage
    ? {
        ...pendingMessage,
        deliveryStatus: undefined,
        deliveryError: undefined,
        clientRequestId: undefined,
      }
    : {
        id: args.message.messageId,
        senderId: session.viewerUserId,
        direction: "sent",
        occurredAt: getCurrentUTCTimestamp(),
        text: args.text.trim(),
      };
  const messages = session.messages
    .filter((item) => item.id !== message.id)
    .concat(message)
    .sort((left, right) => left.occurredAt - right.occurredAt);
  decryptedSessions.set(sessionKey, { ...session, messages });
  emitChange();
}

function hasPlayableXChatAttachment(
  attachment: BrowserDecryptedXChatAttachment
): boolean {
  return Boolean(
    attachment.url || attachment.previewUrl || attachment.variants?.length
  );
}

/**
 * A just-sent media event can arrive before X makes its encrypted bytes
 * downloadable. Keep the browser-owned optimistic preview until a playable
 * provider attachment is available instead of regressing to unavailable.
 */
export function mergeXChatAttachmentsPreservingPlayablePreview(args: {
  existing?: BrowserDecryptedXChatAttachment[];
  incoming?: BrowserDecryptedXChatAttachment[];
}): BrowserDecryptedXChatAttachment[] | undefined {
  if (!args.incoming?.length) return args.existing;
  if (!args.existing?.length) return args.incoming;

  return args.incoming.map((incoming, index) => {
    if (hasPlayableXChatAttachment(incoming)) return incoming;
    const existing =
      args.existing?.find(
        (candidate) =>
          (incoming.mediaKey && candidate.mediaKey === incoming.mediaKey) ||
          (incoming.id && candidate.id === incoming.id)
      ) ?? args.existing?.[index];
    if (!existing || !hasPlayableXChatAttachment(existing)) return incoming;

    return {
      ...existing,
      ...incoming,
      url: existing.url,
      previewUrl: existing.previewUrl,
      variants: existing.variants,
      isGif: existing.isGif || incoming.isGif,
      isVoiceNote: existing.isVoiceNote || incoming.isVoiceNote,
      isLoading: false,
      unavailable: false,
    };
  });
}

/** Decrypt and merge one user-requested older event page in browser memory. */
export async function appendXChatEventPageInBrowser(args: {
  prospectId: string;
  page: XChatEncryptedEventPage;
  getEncryptedMedia?: XChatEncryptedMediaFetcher;
  pagination?: "older" | "newest";
}): Promise<void> {
  const sessionKey = sessionKeysByProspectId.get(args.prospectId);
  const session = sessionKey ? decryptedSessions.get(sessionKey) : undefined;
  const current = activeSession;
  if (
    !sessionKey ||
    !session ||
    !current?.chat.isUnlocked() ||
    session.conversationId !== args.page.conversationId ||
    current.viewerUserId !== session.viewerUserId ||
    current.signingKeyVersion !== session.signingKeyVersion
  ) {
    throw new Error("Your XChat session expired. Unlock it again to continue.");
  }

  const result = current.chat.decryptEvents(
    args.page.events.map((event) => event.encodedEvent)
  );
  indexVerifiedXChatRawEvents(current, result.messages);
  const normalized = normalizeVerifiedXChatConversation({
    events: result.messages.map(({ event }) => event),
    viewerUserId: session.viewerUserId,
  });
  // chat-xdk may return a new Uint8Array view over key material already owned
  // by the active WASM session. Never zero an overwritten view here: doing so
  // can invalidate both views and break every later media decrypt. Key material
  // is zeroed only when the complete session is released.
  const nextConversationKeys = mergeXChatConversationKeys(
    current.conversationKeys,
    result.conversationKeys.keys
  );
  current.conversationKeys = nextConversationKeys;
  if (args.pagination === "newest" && result.conversationKeys.latestVersion) {
    current.latestConversationKeyVersion =
      result.conversationKeys.latestVersion;
  }
  const nextBindings = buildVerifiedMediaBindings({
    prospectId: args.prospectId,
    conversationId: session.conversationId,
    messages: normalized.messages,
  });
  for (const [key, binding] of nextBindings) {
    current.mediaBindings.set(key, binding);
  }
  const existingMessagesById = new Map(
    session.messages.map((message) => [message.id, message])
  );
  const messagesNeedingMedia = normalized.messages.filter((message) => {
    const existing = existingMessagesById.get(message.id);
    return getXChatMediaOwners([message]).some((owner) => {
      const existingAttachments =
        owner.messageId === message.id
          ? existing?.attachments
          : existing?.quotedMessage?.id === owner.messageId
            ? existing.quotedMessage.attachments
            : undefined;
      return owner.attachments.some(
        (attachment) =>
          attachment.mediaKey &&
          !attachment.url &&
          !existingAttachments?.some(
            (candidate) =>
              candidate.mediaKey === attachment.mediaKey &&
              Boolean(candidate.url)
          )
      );
    });
  });
  const hydrated =
    args.getEncryptedMedia && messagesNeedingMedia.length > 0
      ? await hydrateXChatAttachments({
          chat: current.chat,
          conversationKeys: nextConversationKeys,
          prospectId: args.prospectId,
          conversationId: session.conversationId,
          mediaBindings: current.mediaBindings,
          messages: messagesNeedingMedia,
          getEncryptedMedia: args.getEncryptedMedia,
          isStillUnlocked: () => activeSession === current,
        })
      : { messages: [], objectUrls: [] };
  if (activeSession !== current || !current.chat.isUnlocked()) {
    for (const objectUrl of hydrated.objectUrls) {
      URL.revokeObjectURL(objectUrl);
    }
    throw new Error("The XChat session was locked while loading messages.");
  }

  const hydratedMessagesById = new Map(
    hydrated.messages.map((message) => [message.id, message])
  );
  const incomingMessages = normalized.messages.map((message) => {
    const hydratedMessage = hydratedMessagesById.get(message.id);
    const existingMessage = existingMessagesById.get(message.id);
    const incomingMessage = hydratedMessage ?? message;
    if (!existingMessage) return incomingMessage;
    return {
      ...existingMessage,
      ...incomingMessage,
      attachments: mergeXChatAttachmentsPreservingPlayablePreview({
        existing: existingMessage.attachments,
        incoming: incomingMessage.attachments,
      }),
      quotedMessage: incomingMessage.quotedMessage
        ? {
            ...incomingMessage.quotedMessage,
            attachments: mergeXChatAttachmentsPreservingPlayablePreview({
              existing: existingMessage.quotedMessage?.attachments,
              incoming: incomingMessage.quotedMessage.attachments,
            }),
          }
        : existingMessage.quotedMessage,
    };
  });
  const messagesById = new Map(
    [...session.messages, ...incomingMessages].map((message) => [
      message.id,
      message,
    ])
  );
  const mergedMessages = applyXChatReadReceipts(
    hydrateXChatQuotedMessages([...messagesById.values()]),
    normalized.readReceipts
  );
  const messageUpdates = [
    ...(session.messageUpdates ?? []),
    ...normalized.messageUpdates,
  ];
  const loadedEventIds = new Set(session.loadedEventIds ?? []);
  for (const event of args.page.events) {
    if (event.id) loadedEventIds.add(event.id);
  }
  decryptedSessions.set(sessionKey, {
    ...session,
    messages: mergedMessages.sort(
      (left, right) => left.occurredAt - right.occurredAt
    ),
    messageUpdates,
    loadedEventIds: [...loadedEventIds],
    decryptionErrorCount:
      session.decryptionErrorCount + Object.keys(result.errors).length,
    eventPagesFetched: session.eventPagesFetched + 1,
    nextCursor:
      args.pagination === "newest" ? session.nextCursor : args.page.nextCursor,
    hasMore: args.pagination === "newest" ? session.hasMore : args.page.hasMore,
  });
  if (hydrated.objectUrls.length > 0) {
    const currentUrls = objectUrlsBySessionKey.get(sessionKey) ?? new Set();
    for (const objectUrl of hydrated.objectUrls) {
      currentUrls.add(objectUrl);
    }
    objectUrlsBySessionKey.set(sessionKey, currentUrls);
  }
  pruneUnreferencedXChatObjectUrls(sessionKey, mergedMessages);
  emitChange();
}

function releaseActiveSession() {
  const session = activeSession;
  activeSession = null;
  if (!session) {
    return;
  }
  for (const conversationKey of Object.values(session.conversationKeys)) {
    conversationKey.fill(0);
  }
  session.mediaBindings.clear();
  session.replyTargetsByMessageId.clear();
  session.rawEditEventsByMessageId.clear();
  session.rawKeyChangeEventsByVersion.clear();
  try {
    session.chat.free();
  } catch {
    // Key material is no longer reachable from this browser session even if
    // the XDK's best-effort cleanup reports an error.
  }
}

/** Frees local XChat key material and forgets all decrypted plaintext. */
export function lockXChatInBrowser(): void {
  const unlockedProspectIds = Array.from(sessionKeysByProspectId.keys());
  releaseActiveSession();
  for (const sessionKey of Array.from(objectUrlsBySessionKey.keys())) {
    revokeObjectUrls(sessionKey);
  }
  decryptedSessions.clear();
  sessionKeysByProspectId.clear();
  pendingTextMessagesByProspectId.clear();
  pendingPublishedMessagesByClientRequestId.clear();
  encryptedMediaRequestsByBindingKey.clear();
  encryptedMediaRetryAtByBindingKey.clear();
  for (const prospectId of unlockedProspectIds) {
    sessionStatesByProspectId.set(prospectId, { status: "locked" });
  }
  emitChange();
}

type XChatMediaDecryptor = Pick<ChatWithJuicebox, "decryptStream">;

type XChatMediaHydrationResult = {
  messages: BrowserDecryptedXChatMessage[];
  objectUrls: string[];
};

type XChatMimeTypeDetector = (bytes: Uint8Array) => string | undefined;

const MAX_XCHAT_BROWSER_MEDIA_BYTES = 100 * 1024 * 1024;
const XCHAT_MEDIA_HYDRATION_CONCURRENCY = 3;

async function readXChatEncryptedMediaResponse(
  media: XChatEncryptedMediaResponse
): Promise<ArrayBuffer> {
  if (media.availability === "unavailable") {
    throw new Error("XChat attachment is no longer available (404 Not Found).");
  }
  if (media.ciphertext instanceof ArrayBuffer) {
    return media.ciphertext;
  }
  if (!media.url) {
    throw new Error("XChat media response did not include encrypted bytes.");
  }
  if (
    typeof media.size === "number" &&
    (!Number.isSafeInteger(media.size) ||
      media.size <= 0 ||
      media.size > MAX_XCHAT_BROWSER_MEDIA_BYTES)
  ) {
    throw new Error("XChat media size is invalid or unsupported.");
  }
  const response = await fetch(media.url, {
    credentials: "omit",
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error(
      `XChat encrypted media download failed (${response.status}).`
    );
  }
  const blob = await response.blob();
  if (blob.size <= 0 || blob.size > MAX_XCHAT_BROWSER_MEDIA_BYTES) {
    throw new Error("XChat encrypted media size is unsupported.");
  }
  if (typeof media.size === "number" && blob.size !== media.size) {
    throw new Error("XChat encrypted media download was incomplete.");
  }
  return await blob.arrayBuffer();
}

async function detectXChatMediaMimeType(
  plaintext: Uint8Array
): Promise<string | undefined> {
  const { detectMimeType } = await import("@xdevplatform/chat-xdk");
  return detectMimeType(plaintext);
}

const BLOCKED_GENERIC_MEDIA_MIME_TYPES = new Set([
  "application/javascript",
  "application/xhtml+xml",
  "image/svg+xml",
  "text/html",
]);

function getExpectedXChatMediaKind(
  attachment: NonNullable<BrowserDecryptedXChatMessage["attachments"]>[number]
): XChatMediaKind {
  const descriptor = [attachment.type, attachment.mimeType, attachment.fileName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (
    attachment.isVoiceNote ||
    descriptor.includes("audio") ||
    descriptor.includes("voice") ||
    /\.(?:aac|flac|m4a|mp3|oga|ogg|wav)\b/u.test(descriptor)
  ) {
    return "audio";
  }
  // X currently labels some encrypted MP4 attachments as generic "image"
  // media. A concrete filename extension is stronger evidence than that
  // provider label and must win before the descriptor fallback below.
  const fileNameKind = inferAttachmentMediaKind({
    url: attachment.fileName,
  });
  if (fileNameKind === "video") {
    return "video";
  }
  if (fileNameKind === "image" || fileNameKind === "gif") {
    return "image";
  }
  if (
    attachment.isGif ||
    descriptor.includes("image") ||
    descriptor.includes("photo") ||
    descriptor.includes("sticker") ||
    /\.(?:avif|gif|jpe?g|png|webp)\b/u.test(descriptor)
  ) {
    return "image";
  }
  if (
    descriptor.includes("video") ||
    /\.(?:m4v|mov|mp4|webm)\b/u.test(descriptor)
  ) {
    return "video";
  }
  return "file";
}

function getRenderableXChatMediaMimeType(args: {
  detectedMimeType?: string;
  claimedMimeType?: string;
  expectedKind: XChatMediaKind;
}): string | undefined {
  const detected = args.detectedMimeType?.trim().toLowerCase();
  const claimed = args.claimedMimeType?.trim().toLowerCase();
  const candidate = detected || claimed;
  if (!candidate || BLOCKED_GENERIC_MEDIA_MIME_TYPES.has(candidate)) {
    return args.expectedKind === "file"
      ? "application/octet-stream"
      : undefined;
  }
  if (args.expectedKind === "audio") {
    if (candidate.startsWith("audio/")) return candidate;
    // M4A is an ISO-BMFF container and is commonly detected as video/mp4.
    if (candidate === "video/mp4") return "audio/mp4";
    return undefined;
  }
  if (args.expectedKind === "image") {
    return candidate.startsWith("image/") ? candidate : undefined;
  }
  if (args.expectedKind === "video") {
    return candidate.startsWith("video/") ? candidate : undefined;
  }
  return candidate;
}

type DecryptableXChatMedia = {
  mediaHashKey: string;
  expectedKind: XChatMediaKind;
  keyVersion?: string;
};

type XChatMediaOwner = {
  messageId: string;
  keyVersion?: string;
  attachments: NonNullable<BrowserDecryptedXChatMessage["attachments"]>;
};

function getXChatMediaOwners(
  messages: BrowserDecryptedXChatMessage[]
): XChatMediaOwner[] {
  return messages.flatMap((message) => {
    const owners: XChatMediaOwner[] = [];
    if (message.attachments?.length) {
      owners.push({
        messageId: message.id,
        attachments: message.attachments,
        ...(message.keyVersion ? { keyVersion: message.keyVersion } : {}),
      });
    }
    if (message.quotedMessage?.attachments?.length) {
      owners.push({
        messageId: message.quotedMessage.id,
        attachments: message.quotedMessage.attachments,
      });
    }
    return owners;
  });
}

function pruneUnreferencedXChatObjectUrls(
  sessionKey: string,
  messages: BrowserDecryptedXChatMessage[]
): void {
  const trackedUrls = objectUrlsBySessionKey.get(sessionKey);
  if (!trackedUrls?.size) return;

  const referencedUrls = new Set<string>();
  for (const owner of getXChatMediaOwners(messages)) {
    for (const attachment of owner.attachments) {
      for (const url of [
        attachment.url,
        attachment.previewUrl,
        ...(attachment.variants?.map((variant) => variant.url) ?? []),
      ]) {
        if (url?.startsWith("blob:")) referencedUrls.add(url);
      }
    }
  }

  for (const objectUrl of trackedUrls) {
    if (referencedUrls.has(objectUrl)) continue;
    URL.revokeObjectURL(objectUrl);
    trackedUrls.delete(objectUrl);
  }
  if (trackedUrls.size === 0) objectUrlsBySessionKey.delete(sessionKey);
}

function getDecryptableXChatMedia(args: {
  owner: XChatMediaOwner;
  attachment: NonNullable<BrowserDecryptedXChatMessage["attachments"]>[number];
}): DecryptableXChatMedia | null {
  const { attachment, owner } = args;
  if (
    typeof attachment.mediaKey === "string" &&
    attachment.mediaKey &&
    !attachment.url
  ) {
    return {
      mediaHashKey: attachment.mediaKey,
      expectedKind: getExpectedXChatMediaKind(attachment),
      ...(owner.keyVersion ? { keyVersion: owner.keyVersion } : {}),
    };
  }
  return null;
}

function buildVerifiedMediaBindings(args: {
  prospectId: string;
  conversationId: string;
  messages: BrowserDecryptedXChatMessage[];
}): Map<string, XChatMediaBinding> {
  const bindings = new Map<string, XChatMediaBinding>();
  for (const owner of getXChatMediaOwners(args.messages)) {
    for (const attachment of owner.attachments) {
      const media = getDecryptableXChatMedia({ owner, attachment });
      if (!media) {
        continue;
      }
      const binding: XChatMediaBinding = {
        prospectId: args.prospectId,
        conversationId: args.conversationId,
        messageId: owner.messageId,
        mediaHashKey: media.mediaHashKey,
        expectedKind: media.expectedKind,
        ...(media.keyVersion ? { keyVersion: media.keyVersion } : {}),
      };
      bindings.set(makeMediaBindingKey(binding), binding);
    }
  }
  return bindings;
}

function setXChatMediaLoadingState(args: {
  prospectId: string;
  conversationId: string;
  messages: BrowserDecryptedXChatMessage[];
  mediaBindings: ReadonlyMap<string, XChatMediaBinding>;
  isLoading: boolean;
}): BrowserDecryptedXChatMessage[] {
  const updateAttachments = (
    messageId: string,
    attachments: BrowserDecryptedXChatMessage["attachments"]
  ) =>
    attachments?.map((attachment) => {
      if (!attachment.mediaKey || attachment.url) return attachment;
      const bindingKey = makeMediaBindingKey({
        prospectId: args.prospectId,
        conversationId: args.conversationId,
        messageId,
        mediaHashKey: attachment.mediaKey,
      });
      if (!args.mediaBindings.has(bindingKey)) return attachment;
      return {
        ...attachment,
        isLoading: args.isLoading,
        unavailable: !args.isLoading,
      };
    });

  return args.messages.map((message) => ({
    ...message,
    attachments: updateAttachments(message.id, message.attachments),
    quotedMessage: message.quotedMessage
      ? {
          ...message.quotedMessage,
          attachments: updateAttachments(
            message.quotedMessage.id,
            message.quotedMessage.attachments
          ),
        }
      : undefined,
  }));
}

type XChatConversationKeyCandidate = {
  keyVersion: string;
  conversationKey: Uint8Array;
};

const XCHAT_CONVERSATION_KEY_BYTES = 32;

function compareXChatKeyVersionsNewestFirst(
  left: string,
  right: string
): number {
  try {
    const leftVersion = BigInt(left);
    const rightVersion = BigInt(right);
    if (leftVersion === rightVersion) {
      return 0;
    }
    return leftVersion > rightVersion ? -1 : 1;
  } catch {
    if (left === right) {
      return 0;
    }
    return left > right ? -1 : 1;
  }
}

/**
 * Prefer the explicit event key when present. Some installed XChat event
 * shapes omit keyVersion, so match xurl's recovery behavior by trying every
 * recovered key in deterministic newest-first order.
 */
function getXChatMediaKeyCandidates(args: {
  conversationKeys: Readonly<Record<string, Uint8Array>>;
  preferredKeyVersion?: string;
}): XChatConversationKeyCandidate[] {
  const recoveredKeys = Object.entries(args.conversationKeys)
    .filter(
      ([keyVersion, conversationKey]) =>
        keyVersion.trim().length > 0 && conversationKey.byteLength > 0
    )
    .sort(([left], [right]) => compareXChatKeyVersionsNewestFirst(left, right))
    .map(([keyVersion, conversationKey]) => ({
      keyVersion,
      conversationKey,
    }));
  const preferred = args.preferredKeyVersion
    ? args.conversationKeys[args.preferredKeyVersion]
    : undefined;
  if (!preferred || preferred.byteLength === 0 || !args.preferredKeyVersion) {
    return recoveredKeys;
  }

  return [
    {
      keyVersion: args.preferredKeyVersion,
      conversationKey: preferred,
    },
    ...recoveredKeys.filter(
      (candidate) => candidate.keyVersion !== args.preferredKeyVersion
    ),
  ];
}

/**
 * Copies verified key bytes out of the SDK result before passing them back
 * into WASM. chat-xdk can expose views backed by its own WASM memory; feeding
 * those views into another mutating crypto call can trigger aliasing traps.
 */
export function copyXChatConversationKeyForEncryption(args: {
  conversationKeys: Readonly<Record<string, Uint8Array>>;
  preferredKeyVersion?: string;
}): {
  conversationKey: Uint8Array;
  conversationKeyVersion: string;
} | null {
  const candidate = getXChatMediaKeyCandidates(args).find(
    ({ conversationKey }) =>
      conversationKey.byteLength === XCHAT_CONVERSATION_KEY_BYTES
  );
  if (!candidate) return null;
  return {
    conversationKey: new Uint8Array(candidate.conversationKey),
    conversationKeyVersion: candidate.keyVersion,
  };
}

function withXChatEncryptionKey<T>(
  current: ActiveXChatSession,
  encrypt: (context: {
    conversationKey: Uint8Array;
    conversationKeyVersion: string;
  }) => T,
  preferredKeyVersion = current.latestConversationKeyVersion
): T {
  const context = copyXChatConversationKeyForEncryption({
    conversationKeys: current.conversationKeys,
    preferredKeyVersion,
  });
  if (!context) {
    throw new Error("The XChat conversation key is unavailable. Unlock again.");
  }
  try {
    return encrypt(context);
  } finally {
    context.conversationKey.fill(0);
  }
}

type DownloadableXChatMedia = {
  mediaHashKey: string;
  expectedKind: XChatMediaKind;
  claimedMimeType?: string;
  preferredKeyVersion?: string;
};

type HydratedXChatMedia = {
  objectUrl: string;
  mimeType: string;
};

/**
 * Decrypt sent or received attachment bytes only in the unlocked browser
 * session. Provider bytes remain encrypted in storage and plaintext exists
 * only in revocable browser object URLs.
 * A message's keyVersion is preferred when the SDK exposes it. Older event
 * shapes omit that metadata, so recovered keys are tried newest-first.
 */
export async function hydrateXChatAttachments(args: {
  chat: XChatMediaDecryptor;
  conversationKeys: Readonly<Record<string, Uint8Array>>;
  prospectId: string;
  conversationId: string;
  mediaBindings?: ReadonlyMap<string, XChatMediaBinding>;
  messages: BrowserDecryptedXChatMessage[];
  getEncryptedMedia: XChatEncryptedMediaFetcher;
  detectMimeType?: XChatMimeTypeDetector;
  isStillUnlocked?: () => boolean;
}): Promise<XChatMediaHydrationResult> {
  const isStillUnlocked = args.isStillUnlocked ?? (() => true);
  const downloadableAttachments = new Map<string, DownloadableXChatMedia>();

  for (const owner of getXChatMediaOwners(args.messages)) {
    for (const attachment of owner.attachments) {
      const media = getDecryptableXChatMedia({ owner, attachment });
      if (!media) {
        continue;
      }
      const bindingKey = makeMediaBindingKey({
        prospectId: args.prospectId,
        conversationId: args.conversationId,
        messageId: owner.messageId,
        mediaHashKey: media.mediaHashKey,
      });
      const keyCandidates = getXChatMediaKeyCandidates({
        conversationKeys: args.conversationKeys,
        preferredKeyVersion: media.keyVersion,
      });
      if (keyCandidates.length === 0) {
        continue;
      }
      if (args.mediaBindings) {
        const binding = args.mediaBindings.get(bindingKey);
        if (
          !binding ||
          binding.messageId !== owner.messageId ||
          binding.mediaHashKey !== media.mediaHashKey ||
          binding.keyVersion !== media.keyVersion ||
          binding.expectedKind !== media.expectedKind
        ) {
          continue;
        }
      }
      if (!downloadableAttachments.has(bindingKey)) {
        downloadableAttachments.set(bindingKey, {
          mediaHashKey: media.mediaHashKey,
          expectedKind: media.expectedKind,
          ...(attachment.mimeType
            ? { claimedMimeType: attachment.mimeType }
            : {}),
          ...(media.keyVersion
            ? { preferredKeyVersion: media.keyVersion }
            : {}),
        });
      }
    }
  }

  const hydratedMediaByBindingKey = new Map<string, HydratedXChatMedia>();
  // Conversation messages arrive oldest-first. Start with the newest visible
  // attachments and overlap only the network-bound work so a recent video does
  // not wait behind every historical image in the page.
  const prioritizedDownloads = Array.from(
    downloadableAttachments.entries()
  ).reverse();
  await mapWithConcurrency(
    prioritizedDownloads,
    XCHAT_MEDIA_HYDRATION_CONCURRENCY,
    async ([bindingKey, attachment]) => {
      if (!isStillUnlocked()) {
        return;
      }
      const retryAt = encryptedMediaRetryAtByBindingKey.get(bindingKey);
      if (retryAt && retryAt > getCurrentUTCTimestamp()) {
        return;
      }
      encryptedMediaRetryAtByBindingKey.delete(bindingKey);

      try {
        const encryptedMedia = await getEncryptedXChatMediaOnce({
          bindingKey,
          mediaHashKey: attachment.mediaHashKey,
          getEncryptedMedia: args.getEncryptedMedia,
        });
        encryptedMediaRetryAtByBindingKey.delete(bindingKey);
        if (!isStillUnlocked()) {
          return;
        }
        const encryptedBytes =
          await readXChatEncryptedMediaResponse(encryptedMedia);
        const keyCandidates = getXChatMediaKeyCandidates({
          conversationKeys: args.conversationKeys,
          preferredKeyVersion: attachment.preferredKeyVersion,
        });
        let lastDecryptError: unknown;
        for (const candidate of keyCandidates) {
          if (!isStillUnlocked()) {
            break;
          }
          const ciphertext = new Uint8Array(encryptedBytes);
          let plaintext: Uint8Array | undefined;
          try {
            plaintext = args.chat.decryptStream(
              ciphertext,
              candidate.conversationKey
            );
            const detectedMimeType = args.detectMimeType
              ? args.detectMimeType(plaintext)
              : await detectXChatMediaMimeType(plaintext);
            const playableMimeType = getRenderableXChatMediaMimeType({
              detectedMimeType,
              claimedMimeType: attachment.claimedMimeType,
              expectedKind: attachment.expectedKind,
            });
            if (!playableMimeType) {
              throw new Error("XChat media type did not match its attachment.");
            }
            if (!isStillUnlocked()) {
              break;
            }
            const blobBytes = new Uint8Array(plaintext.byteLength);
            blobBytes.set(plaintext);
            const objectUrl = URL.createObjectURL(
              new Blob([blobBytes.buffer], {
                type: playableMimeType,
              })
            );
            blobBytes.fill(0);
            hydratedMediaByBindingKey.set(bindingKey, {
              objectUrl,
              mimeType: playableMimeType,
            });
            break;
          } catch (error) {
            lastDecryptError = error;
            // The expected-key attempt can fail after a key rotation. Try the
            // remaining recovered keys before marking this attachment missing.
            continue;
          } finally {
            plaintext?.fill(0);
            ciphertext.fill(0);
          }
        }
        if (!hydratedMediaByBindingKey.has(bindingKey)) {
          throw lastDecryptError instanceof Error
            ? lastDecryptError
            : new Error(
                "No recovered XChat key could decrypt this attachment."
              );
        }
      } catch (error) {
        encryptedMediaRetryAtByBindingKey.set(
          bindingKey,
          getXChatMediaRetryAt(error)
        );
        console.warn(
          "[XChatBrowserSession] Unable to render XChat attachment",
          error instanceof Error ? error.message : String(error)
        );
        // Keep this one attachment unavailable. A bad/expired media blob must
        // not discard independently verified XChat messages or other media.
      }
    }
  );

  const hydrateAttachments = (
    messageId: string,
    source: NonNullable<BrowserDecryptedXChatMessage["attachments"]> | undefined
  ) => {
    let changed = false;
    const attachments = source?.map((attachment) => {
      const bindingKey = attachment.mediaKey
        ? makeMediaBindingKey({
            prospectId: args.prospectId,
            conversationId: args.conversationId,
            messageId,
            mediaHashKey: attachment.mediaKey,
          })
        : undefined;
      const hydratedMedia = bindingKey
        ? hydratedMediaByBindingKey.get(bindingKey)
        : undefined;
      if (!hydratedMedia) {
        const hydrationSettled = Boolean(
          bindingKey &&
          (args.mediaBindings?.has(bindingKey) ??
            downloadableAttachments.has(bindingKey))
        );
        if (
          hydrationSettled &&
          (attachment.isLoading || !attachment.unavailable)
        ) {
          changed = true;
          return {
            ...attachment,
            isLoading: false,
            unavailable: true,
          };
        }
        return attachment;
      }
      changed = true;
      const isAudio = hydratedMedia.mimeType.startsWith("audio/");
      const detectedMediaKind = inferAttachmentMediaKind({
        mimeType: hydratedMedia.mimeType,
      });
      return {
        ...attachment,
        type: isAudio
          ? "audio"
          : detectedMediaKind === "gif"
            ? "gif"
            : (detectedMediaKind ?? attachment.type),
        url: hydratedMedia.objectUrl,
        mimeType: hydratedMedia.mimeType,
        isGif: attachment.isGif || detectedMediaKind === "gif",
        isVoiceNote: attachment.isVoiceNote || isAudio,
        isLoading: false,
        unavailable: false,
      };
    });
    return { attachments, changed };
  };

  let messagesChanged = false;
  const messages = args.messages.map((message) => {
    const hydratedMessage = hydrateAttachments(message.id, message.attachments);
    const quote = message.quotedMessage;
    const hydratedQuote = quote
      ? hydrateAttachments(quote.id, quote.attachments)
      : { attachments: undefined, changed: false };
    if (!hydratedMessage.changed && !hydratedQuote.changed) {
      return message;
    }
    messagesChanged = true;
    return {
      ...message,
      ...(hydratedMessage.changed
        ? { attachments: hydratedMessage.attachments }
        : {}),
      ...(quote && hydratedQuote.changed
        ? {
            quotedMessage: {
              ...quote,
              attachments: hydratedQuote.attachments,
              attachmentType:
                hydratedQuote.attachments?.[0]?.type ?? quote.attachmentType,
            },
          }
        : {}),
    };
  });

  return {
    messages: messagesChanged ? messages : args.messages,
    objectUrls: Array.from(
      new Set(
        Array.from(
          hydratedMediaByBindingKey.values(),
          (media) => media.objectUrl
        )
      )
    ),
  };
}

/** Backward-compatible focused entry point retained for existing callers. */
export async function hydrateXChatVoiceNotes(
  args: Omit<Parameters<typeof hydrateXChatAttachments>[0], "mediaBindings"> & {
    voiceNoteBindings?: ReadonlyMap<
      string,
      Omit<XChatMediaBinding, "expectedKind">
    >;
  }
): Promise<XChatMediaHydrationResult> {
  const mediaBindings = args.voiceNoteBindings
    ? new Map(
        Array.from(args.voiceNoteBindings, ([key, binding]) => [
          key,
          { ...binding, expectedKind: "audio" as const },
        ])
      )
    : undefined;
  const { voiceNoteBindings: _voiceNoteBindings, ...rest } = args;
  return await hydrateXChatAttachments({ ...rest, mediaBindings });
}

/**
 * Deduplicates only concurrent token requests. Settled entries are evicted so
 * an expired token is never retained and a rejected request can be retried.
 */
export function createInFlightRealmAuthTokenProvider(
  getRealmAuthToken: (realmId: string) => Promise<string>
): (realmId: string) => Promise<string> {
  const inFlightByRealmId = new Map<string, Promise<string>>();

  return (realmId) => {
    const existingRequest = inFlightByRealmId.get(realmId);
    if (existingRequest) {
      return existingRequest;
    }

    // Defer invocation until after the promise is cached so even a synchronous
    // throw from an implementation follows the same retry-safe cleanup path.
    const request = Promise.resolve().then(() => getRealmAuthToken(realmId));
    inFlightByRealmId.set(realmId, request);
    const clearIfCurrent = () => {
      if (inFlightByRealmId.get(realmId) === request) {
        inFlightByRealmId.delete(realmId);
      }
    };
    void request.then(clearIfCurrent, clearIfCurrent);
    return request;
  };
}

export function decryptXChatInBrowser(args: {
  prospectId: string;
  bundle: XChatDecryptBundle;
  pin: string;
  isCurrent?: () => boolean;
  getRealmAuthToken: (realmId: string) => Promise<string>;
  getEncryptedMedia?: XChatEncryptedMediaFetcher;
}): Promise<XChatDecryptResult> {
  if (args.isCurrent?.() === false) {
    return Promise.reject(new Error("X/Twitter Chat target changed."));
  }
  const operationKey = makeBrowserSessionKey({
    prospectId: args.prospectId,
    bundle: args.bundle,
  });
  return requestXChatBrowserDecryptOnce(operationKey, async () =>
    decryptXChatInBrowserOnce(args)
  );
}

async function decryptXChatInBrowserOnce(args: {
  prospectId: string;
  bundle: XChatDecryptBundle;
  pin: string;
  isCurrent?: () => boolean;
  getRealmAuthToken: (realmId: string) => Promise<string>;
  getEncryptedMedia?: XChatEncryptedMediaFetcher;
}): Promise<XChatDecryptResult> {
  const { bundle } = args;
  let chat: ChatWithJuicebox;
  if (isMatchingUnlockedSession(bundle)) {
    chat = activeSession!.chat;
    chat.updateConfig(bundle.juiceboxConfig);
  } else {
    releaseActiveSession();
    if (!args.pin.trim()) {
      throw new Error("Enter your XChat PIN to unlock this conversation.");
    }
    const { createChat } = await import("@xdevplatform/chat-xdk");
    chat = await createChat({
      juiceboxConfig: bundle.juiceboxConfig,
      getAuthToken: createInFlightRealmAuthTokenProvider(
        args.getRealmAuthToken
      ),
    });
    if (args.isCurrent?.() === false) {
      chat.free();
      throw new Error("X/Twitter Chat target changed.");
    }
    const pinBytes = new TextEncoder().encode(args.pin);
    try {
      await chat.unlock(pinBytes);
    } finally {
      pinBytes.fill(0);
    }
    if (args.isCurrent?.() === false) {
      chat.free();
      throw new Error("X/Twitter Chat target changed.");
    }
    activeSession = {
      chat,
      viewerUserId: bundle.viewerUserId,
      signingKeyVersion: bundle.signingKeyVersion,
      conversationKeys: {},
      latestConversationKeyVersion: undefined,
      mediaBindings: new Map(),
      replyTargetsByMessageId: new Map(),
      rawEditEventsByMessageId: new Map(),
      rawKeyChangeEventsByVersion: new Map(),
    };
  }

  chat.setIdentity(bundle.viewerUserId, bundle.signingKeyVersion);
  chat.setCacheKeys(true);
  chat.setSigningKeys(bundle.signingKeys);
  chat.setRejectUnverified(true);
  const result = chat.decryptEvents(
    bundle.events.map((event) => event.encodedEvent)
  );
  const decryptedConversation = normalizeVerifiedXChatConversation({
    events: result.messages.map(({ event }) => event),
    viewerUserId: bundle.viewerUserId,
  });
  const browserSession = activeSession;
  if (!browserSession || browserSession.chat !== chat) {
    throw new Error("The XChat session was locked before media could decrypt.");
  }
  indexVerifiedXChatRawEvents(browserSession, result.messages);
  // Do not mutate keys returned by chat-xdk while its WASM session remains
  // active. Different decryptEvents calls may expose aliasing Uint8Array views.
  browserSession.conversationKeys = result.conversationKeys.keys;
  browserSession.latestConversationKeyVersion =
    result.conversationKeys.latestVersion ?? undefined;
  browserSession.mediaBindings = buildVerifiedMediaBindings({
    prospectId: args.prospectId,
    conversationId: bundle.conversationId,
    messages: decryptedConversation.messages,
  });
  const decryptionErrorCount = Object.keys(result.errors).length;
  const verifiedMessages = hydrateXChatQuotedMessages(
    decryptedConversation.messages
  );
  const messages = args.getEncryptedMedia
    ? setXChatMediaLoadingState({
        prospectId: args.prospectId,
        conversationId: bundle.conversationId,
        messages: verifiedMessages,
        mediaBindings: browserSession.mediaBindings,
        isLoading: true,
      })
    : verifiedMessages;
  if (args.isCurrent?.() === false) {
    throw new Error("X/Twitter Chat target changed.");
  }
  const session = cacheVerifiedXChatBrowserSession({
    prospectId: args.prospectId,
    bundle,
    messages,
    messageUpdates: decryptedConversation.messageUpdates,
    decryptionErrorCount,
  });

  if (args.getEncryptedMedia) {
    const sessionKey = makeBrowserSessionKey({
      prospectId: args.prospectId,
      bundle,
    });
    void hydrateXChatAttachments({
      chat,
      conversationKeys: browserSession.conversationKeys,
      prospectId: args.prospectId,
      conversationId: bundle.conversationId,
      mediaBindings: browserSession.mediaBindings,
      messages,
      getEncryptedMedia: args.getEncryptedMedia,
      isStillUnlocked: () =>
        args.isCurrent?.() !== false &&
        activeSession === browserSession &&
        chat.isUnlocked(),
    })
      .then((hydratedMedia) => {
        if (
          args.isCurrent?.() === false ||
          activeSession !== browserSession ||
          !chat.isUnlocked() ||
          !applyHydratedXChatMedia({
            prospectId: args.prospectId,
            sessionKey,
            conversationId: session.conversationId,
            messages: hydrateXChatQuotedMessages(hydratedMedia.messages),
            objectUrls: hydratedMedia.objectUrls,
          })
        ) {
          for (const objectUrl of hydratedMedia.objectUrls) {
            URL.revokeObjectURL(objectUrl);
          }
        }
      })
      .catch((error) => {
        console.warn(
          "[XChatBrowserSession] Unable to hydrate initial XChat media",
          error instanceof Error ? error.message : String(error)
        );
        applyHydratedXChatMedia({
          prospectId: args.prospectId,
          sessionKey,
          conversationId: session.conversationId,
          messages: setXChatMediaLoadingState({
            prospectId: args.prospectId,
            conversationId: bundle.conversationId,
            messages,
            mediaBindings: browserSession.mediaBindings,
            isLoading: false,
          }),
          objectUrls: [],
        });
      });
  }

  return {
    messages,
    decryptionErrorCount,
  };
}
