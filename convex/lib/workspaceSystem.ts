import { DISCOVERY_CONFIGURATION_MESSAGE } from "../../shared/lib/workspaceStatusCopyHelpers";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type {
  ProspectingWorkflowPauseReason,
  WorkspaceSystemActionKind,
  WorkspaceSystemDiscoveryState,
  WorkspaceSystemMode,
  WorkspaceFeatureStatus,
} from "../../shared/lib/workspaceSystem";
import { INACTIVITY_PAUSE_AFTER_MS } from "../../shared/lib/workspaceSystem";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { hasRequiredWorkspaceAgentData } from "./workspaceSetup";

type WorkspaceIssueReason =
  | "search_configuration_missing"
  | "setup_incomplete"
  | "icp_refresh_required"
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
  features: WorkspaceFeatureStatus[];
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

  if (workspace.onboardingIssueStatusCode === "search_configuration_missing")
    return "search_configuration_missing";

  if (workspace.onboardingIssueStatusCode === "icp_refresh_required") {
    return "icp_refresh_required";
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
  now = getCurrentUTCTimestamp()
): boolean {
  if (workspace.prospectingWorkflowStatus !== "running") {
    return false;
  }

  if (typeof workspace.lastMeaningfulActivityAt !== "number") {
    return false;
  }

  return now - workspace.lastMeaningfulActivityAt >= INACTIVITY_PAUSE_AFTER_MS;
}

function getBaseFeatureStatus(
  workspace: WorkspaceDoc
): WorkspaceFeatureStatus["status"] {
  const workflowStatus = workspace.prospectingWorkflowStatus ?? "stopped";
  if (workflowStatus === "paused" || workflowStatus === "stopped") {
    return "paused";
  }
  if (deriveWorkspaceIssueReason(workspace) === "workflow_failed") {
    return "unavailable";
  }
  return "healthy";
}

export async function getWorkspaceFeatureStatuses(
  db: WorkspaceSystemDb,
  workspace: WorkspaceDoc
): Promise<WorkspaceFeatureStatus[]> {
  const [circuits, xAccount, linkedinAccount] = await Promise.all([
    db.query("providerCircuitStates").collect(),
    db
      .query("xAccounts")
      .withIndex("by_user", (q) => q.eq("userId", workspace.userId))
      .first(),
    db
      .query("linkedinAccounts")
      .withIndex("by_user", (q) => q.eq("userId", workspace.userId))
      .first(),
  ]);
  const socialApiCircuit = circuits.find(
    (circuit) => circuit.provider === "socialapi"
  );
  const exaCircuit = circuits.find((circuit) => circuit.provider === "exa");
  const socialApiUnavailable =
    socialApiCircuit?.status === "open" ||
    socialApiCircuit?.status === "half_open";
  const exaUnavailable =
    exaCircuit?.status === "open" || exaCircuit?.status === "half_open";
  const baseStatus = getBaseFeatureStatus(workspace);
  const planningUnavailable = socialApiUnavailable || exaUnavailable;
  const xHasRecentError = Boolean(
    xAccount?.lastRefreshError &&
    (xAccount.lastRefreshAttemptAt ?? 0) > (xAccount.lastVerifiedAt ?? 0)
  );
  const xStatus: WorkspaceFeatureStatus["status"] = socialApiUnavailable
    ? "degraded"
    : !xAccount || xAccount.status === "disconnected"
      ? "paused"
      : xAccount.status === "connected"
        ? xHasRecentError
          ? "degraded"
          : "healthy"
        : "unavailable";
  const linkedinHasRecentError = Boolean(
    linkedinAccount?.lastSyncError &&
    (linkedinAccount.lastSyncAttemptAt ?? 0) >
      (linkedinAccount.lastSyncedAt ?? 0)
  );
  const linkedinStatus: WorkspaceFeatureStatus["status"] =
    !linkedinAccount || linkedinAccount.status === "disconnected"
      ? "paused"
      : linkedinAccount.status === "connected"
        ? linkedinHasRecentError
          ? "degraded"
          : "healthy"
        : linkedinAccount.status === "connecting"
          ? "degraded"
          : "unavailable";

  return [
    {
      key: "discovery",
      label: "Discovery",
      status: baseStatus,
      detail:
        baseStatus === "healthy"
          ? "New prospects are being found."
          : "New prospect discovery is not fully available.",
    },
    {
      key: "qualification",
      label: "Qualification",
      status: baseStatus,
      detail:
        baseStatus === "healthy"
          ? "Prospects are being scored."
          : "Prospect scoring is not fully available.",
    },
    {
      key: "enrichment",
      label: "Enrichment",
      status: baseStatus,
      detail:
        baseStatus === "healthy"
          ? "Prospect details are being updated."
          : "Prospect details are not being fully updated.",
    },
    {
      key: "plan_creation",
      label: "Plan creation",
      status: planningUnavailable ? "unavailable" : baseStatus,
      detail: planningUnavailable
        ? "Plan creation is paused while a required service recovers."
        : "Outreach plans can be created.",
    },
    {
      key: "x_twitter",
      label: "X/Twitter",
      status: xStatus,
      detail: socialApiUnavailable
        ? "Some X/Twitter updates are temporarily unavailable."
        : xStatus === "healthy"
          ? "X/Twitter features are available."
          : xStatus === "paused"
            ? "X/Twitter is not connected for this workspace."
            : xStatus === "degraded"
              ? "Some X/Twitter updates are delayed."
              : "X/Twitter needs to be reconnected.",
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      status: linkedinStatus,
      detail:
        linkedinStatus === "healthy"
          ? "LinkedIn features are available."
          : linkedinStatus === "paused"
            ? "LinkedIn is not connected for this workspace."
            : linkedinStatus === "degraded"
              ? "Some LinkedIn updates are delayed."
              : "LinkedIn needs attention.",
    },
    {
      key: "outreach",
      label: "Outreach",
      status: baseStatus === "unavailable" ? "degraded" : baseStatus,
      detail:
        baseStatus === "healthy"
          ? "Outreach workflows are available."
          : "Some outreach work is temporarily unavailable.",
    },
  ];
}

