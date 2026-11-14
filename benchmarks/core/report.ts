import type { UsageSummary } from "./spend";
import type { ProportionEstimate } from "./stats";
import type { EntityType } from "./types";

export type SpeedObservation = Readonly<{
  requestLatencyMs: number;
  firstVerifiedMatchMs: number | null;
  fifthVerifiedMatchMs: number | null;
  activeProcessingMs: number;
  scheduledWaitMs: number;
}>;

/** Public output contains aggregates, never candidate identities or evidence text. */
export type AggregateReport = Readonly<{
  runId: string;
  planSha256: string;
  rows: readonly {
    taskId: string;
    category: string;
    entityType: EntityType;
    toolId: string;
    returned: number;
    verifiedMatches: number;
    precision: ProportionEstimate;
    speed: SpeedObservation;
    usage: UsageSummary;
  }[];
}>;

export interface ReportRenderer {
  markdown(report: AggregateReport): string;
  json(report: AggregateReport): string;
}
