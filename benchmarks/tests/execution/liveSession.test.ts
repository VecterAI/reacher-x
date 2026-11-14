import assert from "node:assert/strict";
import test from "node:test";
import {
  LIVE_SESSION_PATH,
  LiveSessionError,
  ResetIncomplete,
  hasOpenSession,
  resetLiveSession,
  runSettingsSchema,
  withLiveSession,
  type LiveSessionConfig,
} from "../../core/execution/liveSession";
import { DEFAULT_POOLS, fakeDeployment, memoryFile } from "./fakeDeployment";

// Synthetic values only.
const AT_REST = {
  PAUSE_AUTONOMOUS_JOBS: "true",
  PROSPECTING_AUTO_RESCHEDULE: "0",
  OPENROUTER_API_KEY: "or-deployment",
  SOCIALAPI_API_KEY: "social-dev",
  LINKDAPI_API_KEY: "linkd-dev",
};
const STARTER = { ...DEFAULT_POOLS, workflow: 4, qualification: 2 };
const config: LiveSessionConfig = {
  runId: "run-1",
  settings: {
    production: { AI_ONBOARDING_MODEL: "openai/gpt-6-luna-pro" },
    productionSource: "docs/configuration.md",
    runOnly: {
      PROSPECTING_RESCHEDULE_INTERVAL_MINUTES: "10",
      PROSPECTING_BOOTSTRAP_INTERVAL_MINUTES: "10",
    },
    poolLimits: STARTER,
  },
  fundedKeys: {
    SOCIALAPI_API_KEY: "social-funded",
    LINKDAPI_API_KEY: "linkd-funded",
  },
  deploymentOpenRouterKey: "or-deployment",
};
const workspace = { workspaceId: "w1", createdAt: 1, label: "run-1_6_on" };
const SECRETS = ["social-funded", "linkd-funded", "social-dev", "linkd-dev"];

const remoteChanges = (calls: { args: readonly string[] }[]) =>
  calls.filter(
    (call) =>
      call.args[0] === "env" &&
      (call.args[1] === "set" || call.args[1] === "remove")
  );

test("a step runs with funded keys and run settings, then everything is restored", async () => {
  const { env, calls, driver } = fakeDeployment(AT_REST);
  const file = memoryFile();
  const seen = await withLiveSession(driver, file, config, async (session) => {
    await session.trackWorkspace(workspace);
    assert.deepEqual(session.confirmed.poolLimits, STARTER);
    return Object.fromEntries(env);
  });
  assert.equal(seen.SOCIALAPI_API_KEY, "social-funded");
  assert.equal(seen.LINKDAPI_API_KEY, "linkd-funded");
  assert.equal(seen.PAUSE_AUTONOMOUS_JOBS, "false");
  assert.equal(seen.AI_ONBOARDING_MODEL, "openai/gpt-6-luna-pro");
  assert.equal(seen.PROSPECTING_RESCHEDULE_INTERVAL_MINUTES, "10");
  assert.deepEqual(JSON.parse(seen.BENCHMARK_POOL_LIMITS), STARTER);

  // Exactly the original deployment afterwards.
  assert.deepEqual(Object.fromEntries(env), AT_REST);
  // Keys travel on stdin only, and the closed record keeps no key.
  assert.ok(
    calls.every((call) =>
      SECRETS.every((secret) => !call.args.includes(secret))
    )
  );
  assert.equal(JSON.parse(file.data!).status, "restored");
  assert.ok(SECRETS.every((secret) => !file.data!.includes(secret)));
});

test("the reset still runs when the step fails, and the step's error is kept", async () => {
  const { env, driver, functionCalls } = fakeDeployment(AT_REST);
  const file = memoryFile();
  await assert.rejects(
    withLiveSession(driver, file, config, async (session) => {
      await session.trackWorkspace(workspace);
      throw new Error("adapter failed");
    }),
    /adapter failed/
  );
  assert.ok(functionCalls().includes("benchmarkPeopleSearch:stopRun"));
  assert.deepEqual(Object.fromEntries(env), AT_REST);
  assert.equal(await hasOpenSession(file), false);
});

