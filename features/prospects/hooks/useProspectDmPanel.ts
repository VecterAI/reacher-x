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
  XDmPanelContext,
} from "@/shared/lib/twitter/dm";
import { mergeConversationHistoryMessages } from "../lib/conversationHistoryHelpers";

const dmPanelCache = new Map<string, XDmPanelContext | null>();
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
}) {
  const { prospectId, actionRequestId, enabled = true } = args;
  const getDmPanelContext = useAction(api.x.getDmPanelContext);
  const getDmConversationHistoryPage = useAction(
    api.x.getDmConversationHistoryPage
  );
  const sendDmMessage = useAction(api.x.sendDmMessage);
  const cancelActionRequest = useMutation(
    api.socialActions.cancelActionRequest
  );
  const liveDraft = useQuery(
    api.socialActions.getActionRequestDraft,
    enabled && actionRequestId
      ? { actionRequestId: actionRequestId as Id<"agentActionRequests"> }
      : "skip"
  );
  const getDmPanelContextRef = useRef(getDmPanelContext);
  const dataRef = useRef<XDmPanelContext | null>(null);
  const activeCacheKeyRef = useRef("");

  useEffect(() => {
    getDmPanelContextRef.current = getDmPanelContext;
  }, [getDmPanelContext]);

  const [data, setData] = useState<XDmPanelContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [loadOlderError, setLoadOlderError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusOverride, setStatusOverride] = useState<string | null>(null);
  const cacheKey = `${prospectId ?? ""}:${actionRequestId ?? ""}`;

  useEffect(() => {
    activeCacheKeyRef.current = cacheKey;
  }, [cacheKey]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    setStatusOverride(null);
  }, [prospectId, actionRequestId]);

  const refetch = useCallback(async () => {
    setIsLoadingOlder(false);
    setLoadOlderError(false);
    if (!enabled || !prospectId) {
      setData(null);
      setError(null);
      setLoading(false);
      setIsRefreshing(false);
      return null;
    }
    if (dmPanelCache.has(cacheKey)) {
      startTransition(() => {
        setData(dmPanelCache.get(cacheKey) ?? null);
        setError(null);
      });
    }
    const hasVisibleData =
      dmPanelCache.has(cacheKey) || dataRef.current !== null;
    const existingRequest = dmPanelInflight.get(cacheKey);
    if (existingRequest) {
      setLoading(!hasVisibleData);
      setIsRefreshing(hasVisibleData);
      try {
        const result = await existingRequest;
        startTransition(() => {
          setData(result);
          setError(null);
        });
        return result;
      } finally {
        setLoading(false);
        setIsRefreshing(false);
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
          dmPanelCache.set(cacheKey, result);
          startTransition(() => {
            setData(result);
            setError(null);
          });
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
      if (!hasVisibleData) {
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
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [actionRequestId, cacheKey, enabled, prospectId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

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
      dmPanelCache.set(cacheKey, nextData);
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

  const actionRequestStatus = statusOverride ?? liveDraft?.status ?? null;
  const isPendingApproval = actionRequestStatus === "pending_approval";

  const send = useCallback(
    async (
      text: string,
      mediaUrls?: string[],
      mediaDescriptions?: string[]
    ) => {
      if (!prospectId) {
        throw new Error("Missing prospect.");
      }
      const activeActionRequestId =
        actionRequestStatus === "pending_approval" && actionRequestId
          ? (actionRequestId as Id<"agentActionRequests">)
          : undefined;
      if (activeActionRequestId) {
        setStatusOverride("executing");
      }
      const result = await sendDmMessage({
        prospectId: prospectId as Id<"prospects">,
        conversationId: data?.conversationId,
        text,
        mediaUrls,
        mediaDescriptions,
        actionRequestId: activeActionRequestId,
      });
      const nextMessages = Array.isArray(result?.messages)
        ? (result.messages as XDmPanelContext["messages"])
        : (dataRef.current?.messages ?? []);
      const nextConversationId =
        nextMessages.at(-1)?.conversationId ?? dataRef.current?.conversationId;
      const nextData = dataRef.current
        ? {
            ...dataRef.current,
            conversationId: nextConversationId,
            messages: nextMessages,
            draftText: "",
            draftAttachments: undefined,
          }
        : null;

      startTransition(() => {
        setData(nextData);
        setError(null);
      });

      if (nextData) {
        dmPanelCache.set(cacheKey, nextData);
      } else {
        dmPanelCache.delete(cacheKey);
      }

      if (activeActionRequestId) {
        setStatusOverride("completed");
      }

      void refetch();
      return result;
    },
    [
      actionRequestStatus,
      actionRequestId,
      cacheKey,
      data?.conversationId,
      prospectId,
      refetch,
      sendDmMessage,
    ]
  );

  const cancel = useCallback(async () => {
    if (!actionRequestId) {
      return { success: true, duplicate: true };
    }
    const result = await cancelActionRequest({
      actionRequestId: actionRequestId as Id<"agentActionRequests">,
    });
    setStatusOverride("cancelled");
    dmPanelCache.delete(cacheKey);
    return result;
  }, [actionRequestId, cacheKey, cancelActionRequest]);

  const mergedData =
    data && liveDraft && isPendingApproval
      ? {
          ...data,
          draftText: liveDraft.draftText,
          draftAttachments:
            data.draftAttachments?.length || liveDraft.mediaUrls.length === 0
              ? data.draftAttachments
              : liveDraft.mediaUrls.map(
                  (url: string, index: number): XDmAttachmentSummary => ({
                    type: "media",
                    url,
                    altText: liveDraft.mediaDescriptions[index] ?? "",
                  })
                ),
        }
      : data
        ? {
            ...data,
            draftText: isPendingApproval ? data.draftText : "",
            draftAttachments: isPendingApproval
              ? data.draftAttachments
              : undefined,
          }
        : data;

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
    cancel,
    actionRequestStatus,
    isPendingApproval,
    isSendingActionRequest:
      actionRequestStatus === "approved" || actionRequestStatus === "executing",
  };
}
