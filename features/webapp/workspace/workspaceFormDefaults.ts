import type { Doc } from "@/convex/_generated/dataModel";
import {
  DEFAULT_WORKSPACE_USE_CASE_KEY,
  type WorkspaceUseCaseKey,
} from "@/shared/lib/workspaceUseCases";
import type { WorkspacePageFormValues } from "@/shared/lib/schemas/validation";

export function workspaceDocToFormValues(
  workspace: Doc<"workspaces">
): WorkspacePageFormValues {
  const seed =
    workspace.seedDescription?.trim() || workspace.description?.trim() || "";
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
  }));
  while (icps.length < 3) {
    icps.push({
      title: "",
      description: "",
      painPoints: [],
      channels: [],
    });
  }
  return {
    name: workspace.name ?? "",
    useCaseKey: (workspace.useCaseKey ??
      DEFAULT_WORKSPACE_USE_CASE_KEY) as WorkspaceUseCaseKey,
    seedDescription: seed,
    improvedDescription: improved,
    sourceUrl: workspace.sourceUrl?.trim() ? workspace.sourceUrl : "",
    icps,
  };
}
