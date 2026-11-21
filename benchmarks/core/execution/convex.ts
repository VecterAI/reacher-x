import { spawn } from "node:child_process";
import { z } from "zod";
import type { LearningCondition } from "../types";

/**
 * Drives the development deployment through the authenticated Convex CLI,
 * calling the internal hooks in convex/benchmarkPeopleSearch.ts (listed in
 * PEOPLE_SEARCH_HOOKS below). Values for `env set` go through standard input
 * so they never appear in a command line.
 * Every call here can reach the deployment; the runner invokes it only inside
 * an approved live step.
 */

/**
 * The people-search hook set. This driver serves only the people-search
 * benchmark for now, so its Convex function names live here in one place; it
 * gets generalized when a second benchmark needs it.
 */
const PEOPLE_SEARCH_HOOKS = {
  poolLimitsStatus: "benchmarkPeopleSearch:poolLimitsStatus",
  prepareWorkspace: "benchmarkPeopleSearch:prepareWorkspace",
  findRunWorkspace: "benchmarkPeopleSearch:findRunWorkspace",
  startWorkspace: "benchmarkPeopleSearch:startWorkspace",
  runStatus: "benchmarkPeopleSearch:runStatus",
  exportCandidates: "benchmarkPeopleSearch:exportCandidates",
  stopRun: "benchmarkPeopleSearch:stopRun",
  cancelScheduledCycles: "benchmarkPeopleSearch:cancelScheduledCycles",
  releaseNextCycle: "benchmarkPeopleSearch:releaseNextCycle",
  deploymentActivity: "benchmarkPeopleSearch:deploymentActivity",
  runCosts: "benchmarkPeopleSearch:runCosts",
  linkdApiUnitsSince: "benchmarkPeopleSearch:linkdApiUnitsSince",
  resetLinkdApiCircuit: "benchmarkPeopleSearch:resetLinkdApiCircuit",
  keywordPostSearchLimitStatus:
    "benchmarkPeopleSearch:keywordPostSearchLimitStatus",
  matchLimitStatus: "benchmarkPeopleSearch:matchLimitStatus",
  matchLimitPerQueryStatus: "benchmarkPeopleSearch:matchLimitPerQueryStatus",
  matchLimitParked: "benchmarkPeopleSearch:matchLimitParked",
  resumeHeldWorkspace: "benchmarkPeopleSearch:resumeHeldWorkspace",
} as const satisfies Record<string, `benchmarkPeopleSearch:${string}`>;

export type CommandResult = Readonly<{
  exitCode: number;
  stdout: string;
  stderr: string;
}>;
export type CommandRunner = (
  args: readonly string[],
  stdin?: string
) => Promise<CommandResult>;

/** A `convex run` result: the CLI prints nothing when the function returns null. */
export const runOutput = (stdout: string): unknown =>
  stdout.trim() === "" ? null : JSON.parse(stdout);

// Selection variables that could point the CLI at another deployment.
const OVERRIDE_VARIABLES = [
  "CONVEX_DEPLOY_KEY",
  "CONVEX_DEPLOYMENT_TOKEN",
  "CONVEX_SELF_HOSTED_URL",
  "CONVEX_SELF_HOSTED_ADMIN_KEY",
  "CONVEX_URL",
] as const;

/**
 * Runs `npx convex` pinned to one dev deployment. Output stays in memory and is
 * never logged. Selection variables are set to empty strings, not deleted: the
 * CLI loads `.env.local` without overriding variables already present, so an
 * empty value also stops a deploy key in that file from redirecting the call.
 */
export function npxConvexRunner(
  deployment: `dev:${string}`,
  cwd = process.cwd()
): CommandRunner {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...Object.fromEntries(OVERRIDE_VARIABLES.map((name) => [name, ""])),
    CONVEX_DEPLOYMENT: deployment,
  };
  return (args, stdin) =>
    new Promise((resolve, reject) => {
      const child = spawn("npx", ["convex", ...args], {
        cwd,
        env,
        stdio: ["pipe", "pipe", "pipe"],
        // Its own process group, so a Ctrl+C in the terminal reaches only the
        // runner, which then finishes this call and the reset instead of
        // having a deployment command killed halfway.
        detached: process.platform !== "win32",
      });
      let stdout = "";
      let stderr = "";
      // Stream decoding keeps multibyte characters intact across chunks.
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stderr += chunk));
      child.on("error", reject);
      child.on("close", (exitCode) =>
        resolve({ exitCode: exitCode ?? 1, stdout, stderr })
      );
      child.stdin.end(stdin ?? "");
    });
}

