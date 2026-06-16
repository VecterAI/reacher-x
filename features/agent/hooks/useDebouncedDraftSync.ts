"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/shared/lib/logger";

type DraftSyncStatus = "idle" | "saving" | "error";
const draftSyncLogger = logger.withScope("useDebouncedDraftSync");

export function useDebouncedDraftSync(args: {
  enabled: boolean;
  value: string;
  persistedValue: string;
  onSave: (nextValue: string) => Promise<void>;
  delayMs?: number;
}) {
  const { enabled, value, persistedValue, onSave, delayMs = 400 } = args;
  const [status, setStatus] = useState<DraftSyncStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistedValueRef = useRef(persistedValue);
  const queuedValueRef = useRef(value);
  const lastAttemptedValueRef = useRef<string | null>(null);
  const statusResetFrameRef = useRef<number | null>(null);

  useEffect(() => {
    persistedValueRef.current = persistedValue;
  }, [persistedValue]);

  useEffect(() => {
    queuedValueRef.current = value;
  }, [value]);

  const clearPendingTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleIdleStatus = useCallback(() => {
    if (statusResetFrameRef.current !== null) {
      cancelAnimationFrame(statusResetFrameRef.current);
    }

    statusResetFrameRef.current = requestAnimationFrame(() => {
      setStatus("idle");
      statusResetFrameRef.current = null;
    });
  }, []);

  const flush = useCallback(async () => {
    if (!enabled) {
      return;
    }

    const nextValue = queuedValueRef.current;
    if (
      nextValue === persistedValueRef.current ||
      nextValue === lastAttemptedValueRef.current
    ) {
      setStatus("idle");
      return;
    }

    setStatus("saving");
    lastAttemptedValueRef.current = nextValue;

    try {
      await onSave(nextValue);
      persistedValueRef.current = nextValue;
      setStatus("idle");
    } catch (error) {
      draftSyncLogger.error("Draft autosave failed", error);
      setStatus("error");
      lastAttemptedValueRef.current = null;
      throw error;
    }
  }, [enabled, onSave]);

  useEffect(() => {
    if (!enabled) {
      clearPendingTimer();
      scheduleIdleStatus();
      return;
    }

    if (value === persistedValueRef.current) {
      clearPendingTimer();
      if (status !== "saving") {
        scheduleIdleStatus();
      }
      return;
    }

    clearPendingTimer();
    timerRef.current = setTimeout(() => {
      void flush();
    }, delayMs);

    return clearPendingTimer;
  }, [
    clearPendingTimer,
    delayMs,
    enabled,
    flush,
    scheduleIdleStatus,
    status,
    value,
  ]);

  useEffect(
    () => () => {
      clearPendingTimer();
      if (statusResetFrameRef.current !== null) {
        cancelAnimationFrame(statusResetFrameRef.current);
      }
    },
    [clearPendingTimer]
  );

  const flushNow = useCallback(async () => {
    clearPendingTimer();
    await flush();
  }, [clearPendingTimer, flush]);

  return {
    status,
    flushNow,
  };
}
