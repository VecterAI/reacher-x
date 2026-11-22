import { z } from "zod";
import {
  exchangeSchema,
  recordingTransport,
  type Exchange,
  type Transport,
} from "../../core/calls/http";
import {
  modelExchangeSchema,
  type ModelExchange,
  type StepCall,
} from "../../core/calls/llm";
import type { Clock } from "../../core/execution/workspaceRun";
import type { StepBudget } from "../../core/steps/balances";
import type { WorkspaceGate } from "../../core/steps/keyGate";
import {
  UnitFailed,
  toJson,
  untilStopped,
  type UnitLedger,
  type UnitOutcome,
} from "../../core/steps/units";
import { entitySchema, type BenchmarkTask } from "../../core/types";
import {
  filterSetSchema,
  translateTask,
  validateFilterSet,
  type FilterSet,
} from "../setup/filters";
import { toolCatalog } from "../tools/catalog";
import { searchAdapters } from "../tools/registry";

/**
 * Proposal 5.3 step 3: the shared filter step for each prompt, then the
 * competitors one request at a time. Each adapter's raw responses and model
 * calls are kept in the unit's private result (or, if it fails, in its review
 * receipt), with its cost, time and, for Treg, the provider that served it.
 */

/**
 * How a unit's provider and model calls are made. A live step returns the
 * live transport and the recorded harness model at once; the dry run first
 * records `work` against synthetic providers and returns replays of it.
 */
export type ProviderCalls = (
  work: (transport: Transport, call: StepCall) => Promise<unknown>
) => Promise<{ transport: Transport; call: StepCall }>;

export const candidateSchema = z.object({
  sourceId: z.string(),
  rank: z.number().int().positive(),
  discoveredAt: z.string(),
  entity: entitySchema,
});

export const competitorOutcomeSchema = z.object({
  taskId: z.string(),
  toolId: z.string(),
  submittedAt: z.string(),
  candidates: z.array(candidateSchema),
  usage: z.array(
    z.object({
      provider: z.string(),
      unit: z.string(),
      quantity: z.number(),
      reportedUsd: z.number().nullable(),
    })
  ),
  requestLatencyMs: z.number(),
  completedAfterMs: z.number(),
  exchanges: z.array(exchangeSchema),
  modelExchanges: z.array(modelExchangeSchema),
  receipt: z.object({
    toolId: z.string(),
    taskId: z.string(),
    endpoints: z.array(z.string()),
    nativeFilters: z.unknown(),
    unexpressed: z.array(z.string()),
    servedBy: z.record(z.string(), z.string()),
    notes: z.array(z.string()),
  }),
});
export type CompetitorOutcome = z.infer<typeof competitorOutcomeSchema>;

export const translationOutcomeSchema = z.object({
  taskId: z.string(),
  model: z.string(),
  modelObserved: z.string(),
  costUsd: z.number().nullable(),
  filters: filterSetSchema,
  modelExchanges: z.array(modelExchangeSchema),
});
export type TranslationOutcome = z.infer<typeof translationOutcomeSchema>;

/** Records each completed model call, like recordingTransport does for HTTP. */
function recordingSteps(
  call: StepCall,
  sink: (exchange: ModelExchange) => void
): StepCall {
  return async (step, model, request) => {
    const response = await call(step, model, request);
    sink({
      step,
      model,
      system: request.system,
      prompt: request.prompt,
      output: response.output,
      modelObserved: response.modelObserved,
      costUsd: response.costUsd,
      latencyMs: response.latencyMs,
    });
    return response;
  };
}

export type CompetitorPhase = Readonly<{
  ledger: UnitLedger;
  signal: AbortSignal;
  clock: Clock;
  gate: WorkspaceGate;
  budget: () => Promise<StepBudget>;
  // Accounts the phase spends on: the harness model key and Treg.
  accountIds: readonly string[];
  providerCalls: ProviderCalls;
  harnessModel: string;
  secrets: Readonly<Record<string, string>>;
  log(line: string): void;
}>;

export type CompetitorUnitResult = Readonly<{
  taskId: string;
  toolId: string;
  outcome: UnitOutcome<CompetitorOutcome> | null;
}>;

const iso = (clock: Clock) => new Date(clock.now()).toISOString();

/** Before a unit that has not run: false when the step is stopping; otherwise the budget is checked. */
async function mayStart(
  ledger: UnitLedger,
  unitId: string,
  phase: CompetitorPhase
) {
  const state = await ledger.state(unitId);
  if (state !== "new" && state !== "pending") return true;
  if (phase.signal.aborted) return false;
  await (await phase.budget()).check(phase.accountIds);
  return true;
}