/** Non-secret settings the runner records before a step and restores afterwards. */
// Scheduling, search and model settings (proposal 5.5), so each run records
// its production parity and the run-only changes can be undone exactly.
export const RUNTIME_SETTINGS = [
  "PAUSE_AUTONOMOUS_JOBS",
  "PROSPECTING_AUTO_RESCHEDULE",
  "PROSPECTING_RESCHEDULE_INTERVAL_MINUTES",
  "PROSPECTING_BOOTSTRAP_READY_TARGET",
  "PROSPECTING_BOOTSTRAP_INTERVAL_MINUTES",
  "PROSPECTING_BOOTSTRAP_MAX_CYCLES",
  "PROSPECTING_BOOTSTRAP_NO_PROGRESS_TIMEOUT_MINUTES",
  "PROSPECTING_BOOTSTRAP_PENDING_QUALIFICATION_YIELD_PERCENT",
  "PROSPECTING_SEED_KEYWORDS_PER_CYCLE",
  "PROSPECTING_SOCIAL_QUERIES_PER_CYCLE",
  "PROSPECTING_TWITTER_SEARCH_BATCH",
  "PROSPECTING_TWITTER_SEARCH_PAGES_PER_QUERY",
  "PROSPECTING_TWITTER_SEARCH_LOOKBACK_DAYS",
  "PROSPECTING_LINKEDIN_POST_SEARCH_BATCH",
  "PROSPECTING_LINKEDIN_PEOPLE_SEARCH_BATCH",
  "PROVIDER_SEARCH_MAX_RUNTIME_MS",
  "AI_ONBOARDING_MODEL",
  "AI_REASONING_MODEL",
  "AI_FAST_MODEL",
  "AI_TEXT_EMBEDDING_MODEL",
  "OPENROUTER_ROUTING_PRESET",
  "QUALIFICATION_MAX_PARALLELISM",
  "ENRICHMENT_MAX_PARALLELISM",
  "JEV_PREFILTER_MODE",
  "BENCHMARK_LEARNING_OFF_WORKSPACE_IDS",
  "BENCHMARK_POOL_LIMITS",
  "BENCHMARK_KEYWORD_POST_SEARCH_LIMIT",
  "BENCHMARK_HALTED_WORKSPACE_ID",
  "BENCHMARK_MATCH_LIMIT_PER_CYCLE",
  "BENCHMARK_MATCH_LIMIT_PER_QUERY",
] as const;
export type RuntimeSetting = (typeof RUNTIME_SETTINGS)[number];
export const LEARNING_OFF_SETTING = "BENCHMARK_LEARNING_OFF_WORKSPACE_IDS";
// Development only: most LinkdAPI calls enrichment's keyword post search may
// make per benchmark workspace cycle.
export const KEYWORD_SEARCH_CAP_SETTING = "BENCHMARK_KEYWORD_POST_SEARCH_LIMIT";
// Development only: names the workspace a step is stopping; while set, the
// deployment refuses every LinkdAPI call (convex/lib/benchmarkLinkdApiCap.ts).
export const HALT_SETTING = "BENCHMARK_HALTED_WORKSPACE_ID";
// Development only: most matches a benchmark workspace's cycle qualifies before
// the plan-limit gate parks further qualification (convex/lib/benchmarkMatchLimit.ts).
export const MATCH_LIMIT_SETTING = "BENCHMARK_MATCH_LIMIT_PER_CYCLE";
// Development only: most matches a benchmark workspace qualifies across all its
// cycles; once reached, the gate parks qualification and no further cycle runs.
export const QUERY_MATCH_LIMIT_SETTING = "BENCHMARK_MATCH_LIMIT_PER_QUERY";

