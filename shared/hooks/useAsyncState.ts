/**
 * Shared hook utilities for common async state patterns
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "../lib/logger";

interface AsyncResult<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

export function useAsyncState<T>(operation: () => Promise<T>): AsyncResult<T> {
  const [result, setResult] = useState<AsyncResult<T>>({
    data: null,
    error: null,
    loading: true,
  });

  const isMountedRef = useRef(true);

  const run = useCallback(async () => {
    setResult((prev) => ({ ...prev, loading: true }));

    try {
      const data = await operation();
      if (isMountedRef.current)
        setResult({ data, error: null, loading: false });
      return data;
    } catch (err) {
      if (isMountedRef.current)
        setResult({ data: null, error: err as Error, loading: false });

      // Log full error details for debugging
      if (process.env.NODE_ENV === "development") {
        logger.error("useAsyncOperation error:", err);
      }
      return null;
    }
  }, [operation]);

  useEffect(() => {
    void run();
    return () => {
      isMountedRef.current = false;
    };
  }, [run]);

  return result;
}
