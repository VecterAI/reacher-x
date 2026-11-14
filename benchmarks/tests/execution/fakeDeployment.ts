import {
  ConvexReacherXDriver,
  type CommandRunner,
  type PoolLimits,
  type RunStatus,
} from "../../core/convex";

/**
 * An in-memory stand-in for the Convex CLI and the benchmark hooks. `env get`
 * prints the raw value plus a newline, or nothing when unset, as the CLI does;
 * `env set` takes its value from stdin. Nothing reaches a deployment.
 */
export type Handler = (args: Record<string, unknown>) => unknown;

export const DEFAULT_POOLS: PoolLimits = {
  workflow: 64,
  qualification: 10,
  enrichment: 10,
  previewQualification: 4,
  previewEnrichment: 4,
  outreachPlan: 4,
  memoryEvaluation: 4,
};

export function fakeDeployment(
  initial: Record<string, string>,
  handlers: Record<string, Handler> = {}
) {
  const env = new Map(Object.entries(initial));
  const calls: { args: readonly string[]; stdin?: string }[] = [];
  // Settings the fake refuses to change, to simulate an unconfirmed write.
  const ignoredSets = new Set<string>();
  const defaults: Record<string, Handler> = {
    "tenantScheduler:reconcilePoolConfigurationInternal": () => ({
      enforced: false,
    }),
    "benchmarkPeopleSearch:poolLimitsStatus": () => ({
      limits: env.has("BENCHMARK_POOL_LIMITS")
        ? JSON.parse(env.get("BENCHMARK_POOL_LIMITS")!)
        : DEFAULT_POOLS,
      source: env.has("BENCHMARK_POOL_LIMITS") ? "benchmark" : "default",
      error: null,
      enforcedTenantScheduling: false,
    }),
    "benchmarkPeopleSearch:deploymentActivity": () => ({
      workspaceIds: [],
      truncated: false,
    }),
    "benchmarkPeopleSearch:resetLinkdApiCircuit": () => ({ reset: false }),
    "benchmarkPeopleSearch:stopRun": () => ({
      stopped: true,
      cancelFailed: false,
      monitorsDeleted: 1,
      monitorFailures: [],
    }),
    "benchmarkPeopleSearch:cancelScheduledCycles": () => ({
      canceled: 0,
      truncated: false,
    }),
    "benchmarkPeopleSearch:prepareWorkspace": () => ({
      workspaceId: "w1",
      createdAt: 1_000,
    }),
    "benchmarkPeopleSearch:findRunWorkspace": () => null,
    "benchmarkPeopleSearch:startWorkspace": () => null,
    "benchmarkPeopleSearch:runCosts": () => ({
      providers: {},
      llmUsdRecorded: 0,
      llmCallsRecorded: 0,
      capped: false,
    }),
    "benchmarkPeopleSearch:linkdApiUnitsSince": () => ({
      billableUnits: 0,
      successes: 0,
      events: 0,
      capped: false,
    }),
    "benchmarkPeopleSearch:exportCandidates": () => ({
      page: [],
      isDone: true,
      continueCursor: "",
    }),
  };
  const functions = { ...defaults, ...handlers };
  const run: CommandRunner = async (args, stdin) => {
    calls.push({ args, stdin });
    const [command, action, name] = args;
    if (command === "env" && action === "get" && name)
      return {
        exitCode: 0,
        stdout: env.has(name) ? `${env.get(name)}\n` : "",
        stderr: "",
      };
    if (command === "env" && action === "set" && name) {
      if (!ignoredSets.has(name))
        env.set(name, (stdin ?? "").replace(/\n$/, ""));
      return { exitCode: 0, stdout: "", stderr: "" };
    }
    if (command === "env" && action === "remove" && name) {
      env.delete(name);
      return { exitCode: 0, stdout: "", stderr: "" };
    }
    const handler = command === "run" && action ? functions[action] : null;
    if (!handler) return { exitCode: 1, stdout: "", stderr: "unknown" };
    try {
      const output = await handler(JSON.parse(name ?? "{}"));
      return { exitCode: 0, stdout: JSON.stringify(output), stderr: "" };
    } catch {
      return { exitCode: 1, stdout: "", stderr: "failed" };
    }
  };
  return {
    env,
    calls,
    ignoredSets,
    driver: new ConvexReacherXDriver("dev:test", run),
    /** Function names called, in order. */
    functionCalls: () =>
      calls
        .filter((call) => call.args[0] === "run")
        .map((call) => call.args[1]),
  };
}

/** A run status with nothing started, adjusted by `patch`. */
export function status(
  patch: Partial<Omit<NonNullable<RunStatus>, "counts">> & {
    counts?: Partial<NonNullable<RunStatus>["counts"]>;
  } = {}
): NonNullable<RunStatus> {
  const { counts, ...rest } = patch;
  return {
    workspaceStatus: "running",
    pauseReason: null,
    workflowId: null,
    workflowState: null,
    workflowStartedAt: null,
    nextRunAt: null,
    bootstrapCycleCount: null,
    bootstrapCompletedAt: null,
    counts: {
      total: 0,
      pending: 0,
      qualified: 0,
      disqualified: 0,
      unscored: 0,
      organizations: 0,
      ...counts,
    },
    pendingLessonWrites: 0,
    truncated: false,
    ...rest,
  };
}

/** Time advances only when the code under test sleeps. */
export function fakeClock(start = 1_000_000) {
  let now = start;
  return {
    now: () => now,
    async sleep(ms: number, signal?: AbortSignal) {
      if (signal?.aborted) throw signal.reason;
      now += ms;
    },
  };
}

/** An in-memory private file for the live session record. */
export function memoryFile(initial: string | null = null) {
  let data = initial;
  return {
    read: async () => data,
    write: async (next: string) => {
      data = next;
    },
    get data() {
      return data;
    },
  };
}
