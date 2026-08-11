"use client";

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

type ActiveXChatSession = {
  chat: ChatWithJuicebox;
  viewerUserId: string;
  signingKeyVersion: string;
};

let activeSession: ActiveXChatSession | null = null;

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
  if (!activeSession) {
    return;
  }
  activeSession.chat.free();
  activeSession = null;
}

export async function decryptXChatInBrowser(args: {
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
      getAuthToken: args.getRealmAuthToken,
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

  return {
    messages: messages.sort(
      (left, right) => left.occurredAt - right.occurredAt
    ),
    decryptionErrorCount: Object.keys(result.errors).length,
  };
}
