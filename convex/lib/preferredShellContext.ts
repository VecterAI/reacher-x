import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { hasRequiredWorkspaceAgentData } from "./workspaceSetup";

export const preferredShellContextValidator = v.optional(
  v.union(v.literal("workspace"), v.literal("setup_session"))
);

export type PreferredShellContext = "workspace" | "setup_session";

export function shouldPreferWorkspaceContext(
  preferredContext: PreferredShellContext | undefined,
  workspace: Doc<"workspaces"> | null
): boolean {
  return (
    preferredContext === "workspace" && hasRequiredWorkspaceAgentData(workspace)
  );
}
