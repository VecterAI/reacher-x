"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type {
  LinkedInConversationAttachmentSummary,
  LinkedInConversationMessage,
  LinkedInConversationPanelContext,
} from "@/shared/lib/linkedin/conversation";
import type { LinkedInMessageReactionResult } from "@/shared/lib/linkedin/messageReaction";
import {
  mergeConversationHistoryMessages,
  reconcileConversationHistoryRefresh,
} from "../lib/conversationHistoryHelpers";
import {
  mergeOutboundMessageOperations,
  type OutboundMessageMediaMetadata,
} from "../lib/outboundMessageOperations";
import {
  type QueueMessageArgs,
  useOutboundMessageQueue,
} from "./useOutboundMessageQueue";
import type { ComposerMediaKind } from "@/features/composer/types";
import { runLinkedInMessageReactionOperation } from "../lib/linkedinMessageReactionOperation";

const panelInflight = new Map<
  string,
  Promise<LinkedInConversationPanelContext | null>
>();
const LINKEDIN_PANEL_REFRESH_INTERVAL_MS = 30_000;
const EMPTY_PENDING_REACTION_MESSAGE_IDS = new Set<string>();

function isLikelyConnectionFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /connection lost|Connection lost|failed to fetch|network|NetworkError|ECONNRESET|ETIMEDOUT|in flight/i.test(
    msg
  );
}

