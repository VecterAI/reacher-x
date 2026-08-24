import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildXChatMediaAttachment,
  cacheVerifiedXChatBrowserSession,
  confirmXChatReactionInBrowser,
  confirmXChatTextMessageInBrowser,
  copyXChatConversationKeyForEncryption,
  getXChatBrowserSession,
  getXChatBrowserSessionState,
  getXChatUnlockErrorMessage,
  getXChatUnlockFailureState,
  hydrateXChatAttachments,
  getXChatAttachmentMediaType,
  hydrateXChatVoiceNotes,
  lockXChatInBrowser,
  mergeXChatAttachmentsPreservingPlayablePreview,
  mergeXChatConversationKeys,
  publishPreparingXChatMessageInBrowser,
  requestXChatBrowserDecryptOnce,
  requestXChatDecryptBundleOnce,
  resolveXChatAttachmentMimeType,
  setXChatBrowserSessionState,
  type XChatDecryptBundle,
  type XChatDecryptBundleResponse,
} from "./xChatBrowserSession";

describe("getXChatAttachmentMediaType", () => {
  it("maps browser MIME types to the XChat wire enum", () => {
    expect(getXChatAttachmentMediaType("image/png")).toBe(1);
    expect(getXChatAttachmentMediaType("image/gif")).toBe(2);
    expect(getXChatAttachmentMediaType("video/mp4")).toBe(3);
    expect(getXChatAttachmentMediaType("audio/mpeg")).toBe(4);
    expect(getXChatAttachmentMediaType("application/pdf")).toBe(5);
    expect(getXChatAttachmentMediaType("image/svg+xml")).toBe(6);
  });

  it("keeps browser-recorded M4A audio out of XChat's video wire type", () => {
    const mimeType = resolveXChatAttachmentMimeType("audio/mp4", "video/mp4");

    expect(mimeType).toBe("audio/mp4");
    expect(getXChatAttachmentMediaType(mimeType)).toBe(4);
    expect(
      buildXChatMediaAttachment({
        mediaHashKey: "encrypted-audio-hash",
        media: {
          conversationId: "100-200",
          keyVersion: "200",
          fileName: "voice-note.m4a",
          fileSize: 42_000,
          width: 0,
          height: 0,
          mediaType: getXChatAttachmentMediaType(mimeType),
          durationMs: 7_000,
        },
      })
    ).toEqual({
      attachment_type: "media",
      media_hash_key: "encrypted-audio-hash",
      media_type: 4,
      width: 0,
      height: 0,
      filesize_bytes: 42_000,
      filename: "voice-note.m4a",
      duration_millis: 7_000,
    });
  });
});

describe("mergeXChatConversationKeys", () => {
  it("does not zero aliased key views during an incremental merge", () => {
    const previousView = new Uint8Array([7, 8, 9]);
    const incomingView = new Uint8Array(previousView.buffer);

    const merged = mergeXChatConversationKeys(
      { "key-v1": previousView },
      { "key-v1": incomingView }
    );

    expect(Array.from(previousView)).toEqual([7, 8, 9]);
    expect(Array.from(incomingView)).toEqual([7, 8, 9]);
    expect(merged["key-v1"]).toBe(incomingView);
  });
});

