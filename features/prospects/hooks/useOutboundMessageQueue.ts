"use client";

import { useMutation, useQuery } from "convex/react";
import * as React from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  createClientRequestId,
  getCurrentUTCTimestamp,
} from "@/shared/lib/utils";
import type {
  OutboundMessageMediaMetadata,
  OutboundMessageOperation,
} from "../lib/outboundMessageOperations";

type QueueMessageArgs = {
  conversationId?: string;
  text: string;
  mediaUrls?: string[];
  mediaDescriptions?: string[];
  mediaKinds?: Array<"image" | "video" | "gif" | "file">;
  mediaFileNames?: string[];
  mediaMetadata?: OutboundMessageMediaMetadata[];
  quoteId?: string;
  actionRequestId?: Id<"agentActionRequests">;
};

export function useOutboundMessageQueue(args: {
  prospectId?: string;
  platform: "twitter" | "linkedin";
  enabled?: boolean;
}) {
  const { prospectId, platform, enabled = true } = args;
  const queryArgs =
    enabled && prospectId
      ? {
          prospectId: prospectId as Id<"prospects">,
          platform,
        }
      : null;
  const serverOperations = useQuery(
    api.outboundMessageOperations.listForProspect,
    queryArgs ?? "skip"
  );
  const queueMutation = useMutation(api.outboundMessageOperations.queueMessage);
  const retryMutation = useMutation(api.outboundMessageOperations.retryMessage);
  const [localOperations, setLocalOperations] = React.useState<
    OutboundMessageOperation[]
  >([]);

  React.useEffect(() => {
    if (!serverOperations) return;
    const serverRequestIds = new Set(
      serverOperations.map((operation) => operation.clientRequestId)
    );
    setLocalOperations((current) =>
      current.filter(
        (operation) => !serverRequestIds.has(operation.clientRequestId)
      )
    );
  }, [serverOperations]);

  React.useEffect(() => {
    setLocalOperations([]);
  }, [platform, prospectId]);

  const enqueue = React.useCallback(
    async (message: QueueMessageArgs) => {
      if (!prospectId) throw new Error("Prospect is required.");
      const clientRequestId = createClientRequestId();
      const now = getCurrentUTCTimestamp();
      const localOperation: OutboundMessageOperation = {
        clientRequestId,
        prospectId: prospectId as Id<"prospects">,
        platform,
        conversationId: message.conversationId,
        text: message.text.trim(),
        mediaUrls: message.mediaUrls,
        mediaDescriptions: message.mediaDescriptions,
        mediaKinds: message.mediaKinds,
        mediaFileNames: message.mediaFileNames,
        mediaMetadata: message.mediaMetadata,
        quoteId: message.quoteId,
        status: "queued",
        attemptCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      setLocalOperations((current) => [...current, localOperation]);

      try {
        return await queueMutation({
          prospectId: prospectId as Id<"prospects">,
          platform,
          clientRequestId,
          conversationId: message.conversationId,
          text: message.text,
          mediaUrls: message.mediaUrls,
          mediaDescriptions: message.mediaDescriptions,
          mediaKinds: message.mediaKinds,
          mediaFileNames: message.mediaFileNames,
          mediaMetadata: message.mediaMetadata,
          quoteId: message.quoteId,
          actionRequestId: message.actionRequestId,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error && error.message.trim()
            ? error.message
            : "Message could not be queued.";
        setLocalOperations((current) =>
          current.map((operation) =>
            operation.clientRequestId === clientRequestId
              ? {
                  ...operation,
                  status: "failed",
                  errorMessage,
                  updatedAt: getCurrentUTCTimestamp(),
                }
              : operation
          )
        );
        throw error;
      }
    },
    [platform, prospectId, queueMutation]
  );

  const retry = React.useCallback(
    async (operation: OutboundMessageOperation) => {
      if (operation.operationId) {
        return await retryMutation({ operationId: operation.operationId });
      }
      setLocalOperations((current) =>
        current.filter(
          (item) => item.clientRequestId !== operation.clientRequestId
        )
      );
      return await enqueue({
        conversationId: operation.conversationId,
        text: operation.text,
        mediaUrls: operation.mediaUrls,
        mediaDescriptions: operation.mediaDescriptions,
        mediaKinds: operation.mediaKinds,
        mediaFileNames: operation.mediaFileNames,
        mediaMetadata: operation.mediaMetadata,
        quoteId: operation.quoteId,
      });
    },
    [enqueue, retryMutation]
  );

  const operations = React.useMemo(() => {
    const persisted = (serverOperations ?? []) as OutboundMessageOperation[];
    const persistedRequestIds = new Set(
      persisted.map((operation) => operation.clientRequestId)
    );
    return [
      ...persisted,
      ...localOperations.filter(
        (operation) => !persistedRequestIds.has(operation.clientRequestId)
      ),
    ];
  }, [localOperations, serverOperations]);

  return { operations, enqueue, retry };
}
