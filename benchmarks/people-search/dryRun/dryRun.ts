import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  recordingTransport,
  replayTransport,
  type Exchange,
} from "../../core/calls/http";
import {
  recordingCall,
  replayCall,
  type ModelExchange,
} from "../../core/calls/llm";
import { FileCheckpointStore } from "../../core/execution/checkpoints";
import type { Clock } from "../../core/execution/workspaceRun";
import {
  openRouterAccount,
  renidlyAccount,
  socialApiAccount,
  tregAccount,
} from "../../core/steps/balances";
import type { BenchmarkEntity, EntityType } from "../../core/types";
import { freezePlan, loadFrozenPlan } from "../setup/freeze";
import { peopleSearchPlan } from "../setup/plan";
import {
  PILOT_PROMPTS_DROPPED,
  STEPS,
  segmentSchedule,
  type PromptId,
  type SegmentId,
  type StepId,
} from "../setup/schedule";
import { WATCH_OPTIONS } from "../steps/live";
import {
  DEFAULT_KEYWORD_POST_SEARCH_CALLS,
  runStep,
  type SegmentApproval,
  type SegmentResult,
  type StepAccounts,
  type StepDependencies,
} from "../steps/pipeline";
import { workspaceUnitId } from "../steps/workspaces";
import { syntheticDeployment } from "./deployment";
import {
  SyntheticAccounts,
  syntheticJudge,
  syntheticModel,
  syntheticTransport,
} from "./providers";

/**
 * `pnpm benchmark --dry-run [step]`: the live pipeline end to end at $0, with
 * no network and no Convex. A temporary checkout folder holds a synthetic
 * frozen plan and approvals; a simulated deployment runs the workspaces on a
 * clock that advances only when the runner waits; each competitor's responses
 * are first recorded from synthetic providers and then replayed exactly;
 * synthetic judges grade; and the pilot's label sheet is filled with
 * synthetic labels and read back, so D2 is computed. All data is invented.
 */

const REFERENCE_DATE = "2026-11-15T00:00:00.000Z";
const KEYS = {
  deployment: "synthetic-openrouter-key",
  socialApi: "synthetic-socialapi-key",
  renidly: "synthetic-renidly-key",
  treg: "synthetic-treg-key",
};

/** Time moves only when the runner waits, so hours of polling take no time. */
export function syntheticClock(start: number): Clock {
  let now = start;
  return {
    now: () => now,
    async sleep(ms, signal) {
      signal?.throwIfAborted();
      now += ms;
    },
  };
}

function example(entityType: EntityType): BenchmarkEntity {
  const common = {
    name: "Synthetic Reference Example",
    profileUrl: null,
    location: null,
    description: null,
    evidence: [
      {
        id: "e1",
        url: "https://reference.example/profile",
        text: "Synthetic reference evidence.",
        publishedAt: null,
        retrievedAt: REFERENCE_DATE,
      },
    ],
  };
  return entityType === "individual"
    ? { ...common, prospectType: "individual", title: null, employer: null }
    : {
        ...common,
        prospectType: "organization",
        domain: null,
        industry: null,
        employeeCount: null,
      };
}

const droppedPrompts: readonly PromptId[] = PILOT_PROMPTS_DROPPED;

/** The pilot's drop as approved on 20 Nov 2026, so the dry run follows the amended plan. */
export const PILOT_DROP = {
  workspaces: segmentSchedule("pilot", { runId: "dry-run", seed: 0 })
    .workspaces.filter((slot) => droppedPrompts.includes(slot.promptId))
    .map(workspaceUnitId),
  reason:
    "Budget: the pilot finishes with prompt 1 only (project lead, 20 Nov 2026); prompt 6's first cycle runs in the main step",
};

// Segments whose competitors run, and so spend on Treg.
const WITH_COMPETITORS: readonly SegmentId[] = ["smoke", "main"];

function approval(segment: SegmentId, accounts: StepAccounts): SegmentApproval {
  return {
    segment,
    spend: {
      approvalReference: `Synthetic dry-run approval for ${segment}`,
      approvedAt: REFERENCE_DATE,
      accountLimits: [
        accounts.deployment,
        accounts.socialApi,
        ...(WITH_COMPETITORS.includes(segment) ? [accounts.treg] : []),
      ].map((account) => ({
        accountId: account.accountId,
        maxAdditionalUsd: 25,
      })),
    },
    credits: [{ accountId: accounts.renidly.accountId, maxCredits: 1_000 }],
    keywordPostSearchCallsPerCycle: DEFAULT_KEYWORD_POST_SEARCH_CALLS,
    matchLimitPerCycle: null,
    matchLimitPerQuery: null,
    slice: null,
    drop: null,
    ...(segment.startsWith("stage2")
      ? {
          stage2: {
            staticPrompts: 2,
            cyclesPerWorkspace: 5,
            plannedCycleCostUsd: 0.65,
          },
        }
      : {}),
  };
}

/** Fills a label sheet as two synthetic labellers would, disagreeing with the panel now and then. */
async function fillLabels(root: string, results: readonly SegmentResult[]) {
  const store = new FileCheckpointStore(root, "dry-run");
  const path = "benchmarks/.local/people-search/labels/pilot/sheet.csv";
  const sheet = await store.readPrivate(path);
  if (sheet === null) return;
  const verdicts = new Map(
    results
      .flatMap((result) => result.outcome.cases)
      .map((item) => [item.record.caseId, item.record.panel.verifiedMatch])
  );
  const [header, ...rows] = sheet.trimEnd().split("\n");
  const filled = rows.map((row, index) => {
    const [caseId, labeller] = row.split(",");
    const panel = verdicts.get(caseId) ?? false;
    const match = index % 9 === 4 ? !panel : panel;
    return `${caseId},${labeller},${match ? "yes" : "no"},Synthetic label`;
  });
  await store.withLock(() =>
    store.writePrivate(path, `${[header, ...filled].join("\n")}\n`)
  );
}

