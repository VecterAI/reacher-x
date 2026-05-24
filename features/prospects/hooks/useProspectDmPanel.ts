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

  useEffect(() => {
    getDmPanelContextRef.current = getDmPanelContext;
  }, [getDmPanelContext]);

  const [data, setData] = useState<XDmPanelContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusOverride, setStatusOverride] = useState<string | null>(null);
  const cacheKey = `${prospectId ?? ""}:${actionRequestId ?? ""}`;

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    setStatusOverride(null);
  }, [prospectId, actionRequestId]);

  const refetch = useCallback(async () => {
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
      const result = await existingRequest;
      startTransition(() => {
        setData(result);
        setError(null);
      });
      setLoading(false);
      setIsRefreshing(false);
      return result;
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
    error,
    refetch,
    send,
    cancel,
    actionRequestStatus,
    isPendingApproval,
    isSendingActionRequest:
      actionRequestStatus === "approved" || actionRequestStatus === "executing",
  };
}
