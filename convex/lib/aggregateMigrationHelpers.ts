import type { Doc } from "../_generated/dataModel";

export function isWorkspaceSafeForAggregateMigration(
  workspace: Pick<
    Doc<"workspaces">,
    "deletionWorkflowId" | "prospectingWorkflowId" | "prospectingWorkflowStatus"
  >
) {
  const hasNeverStartedProspecting =
    workspace.prospectingWorkflowStatus === undefined &&
    workspace.prospectingWorkflowId === undefined;
  return (
    workspace.deletionWorkflowId === undefined &&
    (hasNeverStartedProspecting ||
      (workspace.prospectingWorkflowStatus !== undefined &&
        workspace.prospectingWorkflowStatus !== "running"))
  );
}
