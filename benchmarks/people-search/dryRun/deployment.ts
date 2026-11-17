import {
  ConvexReacherXDriver,
  type CommandRunner,
  type ExportedProspect,
  type PoolLimits,
  type RunStatus,
} from "../../core/execution/convex";
import type { Clock } from "../../core/execution/workspaceRun";
import { peopleSearchPlan } from "../setup/plan";
import { taskId } from "../setup/criteria";
import type { SyntheticAccounts } from "./providers";

/**
 * A simulated development deployment for the dry run: the Convex CLI's env
 * commands and the benchmark hooks, in memory. Cycles run on the given clock
 * (discovery, then qualification and lesson writing), the next cycle starts
 * after the configured gap while automatic cycles are on, and each cycle
 * spends from the synthetic accounts. All prospects are synthetic.
 */

const MINUTE = 60_000;
const DISCOVERY_MS = 8 * MINUTE;
const QUALIFYING_MS = 5 * MINUTE;
const LESSONS_MS = 6 * MINUTE;
const PER_CYCLE = 8;
// What production spends on the shared SocialAPI key during each cycle.
const PRODUCTION_SOCIALAPI_CENTS = 4;
const POOLS: PoolLimits = {
  workflow: 64,
  qualification: 10,
  enrichment: 10,
  previewQualification: 4,
  previewEnrichment: 4,
  outreachPlan: 4,
  memoryEvaluation: 4,
};

type Cycle = {
  workflowId: string;
  startedAt: number;
  endsAt: number;
  ended: boolean;
  // Stopped before discovery finished: it found nothing and charged nothing.
  canceled: boolean;
};
type Workspace = {
  id: string;
  label: string;
  taskId: string;
  entityType: "individual" | "organization";
  createdAt: number;
  stopped: boolean;
  // When a stopped workspace was resumed to finish its cycle's work.
  resumedAt: number | null;
  cycles: Cycle[];
  nextRunAt: number | null;
  prospects: ExportedProspect[];
};

function prospects(workspace: Workspace, cycle: Cycle, learningOff: boolean) {
  const number = workspace.cycles.length;
  // Learning on finds a little more each cycle, so the dry run's learning table has something to show.
  const qualifiedCount = learningOff ? 4 : Math.min(3 + number, 7);
  return Array.from({ length: PER_CYCLE }, (_, index): ExportedProspect => {
    const i = index + 1;
    const slug = `${workspace.taskId}-${(number - 1) * PER_CYCLE + i}`;
    // One person in a company workspace, which the company prompt must not count.
    const type =
      workspace.entityType === "organization" && i === PER_CYCLE
        ? "individual"
        : workspace.entityType;
    const qualified = i <= qualifiedCount;
    return {
      id: `${workspace.id}-c${number}-${i}`,
      createdAt: cycle.startedAt + i * 45_000,
      platform: i % 2 ? "linkedin" : "twitter",
      prospectType: type,
      displayName:
        type === "individual"
          ? `Synthetic Person ${slug}`
          : `Synthetic Company ${slug}`,
      title: type === "individual" ? "Engineer" : null,
      company: type === "individual" ? "Example Labs" : null,
      location: "London, United Kingdom",
      briefIntro: "Synthetic profile for the dry run.",
      websiteUrl: type === "organization" ? `https://${slug}.example` : null,
      socialProfiles: {
        linkedin: {
          url:
            type === "individual"
              ? `https://www.linkedin.com/in/synthetic-${slug}`
              : `https://www.linkedin.com/company/synthetic-${slug}`,
        },
      },
      matchReason: null,
      matchedKeywords: [],
      qualificationStatus: qualified ? "qualified" : "disqualified",
      qualificationScore: qualified ? 70 + i * 3 : 30 + i,
      qualificationReasoning: null,
      qualifiedAt: qualified ? cycle.endsAt + i * 30_000 : null,
      disqualifiedAt: qualified ? null : cycle.endsAt + i * 30_000,
      qualificationSources: [
        {
          sourceUrl: `https://posts.example/${slug}`,
          text: "Synthetic post written for the dry run.",
          publishedAt: new Date(cycle.startedAt - i * 86_400_000).toISOString(),
          verifiedAt: cycle.endsAt,
        },
      ],
      evidencePosts: [],
    };
  });
}

