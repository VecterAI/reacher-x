import type { EvidenceProvider } from "./evidence";
import { primaryIdentity } from "./identity";
import {
  buildBlindInput,
  evaluateWithPanel,
  type BlindInput,
  type JudgeCaller,
  type PanelModels,
  type PanelResult,
} from "./judges";
import { newestCitedEvidenceAgeDays } from "../analysis/metrics";
import type { ArtifactReference, BenchmarkTask, Candidate } from "../types";

/**
 * Private record of one judged result. It links the opaque case ID back to the
 * tool and source; it stays in the git-ignored run folder and never reaches a
 * judge or a public report.
 */
export type CaseRecord = Readonly<{
  caseId: string;
  taskId: string;
  toolId: string;
  sourceId: string;
  rank: number;
  identity: string | null;
  webEvidence: Readonly<{
    searchesUsed: 0 | 1 | 2;
    receipt: ArtifactReference;
  }> | null;
  input: BlindInput;
  panel: PanelResult;
  newestCitedEvidenceAgeDays: number | null;
}>;

export type JudgingDependencies = Readonly<{
  models: PanelModels;
  call: JudgeCaller;
  // Omitted only when judging on the result's own evidence is intended.
  evidence?: EvidenceProvider;
}>;

/** Proposal 5.3 step 4: web evidence, then the blind panel with a tie-break on disagreement. */
export async function judgeCandidate(
  task: BenchmarkTask,
  toolId: string,
  candidate: Candidate,
  dependencies: JudgingDependencies
): Promise<CaseRecord> {
  const collected = dependencies.evidence
    ? await dependencies.evidence.collect(candidate.entity, task)
    : null;
  const input = buildBlindInput(task, candidate, collected?.evidence ?? []);
  const panel = await evaluateWithPanel(
    input,
    dependencies.models,
    dependencies.call
  );
  return {
    caseId: input.caseId,
    taskId: task.id,
    toolId,
    sourceId: candidate.sourceId,
    rank: candidate.rank,
    identity: primaryIdentity(candidate.entity),
    webEvidence: collected
      ? { searchesUsed: collected.searchesUsed, receipt: collected.receipt }
      : null,
    input,
    panel,
    newestCitedEvidenceAgeDays: newestCitedEvidenceAgeDays(input, panel),
  };
}