export async function getWorkspaceDiscoveryState(
  db: WorkspaceSystemDb,
  workspace: WorkspaceDoc
): Promise<WorkspaceSystemDiscoveryState> {
  if (workspace.prospectingWorkflowStatus === "running") {
    return "active";
  }

  const issueReason = deriveWorkspaceIssueReason(workspace);
  if (
    issueReason !== "workflow_failed" &&
    issueReason !== "icp_refresh_required"
  ) {
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
    featureStatuses?: WorkspaceFeatureStatus[];
  }
): WorkspaceSystemStatus {
  const workflowStatus = workspace.prospectingWorkflowStatus ?? "stopped";
  const issueReason = deriveWorkspaceIssueReason(workspace);
  const discoveryState =
    options?.discoveryState ??
    (workflowStatus === "running" ? "active" : "paused");
  const pauseReason = workspace.prospectingWorkflowPauseReason ?? null;
  const treatStoppedAsPaused =
    workflowStatus === "stopped" && issueReason === null;
  const features = options?.featureStatuses ?? [];
  const hasFeatureIssue = features.some(
    (feature) =>
      feature.status === "degraded" || feature.status === "unavailable"
  );

  if (issueReason === "search_configuration_missing") {
    return {
      workspaceId: String(workspace._id),
      mode: "attention",
      workflowStatus,
      discoveryState: "paused",
      pauseReason: null,
      issueReason,
      canResume: false,
      label: "Search unavailable",
      tooltip: DISCOVERY_CONFIGURATION_MESSAGE,
      dialogTitle: "Search needs attention",
      dialogDescription: DISCOVERY_CONFIGURATION_MESSAGE,
      actionLabel: "Retry",
      actionKind: "retry",
      features,
    };
  }

  if (
    workflowStatus === "running" &&
    issueReason === null &&
    !hasFeatureIssue
  ) {
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
      features,
    };
  }

  if (workflowStatus === "running" && issueReason === null && hasFeatureIssue) {
    return {
      workspaceId: String(workspace._id),
      mode: "degraded",
      workflowStatus,
      discoveryState,
      pauseReason: null,
      issueReason: null,
      canResume: false,
      label: "Limited",
      tooltip: "△ Agent is running with limited availability",
      dialogTitle: "△ Agent is running with limited availability",
      dialogDescription:
        "Some work is delayed while the affected service recovers automatically.",
      actionLabel: null,
      actionKind: null,
      features,
    };
  }

  if (workflowStatus === "running" && issueReason === "icp_refresh_required") {
    return {
      workspaceId: String(workspace._id),
      mode: "degraded",
      workflowStatus,
      discoveryState,
      pauseReason: null,
      issueReason,
      canResume: false,
      label: "Refreshing",
      tooltip: "△ Agent is refreshing profile targeting",
      dialogTitle: "△ Agent is refreshing profile targeting",
      dialogDescription:
        "Updated profile targeting is being prepared automatically while discovery continues where possible.",
      actionLabel: null,
      actionKind: null,
      features,
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
      features,
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
      features,
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
      tooltip: "Qualified prospect limit reached",
      dialogTitle: "Qualified prospect limit reached",
      dialogDescription:
        "Discovery is paused because this workspace reached its qualified prospect limit for the current billing cycle. Upgrade to resume discovery.",
      actionLabel: "View plans",
      actionKind: "view_plans",
      features,
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
      features,
    };
  }

  if (issueReason === "icp_refresh_required") {
    return {
      workspaceId: String(workspace._id),
      mode: "attention",
      workflowStatus,
      discoveryState,
      pauseReason: null,
      issueReason,
      canResume: false,
      label: "Refreshing",
      tooltip: "△ Agent is refreshing profile targeting",
      dialogTitle: "Refreshing profile targeting",
      dialogDescription:
        "Updated profile targeting is being prepared automatically. Discovery will resume when refresh completes.",
      actionLabel: null,
      actionKind: null,
      features,
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
    features,
  };
}
