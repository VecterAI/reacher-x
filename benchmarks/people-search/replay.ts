import type {
  QualificationCoreParams,
  QualificationResult,
} from "../../convex/lib/qualificationCore";
import type { ArtifactReference, LearningCondition } from "../core/types";

// Keep inputs aligned with the production function; telemetry belongs to execution, not fixtures.
export type FrozenQualificationInput = Omit<
  QualificationCoreParams,
  "telemetry"
>;

export type ReplayCase = Readonly<{
  caseId: string;
  taskId: string;
  referenceDate: string;
  expectedMatch: boolean;
  input: FrozenQualificationInput;
}>;

/** Implement with convex/benchmarkReplay.ts and private dev file storage, not live re-fetching. */
export interface QualificationReplay {
  evaluate(args: {
    frozenDataset: ArtifactReference;
    model: string;
    learning: LearningCondition;
  }): Promise<
    readonly {
      caseId: string;
      result: QualificationResult;
      modelObserved: string;
    }[]
  >;
}
