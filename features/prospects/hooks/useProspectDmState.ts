"use client";

import { useAction } from "convex/react";
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const dmStateCache = new Map<string, unknown>();
const dmStateInflight = new Map<string, Promise<unknown>>();

export function useProspectDmState(
  prospectId?: string,
  options?: { enabled?: boolean; platform?: "twitter" | "linkedin" }
) {
  const enabled = options?.enabled ?? true;
  const platform = options?.platform ?? "twitter";
  const getProspectDmState = useAction(api.x.getProspectDmState);
  const getProspectLinkedInMessageState = useAction(
    ((api as any).linkedin?.getProspectLinkedInMessageState ??
      api.x.getProspectDmState) as any
  );
  const getProspectDmStateRef = useRef(getProspectDmState);
  const getProspectLinkedInMessageStateRef = useRef(
    getProspectLinkedInMessageState
  );
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheKey = prospectId ? `${platform}:${String(prospectId)}` : "";

  useEffect(() => {
    getProspectDmStateRef.current = getProspectDmState;
  }, [getProspectDmState]);

  useEffect(() => {
    getProspectLinkedInMessageStateRef.current =
      getProspectLinkedInMessageState;
  }, [getProspectLinkedInMessageState]);

  const refetch = useCallback(async () => {
    if (!enabled || !prospectId) {
      setData(null);
      setError(null);
      setLoading(false);
      return null;
    }
    if (dmStateCache.has(cacheKey)) {
      startTransition(() => {
        setData(dmStateCache.get(cacheKey) ?? null);
        setError(null);
      });
    }
    const existingRequest = dmStateInflight.get(cacheKey);
    if (existingRequest) {
      setLoading(true);
      const result = await existingRequest;
      startTransition(() => {
        setData(result ?? null);
        setError(null);
        setLoading(false);
      });
      return result;
    }
    try {
      setLoading(true);
      const request =
        platform === "linkedin"
          ? getProspectLinkedInMessageStateRef.current({
              prospectId: prospectId as Id<"prospects">,
            })
          : getProspectDmStateRef.current({
              prospectId: prospectId as Id<"prospects">,
            });
      dmStateInflight.set(cacheKey, request);
      const result = await request;
      dmStateCache.set(cacheKey, result);
      startTransition(() => {
        setData(result);
        setError(null);
      });
      return result;
    } catch (err) {
      startTransition(() => {
        setData(null);
        setError(
          err instanceof Error
            ? err.message
            : platform === "linkedin"
              ? "Unable to load LinkedIn message state."
              : "Unable to load DM state."
        );
      });
      return null;
    } finally {
      dmStateInflight.delete(cacheKey);
      setLoading(false);
    }
  }, [cacheKey, enabled, platform, prospectId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    data,
    loading,
    error,
    refetch,
  };
}
