"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ChatWithJuicebox, SigningKeyEntry } from "@xdevplatform/chat-xdk";

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
  hasMore: boolean;
};

export type BrowserDecryptedXChatMessage = {
  id: string;
  senderId: string;
  direction: "sent" | "received";
  occurredAt: number;
  text: string;
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
  decryptionErrorCount: number;
  eventPagesFetched: number;
  hasMore: boolean;
};

export type XChatBrowserSessionTarget = {
  prospectId?: string | null;
  viewerUserId?: string | null;
  participantUserId?: string | null;
  conversationId?: string | null;
  signingKeyVersion?: string | null;
};

type ActiveXChatSession = {
  chat: ChatWithJuicebox;
  viewerUserId: string;
  signingKeyVersion: string;
};

let activeSession: ActiveXChatSession | null = null;
const listeners = new Set<() => void>();
const decryptedSessions = new Map<string, BrowserXChatSession>();
const sessionKeysByProspectId = new Map<string, string>();

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
 * Stores only already-verified plaintext and provider coverage metadata in
 * process memory. Callers must decrypt with rejectUnverified enabled first.
 */
export function cacheVerifiedXChatBrowserSession(args: {
  prospectId: string;
  bundle: XChatDecryptBundle;
  messages: BrowserDecryptedXChatMessage[];
  decryptionErrorCount: number;
}): BrowserXChatSession {
  const session: BrowserXChatSession = {
    prospectId: args.prospectId,
    viewerUserId: args.bundle.viewerUserId,
    participantUserId: args.bundle.participantUserId,
    conversationId: args.bundle.conversationId,
    signingKeyVersion: args.bundle.signingKeyVersion,
    messages: args.messages,
    decryptionErrorCount: args.decryptionErrorCount,
    eventPagesFetched: args.bundle.eventPagesFetched,
    hasMore: args.bundle.hasMore,
  };
  const sessionKey = makeBrowserSessionKey(args);
  const previousSessionKey = sessionKeysByProspectId.get(args.prospectId);

  if (previousSessionKey && previousSessionKey !== sessionKey) {
    decryptedSessions.delete(previousSessionKey);
  }
  decryptedSessions.set(sessionKey, session);
  sessionKeysByProspectId.set(args.prospectId, sessionKey);
  emitChange();
  return session;
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

function releaseActiveSession() {
  const session = activeSession;
  activeSession = null;
  if (!session) {
    return;
  }
  try {
    session.chat.free();
  } catch {
    // Key material is no longer reachable from this browser session even if
    // the XDK's best-effort cleanup reports an error.
  }
}

/** Frees local XChat key material and forgets all decrypted plaintext. */
export function lockXChatInBrowser(): void {
  releaseActiveSession();
  decryptedSessions.clear();
  sessionKeysByProspectId.clear();
  emitChange();
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

export async function decryptXChatInBrowser(args: {
  prospectId: string;
  bundle: XChatDecryptBundle;
  pin: string;
  getRealmAuthToken: (realmId: string) => Promise<string>;
}): Promise<{
  messages: BrowserDecryptedXChatMessage[];
  decryptionErrorCount: number;
}> {
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
    const pinBytes = new TextEncoder().encode(args.pin);
    try {
      await chat.unlock(pinBytes);
    } finally {
      pinBytes.fill(0);
    }
    activeSession = {
      chat,
      viewerUserId: bundle.viewerUserId,
      signingKeyVersion: bundle.signingKeyVersion,
    };
  }

  chat.setIdentity(bundle.viewerUserId, bundle.signingKeyVersion);
  chat.setCacheKeys(true);
  chat.setSigningKeys(bundle.signingKeys);
  chat.setRejectUnverified(true);
  const result = chat.decryptEvents(
    bundle.events.map((event) => event.encodedEvent)
  );
  const messages = result.messages.flatMap(({ event }) => {
    if (
      event.type !== "message" ||
      event.verified !== true ||
      typeof event.senderId !== "string"
    ) {
      return [];
    }
    const text =
      typeof event.content?.text === "string"
        ? event.content.text.trim()
        : typeof event.content?.newText === "string"
          ? event.content.newText.trim()
          : "";
    if (!text) {
      return [];
    }
    const occurredAt =
      typeof event.createdAtMsec === "number" &&
      Number.isFinite(event.createdAtMsec)
        ? event.createdAtMsec
        : 0;
    return [
      {
        id: event.id ?? event.sequenceId ?? `${event.senderId}:${occurredAt}`,
        senderId: event.senderId,
        direction:
          event.senderId === bundle.viewerUserId
            ? ("sent" as const)
            : ("received" as const),
        occurredAt,
        text,
      },
    ];
  });

  const decryptedMessages = messages.sort(
    (left, right) => left.occurredAt - right.occurredAt
  );
  const decryptionErrorCount = Object.keys(result.errors).length;
  cacheVerifiedXChatBrowserSession({
    prospectId: args.prospectId,
    bundle,
    messages: decryptedMessages,
    decryptionErrorCount,
  });

  return { messages: decryptedMessages, decryptionErrorCount };
}
