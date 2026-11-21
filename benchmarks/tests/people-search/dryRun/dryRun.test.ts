import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { dryRun } from "../../../people-search/dryRun/dryRun";

test("the dry run reaches D2 with synthetic labels read back and the learning measures", async () => {
  const [pilot] = await dryRun({
    through: "pilot",
    signal: new AbortController().signal,
    log: () => undefined,
  });
  assert.equal(pilot.outcome.segment, "pilot");
  assert.equal(pilot.outcome.status, "complete");
  // Prompt 6 dropped by approval (20 Nov 2026): prompt 1's two workspaces.
  assert.equal(pilot.outcome.workspaces.length, 2);
  assert.deepEqual(
    pilot.outcome.dropped.map((item) => item.unitId),
    ["w-p06-off", "w-p06-on"]
  );
  assert.match(pilot.report, /Dropped by approval: w-p06-off, w-p06-on never ran/);
  const agreement = pilot.outcome.decision?.rows[0];
  assert.match(agreement?.condition ?? "", /Judges agree with people/);
  assert.notEqual(agreement?.status, "waiting");
  assert.match(pilot.report, /## ReacherX cycle by cycle/);
  assert.match(pilot.report, /Learning on minus off/);
  assert.match(pilot.decision ?? "", /# D2 checkpoint/);
});

test("pnpm benchmark --dry-run prints the reports and contacts nothing", async () => {
  const tsx = createRequire(import.meta.url).resolve("tsx/cli");
  const cli = fileURLToPath(new URL("../../../cli.ts", import.meta.url));
  // No credentials in the environment: the dry run needs none.
  const { stdout, stderr } = await promisify(execFile)(
    process.execPath,
    [tsx, cli, "--dry-run", "smoke"],
    { env: { PATH: process.env.PATH ?? "", NODE_ENV: "test" } }
  );
  assert.match(stdout, /# Step smoke: complete/);
  assert.match(stdout, /# D1 checkpoint/);
  assert.match(stderr, /no network or deployment contact, \$0/);
});

test("a dry run that stops before the requested step returns that stop and its reason", async () => {
  const stopped = new AbortController();
  stopped.abort();
  const results = await dryRun({
    through: "main",
    signal: stopped.signal,
    log: () => undefined,
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].outcome.segment, "smoke");
  assert.equal(results[0].outcome.status, "interrupted");
  assert.equal(results[0].outcome.stopReason, "The step was interrupted.");
});
