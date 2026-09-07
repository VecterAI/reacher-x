import type { Doc } from "@/convex/_generated/dataModel";
import {
  DEFAULT_WORKSPACE_USE_CASE_KEY,
  type WorkspaceUseCaseKey,
} from "@/shared/lib/workspaceUseCases";
import type { WorkspacePageFormValues } from "@/shared/lib/schemas/validation";
import { resolveWorkspaceProfileProvenance } from "@/shared/lib/workspaceProfileProvenance";

export function workspaceDocToFormValues(
  workspace: Doc<"workspaces">
): WorkspacePageFormValues {
  const seed =
    (workspace.rawUserDescription?.trim()
      ? workspace.rawUserDescription
      : workspace.seedDescription?.trim()) ||
    workspace.description?.trim() ||
    "";
  const improved =
    workspace.improvedDescription?.trim() ||
    workspace.description?.trim() ||
    "";
  const rawIcps = workspace.icps ?? [];
  const icps = rawIcps.map((icp) => ({
    title: icp.title,
    description: icp.description,
    painPoints: [...icp.painPoints],
    channels: [...icp.channels],
    provenance: resolveWorkspaceProfileProvenance(icp),
  }));
  while (icps.length < 1) {
    icps.push({
      title: "",
      description: "",
      painPoints: [],
      channels: [],
      provenance: "manual",
    });
  }
  return {
    name: workspace.name ?? "",
    useCaseKey: (workspace.useCaseKey ??
      DEFAULT_WORKSPACE_USE_CASE_KEY) as WorkspaceUseCaseKey,
    rawUserDescription: seed,
    improvedDescription: improved,
    sourceUrl: workspace.sourceUrl?.trim() ? workspace.sourceUrl : "",
    icps,
  };
}
