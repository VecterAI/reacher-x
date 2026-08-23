"use client";

import { useCallback, useState } from "react";

export function useRetryableMediaFailures() {
  const [failedKeys, setFailedKeys] = useState<Set<string>>(() => new Set());
  const [retryingKeys, setRetryingKeys] = useState<Set<string>>(
    () => new Set()
  );

  const markFailed = useCallback((key: string) => {
    setFailedKeys((current) => {
      if (current.has(key)) return current;
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }, []);

  const retry = useCallback(
    async (key: string, retryAction?: () => Promise<void> | void) => {
      setRetryingKeys((current) => {
        const next = new Set(current);
        next.add(key);
        return next;
      });

      try {
        await retryAction?.();
        setFailedKeys((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      } finally {
        setRetryingKeys((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }
    },
    []
  );

  return { failedKeys, markFailed, retry, retryingKeys };
}