export function useProspectLinkedInPanel(args: {
  prospectId?: string;
  actionRequestId?: string | null;
  enabled?: boolean;
}) {
  const { prospectId, actionRequestId, enabled = true } = args;
  const linkedinApi = (api as any).linkedin;
  const getPanelContext = useAction(
    linkedinApi.getLinkedInConversationPanelContext
  );
  const getLinkedInConversationHistoryPage = useAction(
    linkedinApi.getLinkedInConversationHistoryPage
  );
  const markLinkedInConversationRead = useAction(
    linkedinApi.markLinkedInConversationRead
  );
  const {
    operations: outboundOperations,
    enqueue: enqueueOutboundMessage,
    enqueuePrepared: enqueuePreparedOutboundMessage,
    retry: retryOutboundMessage,
  } = useOutboundMessageQueue({
    prospectId,
    platform: "linkedin",
    enabled,
  });
  const reactToLinkedInMessage = useAction(linkedinApi.reactToLinkedInMessage);
  const cancelActionRequest = useMutation(
    api.socialActions.cancelActionRequest
  );
  const liveDraft = useQuery(
    api.socialActions.getActionRequestDraft,
    enabled && actionRequestId
      ? { actionRequestId: actionRequestId as Id<"agentActionRequests"> }
      : "skip"
  );
  const conversationRevision = useQuery(
    api.platformConversations.getLinkedInConversationRevision,
    enabled && prospectId
      ? { prospectId: prospectId as Id<"prospects"> }
      : "skip"
  );
  const getPanelContextRef = useRef(getPanelContext);
  const dataRef = useRef<LinkedInConversationPanelContext | null>(null);
  const activeCacheKeyRef = useRef("");
  const conversationRevisionRef = useRef<string | null | undefined>(undefined);
  const reactionOperationsRef = useRef(new Set<string>());
  const acknowledgedReadRef = useRef<string | null>(null);
  const readInFlightRef = useRef<string | null>(null);

  useEffect(() => {
    getPanelContextRef.current = getPanelContext;
  }, [getPanelContext]);

  const [storedData, setData] =
    useState<LinkedInConversationPanelContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [storedLoadOlderError, setLoadOlderError] = useState(false);
  const [storedError, setError] = useState<string | null>(null);
  const [reactionPendingState, setReactionPendingState] = useState<{
    cacheKey: string;
    messageIds: Set<string>;
  }>({ cacheKey: "", messageIds: new Set() });
  const [statusOverride, setStatusOverride] = useState<{
    cacheKey: string;
    status: string;
  } | null>(null);
  const cacheKey = `${prospectId ?? ""}:${actionRequestId ?? ""}`;
  const stateBelongsToCurrentPanel = activeCacheKeyRef.current === cacheKey;
  const data = stateBelongsToCurrentPanel ? storedData : null;
  const loadOlderError = stateBelongsToCurrentPanel
    ? storedLoadOlderError
    : false;
  const error = stateBelongsToCurrentPanel ? storedError : null;
  const pendingReactionMessageIds =
    reactionPendingState.cacheKey === cacheKey
      ? reactionPendingState.messageIds
      : EMPTY_PENDING_REACTION_MESSAGE_IDS;

  const latestReceivedMessageId = data?.messages
    .toReversed()
    .find((message) => message.direction === "received")?.id;

  useEffect(() => {
    if (
      !enabled ||
      !prospectId ||
      !data?.conversationId ||
      !latestReceivedMessageId
    ) {
      return;
    }
    const operationKey = `${data.conversationId}:${latestReceivedMessageId}`;
    const markReadWhenVisible = () => {
      if (
        document.visibilityState !== "visible" ||
        acknowledgedReadRef.current === operationKey ||
        readInFlightRef.current === operationKey
      ) {
        return;
      }
      readInFlightRef.current = operationKey;
      void markLinkedInConversationRead({
        prospectId: prospectId as Id<"prospects">,
      })
        .then(() => {
          acknowledgedReadRef.current = operationKey;
        })
        .catch((markReadError) => {
          console.warn(
            "[LinkedInConversationPanel] Unable to mark conversation read",
            markReadError instanceof Error
              ? markReadError.message
              : String(markReadError)
          );
        })
        .finally(() => {
          if (readInFlightRef.current === operationKey) {
            readInFlightRef.current = null;
          }
        });
    };

    markReadWhenVisible();
    document.addEventListener("visibilitychange", markReadWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", markReadWhenVisible);
    };
  }, [
    data?.conversationId,
    enabled,
    latestReceivedMessageId,
    markLinkedInConversationRead,
    prospectId,
  ]);

  useEffect(() => {
    activeCacheKeyRef.current = cacheKey;
    conversationRevisionRef.current = undefined;
    dataRef.current = null;
  }, [cacheKey]);

  const refetch = useCallback(async () => {
    const requestCacheKey = cacheKey;
    setIsLoadingOlder(false);
    setLoadOlderError(false);
    if (!enabled || !prospectId) {
      dataRef.current = null;
      setData(null);
      setError(null);
      setLoading(false);
      setIsRefreshing(false);
      return null;
    }

    const hasVisibleData = dataRef.current !== null;
    const commitResult = (result: LinkedInConversationPanelContext | null) => {
      if (activeCacheKeyRef.current !== requestCacheKey) return;
      const nextData = reconcileConversationHistoryRefresh(
        dataRef.current,
        result
      );
      dataRef.current = nextData;
      startTransition(() => {
        setData(nextData);
        setError(null);
      });
    };

    const existingRequest = panelInflight.get(cacheKey);
    if (existingRequest) {
      setLoading(!hasVisibleData);
      setIsRefreshing(hasVisibleData);
      try {
        const result = await existingRequest;
        commitResult(result);
        return result;
      } finally {
        if (activeCacheKeyRef.current === requestCacheKey) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    try {
      setLoading(!hasVisibleData);
      setIsRefreshing(hasVisibleData);
      let lastErr: unknown;
      let result: LinkedInConversationPanelContext | null = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const request = getPanelContextRef.current({
            prospectId: prospectId as Id<"prospects">,
            actionRequestId: actionRequestId
              ? (actionRequestId as Id<"agentActionRequests">)
              : undefined,
          });
          panelInflight.set(cacheKey, request);
          result = await request;
          commitResult(result);
          return result;
        } catch (err) {
          lastErr = err;
          panelInflight.delete(cacheKey);
          if (attempt === 0 && isLikelyConnectionFailure(err)) {
            await new Promise((resolve) => setTimeout(resolve, 1200));
            continue;
          }
          break;
        }
      }

      if (!hasVisibleData && activeCacheKeyRef.current === requestCacheKey) {
        dataRef.current = null;
        startTransition(() => {
          setData(null);
          setError(
            lastErr instanceof Error
              ? lastErr.message
              : "Unable to load messages."
          );
        });
      }
      return null;
    } finally {
      panelInflight.delete(cacheKey);
      if (activeCacheKeyRef.current === requestCacheKey) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [actionRequestId, cacheKey, enabled, prospectId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const conversationRevisionKey = conversationRevision
    ? `${conversationRevision.updatedAt}:${conversationRevision.latestMessageId ?? ""}:${conversationRevision.latestMessageAt ?? ""}`
    : null;
  const conversationRevisionLoaded = conversationRevision !== undefined;

  useEffect(() => {
    if (!conversationRevisionLoaded) return;
    const previousRevision = conversationRevisionRef.current;
    conversationRevisionRef.current = conversationRevisionKey;
    if (
      previousRevision === undefined ||
      previousRevision === conversationRevisionKey ||
      dataRef.current === null
    ) {
      return;
    }
    void refetch();
  }, [conversationRevisionKey, conversationRevisionLoaded, refetch]);

  useEffect(() => {
    if (!enabled || !prospectId) {
      return;
    }

    const refreshWhenVisible = () => {
      if (
        document.visibilityState !== "visible" ||
        dataRef.current?.eligibility.enabled === false
      ) {
        return;
      }
      // refetch coalesces concurrent calls per panel cache key, so a provider
      // refresh already in flight is reused rather than duplicated.
      void refetch();
    };

    const intervalId = window.setInterval(
      refreshWhenVisible,
      LINKEDIN_PANEL_REFRESH_INTERVAL_MS
    );
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [enabled, prospectId, refetch]);

  const loadOlder = useCallback(async () => {
    const requestCacheKey = cacheKey;
    const currentData = dataRef.current;
    const cursor = currentData?.history?.nextCursor;
    if (
      !prospectId ||
      !currentData?.history?.hasMore ||
      !cursor ||
      isLoadingOlder
    ) {
      return null;
    }

    setIsLoadingOlder(true);
    setLoadOlderError(false);
    try {
      const page = await getLinkedInConversationHistoryPage({
        prospectId: prospectId as Id<"prospects">,
        cursor,
        limit: 25,
      });
      if (!page) {
        throw new Error("Conversation history is unavailable.");
      }
      if (activeCacheKeyRef.current !== requestCacheKey) return page;

      const latestData = dataRef.current;
      if (!latestData) return page;
      const nextData: LinkedInConversationPanelContext = {
        ...latestData,
        conversationId: page.conversationId ?? latestData.conversationId,
        messages: mergeConversationHistoryMessages(
          latestData.messages,
          page.messages
        ),
        history: page.history,
      };
      dataRef.current = nextData;
      startTransition(() => setData(nextData));
      return page;
    } catch {
      if (activeCacheKeyRef.current === requestCacheKey) {
        setLoadOlderError(true);
      }
      return null;
    } finally {
      if (activeCacheKeyRef.current === requestCacheKey) {
        setIsLoadingOlder(false);
      }
    }
  }, [
    cacheKey,
    getLinkedInConversationHistoryPage,
    isLoadingOlder,
    prospectId,
  ]);

  const currentStatusOverride =
    statusOverride?.cacheKey === cacheKey ? statusOverride.status : null;
  const actionRequestStatus =
    currentStatusOverride === "executing" &&
    liveDraft?.status &&
    liveDraft.status !== "pending_approval"
      ? liveDraft.status
      : (currentStatusOverride ?? liveDraft?.status ?? null);
  const isPendingApproval = actionRequestStatus === "pending_approval";

  const send = useCallback(
    async (
      text: string,
      mediaUrls?: string[],
      mediaDescriptions?: string[],
      mediaKinds?: ComposerMediaKind[],
      mediaFileNames?: string[],
      mediaMetadata?: OutboundMessageMediaMetadata[],
      quoteId?: string,
      voiceNoteCacheId?: Id<"platformConversationMediaCache">
    ) => {
      if (!prospectId) {
        throw new Error("Missing prospect.");
      }
      const activeActionRequestId =
        actionRequestStatus === "pending_approval" && actionRequestId
          ? (actionRequestId as Id<"agentActionRequests">)
          : undefined;
      if (activeActionRequestId) {
        setStatusOverride({ cacheKey, status: "executing" });
      }
      try {
        return await enqueueOutboundMessage({
          conversationId: data?.conversationId,
          text,
          mediaUrls,
          mediaDescriptions,
          mediaKinds,
          mediaFileNames,
          mediaMetadata,
          voiceNoteCacheId,
          quoteId,
          actionRequestId: activeActionRequestId,
        });
      } catch (error) {
        if (activeActionRequestId) setStatusOverride(null);
        throw error;
      }
    },
    [
      actionRequestStatus,
      actionRequestId,
      cacheKey,
      data?.conversationId,
      enqueueOutboundMessage,
      prospectId,
    ]
  );

  const sendPrepared = useCallback(
    async (args: {
      optimisticMessage: QueueMessageArgs;
      prepare: () => Promise<QueueMessageArgs>;
      releaseOptimisticPreview?: () => void;
    }) => {
      if (!prospectId) {
        throw new Error("Missing prospect.");
      }
      const activeActionRequestId =
        actionRequestStatus === "pending_approval" && actionRequestId
          ? (actionRequestId as Id<"agentActionRequests">)
          : undefined;
      if (activeActionRequestId) {
        setStatusOverride({ cacheKey, status: "executing" });
      }
      const withPanelContext = (message: QueueMessageArgs) => ({
        ...message,
        conversationId: data?.conversationId,
        actionRequestId: activeActionRequestId,
      });
      try {
        return await enqueuePreparedOutboundMessage({
          optimisticMessage: withPanelContext(args.optimisticMessage),
          prepare: async () => withPanelContext(await args.prepare()),
          releaseOptimisticPreview: args.releaseOptimisticPreview,
        });
      } catch (error) {
        if (activeActionRequestId) setStatusOverride(null);
        throw error;
      }
    },
    [
      actionRequestId,
      actionRequestStatus,
      cacheKey,
      data?.conversationId,
      enqueuePreparedOutboundMessage,
      prospectId,
    ]
  );

  const retrySend = useCallback(
    async (clientRequestId: string) => {
      const operation = outboundOperations.find(
        (item) => item.clientRequestId === clientRequestId
      );
      if (!operation) throw new Error("Message is no longer available.");
      return await retryOutboundMessage(operation);
    },
    [outboundOperations, retryOutboundMessage]
  );

  const cancel = useCallback(async () => {
    if (!actionRequestId) {
      return { success: true, duplicate: true };
    }

    const result = await cancelActionRequest({
      actionRequestId: actionRequestId as Id<"agentActionRequests">,
    });
    setStatusOverride({ cacheKey, status: "cancelled" });
    return result;
  }, [actionRequestId, cacheKey, cancelActionRequest]);

  const reactToMessage = useCallback(
    async (messageId: string, emoji: string) => {
      if (!prospectId) throw new Error("Prospect is required.");
      const requestCacheKey = cacheKey;
      return await runLinkedInMessageReactionOperation({
        operationKey: `${requestCacheKey}:${messageId}`,
        messageId,
        emoji,
        inFlightOperations: reactionOperationsRef.current,
        getData: () => dataRef.current,
        isCurrent: () => activeCacheKeyRef.current === requestCacheKey,
        setData: (nextData) => {
          dataRef.current = nextData;
          setData(nextData);
        },
        setPending: (pending) => {
          if (activeCacheKeyRef.current !== requestCacheKey) return;
          setReactionPendingState((current) => {
            const currentMessageIds =
              current.cacheKey === requestCacheKey
                ? [...current.messageIds]
                : [];
            const messageIds = new Set(
              pending
                ? [...currentMessageIds, messageId]
                : currentMessageIds.filter(
                    (currentMessageId) => currentMessageId !== messageId
                  )
            );
            return { cacheKey: requestCacheKey, messageIds };
          });
        },
        addReaction: async () =>
          (await reactToLinkedInMessage({
            prospectId: prospectId as Id<"prospects">,
            messageId,
            reaction: emoji,
          })) as LinkedInMessageReactionResult,
        refresh: refetch,
      });
    },
    [cacheKey, prospectId, reactToLinkedInMessage, refetch]
  );

  const dataWithOutbound = data
    ? {
        ...data,
        messages: mergeOutboundMessageOperations(
          data.messages,
          outboundOperations,
          data.conversationId ?? `outbound:linkedin:${prospectId ?? ""}`
        ) as LinkedInConversationMessage[],
      }
    : data;

  const mergedData =
    dataWithOutbound && liveDraft && isPendingApproval
      ? {
          ...dataWithOutbound,
          draftText: liveDraft.draftText,
          draftAttachments:
            dataWithOutbound.draftAttachments?.length ||
            liveDraft.mediaUrls.length === 0
              ? dataWithOutbound.draftAttachments
              : liveDraft.mediaUrls.map(
                  (
                    url: string,
                    index: number
                  ): LinkedInConversationAttachmentSummary => ({
                    type: "attachment",
                    url,
                    previewUrl: url,
                    altText: liveDraft.mediaDescriptions[index] ?? "",
                  })
                ),
        }
      : dataWithOutbound
        ? {
            ...dataWithOutbound,
            draftText: isPendingApproval ? dataWithOutbound.draftText : "",
            draftAttachments: isPendingApproval
              ? dataWithOutbound.draftAttachments
              : undefined,
          }
        : dataWithOutbound;

  return {
    data: mergedData,
    loading,
    isRefreshing,
    isLoadingOlder,
    loadOlderError,
    error,
    refetch,
    loadOlder,
    send,
    sendPrepared,
    retrySend,
    reactToMessage,
    pendingReactionMessageIds,
    cancel,
    actionRequestStatus,
    isPendingApproval,
    isSendingActionRequest:
      actionRequestStatus === "approved" || actionRequestStatus === "executing",
  };
}
