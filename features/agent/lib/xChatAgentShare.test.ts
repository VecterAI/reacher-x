import { describe, expect, it } from "vitest";
import {
  buildXChatAgentSharePayload,
  MAX_SHARED_XCHAT_MESSAGES,
} from "./xChatAgentShare";

describe("buildXChatAgentSharePayload", () => {
  it("strips browser-only metadata and reports excluded attachments", () => {
    const payload = buildXChatAgentSharePayload([
      {
        id: "ad07d6d8-29c5-4d94-9666-c8bc4500c33c",
        sequenceId: "2091851443955249152",
        keyVersion: "1786384407037",
        senderId: "1743216568451125248",
        direction: "sent",
        occurredAt: 1_787_571_223_616,
        text: "",
        readAt: "2026-08-28T15:29:30.757Z",
        attachments: [
          {
            type: "audio",
            mediaKey: "TKPnAzSebN",
            fileName: "voice-note.webm",
            fileSize: 127_788,
            durationMs: 7_973,
            isVoiceNote: true,
            unavailable: true,
          },
        ],
      },
    ]);

    expect(payload.excludedAttachmentCount).toBe(1);
    expect(payload.messages).toEqual([
      {
        id: "ad07d6d8-29c5-4d94-9666-c8bc4500c33c",
        senderId: "1743216568451125248",
        direction: "sent",
        occurredAt: 1_787_571_223_616,
        text: "",
      },
    ]);
    expect(Object.keys(payload.messages[0] ?? {})).toEqual([
      "id",
      "senderId",
      "direction",
      "occurredAt",
      "text",
    ]);
  });

  it("limits the payload and attachment count to the shared message window", () => {
    const messages = Array.from(
      { length: MAX_SHARED_XCHAT_MESSAGES + 1 },
      (_, index) => ({
        id: String(index),
        senderId: "viewer",
        direction: "sent" as const,
        occurredAt: index,
        text: `Message ${index}`,
        attachments:
          index === 0 || index === MAX_SHARED_XCHAT_MESSAGES
            ? [{ type: "image" }]
            : undefined,
      })
    );

    const payload = buildXChatAgentSharePayload(messages);

    expect(payload.messages).toHaveLength(MAX_SHARED_XCHAT_MESSAGES);
    expect(payload.messages[0]?.id).toBe("1");
    expect(payload.excludedAttachmentCount).toBe(1);
  });
});
