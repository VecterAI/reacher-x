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
  LinkedInConversationPanelContext,
} from "@/shared/lib/linkedin/conversation";
import { toast } from "sonner";

const panelCache = new Map<string, LinkedInConversationPanelContext | null>();
const panelInflight = new Map<
  string,
  Promise<LinkedInConversationPanelContext | null>
>();

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
  const sendLinkedInMessage = useAction(linkedinApi.sendLinkedInMessage);
  const cancelActionRequest = useMutation(api.socialActions.cancelActionRequest);
  const liveDraft = useQuery(
    api.socialActions.getActionRequestDraft,
    enabled && actionRequestId
      ? { actionRequestId: actionRequestId as Id<"agentActionRequests"> }
      : "skip"
  );
  const getPanelContextRef = useRef(getPanelContext);
  const dataRef = useRef<LinkedInConversationPanelContext | null>(null);

  useEffect(() => {
    getPanelContextRef.current = getPanelContext;
  }, [getPanelContext]);

  const [data, setData] = useState<LinkedInConversationPanelContext | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
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

    if (panelCache.has(cacheKey)) {
      startTransition(() => {
        setData(panelCache.get(cacheKey) ?? null);
        setError(null);
      });
    }

    const hasVisibleData =
      panelCache.has(cacheKey) || dataRef.current !== null;

    const existingRequest = panelInflight.get(cacheKey);
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
          panelCache.set(cacheKey, result);
          startTransition(() => {
            setData(result);
            setError(null);
          });
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

      if (!hasVisibleData) {
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
      _mediaDescriptions?: string[]
    ) => {
      if (!prospectId) {
        throw new Error("Missing prospect.");
      }
      if (isSendingMessage) {
        return { success: true as const, duplicate: true, pending: true };
      }

      const activeActionRequestId =
        actionRequestStatus === "pending_approval" && actionRequestId
          ? (actionRequestId as Id<"agentActionRequests">)
          : undefined;
      const trimmedText = text.trim();
      const normalizedMediaUrls = (mediaUrls ?? []).filter(
        (url): url is string => typeof url === "string" && url.trim().length > 0
      );
      const previousData = dataRef.current;
      const optimisticConversationId =
        previousData?.conversationId ?? `optimistic:linkedin:${prospectId}`;
      const optimisticMessageId = `optimistic:linkedin:${Date.now()}`;
      const optimisticMessage = {
        id: optimisticMessageId,
        conversationId: optimisticConversationId,
        text: trimmedText,
        createdAt: new Date().toISOString(),
        direction: "sent" as const,
        attachments:
          normalizedMediaUrls.length > 0
            ? normalizedMediaUrls.map((url) => ({
                type: "attachment" as const,
                url,
                previewUrl: url,
              }))
            : undefined,
      };
      const optimisticData = previousData
        ? {
            ...previousData,
            conversationId: optimisticConversationId,
            eligibility: {
              ...previousData.eligibility,
              conversationId: optimisticConversationId,
            },
            messages: [...previousData.messages, optimisticMessage],
            draftText: "",
            draftAttachments: undefined,
          }
        : previousData;

      if (activeActionRequestId) {
        setStatusOverride("executing");
      }

      startTransition(() => {
        setData(optimisticData);
        setError(null);
      });
      if (optimisticData) {
        panelCache.set(cacheKey, optimisticData);
      } else {
        panelCache.delete(cacheKey);
      }
      setIsSendingMessage(true);

      void sendLinkedInMessage({
        prospectId: prospectId as Id<"prospects">,
        conversationId: previousData?.conversationId,
        text: trimmedText,
        mediaUrls: normalizedMediaUrls,
        actionRequestId: activeActionRequestId,
      })
        .then((result) => {
          const nextMessages = Array.isArray(result?.messages)
            ? (result.messages as LinkedInConversationPanelContext["messages"])
            : dataRef.current?.messages.map((message) =>
                message.id === optimisticMessageId
                  ? {
                      ...message,
                      id: result?.messageId ?? optimisticMessageId,
                      conversationId:
                        result?.conversationId ?? message.conversationId,
                    }
                  : message
              ) ?? [];
          const nextConversationId =
            result?.conversationId ??
            nextMessages.at(-1)?.conversationId ??
            previousData?.conversationId;
          const nextData = dataRef.current
            ? {
                ...dataRef.current,
                conversationId: nextConversationId,
                eligibility: {
                  ...dataRef.current.eligibility,
                  conversationId: nextConversationId,
                },
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
            panelCache.set(cacheKey, nextData);
          } else {
            panelCache.delete(cacheKey);
          }

          if (activeActionRequestId) {
            setStatusOverride("completed");
          }

          void refetch();
        })
        .catch((err) => {
          const revertedData = previousData
            ? {
                ...previousData,
                draftText: trimmedText,
                draftAttachments:
                  normalizedMediaUrls.length > 0
                    ? normalizedMediaUrls.map((url) => ({
                        type: "attachment" as const,
                        url,
                        previewUrl: url,
                      }))
                    : undefined,
              }
            : previousData;

          startTransition(() => {
            setData(revertedData);
            setError(
              err instanceof Error ? err.message : "Unable to send message."
            );
          });

          if (revertedData) {
            panelCache.set(cacheKey, revertedData);
          } else {
            panelCache.delete(cacheKey);
          }

          setStatusOverride(null);
          toast.error("Failed to send LinkedIn message", {
            description:
              err instanceof Error ? err.message : "Please try again.",
          });
        })
        .finally(() => {
          setIsSendingMessage(false);
        });

      return { success: true as const, pending: true };
    },
    [
      actionRequestStatus,
      actionRequestId,
      cacheKey,
      isSendingMessage,
      prospectId,
      refetch,
      sendLinkedInMessage,
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
    panelCache.delete(cacheKey);
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
    isSendingMessage,
    isSendingActionRequest:
      actionRequestStatus === "approved" || actionRequestStatus === "executing",
  };
}
