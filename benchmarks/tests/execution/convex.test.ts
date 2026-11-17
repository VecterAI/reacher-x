import assert from "node:assert/strict";
import test from "node:test";
import {
  ConvexReacherXDriver,
  LEARNING_OFF_SETTING,
  runOutput,
  type CommandRunner,
} from "../../core/execution/convex";

// Mimics the CLI against an in-memory env; nothing reaches a deployment.
// `env get` prints the raw value plus a newline, or nothing when unset.
function fakeDeployment(initial: Record<string, string>) {
  const env = new Map(Object.entries(initial));
  const calls: { args: readonly string[]; stdin?: string }[] = [];
  const run: CommandRunner = async (args, stdin) => {
    calls.push({ args, stdin });
    const [command, action, name] = args;
    if (command === "env" && action === "get" && name)
      return {
        exitCode: 0,
        stdout: env.has(name) ? `${env.get(name)}\n` : "",
        stderr: env.has(name) ? "" : "not found",
      };
    if (command === "env" && action === "set" && name)
      env.set(name, (stdin ?? "").replace(/\n$/, ""));
    if (command === "env" && action === "remove" && name) env.delete(name);
    if (command === "run")
      return {
        exitCode: 0,
        stdout: JSON.stringify({ workspaceId: "w1", createdAt: 1 }),
        stderr: "",
      };
    return { exitCode: 0, stdout: "", stderr: "" };
  };
  return { env, calls, driver: new ConvexReacherXDriver("dev:test", run) };
}

const workspace = { workspaceId: "w1", createdAt: 1, label: "run-1_13_off" };

test("snapshots read only allowlisted settings and keep exact values", async () => {
  const pretty = '{\n  "workflow": 4\n}';
  const { calls, driver } = fakeDeployment({
    OPENROUTER_API_KEY: "secret",
    PAUSE_AUTONOMOUS_JOBS: "true",
    BENCHMARK_POOL_LIMITS: pretty,
  });
  const { settings } = await driver.snapshotRuntime();
  assert.equal(settings.PAUSE_AUTONOMOUS_JOBS, "true");
  assert.equal(settings.BENCHMARK_POOL_LIMITS, pretty);
  assert.equal(settings[LEARNING_OFF_SETTING], null);
  assert.ok(calls.every((call) => !call.args.includes("OPENROUTER_API_KEY")));
});

test("the learning switch names only the active control workspace", async () => {
  const { env, calls, driver } = fakeDeployment({});
  await driver.setLearning(workspace, "off");
  assert.equal(env.get(LEARNING_OFF_SETTING), "w1");
  // The value travels on stdin, not in the command line.
  assert.ok(calls.every((call) => !call.args.includes("w1")));
  await driver.setLearning(workspace, "on");
  assert.equal(env.has(LEARNING_OFF_SETTING), false);
});

test("restore returns every recorded setting to its snapshot value", async () => {
  const { env, driver } = fakeDeployment({ PAUSE_AUTONOMOUS_JOBS: "true" });
  const snapshot = await driver.snapshotRuntime();
  await driver.setSetting("PAUSE_AUTONOMOUS_JOBS", "false");
  await driver.setSetting("PROSPECTING_RESCHEDULE_INTERVAL_MINUTES", "10");
  await driver.restoreRuntime(snapshot);
  assert.equal(env.get("PAUSE_AUTONOMOUS_JOBS"), "true");
  assert.equal(env.has("PROSPECTING_RESCHEDULE_INTERVAL_MINUTES"), false);
});

test("failed CLI calls report the function, not its arguments", async () => {
  const driver = new ConvexReacherXDriver("dev:test", async () => ({
    exitCode: 1,
    stdout: "",
    stderr: "Benchmark prompt text",
  }));
  await assert.rejects(
    driver.prepare({
      userId: "u1",
      label: "run-1_13_on",
      prompt: "Benchmark prompt text",
      useCaseKey: "find_customers",
    }),
    (error: Error) =>
      error.message ===
      "Convex function benchmarkPeopleSearch:prepareWorkspace failed."
  );
});

test("a function result of null, which the CLI prints as nothing, reads as null", () => {
  assert.equal(runOutput(""), null);
  assert.equal(runOutput("\n"), null);
  assert.deepEqual(runOutput('{"workspaceId":"w1"}\n'), { workspaceId: "w1" });
});
