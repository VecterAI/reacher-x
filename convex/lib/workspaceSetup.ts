import type { Doc } from "../_generated/dataModel";

type WorkspaceAgentSetupFields = Pick<
  Doc<"workspaces">,
  "description" | "improvedDescription" | "icps"
>;
type WorkspaceSetupCompletionFields = Pick<
  Doc<"workspaces">,
  "setupCompletedAt"
>;
type ReportableWorkspaceFields = WorkspaceSetupCompletionFields &
  Pick<Doc<"workspaces">, "deletionWorkflowId">;

type WorkspaceWithRequiredAgentData<T extends WorkspaceAgentSetupFields> = T & {
  improvedDescription: string;
  icps: NonNullable<Doc<"workspaces">["icps"]>;
};
type WorkspaceWithCompletedSetup<T extends WorkspaceSetupCompletionFields> =
  T & {
    setupCompletedAt: number;
  };

export function isWorkspaceSetupCompleted<
  T extends WorkspaceSetupCompletionFields | null | undefined,
>(
  workspace: T
): workspace is WorkspaceWithCompletedSetup<Exclude<T, null | undefined>> {
  return typeof workspace?.setupCompletedAt === "number";
}

export function filterCompletedWorkspaces<
  T extends WorkspaceSetupCompletionFields,
>(workspaces: readonly T[]): Array<WorkspaceWithCompletedSetup<T>> {
  return workspaces.filter(
    (workspace): workspace is WorkspaceWithCompletedSetup<T> =>
      isWorkspaceSetupCompleted(workspace)
  );
}

export function filterReportableWorkspaces<T extends ReportableWorkspaceFields>(
  workspaces: readonly T[]
): Array<WorkspaceWithCompletedSetup<T>> {
  return filterCompletedWorkspaces(workspaces).filter(
    (workspace) => workspace.deletionWorkflowId === undefined
  );
}

export function countCompletedWorkspaces(
  workspaces: readonly WorkspaceSetupCompletionFields[]
): number {
  return filterCompletedWorkspaces(workspaces).length;
}

export function hasRequiredWorkspaceAgentData<
  T extends WorkspaceAgentSetupFields | null | undefined,
>(
  workspace: T
): workspace is WorkspaceWithRequiredAgentData<Exclude<T, null | undefined>> {
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