describe("mergeXChatAttachmentsPreservingPlayablePreview", () => {
  it("keeps a sent voice note playable while provider media is still unavailable", () => {
    const attachments = mergeXChatAttachmentsPreservingPlayablePreview({
      existing: [
        {
          mediaKey: "sent-voice-hash",
          type: "file",
          url: "blob:local-voice-preview",
          previewUrl: "blob:local-voice-preview",
          mimeType: "audio/mp4",
          durationMs: 4_000,
          isVoiceNote: true,
          unavailable: false,
        },
      ],
      incoming: [
        {
          mediaKey: "sent-voice-hash",
          type: "audio",
          durationMs: 4_000,
          isVoiceNote: true,
          unavailable: true,
        },
      ],
    });

    expect(attachments?.[0]).toMatchObject({
      mediaKey: "sent-voice-hash",
      type: "audio",
      url: "blob:local-voice-preview",
      isVoiceNote: true,
      unavailable: false,
    });
  });

  it("replaces the local preview once decrypted provider media is playable", () => {
    const attachments = mergeXChatAttachmentsPreservingPlayablePreview({
      existing: [
        {
          mediaKey: "sent-voice-hash",
          type: "audio",
          url: "blob:local-voice-preview",
          isVoiceNote: true,
        },
      ],
      incoming: [
        {
          mediaKey: "sent-voice-hash",
          type: "audio",
          url: "blob:decrypted-provider-voice",
          isVoiceNote: true,
          unavailable: false,
        },
      ],
    });

    expect(attachments?.[0]?.url).toBe("blob:decrypted-provider-voice");
  });
});

describe("copyXChatConversationKeyForEncryption", () => {
  it("copies the preferred 32-byte key out of the SDK-owned view", () => {
    const preferred = new Uint8Array(32).fill(7);
    const selected = copyXChatConversationKeyForEncryption({
      conversationKeys: {
        "100": new Uint8Array(32).fill(1),
        "200": preferred,
      },
      preferredKeyVersion: "200",
    });

    expect(selected?.conversationKeyVersion).toBe("200");
    expect(selected?.conversationKey).not.toBe(preferred);
    expect(selected?.conversationKey).toEqual(preferred);
  });

  it("rejects malformed keys and falls back to the newest valid version", () => {
    const selected = copyXChatConversationKeyForEncryption({
      conversationKeys: {
        "300": new Uint8Array(31),
        "200": new Uint8Array(32).fill(2),
        "100": new Uint8Array(32).fill(1),
      },
      preferredKeyVersion: "300",
    });

    expect(selected?.conversationKeyVersion).toBe("200");
    expect(selected?.conversationKey).toEqual(new Uint8Array(32).fill(2));
  });

  it("returns null when no protocol-valid conversation key exists", () => {
    expect(
      copyXChatConversationKeyForEncryption({
        conversationKeys: { invalid: new Uint8Array(33) },
      })
    ).toBeNull();
  });
});

describe("requestXChatDecryptBundleOnce", () => {
  it("shares one in-flight provider request for the same prospect", async () => {
    let resolveRequest:
      | ((value: XChatDecryptBundleResponse) => void)
      | undefined;
    const request = vi.fn(
      () =>
        new Promise<XChatDecryptBundleResponse>((resolve) => {
          resolveRequest = resolve;
        })
    );

    const first = requestXChatDecryptBundleOnce("prospect-dedupe", request);
    const second = requestXChatDecryptBundleOnce("prospect-dedupe", request);

    expect(first).toBe(second);
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(1);
    resolveRequest?.({ availability: "available", ...bundle() });
    await expect(first).resolves.toMatchObject({ conversationId: "100-200" });
  });
});

describe("requestXChatBrowserDecryptOnce", () => {
  it("shares the complete unlock and decrypt across concurrently mounted panels", async () => {
    let resolveDecrypt:
      | ((value: { messages: []; decryptionErrorCount: number }) => void)
      | undefined;
    const decrypt = vi.fn(
      () =>
        new Promise<{ messages: []; decryptionErrorCount: number }>(
          (resolve) => {
            resolveDecrypt = resolve;
          }
        )
    );

    const first = requestXChatBrowserDecryptOnce(
      "concurrent-panel-session",
      decrypt
    );
    const second = requestXChatBrowserDecryptOnce(
      "concurrent-panel-session",
      decrypt
    );

    expect(first).toBe(second);
    await Promise.resolve();
    expect(decrypt).toHaveBeenCalledTimes(1);
    resolveDecrypt?.({ messages: [], decryptionErrorCount: 0 });
    await expect(first).resolves.toEqual({
      messages: [],
      decryptionErrorCount: 0,
    });

    decrypt.mockResolvedValueOnce({ messages: [], decryptionErrorCount: 0 });
    await requestXChatBrowserDecryptOnce("concurrent-panel-session", decrypt);
    expect(decrypt).toHaveBeenCalledTimes(2);
  });
});

