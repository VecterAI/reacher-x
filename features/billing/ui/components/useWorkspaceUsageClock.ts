"use client";

import { useCallback, useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

/** Server timestamp plus a monotonic anchor for scheduling cycle refreshes. */
export function useWorkspaceUsageClock(enabled: boolean) {
  const getServerTime = useAction(api.workspacePlanUsage.getServerTime);
  const [revision, setRevision] = useState(0);
  const [sync, setSync] = useState<{
    enabled: boolean;
    clock: { nowMs: number; receivedAt: number } | null;
    error: boolean;
  }>({ enabled, clock: null, error: false });
  if (sync.enabled !== enabled) {
    setSync({ enabled, clock: null, error: false });
  }
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void getServerTime({}).then(
      (nowMs) => {
        if (cancelled) return;
        setSync({
          enabled,
          clock: { nowMs, receivedAt: performance.now() },
          error: false,
        });
      },
      () => {
        if (cancelled) return;
        setSync((value) => ({ ...value, error: true }));
      }
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, getServerTime, refresh, revision]);

  useEffect(() => {
    if (!enabled || !sync.error) return;
    const retry = setTimeout(refresh, 60_000);
    return () => clearTimeout(retry);
  }, [enabled, sync, refresh]);

  useEffect(() => {
    if (!enabled) return;
    // Re-sync on return: monotonic clocks may pause during system sleep.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = setInterval(refresh, 3_600_000);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, refresh]);

  return {
    clock: enabled && sync.enabled ? sync.clock : null,
    error: enabled && sync.enabled && sync.error,
    refresh,
  };
}
