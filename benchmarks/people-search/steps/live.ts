import { liveTransport } from "../../core/calls/http";
import { openRouterStructured } from "../../core/calls/llm";
import {
  FileCheckpointStore,
  RunnerStateError,
} from "../../core/execution/checkpoints";
import {
  ConvexReacherXDriver,
  npxConvexRunner,
} from "../../core/execution/convex";
import {
  systemClock,
  type WatchOptions,
} from "../../core/execution/workspaceRun";
import { openRouterJudgeCaller } from "../../core/judging/judgeModel";
import {
  inspectBenchmarkEnvironment,
  judgeOpenRouterKey,
} from "../../core/setup/env";
import {
  openRouterAccount,
  renidlyAccount,
  socialApiAccount,
  tregAccount,
} from "../../core/steps/balances";
import { loadFrozenPlan } from "../setup/freeze";
import { peopleSearchPlan } from "../setup/plan";
import type { SegmentId } from "../setup/schedule";
import {
  approvalPath,
  segmentApprovalSchema,
  type SegmentApproval,
  type StepDependencies,
} from "./pipeline";

/** Wiring for `pnpm benchmark --live <step>`: real deployment, providers and judges. */

// Proposal 5.3: status every 30 seconds; settled after two quiet polls; a
// minute's wait before the last spend reading, which OpenRouter reports late.
export const WATCH_OPTIONS: Omit<WatchOptions, "signal"> = {
  pollMs: peopleSearchPlan.execution.statusPollSeconds * 1_000,
  settlePolls: 2,
  startTimeoutMs: 15 * 60_000,
  maxCycleMs: 90 * 60_000,
  scheduledGapMs: peopleSearchPlan.execution.initialCycleGapMinutes * 60_000,
  spendSettleMs: 60_000,
  maxPollFailures: 5,
};

export class LiveSetupError extends Error {}

type Environment = Readonly<Record<string, string | undefined>>;

/** Reads a segment's approval from the private approvals folder; null when there is none. */
export function approvalReader(store: FileCheckpointStore) {
  return async (segment: SegmentId): Promise<SegmentApproval | null> => {
    const path = approvalPath(segment);
    const text = await store.readPrivate(path);
    if (text === null) return null;
    let approval: SegmentApproval;
    try {
      approval = segmentApprovalSchema.parse(JSON.parse(text));
    } catch {
      throw new RunnerStateError(`The approval in ${path} is not valid.`);
    }
    if (approval.segment !== segment)
      throw new RunnerStateError(
        `The approval in ${path} is for ${approval.segment}, not ${segment}.`
      );
    return approval;
  };
}

const isDevelopment = (value: string): value is `dev:${string}` =>
  value.startsWith("dev:");

const required = (environment: Environment, name: string) => {
  const value = environment[name]?.trim();
  if (!value) throw new LiveSetupError(`Set ${name} before a live step.`);
  return value;
};

export async function liveDependencies(
  root: string,
  environment: Environment,
  signal: AbortSignal,
  log: (line: string) => void
): Promise<StepDependencies> {
  const { issues } = inspectBenchmarkEnvironment(environment);
  if (issues.length)
    throw new LiveSetupError(
      `The local environment is not ready: ${issues.join(" ")} Run pnpm benchmark --check-env.`
    );
  const dev = required(environment, "CONVEX_DEPLOYMENT");
  if (!isDevelopment(dev))
    throw new LiveSetupError("Select the development deployment first.");
  const store = new FileCheckpointStore(root, "live");
  const transport = liveTransport();
  const judgeKey = judgeOpenRouterKey(environment);
  const deploymentKey = required(environment, "OPENROUTER_API_KEY");
  const harness = openRouterStructured(judgeKey.apiKey);
  return {
    root,
    frozen: await loadFrozenPlan(store),
    readApproval: approvalReader(store),
    driver: new ConvexReacherXDriver(dev, npxConvexRunner(dev, root)),
    session: {
      fundedKeys: {
        SOCIALAPI_API_KEY: required(environment, "SOCIALAPI_API_KEY"),
        LINKDAPI_API_KEY: required(environment, "LINKDAPI_API_KEY"),
      },
      deploymentOpenRouterKey: deploymentKey,
    },
    userId: required(environment, "BENCHMARK_USER_ID"),
    clock: systemClock,
    watch: WATCH_OPTIONS,
    signal,
    accounts: {
      deployment: openRouterAccount(deploymentKey, transport),
      judge: judgeKey.sharesDeploymentKey
        ? null
        : openRouterAccount(judgeKey.apiKey, transport),
      socialApi: socialApiAccount(
        required(environment, "SOCIALAPI_API_KEY"),
        transport
      ),
      renidly: renidlyAccount(
        required(environment, "LINKDAPI_API_KEY"),
        transport
      ),
      treg: tregAccount(required(environment, "TREG_TOKEN"), transport),
    },
    // Live calls need no preparation; the pipeline records them.
    providerCalls: async () => ({
      transport,
      call: (_step, model, request) => harness(model, request),
    }),
    harnessModel: peopleSearchPlan.models.harness,
    secrets: Object.fromEntries(
      [
        "EXA_API_KEY",
        "TREG_TOKEN",
        "CLAY_API_KEY",
        "CONTEXT_DEV_API_KEY",
        "FIRECRAWL_API_KEY",
      ].map((name) => [name, required(environment, name)])
    ),
    judgeCall: openRouterJudgeCaller(judgeKey.apiKey),
    evidence: { transport, apiKey: required(environment, "TAVILY_API_KEY") },
    log,
  };
}