// Each match limit: its setting, the hook confirming it, and its name in errors.
const MATCH_LIMITS = {
  cycle: {
    setting: MATCH_LIMIT_SETTING,
    status: PEOPLE_SEARCH_HOOKS.matchLimitStatus,
    name: "match limit",
  },
  query: {
    setting: QUERY_MATCH_LIMIT_SETTING,
    status: PEOPLE_SEARCH_HOOKS.matchLimitPerQueryStatus,
    name: "match limit per query",
  },
} as const;
export type MatchLimitScope = keyof typeof MATCH_LIMITS;

/** Development provider keys replaced by funded keys during a live step, then restored. */
export const PROVIDER_KEYS = ["SOCIALAPI_API_KEY", "LINKDAPI_API_KEY"] as const;
export type ProviderKey = (typeof PROVIDER_KEYS)[number];
// Secrets the runner may read: provider keys to restore, and the deployment's
// OpenRouter key to confirm it is the key whose spend is measured.
type SecretSetting = ProviderKey | "OPENROUTER_API_KEY";

export type DevelopmentRuntimeSnapshot = Readonly<{
  deployment: `dev:${string}`;
  recordedAt: string;
  settings: Readonly<Record<RuntimeSetting, string | null>>;
}>;

const idSchema = z.string().min(1);

export const workspaceRefSchema = z.strictObject({
  workspaceId: idSchema,
  createdAt: z.number(),
});
export type BenchmarkWorkspace = Readonly<
  z.infer<typeof workspaceRefSchema> & { label: string }
>;

const parkedSchema = z.object({
  pending: z.number(),
  enrichmentWaiting: z.number(),
});

const statusFields = {
  workspaceStatus: z.string().nullable(),
  pauseReason: z.string().nullable(),
  workflowId: z.string().nullable(),
  workflowState: z.string().nullable(),
  workflowStartedAt: z.number().nullable(),
  nextRunAt: z.number().nullable(),
  bootstrapCycleCount: z.number().nullable(),
  bootstrapCompletedAt: z.number().nullable(),
  counts: z.object({
    total: z.number(),
    pending: z.number(),
    qualified: z.number(),
    disqualified: z.number(),
    unscored: z.number(),
    organizations: z.number(),
    // Qualified prospects whose enrichment has not finished.
    enrichmentWaiting: z.number().default(0),
  }),
  pendingLessonWrites: z.number(),
  truncated: z.boolean(),
};
const matchLimitFields = {
  // The cycle's limit: the lower of the limit per cycle and what the limit
  // per query leaves after earlier cycles.
  limit: z.number(),
  qualifiedThisCycle: z.number(),
  reached: z.boolean(),
  // The limit per query and the workspace's matches over all its cycles;
  // null (and not reached) when none applies or the deployment predates it.
  queryLimit: z.number().nullable().default(null),
  queryMatches: z.number().nullable().default(null),
  queryReached: z.boolean().default(false),
};

// What `runStatus` returns; the parked work is read page by page after it.
const deploymentStatusSchema = z
  .object({
    ...statusFields,
    matchLimit: z.object(matchLimitFields).nullable().default(null),
  })
  .nullable();

const parkedPageSchema = parkedSchema.extend({ cursor: z.string().nullable() });
// Pages read at most per status read (each byte-capped; far more than any
// benchmark workspace needs). Past it the read fails and is retried.
const MAX_PARKED_PAGES = 50;

export const runStatusSchema = z
  .object({
    ...statusFields,
    // The development-only match limit per cycle; null when none applies.
    // Absent from deployments without it.
    matchLimit: z
      .object({
        ...matchLimitFields,
        // Of counts.pending and counts.enrichmentWaiting, the prospects the
        // reached limit holds back for the rest of the cycle: no workflow is
        // working on them and none will start.
        parked: parkedSchema,
      })
      .nullable()
      .default(null),
  })
  .nullable();
export type RunStatus = z.infer<typeof runStatusSchema>;

