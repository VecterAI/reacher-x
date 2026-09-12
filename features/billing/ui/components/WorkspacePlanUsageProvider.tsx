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
import type { Infer } from "convex/values";
import { useConvexAuth } from "convex/react";
import { usePathname } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { workspacePlanUsageValidator } from "@/convex/validators";
import { usePreferredShellQueryArgs, useQueryWithStatus } from "@/shared/hooks";
import { useWorkspaceUsageClock } from "./useWorkspaceUsageClock";

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
  const workspaceId =
    shell.data?.activeContextType === "workspace"
      ? (shell.data.workspaceSystemStatus?.workspaceId as
          | Id<"workspaces">
          | undefined)
      : null;
  const available = Boolean(workspaceId) && pathname !== "/agent/setup";
  const {
    clock,
    error: clockError,
    refresh,
  } = useWorkspaceUsageClock(isAuthenticated && available);
  const query = useQueryWithStatus(
    api.workspacePlanUsage.getCurrent,
    available && workspaceId && clock
      ? { workspaceId, nowMs: clock.nowMs }
      : "skip"
  );
  // Keep the current workspace's notice mounted during clock refreshes.
  // A workspace change, denied query, or sign-out must never reuse its data.
  const scope = available ? workspaceId : null;
  const data = query.isError || clockError ? null : query.data;
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
    // Device wall-clock changes must not move the billing-cycle timer.
    const delay =
      cycleEnd === undefined || !clock || clock.nowMs > cycleEnd
        ? null
        : Math.max(
            0,
            cycleEnd + 1 - clock.nowMs - (performance.now() - clock.receivedAt)
          );
    const timer =
      delay !== null && delay >= 0 && delay <= 2_147_483_647
        ? window.setTimeout(refresh, delay)
        : undefined;
    return () => {
      window.clearTimeout(timer);
    };
  }, [cycleEnd, clock, refresh]);
  const value = useMemo(
    () => ({
      usage,
      available,
      unavailable: query.isError || clockError,
    }),
    [available, usage, query.isError, clockError]
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
