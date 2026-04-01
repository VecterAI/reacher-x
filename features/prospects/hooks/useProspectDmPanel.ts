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
    api.twitterActions.cancelActionRequest
  );
  const liveDraft = useQuery(
    api.twitterActions.getActionRequestDraft,
    enabled && actionRequestId
      ? { actionRequestId: actionRequestId as Id<"agentActionRequests"> }
      : "skip"
  );
  const getDmPanelContextRef = useRef(getDmPanelContext);

  useEffect(() => {
    getDmPanelContextRef.current = getDmPanelContext;
  }, [getDmPanelContext]);

  const [data, setData] = useState<XDmPanelContext | null>(null);
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
    if (dmPanelCache.has(cacheKey)) {
      startTransition(() => {
        setData(dmPanelCache.get(cacheKey) ?? null);
        setError(null);
      });
    }
    const existingRequest = dmPanelInflight.get(cacheKey);
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
          if (
            attempt === 0 &&
            isLikelyConnectionFailure(err)
          ) {
            await new Promise((r) => setTimeout(r, 1200));
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
            : "Unable to load DMs."
        );
      });
      return null;
    } finally {
      dmPanelInflight.delete(cacheKey);
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
      mediaDescriptions?: string[]
    ) => {
      if (!prospectId) {
        throw new Error("Missing prospect.");
      }
      const result = await sendDmMessage({
        prospectId: prospectId as Id<"prospects">,
        conversationId: data?.conversationId,
        text,
        mediaUrls,
        mediaDescriptions,
        actionRequestId: actionRequestId
          ? (actionRequestId as Id<"agentActionRequests">)
          : undefined,
      });
      dmPanelCache.delete(cacheKey);
      await refetch();
      return result;
    },
    [
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
    dmPanelCache.delete(cacheKey);
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
                    (url, index): XDmAttachmentSummary => ({
                      type: "media",
                      url,
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