// Private export: may hold personal data, so it is written only to ignored storage.
export const exportedProspectSchema = z.object({
  id: idSchema,
  createdAt: z.number(),
  platform: z.string(),
  prospectType: z.enum(["individual", "organization", "unknown"]).nullable(),
  displayName: z.string().nullable(),
  title: z.string().nullable(),
  company: z.string().nullable(),
  location: z.string().nullable(),
  briefIntro: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  socialProfiles: z.unknown(),
  matchReason: z.string().nullable(),
  matchedKeywords: z.array(z.string()),
  qualificationStatus: z.string().nullable(),
  qualificationScore: z.number().nullable(),
  qualificationReasoning: z.string().nullable(),
  qualifiedAt: z.number().nullable(),
  disqualifiedAt: z.number().nullable(),
  qualificationSources: z.array(z.unknown()),
  evidencePosts: z.array(z.string()),
});
export type ExportedProspect = z.infer<typeof exportedProspectSchema>;

const exportPageSchema = z.object({
  page: z.array(exportedProspectSchema),
  isDone: z.boolean(),
  continueCursor: z.string(),
});

export const poolLimitsSchema = z.strictObject({
  workflow: z.number().int(),
  qualification: z.number().int(),
  enrichment: z.number().int(),
  previewQualification: z.number().int(),
  previewEnrichment: z.number().int(),
  outreachPlan: z.number().int(),
  memoryEvaluation: z.number().int(),
});
export type PoolLimits = z.infer<typeof poolLimitsSchema>;

const poolStatusSchema = z.object({
  limits: poolLimitsSchema,
  source: z.enum(["default", "benchmark"]),
  error: z.string().nullable(),
  enforcedTenantScheduling: z.boolean(),
});

// What a development-only cap's resolver reports (keyword post search, match limit).
const capStatusSchema = z.object({
  limit: z.number().int().nullable(),
  source: z.enum(["default", "benchmark"]),
  error: z.string().nullable(),
});

export const stopResultSchema = z.object({
  cancelFailed: z.boolean(),
  stopped: z.boolean(),
  monitorsDeleted: z.number(),
  monitorFailures: z.array(z.string()),
  // Qualification and enrichment workflows a firm stop canceled.
  prospectWorkflowsCanceled: z.number().optional(),
});
export type StopResult = z.infer<typeof stopResultSchema>;

export const resumeResultSchema = z.object({
  qualificationQueued: z.number(),
  failuresCleared: z.number(),
  enrichmentQueued: z.number(),
  leasesReleased: z.number(),
  leasesKept: z.number(),
  cycleStartsCanceled: z.number(),
  truncated: z.boolean(),
});
export type ResumeResult = z.infer<typeof resumeResultSchema>;

const activitySchema = z.object({
  workspaceIds: z.array(idSchema),
  truncated: z.boolean(),
});

export const runCostsSchema = z.object({
  providers: z.record(
    z.string(),
    z.object({
      usd: z.number(),
      requests: z.number(),
      billableUnits: z.number(),
    })
  ),
  llmUsdRecorded: z.number(),
  llmCallsRecorded: z.number(),
  capped: z.boolean(),
});
export type RecordedRunCosts = z.infer<typeof runCostsSchema>;

export const linkdApiUnitsSchema = z.object({
  billableUnits: z.number(),
  successes: z.number(),
  events: z.number(),
  capped: z.boolean(),
});
export type LinkdApiUnits = z.infer<typeof linkdApiUnitsSchema>;

export class ConvexCommandError extends Error {}

export class ConvexReacherXDriver {
  constructor(
    readonly deployment: `dev:${string}`,
    private readonly run: CommandRunner
  ) {}

  private async call<T>(
    fn: string,
    args: Record<string, unknown>,
    schema: z.ZodType<T>
  ): Promise<T> {
    const result = await this.run(["run", fn, JSON.stringify(args)]);
    // CLI errors can echo arguments; report the function name only.
    if (result.exitCode !== 0)
      throw new ConvexCommandError(`Convex function ${fn} failed.`);
    return schema.parse(runOutput(result.stdout));
  }

