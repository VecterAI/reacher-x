import { resolveWorkspaceUseCaseKey } from "../../shared/lib/workspaceUseCases";
import type { Doc } from "../_generated/dataModel";
import { createStableHash } from "./memoryHelpers";

type LearningTarget = Pick<
  Doc<"workspaces">,
  | "description"
  | "rawUserDescription"
  | "useCaseKey"
  | "icps"
  | "targetingSpec"
  | "targetingLearningResetAt"
>;

/** Excludes generated search phrases and operational settings from intent identity. */
export function getLearningTargetingFingerprint(
  workspace: LearningTarget
): string {
  return createStableHash(
    JSON.stringify({
      description: workspace.description,
      rawUserDescription: workspace.rawUserDescription,
      useCaseKey: resolveWorkspaceUseCaseKey(workspace.useCaseKey),
      profiles: workspace.icps?.map(({ title, description, painPoints }) => ({
        title,
        description,
        painPoints,
      })),
      targetingSpec: workspace.targetingSpec && {
        version: workspace.targetingSpec.version,
        summary: workspace.targetingSpec.summary,
        criteria: workspace.targetingSpec.criteria,
      },
    })
  );
}

export function isCurrentTargetingLearning(
  row: {
    targetingFingerprint?: string;
    createdAt?: number;
    _creationTime?: number;
  },
  workspace: LearningTarget
): boolean {
  if (row.targetingFingerprint) {
    return (
      row.targetingFingerprint === getLearningTargetingFingerprint(workspace)
    );
  }
  // Existing records remain usable until an explicit targeting reset. A reset
  // never guesses that unversioned historical lessons describe the new intent.
  return workspace.targetingLearningResetAt === undefined;
}

export function isReusablePipelineLesson(memory: {
  source: string;
  category?: string;
}): boolean {
  return (
    (memory.source === "qualification" &&
      (memory.category === "qualification_win_pattern" ||
        memory.category === "qualification_false_positive_pattern")) ||
    (memory.source === "enrichment" &&
      (memory.category === "enrichment_signal_pattern" ||
        memory.category === "enrichment_role_pattern")) ||
    (memory.source === "outreach" &&
      (memory.category === "outreach_winning_pattern" ||
        memory.category === "outreach_objection_pattern"))
  );
}