export function syntheticDeployment(
  accounts: SyntheticAccounts,
  clock: Clock,
  deploymentOpenRouterKey: string,
  // Sees every CLI call (for example "run benchmarkPeopleSearch:stopRun").
  observe: (call: string) => void = () => undefined
) {
  const env = new Map<string, string>([
    ["PAUSE_AUTONOMOUS_JOBS", "true"],
    ["PROSPECTING_AUTO_RESCHEDULE", "0"],
    ["OPENROUTER_API_KEY", deploymentOpenRouterKey],
    ["SOCIALAPI_API_KEY", "synthetic-development-socialapi"],
    ["LINKDAPI_API_KEY", "synthetic-development-linkdapi"],
  ]);
  const workspaces = new Map<string, Workspace>();
  const gapMs = () =>
    Number(env.get("PROSPECTING_RESCHEDULE_INTERVAL_MINUTES") ?? "60") * MINUTE;

  function start(workspace: Workspace, at: number) {
    workspace.cycles.push({
      workflowId: `${workspace.id}-wf${workspace.cycles.length + 1}`,
      startedAt: at,
      endsAt: at + DISCOVERY_MS,
      ended: false,
      canceled: false,
    });
  }

  // Cycles that ran to the end of discovery, and so used X and LinkedIn data.
  const finished = (cycles: readonly Cycle[]) =>
    cycles.filter((cycle) => cycle.ended && !cycle.canceled);

  /** Plays the workspace forward to now. */
  function advance(workspace: Workspace) {
    const now = clock.now();
    for (;;) {
      const current = workspace.cycles.at(-1);
      if (current && !current.ended && now >= current.endsAt) {
        current.ended = true;
        const off =
          env.get("BENCHMARK_LEARNING_OFF_WORKSPACE_IDS") === workspace.id;
        workspace.prospects.push(...prospects(workspace, current, off));
        accounts.openRouterUsage += 0.31 + 0.02 * workspace.cycles.length;
        // 300 tweets or users at $0.20 per 1,000, as the deployment records
        // them; production uses the same key, so the balance drops further.
        accounts.socialApiCents -= 6 + PRODUCTION_SOCIALAPI_CENTS;
        accounts.renidlyCredits -= 11;
        workspace.nextRunAt =
          !workspace.stopped && env.get("PROSPECTING_AUTO_RESCHEDULE") === "1"
            ? current.endsAt + gapMs()
            : null;
        continue;
      }
      if (
        workspace.nextRunAt !== null &&
        now >= workspace.nextRunAt &&
        !workspace.stopped
      ) {
        start(workspace, workspace.nextRunAt);
        workspace.nextRunAt = null;
        continue;
      }
      return;
    }
  }

  const find = (args: Record<string, unknown>) => {
    const workspace = workspaces.get(String(args.workspaceId));
    if (workspace) advance(workspace);
    return workspace ?? null;
  };

  const functions: Record<string, (args: Record<string, unknown>) => unknown> =
    {
      "tenantScheduler:reconcilePoolConfigurationInternal": () => ({
        enforced: false,
      }),
      "benchmarkPeopleSearch:poolLimitsStatus": () => ({
        limits: env.has("BENCHMARK_POOL_LIMITS")
          ? JSON.parse(env.get("BENCHMARK_POOL_LIMITS")!)
          : POOLS,
        source: env.has("BENCHMARK_POOL_LIMITS") ? "benchmark" : "default",
        error: null,
        enforcedTenantScheduling: false,
      }),
      "benchmarkPeopleSearch:resetLinkdApiCircuit": () => ({ reset: false }),
      "benchmarkPeopleSearch:keywordPostSearchLimitStatus": () => ({
        limit: env.has("BENCHMARK_KEYWORD_POST_SEARCH_LIMIT")
          ? Number(env.get("BENCHMARK_KEYWORD_POST_SEARCH_LIMIT"))
          : null,
        source: env.has("BENCHMARK_KEYWORD_POST_SEARCH_LIMIT")
          ? "benchmark"
          : "default",
        error: null,
      }),
      "benchmarkPeopleSearch:matchLimitStatus": () => ({
        limit: env.has("BENCHMARK_MATCH_LIMIT_PER_CYCLE")
          ? Number(env.get("BENCHMARK_MATCH_LIMIT_PER_CYCLE"))
          : null,
        source: env.has("BENCHMARK_MATCH_LIMIT_PER_CYCLE")
          ? "benchmark"
          : "default",
        error: null,
      }),
      "benchmarkPeopleSearch:deploymentActivity": (args) => ({
        workspaceIds: [...workspaces.values()]
          .filter(
            (workspace) =>
              !workspace.stopped &&
              (workspace.cycles.length > 0 || workspace.nextRunAt !== null) &&
              workspace.id !== args.exceptWorkspaceId
          )
          .map((workspace) => workspace.id),
        truncated: false,
      }),
      "benchmarkPeopleSearch:prepareWorkspace": (args) => {
        const prompt = peopleSearchPlan.prompts.find(
          (item) => item.text === args.prompt
        );
        if (!prompt) throw new Error("Unknown prompt.");
        const workspace: Workspace = {
          id: `synthetic-ws-${workspaces.size + 1}`,
          label: String(args.label),
          taskId: taskId(prompt.id),
          entityType: peopleSearchPlan.categories[prompt.category].entityType,
          createdAt: clock.now(),
          stopped: false,
          resumedAt: null,
          cycles: [],
          nextRunAt: null,
          prospects: [],
        };
        workspaces.set(workspace.id, workspace);
        // Setup writes the workspace's plan with a model call.
        accounts.openRouterUsage += 0.02;
        return { workspaceId: workspace.id, createdAt: workspace.createdAt };
      },
      "benchmarkPeopleSearch:findRunWorkspace": (args) => {
        const workspace = [...workspaces.values()].find(
          (item) => item.label === args.label
        );
        return workspace
          ? { workspaceId: workspace.id, createdAt: workspace.createdAt }
          : null;
      },
      "benchmarkPeopleSearch:startWorkspace": (args) => {
        const workspace = find(args);
        if (!workspace) throw new Error("Unknown workspace.");
        workspace.nextRunAt = clock.now() + 20_000;
        return null;
      },
      "benchmarkPeopleSearch:runStatus": (args): RunStatus => {
        const workspace = find(args);
        if (!workspace) return null;
        const now = clock.now();
        const current = workspace.cycles.at(-1);
        // Qualification and lesson writing still running for any finished
        // cycle: with a short gap, an earlier cycle's work overlaps the next.
        const unfinished = (phaseMs: number) =>
          finished(workspace.cycles).filter(
            (cycle) => now - cycle.endsAt < phaseMs
          ).length +
          // A resumed cycle's remaining qualification and lesson writing.
          (workspace.resumedAt !== null &&
          !workspace.stopped &&
          now - workspace.resumedAt < phaseMs
            ? 1
            : 0);
        const count = (status: string) =>
          workspace.prospects.filter(
            (item) => item.qualificationStatus === status
          ).length;
        return {
          workspaceStatus: workspace.stopped ? "paused" : "running",
          pauseReason: workspace.stopped ? "benchmark-stop" : null,
          workflowId: current?.workflowId ?? null,
          workflowState: current
            ? current.canceled
              ? "canceled"
              : current.ended
                ? "completed"
                : "inProgress"
            : null,
          workflowStartedAt: current?.startedAt ?? null,
          nextRunAt: workspace.nextRunAt,
          bootstrapCycleCount: workspace.cycles.length,
          bootstrapCompletedAt: null,
          counts: {
            total: workspace.prospects.length,
            pending: 3 * unfinished(QUALIFYING_MS),
            qualified: count("qualified"),
            disqualified: count("disqualified"),
            unscored: 0,
            organizations: workspace.prospects.filter(
              (item) => item.prospectType === "organization"
            ).length,
            enrichmentWaiting: 0,
          },
          // Synthetic qualification never reaches a match limit.
          matchLimit: null,
          pendingLessonWrites: unfinished(LESSONS_MS),
          truncated: false,
        };
      },
      "benchmarkPeopleSearch:cancelScheduledCycles": (args) => {
        const workspace = find(args);
        const canceled = workspace?.nextRunAt ? 1 : 0;
        if (workspace) workspace.nextRunAt = null;
        return { canceled, truncated: false };
      },
      "benchmarkPeopleSearch:resumeHeldWorkspace": (args) => {
        // Same cycle, no discovery: only its remaining work runs and charges.
        const workspace = find(args);
        const current = workspace?.cycles.at(-1);
        if (
          !workspace ||
          !workspace.stopped ||
          !current?.ended ||
          current.workflowId !== args.workflowId ||
          env.get("PROSPECTING_AUTO_RESCHEDULE") === "1"
        )
          throw new Error("Not resumable.");
        workspace.stopped = false;
        workspace.resumedAt = clock.now();
        accounts.openRouterUsage += 0.05;
        return {
          qualificationQueued: 3,
          failuresCleared: 0,
          enrichmentQueued: 0,
          leasesReleased: 0,
          leasesKept: 0,
          cycleStartsCanceled: 0,
          truncated: false,
        };
      },
      "benchmarkPeopleSearch:stopRun": (args) => {
        // Played forward to now first, so only the cycle still running is canceled.
        const workspace = find(args);
        if (workspace) {
          workspace.stopped = true;
          workspace.nextRunAt = null;
          const current = workspace.cycles.at(-1);
          if (current && !current.ended) {
            current.ended = true;
            current.canceled = true;
          }
        }
        return {
          cancelFailed: false,
          stopped: true,
          monitorsDeleted: 1,
          monitorFailures: [],
        };
      },
      "benchmarkPeopleSearch:runCosts": (args) => {
        const workspace = find(args);
        const cycles = finished(workspace?.cycles ?? []).length;
        return {
          providers: {
            socialapi: {
              usd: 0.06 * cycles,
              requests: 10 * cycles,
              billableUnits: 300 * cycles,
            },
          },
          llmUsdRecorded: 0.3 * cycles,
          llmCallsRecorded: 40 * cycles,
          capped: false,
        };
      },
      "benchmarkPeopleSearch:linkdApiUnitsSince": (args) => {
        const since = Number(args.since);
        const cycles = finished(
          [...workspaces.values()].flatMap((workspace) => workspace.cycles)
        ).filter((cycle) => cycle.startedAt >= since).length;
        return {
          billableUnits: 11 * cycles,
          successes: 11 * cycles,
          events: 11 * cycles,
          capped: false,
        };
      },
      "benchmarkPeopleSearch:exportCandidates": (args) => {
        const workspace = find(args);
        const all = workspace?.prospects ?? [];
        const options = args.paginationOpts as {
          numItems: number;
          cursor: string | null;
        };
        const from = Number(options.cursor ?? 0);
        const page = all.slice(from, from + options.numItems);
        return {
          page,
          isDone: from + options.numItems >= all.length,
          continueCursor: String(from + options.numItems),
        };
      },
    };

  const run: CommandRunner = async (args, stdin) => {
    const [command, action, name] = args;
    observe(command === "env" ? `env ${action} ${name}` : `run ${action}`);
    if (command === "env" && action === "get" && name)
      return {
        exitCode: 0,
        stdout: env.has(name) ? `${env.get(name)}\n` : "",
        stderr: "",
      };
    if (command === "env" && action === "set" && name) {
      env.set(name, (stdin ?? "").replace(/\n$/, ""));
      return { exitCode: 0, stdout: "", stderr: "" };
    }
    if (command === "env" && action === "remove" && name) {
      env.delete(name);
      return { exitCode: 0, stdout: "", stderr: "" };
    }
    const handler = command === "run" && action ? functions[action] : undefined;
    if (!handler) return { exitCode: 1, stdout: "", stderr: "unknown" };
    try {
      const output = handler(JSON.parse(name ?? "{}"));
      // The CLI prints nothing when the function returns null.
      const stdout = output === null ? "" : JSON.stringify(output);
      return { exitCode: 0, stdout, stderr: "" };
    } catch {
      return { exitCode: 1, stdout: "", stderr: "failed" };
    }
  };
  return { driver: new ConvexReacherXDriver("dev:synthetic", run), env };
}