  private async env(args: readonly string[], stdin?: string) {
    const result = await this.run(["env", ...args], stdin);
    if (result.exitCode !== 0)
      throw new ConvexCommandError(`Convex env ${args[0]} failed.`);
    return result.stdout;
  }

  /** The exact value of one variable, or null when unset (the CLI prints nothing on stdout). */
  private async read(name: string): Promise<string | null> {
    const output = await this.env(["get", name]);
    return output === "" ? null : output.replace(/\n$/, "");
  }

  getSetting(name: RuntimeSetting): Promise<string | null> {
    return this.read(name);
  }

  /** A secret's raw value for the caller to hold in memory or private storage; never log it. */
  readSecret(name: SecretSetting): Promise<string | null> {
    return this.read(name);
  }

  /** Installs or removes a provider key; the value travels on stdin only. */
  async setProviderKey(name: ProviderKey, value: string | null) {
    if (value !== null) await this.env(["set", name], `${value}\n`);
    else if ((await this.read(name)) !== null) await this.env(["remove", name]);
  }

  /** Reads allowlisted settings one by one, so no other value is loaded and multiline values stay exact. */
  async snapshotRuntime(): Promise<DevelopmentRuntimeSnapshot> {
    const settings: Partial<Record<RuntimeSetting, string | null>> = {};
    for (const name of RUNTIME_SETTINGS)
      settings[name] = await this.getSetting(name);
    return {
      deployment: this.deployment,
      recordedAt: new Date().toISOString(),
      settings: settings as Record<RuntimeSetting, string | null>,
    };
  }

  /** Sets or removes each recorded setting so the deployment matches the snapshot. */
  async restoreRuntime(snapshot: DevelopmentRuntimeSnapshot) {
    if (snapshot.deployment !== this.deployment)
      throw new ConvexCommandError(
        "The snapshot belongs to another deployment."
      );
    const current = (await this.snapshotRuntime()).settings;
    for (const name of RUNTIME_SETTINGS) {
      const value = snapshot.settings[name];
      if (current[name] === value) continue;
      if (value === null) await this.env(["remove", name]);
      else await this.setSetting(name, value);
    }
  }

  async setSetting(name: RuntimeSetting, value: string) {
    await this.env(["set", name], `${value}\n`);
  }

  /**
   * Sets the Starter limits (or clears them with null), reconciles the worker
   * pools and returns the limits the deployment reports in effect. Requires
   * autonomous jobs to be unpaused, because reconciliation is skipped while
   * they are paused. Stops on any mismatch rather than running with unknown limits.
   */
  async applyPoolLimits(limits: PoolLimits | null) {
    if (limits)
      await this.setSetting("BENCHMARK_POOL_LIMITS", JSON.stringify(limits));
    else if ((await this.getSetting("BENCHMARK_POOL_LIMITS")) !== null)
      await this.env(["remove", "BENCHMARK_POOL_LIMITS"]);
    const reconciled = await this.call(
      "tenantScheduler:reconcilePoolConfigurationInternal",
      {},
      z.object({ enforced: z.boolean() })
    );
    const status = await this.call(
      PEOPLE_SEARCH_HOOKS.poolLimitsStatus,
      {},
      poolStatusSchema
    );
    const expectedSource = limits ? "benchmark" : "default";
    if (
      status.error ||
      status.enforcedTenantScheduling ||
      reconciled.enforced ||
      status.source !== expectedSource ||
      (limits &&
        Object.entries(limits).some(
          ([pool, value]) => status.limits[pool as keyof PoolLimits] !== value
        ))
    )
      throw new ConvexCommandError(
        "The deployment did not confirm the requested pool limits."
      );
    return status.limits;
  }

