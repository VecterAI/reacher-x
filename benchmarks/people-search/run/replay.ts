import type {
  QualificationCoreParams,
  QualificationResult,
} from "../../../convex/lib/qualificationCore";
import type { ArtifactReference, LearningCondition } from "../../core/types";

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
  expectedMatch: boolean;
  input: FrozenQualificationInput;
  // The policy built from operator instructions only, for the learning-off replay.
  operatorOnlyMemoryPolicy?: string;
}>;

/** Implemented by convex/benchmarkReplay.ts over private dev file storage, never live re-fetching. */
export interface QualificationReplay {
  evaluate(args: {
    frozenDataset: ArtifactReference;
    model: string;
    learning: LearningCondition;
  }): Promise<
    readonly {
      caseId: string;
      result: Pick<QualificationResult, "qualified" | "score" | "reasoning">;
      modelObserved: string;
    }[]
  >;
}
