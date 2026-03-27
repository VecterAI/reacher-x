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
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled ?? true;
  const getProspectDmState = useAction(api.x.getProspectDmState);
  const getProspectDmStateRef = useRef(getProspectDmState);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheKey = prospectId ? String(prospectId) : "";

  useEffect(() => {
    getProspectDmStateRef.current = getProspectDmState;
  }, [getProspectDmState]);

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
      const request = getProspectDmStateRef.current({
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
          err instanceof Error ? err.message : "Unable to load DM state."
        );
      });
      return null;
    } finally {
      dmStateInflight.delete(cacheKey);
      setLoading(false);
    }
  }, [cacheKey, enabled, prospectId]);

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