test("monitors left behind keep the funded SocialAPI key and the session open until they are deleted", async () => {
  let monitorFailures = ["m1"];
  const { env, driver } = fakeDeployment(AT_REST, {
    "benchmarkPeopleSearch:stopRun": () => ({
      stopped: true,
      cancelFailed: false,
      monitorsDeleted: 0,
      monitorFailures,
    }),
  });
  const file = memoryFile();
  const failure = await withLiveSession(driver, file, config, (session) =>
    session.trackWorkspace(workspace)
  ).catch((error: unknown) => error);
  assert.ok(failure instanceof ResetIncomplete);
  assert.match(failure.message, /1 SocialAPI monitor/);
  assert.equal(env.get("SOCIALAPI_API_KEY"), "social-funded");
  assert.equal(env.get("LINKDAPI_API_KEY"), "linkd-dev");
  assert.equal(env.get("PAUSE_AUTONOMOUS_JOBS"), "true");
  assert.equal(env.has("BENCHMARK_POOL_LIMITS"), false);
  assert.equal(await hasOpenSession(file), true);

  // Once the monitors are gone, a repeated reset finishes.
  monitorFailures = [];
  assert.deepEqual(await resetLiveSession(driver, file), []);
  assert.deepEqual(Object.fromEntries(env), AT_REST);
  assert.equal(await hasOpenSession(file), false);
});

test("nothing changes when the deployment is not ready for a step", async () => {
  const cases: [
    Record<string, string>,
    Record<string, () => unknown>,
    RegExp,
  ][] = [
    [{ ...AT_REST, PAUSE_AUTONOMOUS_JOBS: "false" }, {}, /not paused/],
    [{ ...AT_REST, PROSPECTING_AUTO_RESCHEDULE: "on" }, {}, /Automatic cycles/],
    [{ ...AT_REST, BENCHMARK_POOL_LIMITS: "{}" }, {}, /pool limits/],
    [{ ...AT_REST, OPENROUTER_API_KEY: "or-other" }, {}, /OpenRouter key/],
    [
      AT_REST,
      {
        "benchmarkPeopleSearch:deploymentActivity": () => ({
          workspaceIds: ["w9"],
          truncated: false,
        }),
      },
      /Pause them first: w9/,
    ],
  ];
  for (const [initial, handlers, message] of cases) {
    const { calls, driver } = fakeDeployment(initial, handlers);
    const file = memoryFile();
    await assert.rejects(
      withLiveSession(driver, file, config, async () => undefined),
      (error: unknown) =>
        error instanceof LiveSessionError && message.test(error.message)
    );
    assert.deepEqual(remoteChanges(calls), []);
    assert.equal(file.data, null);
  }
});

test("a step left open blocks the next one until it is reset", async () => {
  const { env, driver } = fakeDeployment(AT_REST);
  const file = memoryFile();
  // Capture the record and the deployment mid-step, as a crash leaves them.
  let crash = null as { record: string; env: Map<string, string> } | null;
  await withLiveSession(driver, file, config, async (session) => {
    await session.trackWorkspace(workspace);
    crash = { record: file.data!, env: new Map(env) };
  });
  await file.write(crash!.record);
  env.clear();
  for (const [name, value] of crash!.env) env.set(name, value);
  assert.equal(env.get("SOCIALAPI_API_KEY"), "social-funded");

  assert.equal(await hasOpenSession(file), true);
  await assert.rejects(
    withLiveSession(driver, file, config, async () => undefined),
    /not reset/
  );
  assert.deepEqual(await resetLiveSession(driver, file), []);
  assert.deepEqual(Object.fromEntries(env), AT_REST);
});

test("a setting the deployment does not confirm stops the step and resets it", async () => {
  const { env, ignoredSets, driver } = fakeDeployment(AT_REST);
  ignoredSets.add("AI_ONBOARDING_MODEL");
  const file = memoryFile();
  let ran = false;
  await assert.rejects(
    withLiveSession(driver, file, config, async () => {
      ran = true;
    }),
    /not confirmed on the deployment: AI_ONBOARDING_MODEL/
  );
  assert.equal(ran, false);
  assert.deepEqual(Object.fromEntries(env), AT_REST);
});

test("a development key that was unset is removed again, not left funded", async () => {
  const { SOCIALAPI_API_KEY: _unset, ...withoutSocial } = AT_REST;
  const { env, driver } = fakeDeployment(withoutSocial);
  await withLiveSession(driver, memoryFile(), config, async () => undefined);
  assert.equal(env.has("SOCIALAPI_API_KEY"), false);
});

test("run settings cannot take over what the runner manages", () => {
  const base = config.settings;
  assert.equal(runSettingsSchema.safeParse(base).success, true);
  for (const settings of [
    { ...base, runOnly: { PAUSE_AUTONOMOUS_JOBS: "false" } },
    { ...base, production: { BENCHMARK_LEARNING_OFF_WORKSPACE_IDS: "w1" } },
    {
      ...base,
      production: { AI_FAST_MODEL: "a" },
      runOnly: { AI_FAST_MODEL: "b" },
    },
  ])
    assert.equal(runSettingsSchema.safeParse(settings).success, false);
  assert.equal(LIVE_SESSION_PATH.startsWith("benchmarks/.local/"), true);
});
