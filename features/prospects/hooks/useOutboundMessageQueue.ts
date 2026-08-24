"use client";

import { useMutation, useQuery } from "convex/react";
import * as React from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  createClientRequestId,
  getCurrentUTCTimestamp,
} from "@/shared/lib/utils";
import { getOutboundMessageFailure } from "@/shared/lib/platforms/outboundMessageFailure";
import {
  retryLocalOutboundMessageOperation,
  type OutboundMessageMediaMetadata,
  type OutboundMessageOperation,
} from "../lib/outboundMessageOperations";

export type QueueMessageArgs = {
  conversationId?: string;
  text: string;
  mediaUrls?: string[];
  mediaDescriptions?: string[];
  mediaKinds?: Array<"image" | "video" | "gif" | "file">;
  mediaFileNames?: string[];
  mediaMetadata?: OutboundMessageMediaMetadata[];
  voiceNoteCacheId?: Id<"platformConversationMediaCache">;
  quoteId?: string;
  actionRequestId?: Id<"agentActionRequests">;
};

export type PreparedQueueMessageArgs = {
  optimisticMessage: QueueMessageArgs;
  prepare: () => Promise<QueueMessageArgs>;
  releaseOptimisticPreview?: () => void;
};

type PreparedLocalSend = Pick<
  PreparedQueueMessageArgs,
  "prepare" | "releaseOptimisticPreview"
>;

function createLocalOperation(args: {
  clientRequestId: string;
  prospectId: Id<"prospects">;
  platform: "twitter" | "linkedin";
  message: QueueMessageArgs;
  now: number;
}): OutboundMessageOperation {
  return {
    clientRequestId: args.clientRequestId,
    prospectId: args.prospectId,
    platform: args.platform,
    conversationId: args.message.conversationId,
    text: args.message.text.trim(),
    mediaUrls: args.message.mediaUrls,
    mediaDescriptions: args.message.mediaDescriptions,
    mediaKinds: args.message.mediaKinds,
    mediaFileNames: args.message.mediaFileNames,
    mediaMetadata: args.message.mediaMetadata,
    voiceNoteCacheId: args.message.voiceNoteCacheId,
    quoteId: args.message.quoteId,
    actionRequestId: args.message.actionRequestId,
    status: "queued",
    attemptCount: 0,
    createdAt: args.now,
    updatedAt: args.now,
  };
}

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
  const preparedLocalSendsRef = React.useRef(
    new Map<string, PreparedLocalSend>()
  );

  const releasePreparedLocalSend = React.useCallback(
    (clientRequestId: string) => {
      const prepared = preparedLocalSendsRef.current.get(clientRequestId);
      if (!prepared) return;
      prepared.releaseOptimisticPreview?.();
      preparedLocalSendsRef.current.delete(clientRequestId);
    },
    []
  );

  React.useEffect(() => {
    if (!serverOperations) return;
    const serverRequestIds = new Set(
      serverOperations.map((operation) => operation.clientRequestId)
    );
    for (const clientRequestId of serverRequestIds) {
      releasePreparedLocalSend(clientRequestId);
    }
    setLocalOperations((current) =>
      current.filter(
        (operation) => !serverRequestIds.has(operation.clientRequestId)
      )
    );
  }, [releasePreparedLocalSend, serverOperations]);

  React.useEffect(() => {
    for (const clientRequestId of preparedLocalSendsRef.current.keys()) {
      releasePreparedLocalSend(clientRequestId);
    }
    setLocalOperations([]);
  }, [platform, prospectId, releasePreparedLocalSend]);

  React.useEffect(
    () => () => {
      for (const prepared of preparedLocalSendsRef.current.values()) {
        prepared.releaseOptimisticPreview?.();
      }
      preparedLocalSendsRef.current.clear();
    },
    []
  );

  const markLocalOperationFailed = React.useCallback(
    (clientRequestId: string, error: unknown) => {
      const errorMessage = getOutboundMessageFailure({
        error,
        platform,
      }).message;
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
    },
    [platform]
  );

  const queueWithClientRequestId = React.useCallback(
    async (clientRequestId: string, message: QueueMessageArgs) => {
      if (!prospectId) throw new Error("Prospect is required.");
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
        voiceNoteCacheId: message.voiceNoteCacheId,
        quoteId: message.quoteId,
        actionRequestId: message.actionRequestId,
      });
    },
    [platform, prospectId, queueMutation]
  );

  const enqueue = React.useCallback(
    async (message: QueueMessageArgs) => {
      if (!prospectId) throw new Error("Prospect is required.");
      const clientRequestId = createClientRequestId();
      const now = getCurrentUTCTimestamp();
      const localOperation = createLocalOperation({
        clientRequestId,
        prospectId: prospectId as Id<"prospects">,
        platform,
        message,
        now,
      });
      setLocalOperations((current) => [...current, localOperation]);

      try {
        return await queueWithClientRequestId(clientRequestId, message);
      } catch (error) {
        markLocalOperationFailed(clientRequestId, error);
        throw error;
      }
    },
    [markLocalOperationFailed, platform, prospectId, queueWithClientRequestId]
  );

  const enqueuePrepared = React.useCallback(
    async (args: PreparedQueueMessageArgs) => {
      if (!prospectId) throw new Error("Prospect is required.");
      const clientRequestId = createClientRequestId();
      const localOperation = createLocalOperation({
        clientRequestId,
        prospectId: prospectId as Id<"prospects">,
        platform,
        message: args.optimisticMessage,
        now: getCurrentUTCTimestamp(),
      });
      preparedLocalSendsRef.current.set(clientRequestId, {
        prepare: args.prepare,
        releaseOptimisticPreview: args.releaseOptimisticPreview,
      });
      setLocalOperations((current) => [...current, localOperation]);

      try {
        const preparedMessage = await args.prepare();
        return await queueWithClientRequestId(clientRequestId, preparedMessage);
      } catch (error) {
        markLocalOperationFailed(clientRequestId, error);
        throw error;
      }
    },
    [markLocalOperationFailed, platform, prospectId, queueWithClientRequestId]
  );

  const retry = React.useCallback(
    async (operation: OutboundMessageOperation) => {
      if (operation.operationId) {
        return await retryMutation({ operationId: operation.operationId });
      }
      const preparedSend = preparedLocalSendsRef.current.get(
        operation.clientRequestId
      );
      if (preparedSend) {
        setLocalOperations((current) =>
          current.map((item) =>
            item.clientRequestId === operation.clientRequestId
              ? {
                  ...item,
                  status: "queued",
                  errorMessage: undefined,
                  updatedAt: getCurrentUTCTimestamp(),
                }
              : item
          )
        );
        try {
          const preparedMessage = await preparedSend.prepare();
          return await queueWithClientRequestId(operation.clientRequestId, {
            ...preparedMessage,
            actionRequestId:
              preparedMessage.actionRequestId ?? operation.actionRequestId,
          });
        } catch (error) {
          markLocalOperationFailed(operation.clientRequestId, error);
          throw error;
        }
      }
      setLocalOperations((current) =>
        current.filter(
          (item) => item.clientRequestId !== operation.clientRequestId
        )
      );
      return await retryLocalOutboundMessageOperation(operation, enqueue);
    },
    [enqueue, markLocalOperationFailed, queueWithClientRequestId, retryMutation]
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

  return { operations, enqueue, enqueuePrepared, retry };
}
