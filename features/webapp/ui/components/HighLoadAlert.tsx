"use client";

import { useEffect, useState } from "react";
import { useConvexAuth, useConvexConnectionState } from "convex/react";
import type { Infer } from "convex/values";
import { usePathname, useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type {
  highLoadNoticeValidator,
  highLoadScopeValidator,
} from "@/convex/validators";
import { usePreferredShellQueryArgs } from "@/shared/hooks/usePreferredShellQueryArgs";
import { useQueryWithStatus } from "@/shared/hooks/useQueryWithStatus";
import { useOnlineStatus } from "@/shared/hooks/useOnlineStatus";
import { isBackendStatusBannerEnabled } from "@/shared/lib/backendStatusBanner";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { HighLoadNotice } from "@/shared/ui/components/HighLoadNotice";
import { X_PROFILE_URL } from "@/features/landing/lib/communityUrls";

type HighLoadScope = Infer<typeof highLoadScopeValidator>;
type Notice = NonNullable<Infer<typeof highLoadNoticeValidator>>;
const NOTICE_DELAY_MS = 5_000;
const NOTICE_RECOVERY_DELAY_MS = 1_000;

/** One mounted episode: state changes don't undo dismissal or restart the delay. */
function HighLoadNoticeEpisode({
  notice,
  capacityPresent,
  onDismiss,
}: {
  notice: Notice;
  capacityPresent: boolean;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [hasShown, setHasShown] = useState(false);
  const [now, setNow] = useState(getCurrentUTCTimestamp);
  if (visible && capacityPresent && !hasShown) setHasShown(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), NOTICE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const refresh = () => setNow(getCurrentUTCTimestamp());
    const timer = window.setTimeout(
      refresh,
      Math.max(0, notice.validUntil - getCurrentUTCTimestamp())
    );
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [notice.validUntil]);
  if (!visible || (!capacityPresent && !hasShown) || now >= notice.validUntil)
    return null;
  return (
    <HighLoadNotice
      state={notice.state}
      helpHref={X_PROFILE_URL}
      onDismiss={onDismiss}
    />
  );
}

/** Scope is keyed by the shell so one workspace never inherits another's notice. */
export function HighLoadAlertForScope({ scope }: { scope: HighLoadScope }) {
  const { isAuthenticated } = useConvexAuth();
  const { isWebSocketConnected } = useConvexConnectionState();
  const online = useOnlineStatus();
  const query = useQueryWithStatus(
    api.tenantScheduler.getHighLoadNotice,
    isAuthenticated ? { scope } : "skip"
  );
  // Completing a job briefly frees a slot before the dispatcher fills it.
  // Keep that handoff from flickering the banner or starving its show timer.
  const [retainedNotice, setRetainedNotice] = useState(query.data ?? null);
  const [dismissed, setDismissed] = useState(false);
  if (query.data && retainedNotice !== query.data) {
    setRetainedNotice(query.data);
  }
  if (!retainedNotice && dismissed) setDismissed(false);
  useEffect(() => {
    if (query.data !== null) return;
    const timer = window.setTimeout(
      () => setRetainedNotice(null),
      NOTICE_RECOVERY_DELAY_MS
    );
    return () => window.clearTimeout(timer);
  }, [query.data]);
  if (
    !isAuthenticated ||
    !online ||
    !isWebSocketConnected ||
    query.isError ||
    query.data === undefined ||
    dismissed ||
    !retainedNotice ||
    isBackendStatusBannerEnabled()
  )
    return null;
  return (
    <HighLoadNoticeEpisode
      notice={retainedNotice}
      capacityPresent={Boolean(query.data)}
      onDismiss={() => setDismissed(true)}
    />
  );
}

export function HighLoadAlert() {
  const { isAuthenticated } = useConvexAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shellArgs = usePreferredShellQueryArgs();
  const shell = useQueryWithStatus(
    api.shell.getAppShellState,
    isAuthenticated ? shellArgs : "skip"
  );
  if (!isAuthenticated || shell.isError || !shell.data) return null;

  if (pathname === "/agent/setup") {
    // The URL wins when viewing an older draft; never use another draft's queue.
    const threadId =
      searchParams.get("threadId") ?? shell.data.activeSetupSession?.threadId;
    return threadId ? (
      <HighLoadAlertForScope
        key={`setup:${threadId}`}
        scope={{ kind: "setup", threadId }}
      />
    ) : null;
  }
  const status = shell.data.workspaceSystemStatus;
  if (
    shell.data.activeContextType !== "workspace" ||
    status?.mode !== "running"
  )
    return null;
  const workspaceId = status.workspaceId as Id<"workspaces">;
  return (
    <HighLoadAlertForScope
      key={`workspace:${workspaceId}`}
      scope={{ kind: "workspace", workspaceId }}
    />
  );
}
