import type { UsageCharge } from "./spend";
import type { Candidate, EntityType, LearningCondition } from "./types";

/** Non-secret settings only. Never snapshot a complete environment into run output. */
export type DevelopmentRuntimeSnapshot = Readonly<{
  deployment: `dev:${string}`;
  models: {
    planning: string;
    qualification: string;
    enrichment: string;
    lessons: string;
    embeddings: string;
  };
  autonomousJobsPaused: boolean;
  automaticCycles: boolean;
  cycleGapMinutes: number;
  effectivePoolLimits: {
    workflow: number;
    qualification: number;
    enrichment: number;
    memory: number;
    tenantExecution: number;
  };
}>;

export type BenchmarkWorkspace = Readonly<{
  workspaceId: string;
  runId: string;
  taskId: string;
  entityType: EntityType;
}>;

/** Future implementation uses the authenticated Convex CLI, with secrets on stdin. */
export interface ReacherXDriver {
  readonly deployment: `dev:${string}`;
  snapshotRuntime(): Promise<DevelopmentRuntimeSnapshot>;
  restoreRuntime(snapshot: DevelopmentRuntimeSnapshot): Promise<void>;
  // Preparation must not start discovery before the learning condition is applied.
  prepare(args: {
    runId: string;
    taskId: string;
    prompt: string;
    userId: string;
    entityType: EntityType;
  }): Promise<BenchmarkWorkspace>;
  setLearning(
    workspace: BenchmarkWorkspace,
    condition: LearningCondition
  ): Promise<void>;
  start(workspace: BenchmarkWorkspace): Promise<void>;
  status(workspace: BenchmarkWorkspace): Promise<{
    completedCycles: number;
    pendingQualifications: number;
    pendingLessonWrites: number;
    running: boolean;
    sampleTruncated: boolean;
  }>;
  exportCandidates(workspace: BenchmarkWorkspace): Promise<{
    candidates: Candidate[];
    charges: UsageCharge[];
    sampleTruncated: boolean;
  }>;
  // Stop monitors and pause jobs before restoring funded provider keys. No deletion.
  stop(
    workspace: BenchmarkWorkspace
  ): Promise<{ monitorsDeleted: boolean; jobsPaused: boolean }>;
}
