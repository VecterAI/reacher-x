import type { Doc } from "../_generated/dataModel";
import { getLearningTargetingFingerprint } from "./learningTargetingHelpers";

export function assertWorkspaceRequalificationReady(
  workspace: Doc<"workspaces"> | null,
  fingerprint: string
) {
  if (!workspace) throw new Error("Workspace not found");
  if (workspace.deletionWorkflowId)
    throw new Error("Workspace is being deleted");
  if (getLearningTargetingFingerprint(workspace) !== fingerprint)
    throw new Error(
      "Workspace targeting changed; preview requalification again"
    );
  if (
    workspace.prospectingWorkflowStatus !== "paused" &&
    workspace.prospectingWorkflowStatus !== "stopped"
  )
    throw new Error("Pause and drain discovery before requalification");
  return workspace;
}

export function getRequalificationSkipReason(
  prospect: Doc<"prospects">,
  fingerprint: string,
  hasPlan: boolean
): string | null {
  if (prospect.origin === "setup_preview") return "setup_preview";
  if (prospect.status !== "new" || hasPlan) return "outreach_or_archived";
  if (prospect.qualificationWorkflowId || prospect.enrichmentWorkflowId)
    return "active_workflow";
  if (
    prospect.qualificationTargetingFingerprint === fingerprint &&
    (prospect.qualificationStatus === "qualified" ||
      prospect.qualificationStatus === "disqualified")
  )
    return "already_current";
  return null;
}

// Match the existing audit application workload bound; larger workspaces resume by cursor.
export const MAX_REQUALIFICATION_PROSPECTS = 1_000;
