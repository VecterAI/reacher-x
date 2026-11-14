import { z } from "zod";
import {
  LEARNING_OFF_SETTING,
  PROVIDER_KEYS,
  RUNTIME_SETTINGS,
  poolLimitsSchema,
  type BenchmarkWorkspace,
  type ConvexReacherXDriver,
  type DevelopmentRuntimeSnapshot,
  type PoolLimits,
  type ProviderKey,
  type RuntimeSetting,
} from "./convex";
import { identifierSchema } from "./manifest";
import { keyFingerprint } from "./spend";
import { timestampSchema } from "./types";

/**
 * Proposal 5.3 steps 1 and 6 on the development deployment: switch the run
 * settings on for one live step, and always switch them off again, even when
 * the step fails. Before anything changes, the original settings and
 * development provider keys are written to a private session record, so a
 * crashed step can still be reset with `pnpm benchmark --reset`.
 */

export const LIVE_SESSION_PATH = "benchmarks/.local/live-session.json";

// Set by the session and the cycle controller, never by frozen run settings.
const MANAGED_SETTINGS: readonly RuntimeSetting[] = [
  "PAUSE_AUTONOMOUS_JOBS",
  "PROSPECTING_AUTO_RESCHEDULE",
  LEARNING_OFF_SETTING,
  "BENCHMARK_POOL_LIMITS",
];

const settingValuesSchema = z.partialRecord(
  z.enum(RUNTIME_SETTINGS),
  z.string().min(1)
);

export const runSettingsSchema = z
  .strictObject({
    // Production values (proposal 5.5), set explicitly so no default can differ.
    production: settingValuesSchema,
    // Where the production values were confirmed.
    productionSource: z.string().trim().min(1),
    // Changes made only during a run, such as the 10-minute cycle gap.
    runOnly: settingValuesSchema,
    // Starter pool limits, or null for the deployment's defaults (a D1 decision).
    poolLimits: poolLimitsSchema.nullable(),
  })
  .superRefine((settings, ctx) => {
    const production = Object.keys(settings.production);
    const runOnly = Object.keys(settings.runOnly);
    for (const name of [...production, ...runOnly])
      if (MANAGED_SETTINGS.includes(name as RuntimeSetting))
        ctx.addIssue({
          code: "custom",
          message: `${name} is set by the runner.`,
        });
    if (runOnly.some((name) => production.includes(name)))
      ctx.addIssue({
        code: "custom",
        message: "A setting is either a production value or a run-only change.",
      });
  });
export type RunSettings = z.infer<typeof runSettingsSchema>;

// Parsed as the deployment parses them: convex/lib/autonomousJobHelpers.ts and runtimeConfigHelpers.ts.
const normalized = (value: string | null) => value?.trim().toLowerCase() ?? "";
export const jobsPaused = (value: string | null) =>
  ["true", "1"].includes(normalized(value));
export const automaticCyclesOn = (value: string | null) =>
  ["1", "true", "yes", "on"].includes(normalized(value));

/** What keeps the deployment from being at rest, where autonomous work is off and nothing is left over from a run. */
export function atRestProblems(
  settings: DevelopmentRuntimeSnapshot["settings"]
) {
  const problems: string[] = [];
  if (!jobsPaused(settings.PAUSE_AUTONOMOUS_JOBS))
    problems.push("Autonomous jobs are not paused (PAUSE_AUTONOMOUS_JOBS).");
  if (automaticCyclesOn(settings.PROSPECTING_AUTO_RESCHEDULE))
    problems.push("Automatic cycles are on (PROSPECTING_AUTO_RESCHEDULE).");
  if (settings[LEARNING_OFF_SETTING] !== null)
    problems.push(
      `A learning-off workspace is still named (${LEARNING_OFF_SETTING}).`
    );
  if (settings.BENCHMARK_POOL_LIMITS !== null)
    problems.push(
      "Benchmark pool limits are still set (BENCHMARK_POOL_LIMITS)."
    );
  return problems;
}

const snapshotSchema = z.strictObject({
  deployment: z
    .string()
    .regex(/^dev:.+/)
    .transform((value) => value as `dev:${string}`),
  recordedAt: timestampSchema,
  settings: z.record(z.enum(RUNTIME_SETTINGS), z.string().nullable()),
});

const sessionSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("active"),
    runId: identifierSchema,
    openedAt: timestampSchema,
    snapshot: snapshotSchema,
    // Development keys to put back; kept only until they are restored.
    originalKeys: z.strictObject({
      SOCIALAPI_API_KEY: z.string().nullable(),
      LINKDAPI_API_KEY: z.string().nullable(),
    }),
    // The workspace running now, so a reset after a crash can stop it.
    workspace: z
      .strictObject({
        workspaceId: z.string().min(1),
        createdAt: z.number(),
        label: z.string().min(1),
      })
      .nullable(),
  }),
  z.strictObject({
    status: z.literal("restored"),
    runId: identifierSchema,
    deployment: z.string(),
    openedAt: timestampSchema,
    restoredAt: timestampSchema,
  }),
]);
type SessionRecord = z.infer<typeof sessionSchema>;
type ActiveSession = Extract<SessionRecord, { status: "active" }>;

/** The private session record; FileCheckpointStore provides it under the runner lock. */
export type PrivateFile = Readonly<{
  read(): Promise<string | null>;
  write(data: string): Promise<void>;
}>;

/** The session record in a checkpoint store's private storage; writes need the runner lock. */
export function sessionFileIn(store: {
  readPrivate(path: string): Promise<string | null>;
  writePrivate(path: string, data: string): Promise<void>;
}): PrivateFile {
  return {
    read: () => store.readPrivate(LIVE_SESSION_PATH),
    write: (data) => store.writePrivate(LIVE_SESSION_PATH, data),
  };
}

export class LiveSessionError extends Error {}

/** The step's own error, if any, is kept as `cause`; `problems` lists what is still not reset. */
export class ResetIncomplete extends Error {
  constructor(
    readonly problems: readonly string[],
    options?: { cause?: unknown }
  ) {
    super(
      `The deployment is not fully reset. ${problems.join(" ")} Fix the cause, then run pnpm benchmark --reset.`,
      options
    );
  }
}

async function readSession(file: PrivateFile): Promise<SessionRecord | null> {
  const data = await file.read();
  if (data === null) return null;
  try {
    return sessionSchema.parse(JSON.parse(data));
  } catch {
    // The record can hold keys, so its content is never echoed.
    throw new LiveSessionError(
      `The live session record is unreadable. Review ${LIVE_SESSION_PATH} before any run.`
    );
  }
}

const writeSession = (file: PrivateFile, session: SessionRecord) =>
  file.write(JSON.stringify(session));

/** True when a live step was left open and still needs a reset. */
export async function hasOpenSession(file: PrivateFile) {
  return (await readSession(file))?.status === "active";
}

export type LiveSessionConfig = Readonly<{
  runId: string;
  settings: RunSettings;
  // Funded keys installed for the step, from the local environment file.
  fundedKeys: Readonly<Record<ProviderKey, string>>;
  // The local OPENROUTER_API_KEY. Its spend is ReacherX's cost of record, so
  // it must be the key the deployment uses.
  deploymentOpenRouterKey: string;
}>;

export type ConfirmedRunSettings = Readonly<{
  production: RunSettings["production"];
  productionSource: string;
  runOnly: RunSettings["runOnly"];
  poolLimits: PoolLimits;
  linkdApiCircuitReset: boolean;
}>;

export type LiveSession = Readonly<{
  confirmed: ConfirmedRunSettings;
  /** Records the workspace about to run (or null once it is stopped) before anything else happens. */
  trackWorkspace(workspace: BenchmarkWorkspace | null): Promise<void>;
}>;

