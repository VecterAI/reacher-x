import type { UsageCharge } from "../../core/spend";
import type {
  ArtifactReference,
  BenchmarkTask,
  Candidate,
  EntityType,
} from "../../core/types";

export type TaskCapability =
  | { status: "unverified" }
  | { status: "supported"; documentationUrl: string }
  | { status: "unsupported"; documentationUrl: string; reason: string };

export type AdapterResult = Readonly<{
  candidates: readonly Candidate[];
  charges: readonly UsageCharge[];
  requestLatencyMs: number;
  rawResponse: unknown;
  // Includes native filter translation, endpoint/mode and x-treg-served-by where applicable.
  requestReceipt: ArtifactReference;
}>;

export interface SearchAdapter {
  readonly id: string;
  readonly capabilities: Readonly<Record<EntityType, TaskCapability>>;
  search(
    task: BenchmarkTask,
    topK: 5 | 10,
    signal: AbortSignal
  ): Promise<AdapterResult>;
}
