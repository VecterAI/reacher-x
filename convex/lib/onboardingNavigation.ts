import type { Doc } from "../_generated/dataModel";
import { isProspectReadyQualifiedEnriched } from "./readModelHelpers";

export type WorkspaceLockState =
  | "no_workspace"
  | "needs_icp"
  | "locked"
  | "ready";

export type UserVisibleOnboardingIssueStatus = "none" | "delayed";

export type UserVisibleOnboardingIssueState = {
  status: UserVisibleOnboardingIssueStatus;
  message: string | null;
};

export const ONBOARDING_DELAYED_SAFE_MESSAGE =
  "Setup is taking longer than expected. We're retrying automatically.";

export function mapInternalIssueCodeToUserVisibleIssueState(
  issueCode?: Doc<"workspaces">["onboardingIssueStatusCode"]
): UserVisibleOnboardingIssueState {
  if (!issueCode) {
    return { status: "none", message: null };
  }
  return { status: "delayed", message: ONBOARDING_DELAYED_SAFE_MESSAGE };
}

export function countReadyQualifiedEnrichedProspects(
  prospects: Array<
    Pick<Doc<"prospects">, "qualificationStatus" | "enrichmentStatus">
  >
): number {
  let count = 0;
  for (const prospect of prospects) {
    if (isProspectReadyQualifiedEnriched(prospect)) {
      count += 1;
    }
  }
  return count;
}

export function deriveWorkspaceLockState(args: {
  hasWorkspace: boolean;
  hasRequiredSetupData: boolean;
  readyCount: number;
}): WorkspaceLockState {
  if (!args.hasWorkspace) return "no_workspace";
  if (!args.hasRequiredSetupData) return "needs_icp";
  if (args.readyCount > 0) return "ready";
  return "locked";
}