/** Read-only checks; nothing has changed if this throws. */
async function checkCanOpen(
  driver: ConvexReacherXDriver,
  file: PrivateFile,
  config: LiveSessionConfig
) {
  if ((await readSession(file))?.status === "active")
    throw new LiveSessionError(
      "A previous live step was not reset. Run pnpm benchmark --reset and review it first."
    );
  runSettingsSchema.parse(config.settings);
  const snapshot = await driver.snapshotRuntime();
  const problems = atRestProblems(snapshot.settings);
  if (problems.length)
    throw new LiveSessionError(
      `The deployment is not at rest. ${problems.join(" ")}`
    );
  const deploymentKey = await driver.readSecret("OPENROUTER_API_KEY");
  if (
    !deploymentKey ||
    keyFingerprint(deploymentKey) !==
      keyFingerprint(config.deploymentOpenRouterKey)
  )
    throw new LiveSessionError(
      "The deployment's OpenRouter key is not the local OPENROUTER_API_KEY, whose spend is measured."
    );
  if (PROVIDER_KEYS.some((name) => !config.fundedKeys[name]?.trim()))
    throw new LiveSessionError("A funded provider key is missing.");
  const activity = await driver.activity();
  if (activity.truncated || activity.workspaceIds.length)
    throw new LiveSessionError(
      `Other workspaces could spend during the step. Pause them first: ${
        activity.truncated
          ? "too many to list"
          : activity.workspaceIds.join(", ")
      }.`
    );
  return snapshot;
}

async function applyRunSettings(
  driver: ConvexReacherXDriver,
  config: LiveSessionConfig
): Promise<ConfirmedRunSettings> {
  // Funded keys, confirmed by fingerprint so neither value is ever printed.
  for (const name of PROVIDER_KEYS) {
    await driver.setProviderKey(name, config.fundedKeys[name]);
    const installed = await driver.readSecret(name);
    if (
      !installed ||
      keyFingerprint(installed) !== keyFingerprint(config.fundedKeys[name])
    )
      throw new LiveSessionError(
        `${name} was not confirmed on the deployment.`
      );
  }
  // A LinkedIn circuit an earlier run left open would skip LinkedIn discovery.
  const circuit = await driver.resetLinkdApiCircuit();

  const wanted = Object.entries({
    ...config.settings.production,
    ...config.settings.runOnly,
  }) as [RuntimeSetting, string][];
  for (const [name, value] of wanted)
    if ((await driver.getSetting(name)) !== value)
      await driver.setSetting(name, value);
  const applied = (await driver.snapshotRuntime()).settings;
  const unconfirmed = wanted
    .filter(([name, value]) => applied[name] !== value)
    .map(([name]) => name);
  if (unconfirmed.length)
    throw new LiveSessionError(
      `Settings not confirmed on the deployment: ${unconfirmed.join(", ")}.`
    );

  // Unpause last; pool limits are reconciled only while jobs run.
  await driver.setSetting("PAUSE_AUTONOMOUS_JOBS", "false");
  if (jobsPaused(await driver.getSetting("PAUSE_AUTONOMOUS_JOBS")))
    throw new LiveSessionError("Autonomous jobs did not unpause.");
  const poolLimits = await driver.applyPoolLimits(config.settings.poolLimits);
  return {
    production: config.settings.production,
    productionSource: config.settings.productionSource,
    runOnly: config.settings.runOnly,
    poolLimits,
    linkdApiCircuitReset: circuit.reset,
  };
}

/**
 * Runs `body` with the run settings on, then resets the deployment whether
 * the body succeeded, failed or was interrupted. A reset that cannot finish
 * raises ResetIncomplete, keeping the body's error as its cause.
 */
export async function withLiveSession<T>(
  driver: ConvexReacherXDriver,
  file: PrivateFile,
  config: LiveSessionConfig,
  body: (session: LiveSession) => Promise<T>,
  now: () => Date = () => new Date()
): Promise<T> {
  const snapshot = await checkCanOpen(driver, file, config);
  let state: ActiveSession = {
    status: "active",
    runId: identifierSchema.parse(config.runId),
    openedAt: now().toISOString(),
    snapshot,
    originalKeys: {
      SOCIALAPI_API_KEY: await driver.readSecret("SOCIALAPI_API_KEY"),
      LINKDAPI_API_KEY: await driver.readSecret("LINKDAPI_API_KEY"),
    },
    workspace: null,
  };
  // Written before the first change, so a crash at any later point can be reset.
  await writeSession(file, state);

  let outcome: { ok: true; value: T } | { ok: false; error: unknown };
  try {
    const confirmed = await applyRunSettings(driver, config);
    outcome = {
      ok: true,
      value: await body({
        confirmed,
        async trackWorkspace(workspace) {
          state = {
            ...state,
            workspace: workspace && {
              workspaceId: workspace.workspaceId,
              createdAt: workspace.createdAt,
              label: workspace.label,
            },
          };
          await writeSession(file, state);
        },
      }),
    };
  } catch (error) {
    outcome = { ok: false, error };
  }
  const problems = await resetLiveSession(driver, file, now);
  if (!outcome.ok) {
    if (problems.length)
      throw new ResetIncomplete(problems, { cause: outcome.error });
    throw outcome.error;
  }
  if (problems.length) throw new ResetIncomplete(problems);
  return outcome.value;
}