export type SyntheticOptions = Readonly<{
  signal: AbortSignal;
  log(line: string): void;
  // Sees every simulated deployment call.
  observe?: (call: string) => void;
}>;

/**
 * Freezes a synthetic plan under `root` and returns the step dependencies a
 * live run would get, with every outside service simulated.
 */
export async function syntheticDependencies(
  root: string,
  options: SyntheticOptions
) {
  const store = new FileCheckpointStore(root, "dry-run");
  await store.withLock(() =>
    freezePlan(
      store,
      {
        referenceDate: REFERENCE_DATE,
        seed: 7,
        referenceExamples: Object.fromEntries(
          peopleSearchPlan.prompts.map((prompt) => [
            String(prompt.id),
            example(peopleSearchPlan.categories[prompt.category].entityType),
          ])
        ),
      },
      // The criteria are still a draft; a dry run never needs them agreed.
      { allowDraftCriteria: true }
    )
  );
  const synthetic = new SyntheticAccounts();
  const clock = syntheticClock(Date.parse(REFERENCE_DATE) + 86_400_000);
  const transport = syntheticTransport(synthetic);
  const model = syntheticModel(synthetic);
  const deployment = syntheticDeployment(
    synthetic,
    clock,
    KEYS.deployment,
    options.observe
  );
  const accounts: StepAccounts = {
    deployment: openRouterAccount(KEYS.deployment, transport),
    // One shared OpenRouter key, as agreed for the live runs.
    judge: null,
    socialApi: socialApiAccount(KEYS.socialApi, transport),
    renidly: renidlyAccount(KEYS.renidly, transport),
    treg: tregAccount(KEYS.treg, transport),
  };
  const deps: StepDependencies = {
    root,
    frozen: await loadFrozenPlan(store),
    readApproval: async (segment) => approval(segment, accounts),
    driver: deployment.driver,
    session: {
      fundedKeys: {
        SOCIALAPI_API_KEY: KEYS.socialApi,
        LINKDAPI_API_KEY: KEYS.renidly,
      },
      deploymentOpenRouterKey: KEYS.deployment,
    },
    userId: "synthetic-user",
    clock,
    watch: WATCH_OPTIONS,
    signal: options.signal,
    accounts,
    // Record the unit's calls once against the synthetic providers, then replay them exactly.
    providerCalls: async (work) => {
      const exchanges: Exchange[] = [];
      const models: ModelExchange[] = [];
      await work(
        recordingTransport(transport, (exchange) => {
          exchanges.push(exchange);
        }),
        recordingCall(model, (exchange) => {
          models.push(exchange);
        })
      );
      return {
        transport: replayTransport(exchanges),
        call: replayCall(models),
      };
    },
    harnessModel: peopleSearchPlan.models.harness,
    secrets: {
      EXA_API_KEY: "synthetic-exa-key",
      TREG_TOKEN: KEYS.treg,
      CLAY_API_KEY: "synthetic-clay-key",
      CONTEXT_DEV_API_KEY: "synthetic-context-key",
      FIRECRAWL_API_KEY: "synthetic-firecrawl-key",
    },
    judgeCall: syntheticJudge(synthetic),
    evidence: { transport, apiKey: "synthetic-tavily-key" },
    log: options.log,
  };
  return { deps, synthetic, deploymentEnv: deployment.env };
}

export type DryRunOptions = SyntheticOptions &
  Readonly<{
    // Run the steps up to and including this one; all steps when omitted.
    through?: StepId;
  }>;

/** Runs the steps in a temporary folder that is removed afterwards; returns each segment's reports. */
export async function dryRun(options: DryRunOptions) {
  const root = await mkdtemp(join(tmpdir(), "reacherx-dry-run-"));
  try {
    const built = await syntheticDependencies(root, options);
    const deps: StepDependencies = {
      ...built.deps,
      readApproval: async (segment) => {
        const approval = await built.deps.readApproval(segment);
        return approval && segment === "pilot"
          ? { ...approval, drop: PILOT_DROP }
          : approval;
      },
    };
    const through = options.through ?? STEPS.at(-1)!;
    const steps = STEPS.slice(0, STEPS.indexOf(through) + 1);
    const results: { step: StepId; result: SegmentResult }[] = [];
    for (const step of steps) {
      options.log(`Dry run: ${step}.`);
      let result = await runStep(step, deps);
      if (step === "pilot" && result.outcome.status === "complete") {
        // Label the sample as two people would, then read it back for D2.
        await fillLabels(root, [...results.map((item) => item.result), result]);
        result = await runStep(step, deps);
      }
      results.push({ step, result });
      if (step === "stage2" && result.outcome.status === "complete")
        results.push({ step, result: await runStep(step, deps) });
      if (result.outcome.status !== "complete") break;
    }
    const shown = results.filter(
      (item) => !options.through || item.step === options.through
    );
    // A step that stopped before the requested one is shown too, with its reason.
    const last = results.at(-1);
    if (
      last &&
      last.result.outcome.status !== "complete" &&
      !shown.includes(last)
    )
      shown.push(last);
    return shown.map((item) => item.result);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
