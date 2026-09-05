import type { Doc } from "../_generated/dataModel";
import {
  getWorkspaceProfileProvenance,
  markWorkspaceProfilesAsAiGenerated,
  normalizeWorkspaceProfiles,
  validateWorkspaceProfiles,
  type WorkspaceProfile,
} from "./workspaceProfileChangeCore";
import { reconcileWorkspaceIcpUpdate } from "./workspaceIcpSignalsCore";
import type { WorkspaceTargetingSpec } from "./targetingSpecCore";

type Workspace = Doc<"workspaces">;

export type PostSaveProspectingMaintenanceResult = {
  deletedKeywordCount: number;
  prospectingRestarted: boolean;
};

function normalizeProfileTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveManualProfilesForTargetingUpdate(args: {
  existingProfiles: WorkspaceProfile[];
  submittedProfiles: WorkspaceProfile[];
}): WorkspaceProfile[] {
  const normalizedSubmittedProfiles = normalizeWorkspaceProfiles(
    args.submittedProfiles
  );
  const reconciliation = reconcileWorkspaceIcpUpdate({
    existingIcps: args.existingProfiles,
    incomingIcps: normalizedSubmittedProfiles,
    markChangedProfilesManual: true,
  });

  return reconciliation.nextIcps.filter(
    (profile) => getWorkspaceProfileProvenance(profile) === "manual"
  );
}

export function mergeRegeneratedWorkspaceProfiles(args: {
  generatedProfiles: WorkspaceProfile[];
  manualProfiles: WorkspaceProfile[];
}): WorkspaceProfile[] {
  const normalizedManualProfiles = normalizeWorkspaceProfiles(
    args.manualProfiles
  ).map((profile) => ({ ...profile, provenance: "manual" as const }));
  const manualTitles = new Set(
    normalizedManualProfiles.map((profile) =>
      normalizeProfileTitle(profile.title)
    )
  );
  const generatedProfiles = markWorkspaceProfilesAsAiGenerated(
    normalizeWorkspaceProfiles(args.generatedProfiles)
  ).filter(
    (profile) => !manualTitles.has(normalizeProfileTitle(profile.title))
  );
  const mergedProfiles = [...generatedProfiles, ...normalizedManualProfiles];

  validateWorkspaceProfiles(mergedProfiles);
  return mergedProfiles;
}

export function buildRegeneratedWorkspaceTargetingPatch(args: {
  improvedDescription: string;
  profiles: WorkspaceProfile[];
  targetingSpec: WorkspaceTargetingSpec;
  rawUserDescription: string;
  useCaseKey: NonNullable<Workspace["useCaseKey"]>;
  updatedAt: number;
}) {
  return {
    rawUserDescription: args.rawUserDescription,
    seedDescription: args.rawUserDescription,
    description: args.improvedDescription,
    improvedDescription: args.improvedDescription,
    descriptionSource: "manual" as const,
    useCaseKey: args.useCaseKey,
    icps: args.profiles,
    targetingSpec: args.targetingSpec,
    lastGeneratedAt: args.updatedAt,
    targetingLearningResetAt: args.updatedAt,
    prospectingBootstrapCycleCount: 0,
    prospectingBootstrapCompletedAt: undefined,
    updatedAt: args.updatedAt,
    onboardingIssueStatusCode: undefined,
    onboardingIssueSource: undefined,
    onboardingIssueUpdatedAt: undefined,
    refineRollbackSnapshot: undefined,
  };
}

export async function runPostSaveProspectingMaintenance(args: {
  clearKeywords: () => Promise<number>;
  onError: (error: unknown) => void;
  restartProspecting: () => Promise<boolean>;
  stopProspecting?: () => Promise<unknown>;
}): Promise<PostSaveProspectingMaintenanceResult> {
  let deletedKeywordCount = 0;

  try {
    await args.stopProspecting?.();
    deletedKeywordCount = await args.clearKeywords();
    const prospectingRestarted = await args.restartProspecting();
    return { deletedKeywordCount, prospectingRestarted };
  } catch (error) {
    args.onError(error);
    return { deletedKeywordCount, prospectingRestarted: false };
  }
}