describe("getXChatUnlockErrorMessage", () => {
  it("turns Juicebox invalid-PIN diagnostics into product copy", () => {
    expect(
      getXChatUnlockErrorMessage(
        new Error(
          "Juicebox recovery failed: reason=InvalidPin guesses_remaining=19"
        )
      )
    ).toBe("That PIN isn't correct. You have 19 attempts left.");
    expect(
      getXChatUnlockErrorMessage(
        new Error(
          "Juicebox recovery failed: reason=InvalidPin guesses_remaining=1"
        )
      )
    ).toBe("That PIN isn't correct. You have 1 attempt left.");
  });

  it("does not expose unknown provider diagnostics", () => {
    expect(
      getXChatUnlockErrorMessage(new Error("provider_internal_code=abc123"))
    ).toBe("We couldn't unlock XChat. Try again.");
  });

  it("disables PIN entry when X reports no attempts remaining", () => {
    expect(
      getXChatUnlockFailureState(
        new Error(
          "Juicebox recovery failed: reason=InvalidPin guesses_remaining=0"
        )
      )
    ).toEqual({ status: "attempts_exhausted" });
    expect(
      getXChatUnlockFailureState(
        new Error(
          "Juicebox recovery failed: reason=InvalidPin guesses_remaining=3"
        )
      )
    ).toEqual({ status: "locked", attemptsRemaining: 3 });
  });
});

function bundle(
  overrides: Partial<XChatDecryptBundle> = {}
): XChatDecryptBundle {
  return {
    viewerUserId: "viewer",
    participantUserId: "participant",
    conversationId: "100-200",
    signingKeyVersion: "signing-key",
    juiceboxConfig: "{}",
    signingKeys: [],
    events: [],
    eventPagesFetched: 1,
    hasMore: false,
    ...overrides,
  };
}

function receivedVoiceNote(keyVersion?: string) {
  return [
    {
      id: "message-1",
      senderId: "participant",
      direction: "received" as const,
      occurredAt: 1,
      ...(keyVersion ? { keyVersion } : {}),
      text: "",
      attachments: [
        {
          id: "voice-1",
          mediaKey: "encrypted-voice",
          type: "audio",
          mimeType: "audio/mpeg",
          isVoiceNote: true,
          unavailable: true,
        },
      ],
    },
  ];
}

function sentVoiceNote(keyVersion?: string) {
  return receivedVoiceNote(keyVersion).map((message) => ({
    ...message,
    direction: "sent" as const,
  }));
}

function verifiedVoiceNoteBindings(keyVersion?: string) {
  return new Map([
    [
      JSON.stringify(["prospect-1", "100-200", "message-1", "encrypted-voice"]),
      {
        prospectId: "prospect-1",
        conversationId: "100-200",
        messageId: "message-1",
        mediaHashKey: "encrypted-voice",
        ...(keyVersion ? { keyVersion } : {}),
      },
    ],
  ]);
}

afterEach(() => {
  lockXChatInBrowser();
  vi.unstubAllGlobals();
});

