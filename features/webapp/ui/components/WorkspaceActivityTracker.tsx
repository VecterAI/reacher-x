"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { usePathname } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQueryWithStatus } from "@/shared/hooks";
import { ACTIVITY_HEARTBEAT_THROTTLE_MS } from "@/shared/lib/workspaceSystem";

const SETUP_ROUTE = "/agent/setup";

export function WorkspaceActivityTracker() {
  const pathname = usePathname();
  const shellStateQuery = useQueryWithStatus(api.shell.getAppShellState, {});
  const recordWorkspaceActivity = useMutation(
    api.workspaces.recordWorkspaceActivity
  );
  const lastSentAtRef = useRef(0);
  const inFlightRef = useRef(false);

  const workspaceId =
    shellStateQuery.data?.activeContextType === "workspace"
      ? (shellStateQuery.data.workspaceSystemStatus?.workspaceId ?? null)
      : null;
  const enabled = Boolean(workspaceId) && pathname !== SETUP_ROUTE;

  useEffect(() => {
    if (!enabled) {
      lastSentAtRef.current = 0;
      return;
    }

    async function sendActivity() {
      if (!workspaceId || inFlightRef.current) {
        return;
      }

      const now = Date.now();
      if (now - lastSentAtRef.current < ACTIVITY_HEARTBEAT_THROTTLE_MS) {
        return;
      }

      inFlightRef.current = true;
      lastSentAtRef.current = now;

      try {
        await recordWorkspaceActivity({
          workspaceId: workspaceId as Id<"workspaces">,
        });
      } catch (error) {
        console.error(
          "[WorkspaceActivityTracker] Failed to record activity",
          error
        );
        lastSentAtRef.current = 0;
      } finally {
        inFlightRef.current = false;
      }
    }

    const handlePointer = () => {
      void sendActivity();
    };
    const handleKeyDown = () => {
      void sendActivity();
    };
    const handleFocus = () => {
      void sendActivity();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void sendActivity();
      }
    };

    void sendActivity();
    window.addEventListener("pointerdown", handlePointer, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pointerdown", handlePointer);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, pathname, recordWorkspaceActivity, workspaceId]);

  return null;
}
