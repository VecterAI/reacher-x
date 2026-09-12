"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import type { Infer } from "convex/values";
import { useConvexAuth } from "convex/react";
import { usePathname } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { workspacePlanUsageValidator } from "@/convex/validators";
import {
  usePreferredShellQueryArgs,
  useQueryWithStatus,
  useReportingQueryNow,
} from "@/shared/hooks";

export type WorkspacePlanUsage = Infer<typeof workspacePlanUsageValidator>;
const WorkspacePlanUsageContext = createContext<{
  usage: WorkspacePlanUsage | null;
  available: boolean;
  unavailable: boolean;
}>({ usage: null, available: false, unavailable: false });

export function WorkspacePlanUsageProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { isAuthenticated } = useConvexAuth();
  const pathname = usePathname();
  const shellArgs = usePreferredShellQueryArgs();
  const shell = useQueryWithStatus(
    api.shell.getAppShellState,
    isAuthenticated ? shellArgs : "skip"
  );
  const { queryNowMs, refreshQueryNowMs } = useReportingQueryNow();
  const workspaceId =
    shell.data?.activeContextType === "workspace"
      ? (shell.data.workspaceSystemStatus?.workspaceId as
          | Id<"workspaces">
          | undefined)
      : null;
  const available = Boolean(workspaceId) && pathname !== "/agent/setup";
  const query = useQueryWithStatus(
    api.workspacePlanUsage.getCurrent,
    available && workspaceId ? { workspaceId, nowMs: queryNowMs } : "skip"
  );
  // Keep the current workspace's notice mounted during clock refreshes.
  // A workspace change, denied query, or sign-out must never reuse its data.
  const scope = available ? workspaceId : null;
  const data = query.isError ? null : query.data;
  const [resolved, setResolved] = useState({ scope, data });
  if (
    resolved.scope !== scope ||
    (data !== undefined && data !== resolved.data)
  ) {
    setResolved({ scope, data });
  }
  const usage = available
    ? (data ??
      (data === undefined && resolved.scope === scope ? resolved.data : null) ??
      null)
    : null;
  const cycleEnd = usage?.cycleEnd;
  useEffect(() => {
    // Convex keeps usage live. Only change the query clock after a missed reset,
    // rather than unloading the query on every window focus.
    const refreshWhenVisible = () => {
      if (
        document.visibilityState === "visible" &&
        cycleEnd !== undefined &&
        queryNowMs < cycleEnd &&
        getCurrentUTCTimestamp() >= cycleEnd
      ) {
        refreshQueryNowMs();
      }
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [cycleEnd, queryNowMs, refreshQueryNowMs]);
  useEffect(() => {
    // Paid cycles can end between the reporting hook's hourly refreshes.
    const delay =
      cycleEnd === undefined ? null : cycleEnd + 1 - getCurrentUTCTimestamp();
    const timer =
      delay !== null && delay >= 0 && delay <= 2_147_483_647
        ? window.setTimeout(refreshQueryNowMs, delay)
        : undefined;
    return () => {
      window.clearTimeout(timer);
    };
  }, [cycleEnd, refreshQueryNowMs]);
  const value = useMemo(
    () => ({
      usage,
      available,
      unavailable: query.isError,
    }),
    [available, usage, query.isError]
  );
  return (
    <WorkspacePlanUsageContext.Provider value={value}>
      {children}
    </WorkspacePlanUsageContext.Provider>
  );
}

export function useWorkspacePlanUsage() {
  return useContext(WorkspacePlanUsageContext);
}
