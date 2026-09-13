import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { readBrowserMediaMetadata } from "@/features/composer/lib/browserMediaMetadata";
import { LocalClient } from "./LocalClient";
import { createConversation } from "./conversationFixtures";

export function createServices() {
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
  client.register(api.outboundMessageOperations.queueMessage, (args) => {
    const existing = operations.find(
      (operation) =>
        operation.clientRequestId === args.clientRequestId &&
        operation.prospectId === args.prospectId &&
        operation.platform === args.platform
    );
    if (existing) return existing;
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
    return operation;
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
