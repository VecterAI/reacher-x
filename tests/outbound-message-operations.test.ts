import assert from "node:assert/strict";
import test from "node:test";

import { mergeOutboundMessageOperations } from "../features/prospects/lib/outboundMessageOperations";
import type { RichConversationMessage } from "../features/prospects/ui/components/conversation-message/types";

test("outbound attachment metadata survives provider reconciliation", () => {
  const providerMessage: RichConversationMessage & {
    providerMessageId: string;
  } = {
    id: "unipile-message",
    providerMessageId: "provider-message",
    conversationId: "conversation",
    text: "Document",
    createdAt: "2026-08-21T12:00:00.000Z",
    direction: "sent",
    attachments: [
      {
        type: "attachment",
        url: "https://storage.example/internal-id",
        fileName: "internal-id",
      },
    ],
  };

  const merged = mergeOutboundMessageOperations(
    [providerMessage],
    [
      {
        clientRequestId: "request",
        prospectId: "prospect" as never,
        platform: "linkedin",
        conversationId: "conversation",
        text: "Document",
        mediaUrls: ["https://storage.example/internal-id"],
        mediaKinds: ["file"],
        mediaFileNames: ["proposal.pdf"],
        status: "sent",
        attemptCount: 1,
        createdAt: 1,
        updatedAt: new Date("2026-08-21T12:00:05.000Z").getTime(),
        sentAt: new Date("2026-08-21T12:00:05.000Z").getTime(),
        providerMessageId: "provider-message",
      },
    ],
    "conversation"
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].attachments?.[0]?.type, "file");
  assert.equal(merged[0].attachments?.[0]?.fileName, "proposal.pdf");
});

test("queued video operations render as video immediately", () => {
  const merged = mergeOutboundMessageOperations(
    [],
    [
      {
        clientRequestId: "request",
        prospectId: "prospect" as never,
        platform: "linkedin",
        text: "Video",
        mediaUrls: ["https://storage.example/video"],
        mediaKinds: ["video"],
        mediaFileNames: ["demo.mp4"],
        mediaMetadata: [{ width: 1080, height: 1920, mimeType: "video/mp4" }],
        status: "queued",
        attemptCount: 0,
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    "conversation"
  );

  assert.equal(merged[0].attachments?.[0]?.type, "video");
  assert.equal(merged[0].attachments?.[0]?.fileName, "demo.mp4");
  assert.equal(merged[0].attachments?.[0]?.width, 1080);
  assert.equal(merged[0].attachments?.[0]?.height, 1920);
});
