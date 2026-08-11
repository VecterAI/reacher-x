import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  mergeXChatConversationMessages,
  toXChatConversationMessages,
} from "../features/prospects/lib/xChatConversationMessages";

const session = {
  prospectId: "prospect-1",
  viewerUserId: "viewer-1",
  participantUserId: "participant-1",
  conversationId: "xchat-conversation-1",
  signingKeyVersion: "key-1",
  eventPagesFetched: 1,
  hasMore: true,
  decryptionErrorCount: 0,
  messages: [
    {
      id: "event-2",
      senderId: "viewer-1",
      direction: "sent" as const,
      occurredAt: 2_000,
      text: "Verified reply",
    },
    {
      id: "event-1",
      senderId: "participant-1",
      direction: "received" as const,
      occurredAt: 1_000,
      text: "Verified greeting",
    },
  ],
};

test("verified XChat rows merge with legacy DMs in chronological order", () => {
  const merged = mergeXChatConversationMessages(
    [
      {
        id: "legacy-1",
        conversationId: "legacy-conversation-1",
        text: "Legacy message",
        direction: "received",
        createdAt: "1970-01-01T00:00:01.500Z",
      },
    ],
    session
  );

  assert.deepEqual(
    merged.map((message) => message.id),
    [
      "xchat:xchat-conversation-1:event-1",
      "legacy-1",
      "xchat:xchat-conversation-1:event-2",
    ]
  );
  assert.equal(merged[0]?.text, "Verified greeting");
  assert.equal(merged[2]?.text, "Verified reply");
});

test("XChat message IDs are namespaced and duplicate decrypted events collapse", () => {
  const messages = toXChatConversationMessages({
    ...session,
    messages: [
      ...session.messages,
      {
        id: "event-1",
        senderId: "participant-1",
        direction: "received",
        occurredAt: 1_000,
        text: "Verified greeting",
      },
    ],
  });
  const merged = mergeXChatConversationMessages([], {
    ...session,
    messages: [...session.messages, ...session.messages],
  });

  assert.equal(messages[0]?.id, "xchat:xchat-conversation-1:event-2");
  assert.equal(merged.length, 2);
  assert.equal(merged[0]?.id, "xchat:xchat-conversation-1:event-1");
});

test("the X conversation panel mounts the shared XChat unlock and merge path", () => {
  const source = readFileSync(
    "features/prospects/ui/components/XConversationPanel.tsx",
    "utf8"
  );

  assert.match(source, /useXChatBrowserSession/);
  assert.match(source, /mergeXChatConversationMessages/);
  assert.match(source, /<XChatConversationUnlock/);
  assert.match(
    source,
    /Legacy X\/Twitter DM history is limited to the past 30/
  );
});
