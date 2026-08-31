"use client";

import * as React from "react";
import {
  getCurrentUTCTimestamp,
  getDelayUntilNextUtcHour,
} from "@/shared/lib/utils/time/timeUtils";

const BOUNDARY_SETTLE_MS = 1_000;

/**
 * Keeps deterministic Convex query time arguments current across UTC hour
 * boundaries, matching the reporting aggregates' hourly keys.
 */
export function useReportingQueryNow() {
  const [queryNowMs, setQueryNowMs] = React.useState(() =>
    getCurrentUTCTimestamp()
  );

  const refreshQueryNowMs = React.useCallback(() => {
    setQueryNowMs(getCurrentUTCTimestamp());
  }, []);

  React.useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNextRefresh = () => {
      const nowMs = getCurrentUTCTimestamp();
      timeoutId = setTimeout(
        () => {
          refreshQueryNowMs();
          scheduleNextRefresh();
        },
        getDelayUntilNextUtcHour(nowMs, BOUNDARY_SETTLE_MS)
      );
    };

    scheduleNextRefresh();
    return () => clearTimeout(timeoutId);
  }, [refreshQueryNowMs]);

  return { queryNowMs, refreshQueryNowMs };
}
