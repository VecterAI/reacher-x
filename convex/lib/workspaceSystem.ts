import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type {
  ProspectingWorkflowPauseReason,
  WorkspaceSystemActionKind,
  WorkspaceSystemDiscoveryState,
  WorkspaceSystemMode,
} from "../../shared/lib/workspaceSystem";
import { INACTIVITY_PAUSE_AFTER_MS } from "../../shared/lib/workspaceSystem";
import { hasRequiredWorkspaceAgentData } from "./workspaceSetup";

type WorkspaceIssueReason =
  | "setup_incomplete"
  | "workflow_failed"
  | "limit_reached"
  | null;

export type WorkspaceSystemStatus = {
  workspaceId: string;
  mode: WorkspaceSystemMode;
  workflowStatus: "running" | "paused" | "stopped" | "limit_reached";
  discoveryState: WorkspaceSystemDiscoveryState;
  pauseReason: ProspectingWorkflowPauseReason | null;
  issueReason: WorkspaceIssueReason;
  canResume: boolean;
  label: string;
  tooltip: string;
  dialogTitle: string;
  dialogDescription: string;
  actionLabel: string | null;
  actionKind: WorkspaceSystemActionKind | null;
};

type WorkspaceDoc = Doc<"workspaces">;
type WorkspaceSystemDb = Pick<QueryCtx, "db">["db"];

function deriveWorkspaceIssueReason(
  workspace: WorkspaceDoc
): WorkspaceIssueReason {
  if (workspace.prospectingWorkflowStatus === "limit_reached") {
    return "limit_reached";
  }

  if (!hasRequiredWorkspaceAgentData(workspace)) {
    return "setup_incomplete";
  }

  if (workspace.onboardingIssueStatusCode === "setup_incomplete") {
    return "setup_incomplete";
  }

  if (workspace.onboardingIssueStatusCode) {
    return "workflow_failed";
  }

  return null;
}

export function isWorkspaceInactive(
  workspace: WorkspaceDoc,
  now = Date.now()
): boolean {
  if (workspace.prospectingWorkflowStatus !== "running") {
    return false;
  }

  if (typeof workspace.lastMeaningfulActivityAt !== "number") {
    return false;
  }

  return now - workspace.lastMeaningfulActivityAt >= INACTIVITY_PAUSE_AFTER_MS;
}

export async function getWorkspaceDiscoveryState(
  db: WorkspaceSystemDb,
  workspace: WorkspaceDoc
): Promise<WorkspaceSystemDiscoveryState> {
  if (workspace.prospectingWorkflowStatus === "running") {
    return "active";
  }

  if (deriveWorkspaceIssueReason(workspace) !== "workflow_failed") {
    return "paused";
  }

  const activeMonitor = await db
    .query("socialQueryMonitors")
    .withIndex("by_workspace_status", (q) =>
      q.eq("workspaceId", workspace._id).eq("status", "active")
    )
    .first();

  return activeMonitor ? "active" : "paused";
}

export function deriveWorkspaceSystemStatus(
  workspace: WorkspaceDoc,
  options?: {
    discoveryState?: WorkspaceSystemDiscoveryState;
  }
): WorkspaceSystemStatus {
  const workflowStatus = workspace.prospectingWorkflowStatus ?? "stopped";
  const issueReason = deriveWorkspaceIssueReason(workspace);
  const discoveryState =
    options?.discoveryState ?? (workflowStatus === "running" ? "active" : "paused");
  const pauseReason = workspace.prospectingWorkflowPauseReason ?? null;
  const treatStoppedAsPaused =
    workflowStatus === "stopped" && issueReason === null;

  if (workflowStatus === "running" && issueReason === null) {
    return {
      workspaceId: String(workspace._id),
      mode: "running",
      workflowStatus,
      discoveryState,
      pauseReason: null,
      issueReason: null,
      canResume: false,
      label: "Running",
      tooltip: "△ Agent is active",
      dialogTitle: "△ Agent is active",
      dialogDescription:
        "△ Agent is actively discovering and qualifying prospects.",
      actionLabel: null,
      actionKind: null,
    };
  }

  if (
    workflowStatus === "running" &&
    issueReason !== null &&
    issueReason !== "limit_reached" &&
    issueReason !== "setup_incomplete"
  ) {
    return {
      workspaceId: String(workspace._id),
      mode: "degraded",
      workflowStatus,
      discoveryState,
      pauseReason: null,
      issueReason,
      canResume: false,
      label: "Degraded",
      tooltip: "△ Agent is still running, but recovery is in progress",
      dialogTitle: "△ Agent is still running",
      dialogDescription:
        "A recoverable issue was detected. The workflow is still running and retrying automatically.",
      actionLabel: "Retry now",
      actionKind: "retry",
    };
  }

  if (workflowStatus === "paused" || treatStoppedAsPaused) {
    const inactivePause = pauseReason === "inactive";
    return {
      workspaceId: String(workspace._id),
      mode: "paused",
      workflowStatus,
      discoveryState,
      pauseReason,
      issueReason: null,
      canResume: true,
      label: "Paused",
      tooltip: inactivePause
        ? "△ Agent paused due to inactivity"
        : "△ Agent is paused",
      dialogTitle: "△ Agent is paused",
      dialogDescription: inactivePause
        ? "Paused due to inactivity. Resume to continue discovery."
        : "△ Agent is paused. Resume to continue discovery.",
      actionLabel: "Resume △ Agent",
      actionKind: "resume",
    };
  }

  if (issueReason === "limit_reached") {
    return {
      workspaceId: String(workspace._id),
      mode: "attention",
      workflowStatus,
      discoveryState,
      pauseReason: null,
      issueReason,
      canResume: false,
      label: "Attention",
      tooltip: "Prospecting limit reached",
      dialogTitle: "Prospecting limit reached",
      dialogDescription:
        "Prospecting is paused because the current plan limit has been reached. Upgrade to resume discovery.",
      actionLabel: "View plans",
      actionKind: "view_plans",
    };
  }

  if (issueReason === "setup_incomplete") {
    return {
      workspaceId: String(workspace._id),
      mode: "attention",
      workflowStatus,
      discoveryState,
      pauseReason: null,
      issueReason,
      canResume: false,
      label: "Attention",
      tooltip: "Workspace setup incomplete",
      dialogTitle: "Complete workspace setup",
      dialogDescription:
        "Finish setup to let the system keep discovering and qualifying prospects.",
      actionLabel: "Open setup",
      actionKind: "open_setup",
    };
  }

  return {
    workspaceId: String(workspace._id),
    mode: "attention",
    workflowStatus,
    discoveryState,
    pauseReason: null,
    issueReason: "workflow_failed",
    canResume: false,
    label: "Attention",
    tooltip:
      discoveryState === "active"
        ? "△ Agent is still active, but needs attention"
        : "△ Agent needs attention",
    dialogTitle:
      discoveryState === "active"
        ? "△ Agent is still active, but needs attention"
        : "△ Agent needs attention",
    dialogDescription:
      discoveryState === "active"
        ? "New prospects can still appear while one part of the agent needs a retry."
        : "△ Agent hit an issue and needs a retry before it can continue.",
    actionLabel: "Try again",
    actionKind: "retry",
  };
}
