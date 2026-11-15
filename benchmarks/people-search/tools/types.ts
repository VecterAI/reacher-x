import type { Exchange, Transport } from "../../core/calls/http";
import type { ModelExchange, StepCall } from "../../core/calls/llm";
import type { UsageUnits } from "../../core/calls/rates";
import type { BenchmarkTask, Candidate, EntityType } from "../../core/types";
import type { FilterSet } from "../setup/filters";

export type TaskCapability =
  | { status: "unverified" }
  | { status: "supported"; documentationUrl: string }
  | { status: "unsupported"; documentationUrl: string; reason: string };

/** Everything needed to review or replay a search; no secrets, no judging data. */
export type RequestReceipt = Readonly<{
  toolId: string;
  taskId: string;
  endpoints: readonly string[];
  // Native filters sent, and the shared filter requirements this tool could not express.
  nativeFilters: unknown;
  unexpressed: readonly string[];
  // Provider that actually served a routed call (Treg's served-by header), per step.
  servedBy: Readonly<Record<string, string>>;
  notes: readonly string[];
}>;

export type AdapterResult = Readonly<{
  candidates: readonly Candidate[];
  usage: readonly UsageUnits[];
  // Sum of request latencies, and time until results were usable (including lookups).
  requestLatencyMs: number;
  completedAfterMs: number;
  exchanges: readonly Exchange[];
  modelCalls: readonly Pick<
    ModelExchange,
    "step" | "modelObserved" | "costUsd"
  >[];
  receipt: RequestReceipt;
}>;

export type SearchContext = Readonly<{
  transport: Transport;
  // Model calls some adapters need (Clay query writing, Firecrawl extraction),
  // on the harness key, recorded and replayable like HTTP.
  model: Readonly<{ id: string; call: StepCall }>;
  // The prompt's frozen shared filter translation (proposal 2.2).
  filters: FilterSet;
  topK: 5 | 10;
  secrets: Readonly<Record<string, string>>;
  // When the prompt was submitted; replays reuse the recorded time.
  submittedAt: string;
}>;

export interface SearchAdapter {
  readonly id: string;
  readonly capabilities: Readonly<Record<EntityType, TaskCapability>>;
  search(task: BenchmarkTask, context: SearchContext): Promise<AdapterResult>;
}
