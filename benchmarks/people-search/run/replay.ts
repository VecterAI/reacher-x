import type {
  QualificationCoreParams,
  QualificationResult,
} from "../../../convex/lib/qualificationCore";
import type {
  ArtifactReference,
  EntityType,
  LearningCondition,
} from "../../core/types";

// Aligned with the production function. Telemetry and routing belong to execution;
// `now` is required so the replay sees the same "today" as the original run.
export type FrozenQualificationInput = Omit<
  QualificationCoreParams,
  "telemetry" | "routing" | "now"
> & { now: number };

export type ReplayCase = Readonly<{
  caseId: string;
  taskId: string;
  referenceDate: string;
  entityType: EntityType;
  // The judges' verified-match verdict for this candidate.
  expectedMatch: boolean;
  // ReacherX's own decision in the original run.
  originalDecision: Readonly<{ qualified: boolean; score: number | null }>;
  input: FrozenQualificationInput;
  // The policy built from operator instructions only, for the learning-off replay.
  operatorOnlyMemoryPolicy?: string;
}>;

export type ReplayOutcome = Readonly<
  {
    caseId: string;
    // The model recorded for the calls of this case's replay batch.
    modelObserved: string;
    latencyMs: number;
  } & (
    | {
        status: "ok";
        result: Pick<QualificationResult, "qualified" | "score" | "reasoning">;
      }
    | { status: "error"; error: string }
  )
>;

/** Implemented by convex/benchmarkReplay.ts over private dev file storage, never live re-fetching. */
export interface QualificationReplay {
  evaluate(args: {
    frozenDataset: ArtifactReference;
    model: string;
    learning: LearningCondition;
  }): Promise<readonly ReplayOutcome[]>;
}