  /**
   * Sets the keyword post-search cap per benchmark workspace cycle (or clears it
   * with null) and returns the cap the deployment reports in effect. Stops on
   * any mismatch rather than running with an unknown cap.
   */
  async applyKeywordPostSearchLimit(limit: number | null) {
    if (limit !== null)
      await this.setSetting(KEYWORD_SEARCH_CAP_SETTING, String(limit));
    else if ((await this.getSetting(KEYWORD_SEARCH_CAP_SETTING)) !== null)
      await this.env(["remove", KEYWORD_SEARCH_CAP_SETTING]);
    const status = await this.call(
      PEOPLE_SEARCH_HOOKS.keywordPostSearchLimitStatus,
      {},
      capStatusSchema
    );
    if (
      status.error ||
      status.limit !== limit ||
      status.source !== (limit === null ? "default" : "benchmark")
    )
      throw new ConvexCommandError(
        "The deployment did not confirm the requested keyword post-search cap."
      );
    return status.limit;
  }

  /**
   * Sets a match limit, per benchmark workspace cycle or per query (or clears
   * it with null), and returns the limit in effect. A limit must be confirmed
   * by the deployment's own resolver; a cleared one only needs the setting
   * gone, because an unset value means no limit. Stops on any mismatch.
   */
  async applyMatchLimit(
    limit: number | null,
    scope: MatchLimitScope = "cycle"
  ) {
    const { setting, status: hook, name } = MATCH_LIMITS[scope];
    if (limit === null) {
      if ((await this.getSetting(setting)) !== null)
        await this.env(["remove", setting]);
      if ((await this.getSetting(setting)) !== null)
        throw new ConvexCommandError(`The ${name} was not cleared.`);
      return null;
    }
    await this.setSetting(setting, String(limit));
    const status = await this.call(hook, {}, capStatusSchema);
    if (status.error || status.limit !== limit || status.source !== "benchmark")
      throw new ConvexCommandError(
        `The deployment did not confirm the requested ${name}.`
      );
    return status.limit;
  }

  prepare(args: {
    userId: string;
    label: string;
    prompt: string;
    useCaseKey: string;
  }) {
    return this.call(
      PEOPLE_SEARCH_HOOKS.prepareWorkspace,
      args,
      workspaceRefSchema
    ).then((ref): BenchmarkWorkspace => ({ ...ref, label: args.label }));
  }

  findPrepared(args: { userId: string; label: string; since: number }) {
    return this.call(
      PEOPLE_SEARCH_HOOKS.findRunWorkspace,
      args,
      workspaceRefSchema.nullable()
    ).then((ref) => (ref ? { ...ref, label: args.label } : null));
  }

  /** One workspace runs at a time, so the switch names only the active control workspace. */
  async setLearning(
    workspace: BenchmarkWorkspace,
    condition: LearningCondition
  ) {
    if (condition === "off")
      await this.setSetting(LEARNING_OFF_SETTING, workspace.workspaceId);
    else if ((await this.getSetting(LEARNING_OFF_SETTING)) !== null)
      await this.env(["remove", LEARNING_OFF_SETTING]);
  }

  async start(workspace: BenchmarkWorkspace) {
    await this.call(
      PEOPLE_SEARCH_HOOKS.startWorkspace,
      { workspaceId: workspace.workspaceId },
      z.null()
    );
  }

  async status(workspace: BenchmarkWorkspace): Promise<RunStatus> {
    const { workspaceId } = workspace;
    const status = await this.call(
      PEOPLE_SEARCH_HOOKS.runStatus,
      { workspaceId },
      deploymentStatusSchema
    );
    if (!status?.matchLimit) return status && { ...status, matchLimit: null };
    const parked = { pending: 0, enrichmentWaiting: 0 };
    if (status.matchLimit.reached) {
      let cursor: string | null = null;
      for (let page = 0; ; page += 1) {
        if (page >= MAX_PARKED_PAGES)
          throw new ConvexCommandError("Parked work has too many pages.");
        const result: z.infer<typeof parkedPageSchema> = await this.call(
          PEOPLE_SEARCH_HOOKS.matchLimitParked,
          { workspaceId, cursor },
          parkedPageSchema
        );
        parked.pending += result.pending;
        parked.enrichmentWaiting += result.enrichmentWaiting;
        if (!(cursor = result.cursor)) break;
      }
    }
    return { ...status, matchLimit: { ...status.matchLimit, parked } };
  }

