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
  const cancelActionRequest = useMutation(
    api.twitterActions.cancelActionRequest
  );
  const liveDraft = useQuery(
    api.twitterActions.getActionRequestDraft,
    enabled && actionRequestId
      ? { actionRequestId: actionRequestId as Id<"agentActionRequests"> }
      : "skip"
  );
  const getPanelContextRef = useRef(getPanelContext);

  useEffect(() => {
    getPanelContextRef.current = getPanelContext;
  }, [getPanelContext]);

  const [data, setData] = useState<LinkedInConversationPanelContext | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheKey = `${prospectId ?? ""}:${actionRequestId ?? ""}`;

  const refetch = useCallback(async () => {
    if (!enabled || !prospectId) {
      setData(null);
      setError(null);
      setLoading(false);
      return null;
    }

    if (panelCache.has(cacheKey)) {
      startTransition(() => {
        setData(panelCache.get(cacheKey) ?? null);
        setError(null);
      });
    }

    const existingRequest = panelInflight.get(cacheKey);
    if (existingRequest) {
      setLoading(true);
      const result = await existingRequest;
      startTransition(() => {
        setData(result);
        setError(null);
        setLoading(false);
      });
      return result;
    }

    try {
      setLoading(true);
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

      startTransition(() => {
        setData(null);
        setError(
          lastErr instanceof Error
            ? lastErr.message
            : "Unable to load messages."
        );
      });
      return null;
    } finally {
      panelInflight.delete(cacheKey);
      setLoading(false);
    }
  }, [actionRequestId, cacheKey, enabled, prospectId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const send = useCallback(
    async (
      text: string,
      mediaUrls?: string[],
      _mediaDescriptions?: string[]
    ) => {
      if (!prospectId) {
        throw new Error("Missing prospect.");
      }

      const result = await sendLinkedInMessage({
        prospectId: prospectId as Id<"prospects">,
        conversationId: data?.conversationId,
        text,
        mediaUrls,
        actionRequestId: actionRequestId
          ? (actionRequestId as Id<"agentActionRequests">)
          : undefined,
      });

      panelCache.delete(cacheKey);
      await refetch();
      return result;
    },
    [
      actionRequestId,
      cacheKey,
      data?.conversationId,
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
    panelCache.delete(cacheKey);
    return result;
  }, [actionRequestId, cacheKey, cancelActionRequest]);

  return {
    data:
      data && liveDraft
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
        : data,
    loading,
    error,
    refetch,
    send,
    cancel,
  };
}