async function translation(task: BenchmarkTask, phase: CompetitorPhase) {
  const id = `f-${task.id}`;
  if (!(await mayStart(phase.ledger, id, phase))) return null;
  return phase.ledger.run(
    {
      id,
      taskId: task.id,
      toolId: "filters",
      learning: null,
      cycle: null,
      input: { taskId: task.id, model: phase.harnessModel },
    },
    translationOutcomeSchema,
    async () => {
      const models: ModelExchange[] = [];
      const run = (call: StepCall) =>
        translateTask(task, phase.harnessModel, (model, request) =>
          call("filters", model, request)
        );
      const calls = await phase.providerCalls((_transport, call) => run(call));
      const recorded = recordingSteps(
        phase.gate.step(calls.call, "The shared filter step"),
        (exchange) => models.push(exchange)
      );
      try {
        return { ...(await run(recorded)), modelExchanges: models };
      } catch (error) {
        throw new UnitFailed(
          error instanceof Error ? error.message : "The filter step failed.",
          toJson({ modelExchanges: models }),
          { cause: error }
        );
      }
    }
  );
}

/**
 * Runs the competitor searches for the given prompts: the frozen filter
 * translation first, then every supported adapter in catalog order. A prompt
 * whose translation needs review has no searches.
 */
export async function runCompetitorUnits(
  tasks: readonly BenchmarkTask[],
  phase: CompetitorPhase
) {
  const results: CompetitorUnitResult[] = [];
  const translations: TranslationOutcome[] = [];
  const review: { unitId: string; reason: string }[] = [];
  const tools = toolCatalog.filter(
    (tool): tool is Extract<typeof tool, { implementation: "adapter" }> =>
      tool.implementation === "adapter"
  );
  const supported = (task: BenchmarkTask) =>
    tools.filter(
      (tool) =>
        searchAdapters[tool.id].capabilities[task.entityType].status !==
        "unsupported"
    );
  const stopped = await untilStopped(async () => {
    for (const task of tasks) {
      const translated = await translation(task, phase);
      if (translated === null) continue;
      if (translated.status === "needs-review") {
        review.push({ unitId: `f-${task.id}`, reason: translated.reason });
        phase.ledger.haltAfter(3, `f-${task.id}`, translated.reason);
        continue;
      }
      translations.push(translated.value);
      const filters: FilterSet = validateFilterSet(
        task,
        translated.value.filters
      );
      for (const tool of supported(task)) {
        const adapter = searchAdapters[tool.id];
        const id = `t-${tool.id}-${task.id}`;
        if (!(await mayStart(phase.ledger, id, phase))) continue;
        const outcome = await phase.ledger.run(
          {
            id,
            taskId: task.id,
            toolId: tool.id,
            learning: null,
            cycle: null,
            input: { taskId: task.id, toolId: tool.id, topK: tool.judgedTopK },
          },
          competitorOutcomeSchema,
          async () => {
            phase.log(`${tool.label}: ${task.id}.`);
            const submittedAt = iso(phase.clock);
            const context = (transport: Transport, call: StepCall) => ({
              transport,
              model: { id: phase.harnessModel, call },
              filters,
              topK: tool.judgedTopK,
              secrets: phase.secrets,
              submittedAt,
            });
            const calls = await phase.providerCalls((transport, call) =>
              adapter.search(task, context(transport, call))
            );
            const exchanges: Exchange[] = [];
            const models: ModelExchange[] = [];
            const transport = recordingTransport(
              calls.transport,
              (exchange) => {
                exchanges.push(exchange);
              }
            );
            const call = recordingSteps(
              phase.gate.step(calls.call, `${tool.label}'s harness model call`),
              (exchange) => models.push(exchange)
            );
            try {
              const result = await adapter.search(
                task,
                context(transport, call)
              );
              return {
                ...result,
                taskId: task.id,
                toolId: tool.id,
                submittedAt,
                modelExchanges: models,
              };
            } catch (error) {
              throw new UnitFailed(
                error instanceof Error ? error.message : "The search failed.",
                toJson({ exchanges, modelExchanges: models }),
                { cause: error }
              );
            }
          }
        );
        results.push({ taskId: task.id, toolId: tool.id, outcome });
        if (outcome.status === "needs-review") {
          review.push({ unitId: id, reason: outcome.reason });
          phase.ledger.haltAfter(3, id, outcome.reason);
        }
      }
    }
  });
  // Units neither finished nor held for review; a prompt whose filter step is
  // held for review has no searches to reach.
  const blocked = new Set(
    review.flatMap((item) =>
      item.unitId.startsWith("f-") ? [item.unitId.slice(2)] : []
    )
  );
  const notReached = tasks.reduce(
    (count, task) =>
      blocked.has(task.id)
        ? count
        : count +
          1 +
          supported(task).length -
          (translations.some((item) => item.taskId === task.id) ? 1 : 0) -
          results.filter((item) => item.taskId === task.id && item.outcome)
            .length,
    0
  );
  return { results, translations, review, notReached, stopped };
}