  async exportCandidates(workspace: BenchmarkWorkspace) {
    const prospects: ExportedProspect[] = [];
    let cursor: string | null = null;
    for (;;) {
      const page: z.infer<typeof exportPageSchema> = await this.call(
        PEOPLE_SEARCH_HOOKS.exportCandidates,
        {
          workspaceId: workspace.workspaceId,
          paginationOpts: { numItems: 100, cursor },
        },
        exportPageSchema
      );
      prospects.push(...page.page);
      if (page.isDone) return prospects;
      cursor = page.continueCursor;
    }
  }

  /**
   * Pauses the workspace, cancels its workflow and deletes its SocialAPI
   * monitors. With `halt`, the qualification and enrichment workflows still
   * running for its prospects are canceled too. Never deletes data.
   */
  stop(
    workspace: Pick<BenchmarkWorkspace, "workspaceId">,
    options: Readonly<{ halt?: boolean }> = {}
  ): Promise<StopResult> {
    return this.call(
      PEOPLE_SEARCH_HOOKS.stopRun,
      {
        workspaceId: workspace.workspaceId,
        ...(options.halt ? { halt: true } : {}),
      },
      stopResultSchema
    );
  }

  /**
   * The development kill switch: from now until the session reset removes
   * it, the deployment refuses every LinkdAPI call, so work already running
   * for a workspace being stopped cannot keep spending LinkedIn credits.
   */
  async haltLinkedIn(workspace: Pick<BenchmarkWorkspace, "workspaceId">) {
    await this.setSetting(HALT_SETTING, workspace.workspaceId);
  }

  /**
   * Runs a held workspace again at the cycle it stopped in (`workflowId`),
   * requeuing its unfinished qualification, enrichment and lesson writing.
   * Starts no discovery; refused while automatic cycles are on.
   */
  resume(workspace: BenchmarkWorkspace, workflowId: string) {
    return this.call(
      PEOPLE_SEARCH_HOOKS.resumeHeldWorkspace,
      { workspaceId: workspace.workspaceId, workflowId },
      resumeResultSchema
    );
  }

  /** Cancels next cycles already scheduled for the workspace; it keeps running so qualification finishes. */
  cancelScheduledCycles(workspace: BenchmarkWorkspace) {
    return this.call(
      PEOPLE_SEARCH_HOOKS.cancelScheduledCycles,
      { workspaceId: workspace.workspaceId },
      z.object({ canceled: z.number(), truncated: z.boolean() })
    );
  }

  /** Schedules the held next cycle at `notBefore`, or now if later. */
  releaseNextCycle(workspace: BenchmarkWorkspace, notBefore: number) {
    return this.call(
      PEOPLE_SEARCH_HOOKS.releaseNextCycle,
      { workspaceId: workspace.workspaceId, notBefore },
      z.object({
        scheduledAt: z.number(),
        canceled: z.number(),
        truncated: z.boolean(),
      })
    );
  }

  /** Other workspaces that could spend while jobs are unpaused. */
  activity(except?: BenchmarkWorkspace) {
    return this.call(
      PEOPLE_SEARCH_HOOKS.deploymentActivity,
      except ? { exceptWorkspaceId: except.workspaceId } : {},
      activitySchema
    );
  }

  /** Provider usage and model cost the app recorded for the workspace since a time. */
  runCosts(workspace: BenchmarkWorkspace, since: number) {
    return this.call(
      PEOPLE_SEARCH_HOOKS.runCosts,
      { workspaceId: workspace.workspaceId, since },
      runCostsSchema
    );
  }

  /** LinkedIn data units since a time; only the active benchmark runs while jobs are unpaused. */
  linkdApiUnitsSince(since: number) {
    return this.call(
      PEOPLE_SEARCH_HOOKS.linkdApiUnitsSince,
      { since },
      linkdApiUnitsSchema
    );
  }

  /** Closes a LinkedIn circuit breaker an earlier run left open. */
  resetLinkdApiCircuit() {
    return this.call(
      PEOPLE_SEARCH_HOOKS.resetLinkdApiCircuit,
      {},
      z.object({ reset: z.boolean(), previousStatus: z.string().optional() })
    );
  }
}
