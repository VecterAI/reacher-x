import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { readBrowserMediaMetadata } from "@/features/composer/lib/browserMediaMetadata";
import { LocalClient } from "./LocalClient";
import { createConversation } from "./conversationFixtures";
import type { createAppFixtures } from "./appFixtures";
import { getStringProperty } from "@/convex/lib/typeGuards";
import { recordDemoMessage } from "./lifecycleHelpers";
import {
  isUseCaseWalkthrough,
  USE_CASE_WALKTHROUGH_COPY,
} from "@/features/blog/lib/useCaseWalkthroughCopy";

export function createServices(state?: ReturnType<typeof createAppFixtures>) {
  const client = new LocalClient();
  const conversation = createConversation();
  type Operation = FunctionReturnType<
    typeof api.outboundMessageOperations.listForProspect
  >[number];
  let operations: Operation[] = [];
  let failNextSend = false;

  client.register(
    api.linkedin.getLinkedInConversationPanelContext,
    () => conversation
  );
  client.register(api.linkedin.markLinkedInConversationRead, () => ({
    success: true as const,
  }));
  client.register(
    api.platformConversations.getLinkedInConversationRevision,
    () => null
  );
  client.register(
    api.outboundMessageOperations.listForProspect,
    ({ prospectId, platform }) =>
      operations.filter(
        (operation) =>
          operation.prospectId === prospectId && operation.platform === platform
      )
  );
  client.register(api.outboundMessageOperations.queueMessage, async (args) => {
    const existing = operations.find(
      (operation) =>
        operation.clientRequestId === args.clientRequestId &&
        operation.prospectId === args.prospectId &&
        operation.platform === args.platform
    );
    if (existing) return existing;
    if (!args.text?.trim() && !args.mediaUrls?.length && !args.voiceNoteCacheId)
      throw new Error("Add a message or attachment before sending");
    if (state) {
      const person = state.prospects.find(
        (person) => person._id === args.prospectId
      );
      if (!person || person.platform !== args.platform)
        throw new Error("Conversation recipient not found");
      const account = await client.query(
        api.connectedAccounts.getConnectionSnapshot,
        { platform: args.platform }
      );
      if (!account.isConnected)
        throw new Error("Reconnect the account before sending");
    }
    // Account validation yields; another request may have persisted meanwhile.
    const sentWhileValidating = operations.find(
      (operation) =>
        operation.clientRequestId === args.clientRequestId &&
        operation.prospectId === args.prospectId &&
        operation.platform === args.platform
    );
    if (sentWhileValidating) return sentWhileValidating;
    if (failNextSend) {
      failNextSend = false;
      throw new Error("Experiment: connection interrupted. Try again.");
    }
    const now = getCurrentUTCTimestamp();
    const operationId =
      `experiment-operation-${operations.length + 1}` as Id<"outboundMessageOperations">;
    const operation: Operation = {
      ...args,
      operationId,
      status: "sent",
      attemptCount: 1,
      conversationId: args.conversationId,
      mediaUrls: args.mediaUrls,
      mediaDescriptions: args.mediaDescriptions,
      mediaKinds: args.mediaKinds,
      mediaFileNames: args.mediaFileNames,
      mediaMetadata: args.mediaMetadata,
      quoteId: args.quoteId,
      voiceNoteCacheId: args.voiceNoteCacheId,
      createdAt: now,
      updatedAt: now,
      sentAt: now,
      providerMessageId: operationId,
      errorMessage: undefined,
    };
    operations = [...operations, operation];
    const person = state?.prospects.find(
      (person) => person._id === args.prospectId
    );
    if (state && person)
      recordDemoMessage(
        state.lifecycle,
        person,
        {
          id: operationId,
          conversationId:
            args.conversationId ?? `demo-conversation-${person._id}`,
          direction: "sent",
          text: args.text,
          createdAt: new Date(now).toISOString(),
        },
        now
      );
    const walkthroughId =
      state?.scenario === "introducing-reacherx-v4"
        ? "find-candidates"
        : state?.scenario;
    if (
      state &&
      person &&
      walkthroughId &&
      isUseCaseWalkthrough(walkthroughId) &&
      !state.lifecycle.replies.has(person._id)
    ) {
      state.lifecycle.replies.set(person._id, []);
      const replyText = person._id.endsWith("_1")
        ? USE_CASE_WALKTHROUGH_COPY[walkthroughId].reply
        : "Thanks for reaching out. Could you share a little more about what you have in mind?";
      client.schedule(() => {
        const receivedAt = getCurrentUTCTimestamp();
        const reply = {
          id: `demo_reply_${operationId}`,
          conversationId: `demo-conversation-${person._id}`,
          direction: "received" as const,
          text: replyText,
          createdAt: new Date(receivedAt).toISOString(),
        };
        state.lifecycle.replies.set(person._id, [reply]);
        recordDemoMessage(state.lifecycle, person, reply, receivedAt);
      }, 1800);
    }
    return operation;
  });
  client.register(
    api.xChatSendOperations.generateEncryptedMediaUploadUrl,
    () => "/api/upload?xchat=true"
  );
  client.register(api.x.uploadXChatEncryptedMedia, async ({ storageId }) => {
    const response = await fetch(
      `/api/upload?id=${encodeURIComponent(storageId)}`
    );
    if (!response.ok)
      throw new Error("Demo attachment expired. Attach it again.");
    await response.body?.cancel();
    return { mediaHashKey: storageId };
  });
  client.register(api.x.submitXChatEncryptedMessage, async (args) => {
    if (args.encodedMessageEventSignature !== "fictional-demo-only")
      throw new Error("Only fictional demo messages are supported");
    const payload: unknown = JSON.parse(args.encodedMessageCreateEvent);
    const text = getStringProperty(payload, "text") ?? "";
    const mediaHashKey = getStringProperty(payload, "mediaHashKey");
    // Reactions update the browser session; message sends also update reporting.
    if (text.trim() || mediaHashKey)
      await client.mutation(api.outboundMessageOperations.queueMessage, {
        prospectId: args.prospectId,
        platform: "twitter",
        conversationId: args.conversationId,
        clientRequestId: args.clientRequestId,
        text,
        ...(mediaHashKey
          ? {
              mediaUrls: [`/api/upload?id=${encodeURIComponent(mediaHashKey)}`],
            }
          : {}),
      });
    return {
      success: true as const,
      conversationId: args.conversationId,
      messageId: args.messageId,
      deduplicated: false,
    };
  });
  client.register(api.x.getTwitterConnectionStatus, () => ({
    isConnected: true,
    status: "connected" as const,
    name: "Maya Chen",
    screenName: "maya_demo",
    xUserId: "demo_viewer",
    connectedAccountId: "demo_x_account",
  }));
  client.register(api.autocompleteControl.isEnabled, () => false);
  client.register(api.workspaces.getDefaultWorkspace, () => null);
  client.register(api.outboundVoiceNotes.generateUploadUrl, () => ({
    uploadUrl: "/api/upload",
    uploadIntentId:
      "experiment-upload-intent" as Id<"outboundVoiceNoteUploadIntents">,
  }));
  client.register(
    api.outboundVoiceNotes.finalizeUpload,
    async ({ storageId }) => {
      const mediaUrl = `/api/upload?id=${encodeURIComponent(storageId)}`;
      const response = await fetch(mediaUrl);
      if (!response.ok) throw new Error("Local upload unavailable");
      const blob = await response.blob();
      const file = new File([blob], "voice-note.m4a", { type: blob.type });
      const metadata = await readBrowserMediaMetadata(file, "file");
      if (!metadata.durationMs)
        throw new Error("Unable to read recorded duration");
      return {
        cacheId: storageId as string as Id<"platformConversationMediaCache">,
        mediaUrl,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        durationMs: metadata.durationMs,
        expiresAt: getCurrentUTCTimestamp() + 10 * 60 * 1000,
      };
    }
  );
  return {
    client,
    failNextSend: () => {
      failNextSend = true;
    },
  };
}