describe("browser-only XChat session", () => {
  it("records provider event IDs covered by the initial decrypt bundle", () => {
    const session = cacheVerifiedXChatBrowserSession({
      prospectId: "prospect-coverage",
      bundle: bundle({
        events: [
          { id: "event-1", encodedEvent: "opaque-1" },
          { encodedEvent: "opaque-without-id" },
          { id: "event-2", encodedEvent: "opaque-2" },
        ],
      }),
      messages: [],
      decryptionErrorCount: 0,
    });

    expect(session.loadedEventIds).toEqual(["event-1", "event-2"]);
  });

  it("shares lock lifecycle without exposing decrypted messages", () => {
    expect(getXChatBrowserSessionState("prospect-state")).toEqual({
      status: "unknown",
    });

    setXChatBrowserSessionState("prospect-state", { status: "checking" });
    expect(getXChatBrowserSessionState("prospect-state")).toEqual({
      status: "checking",
    });

    cacheVerifiedXChatBrowserSession({
      prospectId: "prospect-state",
      bundle: bundle(),
      messages: [],
      decryptionErrorCount: 0,
    });
    expect(getXChatBrowserSessionState("prospect-state")).toEqual({
      status: "unlocked",
    });

    lockXChatInBrowser();
    expect(getXChatBrowserSessionState("prospect-state")).toEqual({
      status: "locked",
    });
  });

  it("publishes provider-confirmed encrypted text sends in memory", () => {
    cacheVerifiedXChatBrowserSession({
      prospectId: "prospect-send",
      bundle: bundle(),
      messages: [],
      decryptionErrorCount: 0,
    });

    confirmXChatTextMessageInBrowser({
      prospectId: "prospect-send",
      message: {
        conversationId: "100-200",
        messageId: "encrypted-message-id",
        encodedMessageCreateEvent: "opaque-event",
        encodedMessageEventSignature: "opaque-signature",
      },
      text: "  encrypted hello  ",
    });

    expect(
      getXChatBrowserSession({ prospectId: "prospect-send" })?.messages
    ).toMatchObject([
      {
        id: "encrypted-message-id",
        senderId: "viewer",
        direction: "sent",
        text: "encrypted hello",
      },
    ]);
  });

  it("applies and removes a provider-confirmed reaction without a refetch", () => {
    cacheVerifiedXChatBrowserSession({
      prospectId: "prospect-reaction",
      bundle: bundle(),
      messages: [
        {
          id: "message-id",
          sequenceId: "message-sequence",
          senderId: "participant",
          direction: "received",
          occurredAt: 1,
          text: "React to me",
        },
      ],
      decryptionErrorCount: 0,
    });

    confirmXChatReactionInBrowser({
      prospectId: "prospect-reaction",
      targetMessageSequenceId: "message-sequence",
      emoji: "❤️",
      remove: false,
    });
    expect(
      getXChatBrowserSession({ prospectId: "prospect-reaction" })?.messages[0]
        ?.reactions
    ).toEqual([{ emoji: "❤️", count: 1, reactedByViewer: true }]);

    confirmXChatReactionInBrowser({
      prospectId: "prospect-reaction",
      targetMessageSequenceId: "message-sequence",
      emoji: "❤️",
      remove: true,
    });
    expect(
      getXChatBrowserSession({ prospectId: "prospect-reaction" })?.messages[0]
        ?.reactions
    ).toEqual([]);
  });

  it("uses the attachment's exact historical key version, not the latest key", async () => {
    const createObjectURL = vi.fn(() => "blob:voice-note");
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    const historicalKey = new Uint8Array([1]);
    const latestKey = new Uint8Array([2]);
    const decryptStream = vi.fn((ciphertext, conversationKey) => {
      expect(Array.from(ciphertext)).toEqual([9, 8]);
      expect(conversationKey).toBe(historicalKey);
      return new Uint8Array([0x49, 0x44, 0x33]);
    });

    const hydrated = await hydrateXChatVoiceNotes({
      chat: { decryptStream },
      conversationKeys: {
        "historical-key": historicalKey,
        "latest-key": latestKey,
      },
      prospectId: "prospect-1",
      conversationId: "100-200",
      messages: receivedVoiceNote("historical-key"),
      getEncryptedMedia: async () => ({
        ciphertext: new Uint8Array([9, 8]).buffer,
      }),
      detectMimeType: () => "audio/mpeg",
    });

    expect(decryptStream).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(hydrated.messages[0]?.attachments?.[0]).toMatchObject({
      url: "blob:voice-note",
      unavailable: false,
    });
    expect(hydrated.objectUrls).toEqual(["blob:voice-note"]);
  });

  it("downloads a verified voice note with no event keyVersion using the newest recovered key", async () => {
    const createObjectURL = vi.fn(() => "blob:missing-key-version");
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    const olderKey = new Uint8Array([1]);
    const newestKey = new Uint8Array([2]);
    const requestedMediaKeys: string[] = [];
    const decryptStream = vi.fn((_ciphertext, conversationKey) => {
      expect(conversationKey).toBe(newestKey);
      return new Uint8Array([0x49, 0x44, 0x33]);
    });

    const hydrated = await hydrateXChatVoiceNotes({
      chat: { decryptStream },
      conversationKeys: { "100": olderKey, "200": newestKey },
      prospectId: "prospect-1",
      conversationId: "100-200",
      messages: receivedVoiceNote(),
      voiceNoteBindings: verifiedVoiceNoteBindings(),
      getEncryptedMedia: async (mediaHashKey) => {
        requestedMediaKeys.push(mediaHashKey);
        return { ciphertext: new Uint8Array([9, 8]).buffer };
      },
      detectMimeType: () => "audio/mpeg",
    });

    expect(requestedMediaKeys).toEqual(["encrypted-voice"]);
    expect(decryptStream).toHaveBeenCalledTimes(1);
    expect(hydrated.messages[0]?.attachments?.[0]).toMatchObject({
      url: "blob:missing-key-version",
      unavailable: false,
    });
  });

  it("downloads a verified sent voice note", async () => {
    const createObjectURL = vi.fn(() => "blob:sent-voice-note");
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    const conversationKey = new Uint8Array([3]);
    const getEncryptedMedia = vi.fn(async () => ({
      ciphertext: new Uint8Array([9, 8]).buffer,
    }));
    const decryptStream = vi.fn((_ciphertext, key) => {
      expect(key).toBe(conversationKey);
      return new Uint8Array([0x49, 0x44, 0x33]);
    });

    const hydrated = await hydrateXChatVoiceNotes({
      chat: { decryptStream },
      conversationKeys: { "300": conversationKey },
      prospectId: "prospect-1",
      conversationId: "100-200",
      messages: sentVoiceNote(),
      voiceNoteBindings: verifiedVoiceNoteBindings(),
      getEncryptedMedia,
      detectMimeType: () => "audio/mpeg",
    });

    expect(getEncryptedMedia).toHaveBeenCalledWith("encrypted-voice");
    expect(decryptStream).toHaveBeenCalledTimes(1);
    expect(hydrated.messages[0]?.attachments?.[0]).toMatchObject({
      url: "blob:sent-voice-note",
      unavailable: false,
    });
  });

  it("uses decrypted MIME detection to render a generic media hash as audio", async () => {
    const createObjectURL = vi.fn(() => "blob:detected-audio");
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    const conversationKey = new Uint8Array([4]);
    const hydrated = await hydrateXChatAttachments({
      chat: {
        decryptStream: () => new Uint8Array([0x49, 0x44, 0x33]),
      },
      conversationKeys: { "100": conversationKey },
      prospectId: "prospect-1",
      conversationId: "100-200",
      messages: [
        {
          id: "message-generic-audio",
          senderId: "participant",
          direction: "received",
          occurredAt: 1,
          text: "",
          attachments: [
            {
              mediaKey: "generic-media-hash",
              type: "attachment",
              unavailable: true,
            },
          ],
        },
      ],
      getEncryptedMedia: async () => ({
        ciphertext: new Uint8Array([9, 8]).buffer,
      }),
      detectMimeType: () => "audio/mpeg",
    });

    expect(hydrated.messages[0]?.attachments?.[0]).toMatchObject({
      type: "audio",
      url: "blob:detected-audio",
      mimeType: "audio/mpeg",
      isVoiceNote: true,
      unavailable: false,
    });
  });

  it("decrypts image and video attachments into browser-only object URLs", async () => {
    const createObjectURL = vi.fn((blob: Blob) => `blob:${blob.type}`);
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    const messages = [
      {
        id: "message-media",
        senderId: "participant",
        direction: "received" as const,
        occurredAt: 1,
        keyVersion: "media-key-version",
        text: "",
        attachments: [
          {
            mediaKey: "encrypted-image",
            type: "image",
            fileName: "photo.png",
            unavailable: true,
          },
          {
            mediaKey: "encrypted-video",
            // X can expose an encrypted MP4 with a misleading generic image
            // label. The concrete filename and decrypted MIME must win.
            type: "media",
            mimeType: "image",
            fileName: "clip.mp4",
            unavailable: true,
          },
        ],
      },
    ];

    const hydrated = await hydrateXChatAttachments({
      chat: {
        decryptStream: (ciphertext) => new Uint8Array(ciphertext),
      },
      conversationKeys: {
        "media-key-version": new Uint8Array([7]),
      },
      prospectId: "prospect-1",
      conversationId: "100-200",
      messages,
      getEncryptedMedia: async (mediaHashKey) => ({
        ciphertext: new Uint8Array([mediaHashKey === "encrypted-image" ? 1 : 2])
          .buffer,
      }),
      detectMimeType: (plaintext) =>
        plaintext[0] === 1 ? "image/png" : "video/mp4",
    });

    expect(hydrated.messages[0]?.attachments).toMatchObject([
      { url: "blob:image/png", unavailable: false },
      { type: "video", url: "blob:video/mp4", unavailable: false },
    ]);
    expect(hydrated.objectUrls).toEqual(["blob:video/mp4", "blob:image/png"]);
  });

  it("hydrates quoted media before its original message page is loaded", async () => {
    const createObjectURL = vi.fn((blob: Blob) => `blob:${blob.type}`);
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    const getEncryptedMedia = vi.fn(async () => ({
      ciphertext: new Uint8Array([1]).buffer,
    }));

    const hydrated = await hydrateXChatAttachments({
      chat: {
        decryptStream: (ciphertext) => new Uint8Array(ciphertext),
      },
      conversationKeys: { "current-key": new Uint8Array([7]) },
      prospectId: "prospect-1",
      conversationId: "100-200",
      messages: [
        {
          id: "reply-message",
          senderId: "viewer",
          direction: "sent",
          occurredAt: 2,
          text: "Reply body",
          quotedMessage: {
            id: "unloaded-original-message",
            direction: "received",
            attachmentType: "media",
            attachments: [
              {
                mediaKey: "quoted-image-hash",
                type: "media",
                fileName: "quoted-photo.png",
                unavailable: true,
              },
            ],
          },
        },
      ],
      getEncryptedMedia,
      detectMimeType: () => "image/png",
    });

    expect(getEncryptedMedia).toHaveBeenCalledWith("quoted-image-hash");
    expect(hydrated.messages[0]?.attachments).toBeUndefined();
    expect(hydrated.messages[0]?.quotedMessage).toMatchObject({
      id: "unloaded-original-message",
      attachmentType: "image",
      attachments: [
        {
          type: "image",
          url: "blob:image/png",
          mimeType: "image/png",
          unavailable: false,
        },
      ],
    });
  });

  it("does not repeatedly request a missing attachment in one browser session", async () => {
    const getEncryptedMedia = vi.fn(async () => {
      throw new Error("XChat request failed (404 Not Found).");
    });
    const args = {
      chat: { decryptStream: vi.fn(() => new Uint8Array()) },
      conversationKeys: { "missing-key": new Uint8Array([1]) },
      prospectId: "prospect-missing-cache",
      conversationId: "100-200",
      messages: [
        {
          id: "message-missing-cache",
          senderId: "participant",
          direction: "received" as const,
          occurredAt: 1,
          keyVersion: "missing-key",
          text: "",
          attachments: [
            {
              mediaKey: "permanently-missing-media",
              type: "image",
              unavailable: true,
            },
          ],
        },
      ],
      getEncryptedMedia,
    };

    await hydrateXChatAttachments(args);
    await hydrateXChatAttachments(args);

    expect(getEncryptedMedia).toHaveBeenCalledTimes(1);
  });

  it("clears missing-media retry state when XChat is locked", async () => {
    const getEncryptedMedia = vi.fn(async () => {
      throw new Error("XChat request failed (404 Not Found).");
    });
    const args = {
      chat: { decryptStream: vi.fn(() => new Uint8Array()) },
      conversationKeys: { "missing-key": new Uint8Array([1]) },
      prospectId: "prospect-lock-clears-media",
      conversationId: "100-200",
      messages: [
        {
          id: "message-lock-clears-media",
          senderId: "participant",
          direction: "received" as const,
          occurredAt: 1,
          keyVersion: "missing-key",
          text: "",
          attachments: [
            {
              mediaKey: "missing-media-after-lock",
              type: "image",
              unavailable: true,
            },
          ],
        },
      ],
      getEncryptedMedia,
    };

    await hydrateXChatAttachments(args);
    lockXChatInBrowser();
    await hydrateXChatAttachments(args);

    expect(getEncryptedMedia).toHaveBeenCalledTimes(2);
  });

  it("starts recent XChat media before older attachments", async () => {
    const started: string[] = [];
    const messages = Array.from({ length: 4 }, (_, index) => ({
      id: `message-${index + 1}`,
      senderId: "participant",
      direction: "received" as const,
      occurredAt: index + 1,
      keyVersion: "media-key",
      text: "",
      attachments: [
        {
          mediaKey: `media-${index + 1}`,
          type: "image",
          unavailable: true,
        },
      ],
    }));

    await hydrateXChatAttachments({
      chat: { decryptStream: () => new Uint8Array([1]) },
      conversationKeys: { "media-key": new Uint8Array([1]) },
      prospectId: "prospect-priority",
      conversationId: "100-200",
      messages,
      getEncryptedMedia: async (mediaHashKey) => {
        started.push(mediaHashKey);
        return { ciphertext: new Uint8Array([1]).buffer };
      },
      detectMimeType: () => "image/png",
    });

    expect(started.slice(0, 3)).toEqual(["media-4", "media-3", "media-2"]);
  });

  it("renders an M4A voice note when the XDK reports its MP4 container", async () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:m4a-voice-note");
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });

    const hydrated = await hydrateXChatVoiceNotes({
      chat: {
        decryptStream: () =>
          new Uint8Array([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70]),
      },
      conversationKeys: { "historical-key": new Uint8Array([1]) },
      prospectId: "prospect-1",
      conversationId: "100-200",
      messages: receivedVoiceNote("historical-key"),
      getEncryptedMedia: async () => ({
        ciphertext: new Uint8Array([9]).buffer,
      }),
      detectMimeType: () => "video/mp4",
    });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0]?.[0]).toMatchObject({
      type: "audio/mp4",
    });
    expect(hydrated.messages[0]?.attachments?.[0]).toMatchObject({
      url: "blob:m4a-voice-note",
      unavailable: false,
    });
  });

  it("falls back after an explicit historical key fails", async () => {
    const createObjectURL = vi.fn(() => "blob:fallback-key");
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    const wrongHistoricalKey = new Uint8Array([1]);
    const fallbackNewestKey = new Uint8Array([2]);
    const attemptedKeys: Uint8Array[] = [];
    const getEncryptedMedia = vi.fn(async () => ({
      ciphertext: new Uint8Array([9, 8]).buffer,
    }));
    const decryptStream = vi.fn((_ciphertext, conversationKey) => {
      attemptedKeys.push(conversationKey);
      if (conversationKey === wrongHistoricalKey) {
        throw new Error("authentication failed");
      }
      return new Uint8Array([0x49, 0x44, 0x33]);
    });

    const hydrated = await hydrateXChatVoiceNotes({
      chat: { decryptStream },
      conversationKeys: {
        "100": wrongHistoricalKey,
        "200": fallbackNewestKey,
      },
      prospectId: "prospect-1",
      conversationId: "100-200",
      messages: receivedVoiceNote("100"),
      voiceNoteBindings: verifiedVoiceNoteBindings("100"),
      getEncryptedMedia,
      detectMimeType: () => "audio/mpeg",
    });

    expect(getEncryptedMedia).toHaveBeenCalledTimes(1);
    expect(attemptedKeys).toEqual([wrongHistoricalKey, fallbackNewestKey]);
    expect(hydrated.messages[0]?.attachments?.[0]).toMatchObject({
      url: "blob:fallback-key",
      unavailable: false,
    });
  });

  it("leaves the attachment unavailable when retrieval or MIME validation fails", async () => {
    const decryptStream = vi.fn(() => new Uint8Array([1, 2, 3]));
    const messages = receivedVoiceNote("historical-key");

    const failedDownload = await hydrateXChatVoiceNotes({
      chat: { decryptStream },
      conversationKeys: { "historical-key": new Uint8Array([1]) },
      prospectId: "prospect-1",
      conversationId: "100-200",
      messages,
      getEncryptedMedia: async () => {
        throw new Error("expired");
      },
      detectMimeType: () => "audio/mpeg",
    });

    expect(failedDownload.messages).toBe(messages);
    expect(failedDownload.objectUrls).toEqual([]);
    expect(decryptStream).not.toHaveBeenCalled();

    const failedMime = await hydrateXChatVoiceNotes({
      chat: { decryptStream },
      conversationKeys: { "historical-key": new Uint8Array([1]) },
      prospectId: "prospect-1",
      conversationId: "100-200",
      messages,
      getEncryptedMedia: async () => ({
        ciphertext: new Uint8Array([9]).buffer,
      }),
      detectMimeType: () => "image/jpeg",
    });

    expect(failedMime.messages).toBe(messages);
    expect(failedMime.objectUrls).toEqual([]);
  });

  it("settles a loading attachment to unavailable after hydration fails", async () => {
    const messages = receivedVoiceNote("historical-key").map((message) => ({
      ...message,
      attachments: message.attachments?.map((attachment) => ({
        ...attachment,
        isLoading: true,
        unavailable: false,
      })),
    }));

    const result = await hydrateXChatVoiceNotes({
      chat: { decryptStream: vi.fn(() => new Uint8Array()) },
      conversationKeys: { "historical-key": new Uint8Array([1]) },
      prospectId: "prospect-loading-failure",
      conversationId: "100-200",
      messages,
      getEncryptedMedia: async () => {
        throw new Error("expired");
      },
    });

    expect(result.messages[0]?.attachments?.[0]).toMatchObject({
      isLoading: false,
      unavailable: true,
    });
  });

  it("revokes browser-created voice-note URLs when the XChat session locks", () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: vi.fn(), revokeObjectURL });

    cacheVerifiedXChatBrowserSession({
      prospectId: "prospect-1",
      bundle: bundle(),
      messages: [],
      decryptionErrorCount: 0,
      objectUrls: ["blob:voice-note"],
    });

    lockXChatInBrowser();

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:voice-note");
  });

  it("transfers an optimistic voice-note preview to the conversation lifecycle", () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: vi.fn(), revokeObjectURL });

    cacheVerifiedXChatBrowserSession({
      prospectId: "prospect-local-preview",
      bundle: bundle(),
      messages: [],
      decryptionErrorCount: 0,
    });
    publishPreparingXChatMessageInBrowser({
      prospectId: "prospect-local-preview",
      text: "",
      attachments: [
        {
          type: "audio",
          url: "blob:optimistic-voice-note",
          isVoiceNote: true,
        },
      ],
      objectUrls: ["blob:optimistic-voice-note"],
    });

    lockXChatInBrowser();

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:optimistic-voice-note");
  });
});
