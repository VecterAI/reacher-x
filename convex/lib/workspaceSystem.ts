import type { Doc } from "../_generated/dataModel";
import type {
  ProspectingWorkflowPauseReason,
  WorkspaceSystemActionKind,
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

export function deriveWorkspaceSystemStatus(
  workspace: WorkspaceDoc
): WorkspaceSystemStatus {
  const workflowStatus = workspace.prospectingWorkflowStatus ?? "stopped";
  const issueReason = deriveWorkspaceIssueReason(workspace);
  const pauseReason = workspace.prospectingWorkflowPauseReason ?? null;
  const treatStoppedAsPaused =
    workflowStatus === "stopped" && issueReason === null;

  if (workflowStatus === "running" && issueReason === null) {
    return {
      workspaceId: String(workspace._id),
      mode: "running",
      workflowStatus,
      pauseReason: null,
      issueReason: null,
      canResume: false,
      label: "Running",
      tooltip: "∆ Agent is active",
      dialogTitle: "∆ Agent is active",
      dialogDescription:
        "∆ Agent is actively discovering and qualifying prospects.",
      actionLabel: null,
      actionKind: null,
    };
  }

  if (workflowStatus === "paused" || treatStoppedAsPaused) {
    const inactivePause = pauseReason === "inactive";
    return {
      workspaceId: String(workspace._id),
      mode: "paused",
      workflowStatus,
      pauseReason,
      issueReason: null,
      canResume: true,
      label: "Paused",
      tooltip: inactivePause
        ? "∆ Agent paused due to inactivity"
        : "∆ Agent is paused",
      dialogTitle: "∆ Agent is paused",
      dialogDescription: inactivePause
        ? "Paused due to inactivity. Resume to continue discovery."
        : "∆ Agent is paused. Resume to continue discovery.",
      actionLabel: "Resume ∆ Agent",
      actionKind: "resume",
    };
  }

  if (issueReason === "limit_reached") {
    return {
      workspaceId: String(workspace._id),
      mode: "attention",
      workflowStatus,
      pauseReason: null,
      issueReason,
      canResume: false,
      label: "Attention",
      tooltip: "Prospecting limit reached",
      dialogTitle: "Prospecting limit reached",
      dialogDescription:
        "Prospecting is paused until you increase capacity or free up space.",
      actionLabel: "View plans",
      actionKind: "view_plans",
    };
  }

  if (issueReason === "setup_incomplete") {
    return {
      workspaceId: String(workspace._id),
      mode: "attention",
      workflowStatus,
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
    pauseReason: null,
    issueReason: "workflow_failed",
    canResume: false,
    label: "Attention",
    tooltip: "∆ Agent needs attention",
    dialogTitle: "∆ Agent needs attention",
    dialogDescription:
      "∆ Agent hit an issue and needs a retry before it can continue.",
    actionLabel: "Try again",
    actionKind: "retry",
  };
}
