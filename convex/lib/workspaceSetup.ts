import type { Doc } from "../_generated/dataModel";

type WorkspaceAgentSetupFields = Pick<
  Doc<"workspaces">,
  "description" | "improvedDescription" | "icps"
>;

type WorkspaceWithRequiredAgentData = WorkspaceAgentSetupFields & {
  improvedDescription: string;
  icps: NonNullable<Doc<"workspaces">["icps"]>;
};

export function hasRequiredWorkspaceAgentData(
  workspace: WorkspaceAgentSetupFields | null | undefined
): workspace is WorkspaceWithRequiredAgentData {
  if (!workspace) {
    return false;
  }

  const hasDescription = workspace.description.trim().length > 0;
  const hasImprovedDescription =
    typeof workspace.improvedDescription === "string" &&
    workspace.improvedDescription.trim().length > 0;
  const hasIcps = Array.isArray(workspace.icps) && workspace.icps.length > 0;

  return hasDescription && hasImprovedDescription && hasIcps;
}
