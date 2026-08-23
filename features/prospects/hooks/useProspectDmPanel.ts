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
  XDmAttachmentSummary,
  XDmMessage,
  XDmPanelContext,
} from "@/shared/lib/twitter/dm";
import {
  mergeConversationHistoryMessages,
  reconcileConversationHistoryRefresh,
} from "../lib/conversationHistoryHelpers";
import type { ComposerMediaKind } from "@/features/composer/types";
import {
  mergeOutboundMessageOperations,
  type OutboundMessageMediaMetadata,
} from "../lib/outboundMessageOperations";
import { useOutboundMessageQueue } from "./useOutboundMessageQueue";

const dmPanelInflight = new Map<string, Promise<XDmPanelContext | null>>();
function isLikelyConnectionFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /connection lost|Connection lost|failed to fetch|network|NetworkError|ECONNRESET|ETIMEDOUT|in flight/i.test(
    msg
  );
}

export function useProspectDmPanel(args: {
  prospectId?: string;
  actionRequestId?: string | null;
  enabled?: boolean;
  refreshContextOnRevision?: boolean;
}) {
  const {
    prospectId,
    actionRequestId,
    enabled = true,
    refreshContextOnRevision = true,
  } = args;
  const getDmPanelContext = useAction(api.x.getDmPanelContext);
  const getDmConversationHistoryPage = useAction(
    api.x.getDmConversationHistoryPage
  );
  const {
    operations: outboundOperations,
    enqueue: enqueueOutboundMessage,
    retry: retryOutboundMessage,
  } = useOutboundMessageQueue({
    prospectId,
    platform: "twitter",
    enabled,
  });
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
    api.platformConversations.getTwitterConversationRevision,
    enabled && prospectId
      ? { prospectId: prospectId as Id<"prospects"> }
      : "skip"
  );
  const getDmPanelContextRef = useRef(getDmPanelContext);
  const dataRef = useRef<XDmPanelContext | null>(null);
  const activeCacheKeyRef = useRef("");
  const conversationRevisionRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    getDmPanelContextRef.current = getDmPanelContext;
  }, [getDmPanelContext]);

  const [storedData, setData] = useState<XDmPanelContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [storedLoadOlderError, setLoadOlderError] = useState(false);
  const [storedError, setError] = useState<string | null>(null);
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
    const commitResult = (result: XDmPanelContext | null) => {
      if (activeCacheKeyRef.current !== requestCacheKey) {
        return;
      }
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
    const existingRequest = dmPanelInflight.get(cacheKey);
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
      let result: XDmPanelContext | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const request = getDmPanelContextRef.current({
            prospectId: prospectId as Id<"prospects">,
            actionRequestId: actionRequestId
              ? (actionRequestId as Id<"agentActionRequests">)
              : undefined,
          });
          dmPanelInflight.set(cacheKey, request);
          result = await request;
          commitResult(result);
          return result;
        } catch (err) {
          lastErr = err;
          dmPanelInflight.delete(cacheKey);
          if (attempt === 0 && isLikelyConnectionFailure(err)) {
            await new Promise((r) => setTimeout(r, 1200));
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
            lastErr instanceof Error ? lastErr.message : "Unable to load DMs."
          );
        });
      }
      return null;
    } finally {
      dmPanelInflight.delete(cacheKey);
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
    if (!conversationRevisionLoaded) {
      return;
    }

    const previousRevision = conversationRevisionRef.current;
    conversationRevisionRef.current = conversationRevisionKey;

    if (
      previousRevision === undefined ||
      previousRevision === conversationRevisionKey ||
      dataRef.current === null ||
      !refreshContextOnRevision
    ) {
      return;
    }

    void refetch();
  }, [
    conversationRevisionKey,
    conversationRevisionLoaded,
    refetch,
    refreshContextOnRevision,
  ]);

  const loadOlder = useCallback(async () => {
    const requestCacheKey = cacheKey;
    const currentData = dataRef.current;
    const cursor = currentData?.history?.nextCursor;
    if (
      !prospectId ||
      !currentData?.eligibility.enabled ||
      !currentData?.history?.hasMore ||
      !cursor ||
      isLoadingOlder
    ) {
      return null;
    }

    setIsLoadingOlder(true);
    setLoadOlderError(false);
    try {
      const page = await getDmConversationHistoryPage({
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
      const nextData: XDmPanelContext = {
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
  }, [cacheKey, getDmConversationHistoryPage, isLoadingOlder, prospectId]);

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
      mediaMetadata?: OutboundMessageMediaMetadata[]
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

  const dataWithOutbound = data
    ? {
        ...data,
        messages: mergeOutboundMessageOperations(
          data.messages,
          outboundOperations,
          data.conversationId ?? `outbound:twitter:${prospectId ?? ""}`
        ) as XDmMessage[],
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
                  (url: string, index: number): XDmAttachmentSummary => ({
                    type: "media",
                    url,
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
    retrySend,
    cancel,
    actionRequestStatus,
    isPendingApproval,
    isSendingActionRequest:
      actionRequestStatus === "approved" || actionRequestStatus === "executing",
    conversationRevisionKey,
    conversationRevisionLoaded,
    conversationRevisionLatestMessageId:
      conversationRevision?.latestMessageId ?? null,
  };
}
