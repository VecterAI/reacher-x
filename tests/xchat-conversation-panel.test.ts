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

test("legacy DMs stay hidden until canonical XChat pagination is exhausted", () => {
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
    ["xchat:xchat-conversation-1:event-1", "xchat:xchat-conversation-1:event-2"]
  );
  assert.equal(merged[0]?.text, "Verified greeting");
  assert.equal(merged[1]?.text, "Verified reply");
});

test("exhausted XChat history includes only strictly older legacy rows", () => {
  const merged = mergeXChatConversationMessages(
    [
      {
        id: "legacy-older",
        conversationId: "legacy-conversation-1",
        text: "Before XChat",
        direction: "received",
        createdAt: "1970-01-01T00:00:00.500Z",
      },
      {
        id: "legacy-overlap",
        conversationId: "legacy-conversation-1",
        text: "Overlapping legacy cache",
        direction: "received",
        createdAt: "1970-01-01T00:00:01.500Z",
      },
      {
        id: "legacy-unknown-time",
        conversationId: "legacy-conversation-1",
        text: "Unknown boundary",
        direction: "received",
      },
    ],
    { ...session, hasMore: false }
  );

  assert.deepEqual(
    merged.map((message) => message.id),
    [
      "legacy-older",
      "xchat:xchat-conversation-1:event-1",
      "xchat:xchat-conversation-1:event-2",
    ]
  );
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

test("verified XChat reactions decorate matching legacy DM rows", () => {
  const merged = mergeXChatConversationMessages(
    [
      {
        id: "legacy-1",
        conversationId: "legacy-conversation-1",
        text: "Legacy message",
        direction: "sent",
      },
    ],
    {
      ...session,
      hasMore: false,
      messages: [],
      messageUpdates: [
        {
          targetMessageId: "legacy-1",
          reactions: [{ emoji: "🔥", count: 1, reactedByViewer: false }],
        },
      ],
    }
  );

  assert.deepEqual(merged[0]?.reactions, [
    { emoji: "🔥", count: 1, reactedByViewer: false },
  ]);
});

test("cross-page XChat updates decorate namespaced encrypted rows", () => {
  const merged = mergeXChatConversationMessages([], {
    ...session,
    messageUpdates: [
      {
        targetMessageId: "event-1",
        text: "Edited greeting",
        editedAt: "2026-08-14T00:00:00.000Z",
        reactions: [{ emoji: "👍", count: 1, reactedByViewer: true }],
      },
    ],
  });

  assert.equal(merged[0]?.id, "xchat:xchat-conversation-1:event-1");
  assert.equal(merged[0]?.text, "Edited greeting");
  assert.equal(merged[0]?.editedAt, "2026-08-14T00:00:00.000Z");
  assert.deepEqual(merged[0]?.reactions, [
    { emoji: "👍", count: 1, reactedByViewer: true },
  ]);
});

test("XChat local echoes preserve delivery state and exact retry identity", () => {
  const [message] = toXChatConversationMessages({
    ...session,
    messages: [
      {
        id: "pending-event",
        senderId: "viewer-1",
        direction: "sent",
        occurredAt: 3_000,
        text: "Pending encrypted message",
        deliveryStatus: "failed",
        deliveryError: "Provider unavailable",
        clientRequestId: "encrypted-request-1",
      },
    ],
  });

  assert.equal(message?.deliveryStatus, "failed");
  assert.equal(message?.deliveryError, "Provider unavailable");
  assert.equal(message?.outboundClientRequestId, "encrypted-request-1");
});

test("XChat sends publish locally before serialized provider delivery", () => {
  const panelSource = readFileSync(
    "features/prospects/ui/components/XConversationPanel.tsx",
    "utf8"
  );
  const sessionSource = readFileSync(
    "features/agent/lib/xChatBrowserSession.ts",
    "utf8"
  );

  assert.match(
    panelSource,
    /publishPendingXChatTextMessageInBrowser\([\s\S]*?await submitXChatMessageInOrder\(/
  );
  assert.match(
    panelSource,
    /publishPreparingXChatMessageInBrowser\([\s\S]*?prepareXChatEncryptedMediaInBrowser\(/
  );
  assert.match(panelSource, /xChatSendTailsRef/);
  assert.match(sessionSource, /pendingPublishedMessagesByClientRequestId/);
  assert.match(sessionSource, /getPendingXChatMessageForRetry/);
  assert.match(sessionSource, /deliveryStatus: "failed"/);
});

test("XChat replies preserve signed targets and support encrypted attachments", () => {
  const panelSource = readFileSync(
    "features/prospects/ui/components/XConversationPanel.tsx",
    "utf8"
  );
  const sessionSource = readFileSync(
    "features/agent/lib/xChatBrowserSession.ts",
    "utf8"
  );

  assert.match(sessionSource, /originalB64/);
  assert.match(sessionSource, /replyTargetsByMessageId/);
  assert.match(sessionSource, /replyToEvent: target\.encodedEvent/);
  assert.match(sessionSource, /rawEditEventsByMessageId/);
  assert.match(sessionSource, /rawKeyChangeEventsByVersion/);
  assert.doesNotMatch(sessionSource, /replyToSenderId: args\.replyToSenderId/);
  assert.match(
    sessionSource,
    /prepareXChatMediaMessageInBrowser[\s\S]*?current\.chat\.encryptReply/
  );
  assert.match(
    panelSource,
    /replyToMessageId: replyTarget\?\.id[\s\S]*?replyToSequenceId: replyTarget\?\.sequenceId/
  );
  assert.match(
    panelSource,
    /setReplyingTo\(\(current\) => current \?\? replyTarget\)/
  );
  assert.doesNotMatch(panelSource, /selectedMedia \|\| replyingTo/);
  assert.doesNotMatch(
    panelSource,
    /Send the attachment first, or remove it to reply/
  );
  assert.match(panelSource, /preparePersistedXChatReplyMessageInBrowser/);
});

test("the X conversation panel gates history behind the shared XChat lifecycle", () => {
  const source = readFileSync(
    "features/prospects/ui/components/XConversationPanel.tsx",
    "utf8"
  );
  const unlockSource = readFileSync(
    "features/prospects/ui/components/XChatConversationUnlock.tsx",
    "utf8"
  );
  const unlockGateSource = readFileSync(
    "features/prospects/ui/components/XChatUnlockGate.tsx",
    "utf8"
  );
  const agentUnlockSource = readFileSync(
    "features/agent/ui/components/xchat-history/XChatUnlockCard.tsx",
    "utf8"
  );

  assert.match(source, /useXChatBrowserSession/);
  assert.match(source, /useXChatBrowserSessionState/);
  assert.match(source, /mergeXChatConversationMessages/);
  assert.match(source, /<XChatConversationUnlock/);
  assert.match(source, /shouldGateConversation/);
  assert.match(source, /<ConversationMessageViewport/);
  assert.match(source, /scrollerItems/);
  assert.doesNotMatch(source, /<ScrollArea/);
  assert.doesNotMatch(source, /<ConversationHistoryPagination/);
  assert.match(
    source,
    /Legacy X\/Twitter DM history is limited to the past 30/
  );
  assert.match(unlockSource, /<XChatUnlockGate/);
  assert.match(unlockGateSource, /<InputOTP/);
  assert.match(unlockGateSource, /onComplete=\{onPinComplete\}/);
  assert.doesNotMatch(unlockGateSource, /type="submit"/);
  assert.match(unlockSource, /setXChatBrowserSessionState/);
  assert.match(unlockSource, /getDecryptBundle/);
  assert.match(unlockSource, /void prepareBundle\(\)/);
  assert.doesNotMatch(unlockSource, /setInterval/);
  assert.doesNotMatch(agentUnlockSource, /No readable messages/);
  assert.match(agentUnlockSource, /buildXChatAgentSharePayload/);
  assert.match(agentUnlockSource, /XCHAT_AGENT_MEDIA_LIMITATION_COPY/);
  assert.doesNotMatch(agentUnlockSource, /Messages shared with the Agent/);
});

test("XChat publishes verified messages before best-effort media hydration", () => {
  const sessionSource = readFileSync(
    "features/agent/lib/xChatBrowserSession.ts",
    "utf8"
  );
  const cacheIndex = sessionSource.indexOf(
    "const session = cacheVerifiedXChatBrowserSession"
  );
  const hydrateIndex = sessionSource.indexOf(
    "void hydrateXChatAttachments",
    cacheIndex
  );

  assert.ok(cacheIndex >= 0);
  assert.ok(hydrateIndex > cacheIndex);
  assert.match(sessionSource, /function applyHydratedXChatMedia/);
  assert.match(sessionSource, /session\.messages\.map/);
  assert.match(sessionSource, /objectUrlsBySessionKey\.get/);
});

test("sent XChat voice notes keep a conversation-owned playable preview", () => {
  const panel = readFileSync(
    "features/prospects/ui/components/XConversationPanel.tsx",
    "utf8"
  );
  const session = readFileSync(
    "features/agent/lib/xChatBrowserSession.ts",
    "utf8"
  );

  assert.match(panel, /const localPreviewUrl = selectedMedia\.url/);
  assert.match(panel, /retainMediaObjectUrls: true as const/);
  assert.match(panel, /didTransferMediaPreview = true/);
  assert.match(panel, /objectUrls: \[localPreviewUrl\]/);
  assert.match(panel, /isVoiceNote: selectedMedia\.isVoiceNote/);
  assert.match(panel, /mediaKey: mediaHashKey/);
  assert.match(session, /mergeXChatAttachmentsPreservingPlayablePreview/);
  assert.match(session, /url: existing\.url,[\s\S]{0,220}unavailable: false/);
});

test("open XChat panels refresh from reactive revisions without polling", () => {
  const panelSource = readFileSync(
    "features/prospects/ui/components/XConversationPanel.tsx",
    "utf8"
  );
  const hookSource = readFileSync(
    "features/prospects/hooks/useProspectDmPanel.ts",
    "utf8"
  );
  const sessionSource = readFileSync(
    "features/agent/lib/xChatBrowserSession.ts",
    "utf8"
  );

  assert.match(panelSource, /conversationRevisionKey/);
  assert.match(panelSource, /createRevisionRefreshCoordinator/);
  assert.match(panelSource, /shouldRefreshXChatConversationRevision/);
  assert.match(panelSource, /pagination: "newest"/);
  assert.match(panelSource, /realtimeEventCoversRevision/);
  assert.match(panelSource, /decryptedSessionCoversRevision/);
  assert.match(sessionSource, /loadedEventIds/);
  assert.match(panelSource, /api\.xChatRealtimeEvents\.getForProspect/);
  const lockedRevisionGuard = panelSource.indexOf(
    "if (!isXChatUnlocked) return;"
  );
  const observedRevisionAfterUnlock = panelSource.lastIndexOf(
    "observedXChatRevisionRef.current = {"
  );
  assert.ok(lockedRevisionGuard >= 0);
  assert.ok(observedRevisionAfterUnlock > lockedRevisionGuard);
  assert.match(hookSource, /getTwitterConversationRevision/);
  assert.doesNotMatch(panelSource, /setInterval/);
  assert.doesNotMatch(panelSource, /visibilitychange",\s*refreshNewest/u);
  assert.doesNotMatch(hookSource, /setInterval/);
  assert.doesNotMatch(hookSource, /visibilitychange/);
});
