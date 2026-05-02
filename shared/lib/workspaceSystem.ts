export const INACTIVITY_PAUSE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export const ACTIVITY_HEARTBEAT_THROTTLE_MS = 15 * 60 * 1000;

export const SERVER_ACTIVITY_WRITE_DEBOUNCE_MS = 5 * 60 * 1000;

export type ProspectingWorkflowPauseReason = "manual" | "inactive";

export type WorkspaceSystemMode =
  | "running"
  | "degraded"
  | "paused"
  | "attention";

export type WorkspaceSystemActionKind =
  | "resume"
  | "open_setup"
  | "view_plans"
  | "retry";