/**
 * Proposal 5.3 step 6. Stops the tracked workspace, clears pool limits, pauses
 * jobs, restores every recorded setting, and restores the development keys;
 * the SocialAPI key only once the workspace's monitors are deleted, because
 * the funded key's account owns them. Each part is attempted even when an
 * earlier one fails. Returns what is still not reset; the session stays
 * active until nothing is, so the reset can be repeated.
 */
export async function resetLiveSession(
  driver: ConvexReacherXDriver,
  file: PrivateFile,
  now: () => Date = () => new Date()
): Promise<string[]> {
  const state = await readSession(file);
  if (state?.status !== "active") return [];
  if (state.snapshot.deployment !== driver.deployment)
    return [
      `The open session belongs to ${state.snapshot.deployment}; select that deployment to reset it.`,
    ];

  const problems: string[] = [];
  const attempt = async (failure: string, step: () => Promise<void>) => {
    try {
      await step();
    } catch {
      problems.push(failure);
    }
  };

  // No new cycle, and the monitors go while the key that created them is installed.
  let monitorsCleared = true;
  if (state.workspace) {
    const workspace = state.workspace;
    monitorsCleared = false;
    await attempt("The active workspace could not be stopped.", async () => {
      const stop = await driver.stop(workspace);
      if (stop.cancelFailed)
        problems.push(
          "The workspace's workflow could not be canceled; check that it is not running."
        );
      if (stop.monitorFailures.length)
        problems.push(
          `${stop.monitorFailures.length} SocialAPI monitor(s) were not deleted.`
        );
      else monitorsCleared = true;
    });
  }

  // Reconciliation is skipped while jobs are paused, so limits are cleared first.
  await attempt("Pool limits were not confirmed cleared.", async () => {
    const paused = jobsPaused(await driver.getSetting("PAUSE_AUTONOMOUS_JOBS"));
    if (!paused) await driver.applyPoolLimits(null);
    // While paused, removing the setting below is enough: pools reconcile on the next unpause.
  });

  await attempt("Autonomous jobs could not be paused.", () =>
    driver.setSetting(
      "PAUSE_AUTONOMOUS_JOBS",
      state.snapshot.settings.PAUSE_AUTONOMOUS_JOBS ?? "true"
    )
  );
  await attempt("Recorded settings could not be restored.", () =>
    driver.restoreRuntime(state.snapshot)
  );

  for (const name of PROVIDER_KEYS) {
    if (name === "SOCIALAPI_API_KEY" && !monitorsCleared) {
      problems.push(
        "The funded SocialAPI key stays installed until the workspace's monitors are deleted."
      );
      continue;
    }
    await attempt(`${name} could not be restored.`, async () => {
      const original = state.originalKeys[name];
      await driver.setProviderKey(name, original);
      if ((await driver.readSecret(name)) !== original) throw new Error();
    });
  }

  await attempt("The restored settings could not be confirmed.", async () => {
    const current = (await driver.snapshotRuntime()).settings;
    const differing = RUNTIME_SETTINGS.filter(
      (name) => current[name] !== state.snapshot.settings[name]
    );
    if (differing.length)
      problems.push(`Settings still differ: ${differing.join(", ")}.`);
  });

  if (problems.length === 0)
    await writeSession(file, {
      status: "restored",
      runId: state.runId,
      deployment: state.snapshot.deployment,
      openedAt: state.openedAt,
      restoredAt: now().toISOString(),
    });
  return problems;
}
