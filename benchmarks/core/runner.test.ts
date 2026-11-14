import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
  copyFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { FileCheckpointStore } from "./checkpoints";
import {
  canonicalJson,
  getPlanDigest,
  hashBytes,
  type JsonValue,
  type OfflineRunFile,
  type RunManifest,
} from "./manifest";
import { runOfflineUnits } from "./runner";
import {
  peopleSearchPlan,
  assertPeopleSearchManifest,
} from "../people-search/plan";

const referenceDate = "2026-11-14T00:00:00Z";

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "reacherx-offline-runner-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  async function artifact(name: string, value: JsonValue) {
    const path = `benchmarks/.local/fixtures/${name}.json`;
    const data = canonicalJson(value);
    await mkdir(dirname(join(root, path)), { recursive: true, mode: 0o700 });
    await writeFile(join(root, path), data, { mode: 0o600 });
    return { path, sha256: hashBytes(data) };
  }
  const proposal = "synthetic proposal fixture";
  await mkdir(join(root, "docs/benchmark"), { recursive: true });
  await writeFile(
    join(root, "docs/benchmark/synthetic-proposal.pdf"),
    proposal
  );
  const inputs = await Promise.all([
    artifact("first", { name: "Synthetic Company A" }),
    artifact("second", { name: "Synthetic Company B" }),
  ]);
  const manifest: RunManifest = {
    schemaVersion: 1,
    runId: "synthetic-offline",
    planId: "synthetic-plan",
    sourceProposal: {
      path: "docs/benchmark/synthetic-proposal.pdf",
      sha256: hashBytes(proposal),
    },
    planSha256: "",
    referenceDate,
    seed: 42,
    tasks: inputs.map((_, index) => ({
      id: `task-${index + 1}`,
      prompt: "Synthetic test task",
      entityType: "organization",
      referenceDate,
      criteria: [
        {
          id: "criterion-1",
          requirement: "Synthetic requirement",
          required: true,
        },
      ],
      definitionNotes: [],
    })),
    referenceExamples: inputs.map((input, index) => ({
      taskId: `task-${index + 1}`,
      artifact: { ...input },
    })),
    rateSnapshot: await artifact("rates", { rates: [] }),
    runtimeSnapshot: await artifact("runtime", { fixtureOnly: true }),
    step: "smoke",
    execution: { mode: "offline" },
  };
  manifest.planSha256 = getPlanDigest(manifest);
  const run: OfflineRunFile = {
    manifest,
    units: inputs.map((input, index) => ({
      id: `unit-${index + 1}`,
      runId: manifest.runId,
      taskId: `task-${index + 1}`,
      toolId: "synthetic",
      input: { ...input },
      learning: null,
      cycle: null,
    })),
  };
  return { root, run, artifact };
}

test("sequential execution persists private results and reuses completed units without executing them again", async (t) => {
  const { root, run } = await fixture(t);
  const calls: string[] = [];
  let active = 0;
  let maxActive = 0;
  const first = await runOfflineUnits(root, run, async (unit, input) => {
    calls.push(unit.id);
    active++;
    maxActive = Math.max(maxActive, active);
    await Promise.resolve();
    active--;
    return input;
  });
  assert.deepEqual(calls, ["unit-1", "unit-2"]);
  assert.equal(maxActive, 1);
  assert.equal(first.completed, 2);
  const second = await runOfflineUnits(root, run, async () => {
    throw new Error("Completed work must not execute");
  });
  assert.equal(second.reused, 2);
  assert.equal(second.completed, 0);
  if (process.platform !== "win32") {
    assert.equal(
      (await stat(join(root, first.checkpointReport.path))).mode & 0o777,
      0o600
    );
    assert.equal(
      (await stat(join(root, "benchmarks/.local"))).mode & 0o777,
      0o700
    );
  }
});

test("a partial run reuses its completed result and executes only pending work", async (t) => {
  const { root, run } = await fixture(t);
  const store = new FileCheckpointStore(root, run.manifest.runId);
  await store.withLock(async () => {
    await store.freeze(run);
    for (const unit of run.units)
      await store.write({ unit, status: "pending", updatedAt: referenceDate });
    const unit = run.units[0];
    await store.write({
      unit,
      status: "started",
      startedAt: referenceDate,
      updatedAt: referenceDate,
    });
    const result = await store.saveResult(unit.id, { previouslySaved: true });
    await store.write({
      unit,
      status: "completed",
      result,
      updatedAt: referenceDate,
    });
  });
  const calls: string[] = [];
  const result = await runOfflineUnits(root, run, async (unit, input) => {
    calls.push(unit.id);
    return input;
  });
  assert.deepEqual(calls, ["unit-2"]);
  assert.equal(result.reused, 1);
});

test("an uncertain operation is marked for review and cannot be repeated automatically", async (t) => {
  const { root, run } = await fixture(t);
  let calls = 0;
  await assert.rejects(
    runOfflineUnits(root, run, async (unit, input) => {
      calls++;
      if (unit.id === "unit-2") throw new Error("PRIVATE_RESPONSE_MARKER");
      return input;
    }),
    (error: unknown) =>
      error instanceof Error &&
      !error.message.includes("PRIVATE_RESPONSE_MARKER") &&
      error.message.includes("Review")
  );
  const store = new FileCheckpointStore(root, run.manifest.runId);
  assert.equal((await store.read("unit-1"))?.status, "completed");
  assert.equal((await store.read("unit-2"))?.status, "needs-review");
  await assert.rejects(
    runOfflineUnits(root, run, async () => {
      calls++;
      return null;
    }),
    /requires review/
  );
  assert.equal(calls, 2);
});

test("a started checkpoint later in the schedule prevents earlier pending work from running", async (t) => {
  const { root, run } = await fixture(t);
  const store = new FileCheckpointStore(root, run.manifest.runId);
  await store.withLock(async () => {
    await store.freeze(run);
    for (const unit of run.units)
      await store.write({ unit, status: "pending", updatedAt: referenceDate });
    const unit = run.units[1];
    await store.write({
      unit,
      status: "started",
      startedAt: referenceDate,
      updatedAt: referenceDate,
    });
  });
  let calls = 0;
  await assert.rejects(
    runOfflineUnits(root, run, async () => {
      calls++;
      return null;
    }),
    /requires review/
  );
  assert.equal(calls, 0);
});

test("changed plan contents and changed work order cannot reuse an existing run ID", async (t) => {
  const { root, run } = await fixture(t);
  await runOfflineUnits(root, run);
  let calls = 0;
  const execute = async () => {
    calls++;
    return null;
  };
  const modified = structuredClone(run);
  modified.manifest.tasks[0].criteria[0].requirement = "Changed requirement";
  await assert.rejects(runOfflineUnits(root, modified, execute));
  modified.manifest.planSha256 = getPlanDigest(modified.manifest);
  await assert.rejects(
    runOfflineUnits(root, modified, execute),
    /different frozen plan/
  );
  await assert.rejects(
    runOfflineUnits(root, { ...run, units: [...run.units].reverse() }, execute),
    /work order/
  );
  assert.equal(calls, 0);
});

test("corrupted input and completed-result artifacts stop resumption", async (t) => {
  for (const target of ["input", "result"]) {
    const { root, run } = await fixture(t);
    await runOfflineUnits(root, run);
    const checkpoint = await new FileCheckpointStore(
      root,
      run.manifest.runId
    ).read("unit-1");
    assert.ok(checkpoint?.status === "completed");
    const path =
      target === "input" ? run.units[0].input.path : checkpoint.result.path;
    await writeFile(join(root, path), "{}", { mode: 0o600 });
    let calls = 0;
    await assert.rejects(
      runOfflineUnits(root, run, async () => {
        calls++;
        return null;
      }),
      /frozen hash/
    );
    assert.equal(calls, 0);
  }
});

test("missing checkpoints or frozen records are not recreated into a billable retry", async (t) => {
  for (const file of ["checkpoints/unit-1.json", "frozen-run.json"]) {
    const { root, run } = await fixture(t);
    await runOfflineUnits(root, run);
    await rm(
      join(root, `benchmarks/.local/runs/${run.manifest.runId}/${file}`)
    );
    let calls = 0;
    await assert.rejects(
      runOfflineUnits(root, run, async () => {
        calls++;
        return null;
      }),
      /missing/
    );
    assert.equal(calls, 0);
  }
});

test(
  "the private runner lock excludes other run IDs and is released after completion",
  { timeout: 10000 },
  async (t) => {
    const { root, run } = await fixture(t);
    let release = () => {};
    let entered = () => {};
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const executing = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const first = runOfflineUnits(root, run, async (_unit, input) => {
      entered();
      await waiting;
      return input;
    });
    await executing;
    const other = structuredClone(run);
    other.manifest.runId = "other-run";
    for (const unit of other.units) unit.runId = "other-run";
    try {
      await assert.rejects(runOfflineUnits(root, other), /Runner lock/);
    } finally {
      release();
      await first;
    }
    await assert.rejects(stat(join(root, "benchmarks/.local/runner.lock")), {
      code: "ENOENT",
    });
  }
);

test("stale locks, unsafe paths, symlinks and live-mode requests fail closed", async (t) => {
  const { root, run } = await fixture(t);
  const live = structuredClone(run);
  live.manifest.execution = {
    mode: "live",
    spendApproval: {
      approvalReference: "test-only",
      approvedAt: referenceDate,
      accountLimits: [{ accountId: "synthetic", maxAdditionalUsd: 1 }],
    },
  };
  await assert.rejects(runOfflineUnits(root, live));
  const traversal = structuredClone(run);
  traversal.units[0].input.path = "benchmarks/.local/../../outside.json";
  await assert.rejects(runOfflineUnits(root, traversal));
  const linked = structuredClone(run);
  linked.units[0].input.path = "benchmarks/.local/fixtures/link.json";
  await symlink(
    join(root, run.units[0].input.path),
    join(root, linked.units[0].input.path)
  );
  await assert.rejects(runOfflineUnits(root, linked), /symlinks/);
  await writeFile(
    join(root, "benchmarks/.local/runner.lock"),
    "stale fixture",
    { mode: 0o600 }
  );
  await assert.rejects(runOfflineUnits(root, run), /Runner lock/);
  assert.equal(
    await readFile(join(root, "benchmarks/.local/runner.lock"), "utf8"),
    "stale fixture"
  );
});

test("empty criteria, missing examples, mismatched dates and duplicate unit IDs never execute", async (t) => {
  const { root, run } = await fixture(t);
  const cases = [
    structuredClone(run),
    structuredClone(run),
    structuredClone(run),
    structuredClone(run),
  ];
  cases[0].manifest.tasks[0].criteria = [];
  cases[1].manifest.referenceExamples = [];
  cases[2].manifest.tasks[0].referenceDate = "2026-11-13T00:00:00Z";
  cases[3].units[1].id = cases[3].units[0].id;
  let calls = 0;
  for (const input of cases)
    await assert.rejects(
      runOfflineUnits(root, input, async () => {
        calls++;
        return null;
      })
    );
  assert.equal(calls, 0);
});

test("CLI offline execution validates the approved prompts and resumes without printing saved responses", async (t) => {
  const { root, run } = await fixture(t);
  run.manifest.planId = peopleSearchPlan.id;
  run.manifest.sourceProposal = {
    path: peopleSearchPlan.sourceProposal.path,
    sha256: peopleSearchPlan.sourceProposal.sha256,
  };
  run.manifest.tasks = peopleSearchPlan.prompts.map((prompt) => ({
    id: String(prompt.id),
    prompt: prompt.text,
    entityType: peopleSearchPlan.categories[prompt.category].entityType,
    referenceDate,
    criteria: [
      {
        id: "synthetic-criterion",
        requirement: "Synthetic offline fixture only",
        required: true,
      },
    ],
    definitionNotes: [],
  }));
  run.manifest.referenceExamples = run.manifest.tasks.map((task) => ({
    taskId: task.id,
    artifact: run.units[0].input,
  }));
  run.units[0].taskId = "14";
  run.units[1].taskId = "15";
  run.manifest.planSha256 = getPlanDigest(run.manifest);
  const source = fileURLToPath(
    new URL(
      "../../docs/benchmark/people-search-v2-proposal.pdf",
      import.meta.url
    )
  );
  await copyFile(source, join(root, run.manifest.sourceProposal.path));
  const packet = join(root, "benchmarks/.local/offline-run.json");
  await writeFile(packet, JSON.stringify(run), { mode: 0o600 });
  const tsx = createRequire(import.meta.url).resolve("tsx/cli");
  const cli = fileURLToPath(new URL("../cli.ts", import.meta.url));
  const execute = promisify(execFile);
  for (const [completed, reused] of [
    [2, 0],
    [0, 2],
  ]) {
    const { stdout } = await execute(
      process.execPath,
      [tsx, cli, "--offline-run", packet],
      { cwd: root }
    );
    const output: unknown = JSON.parse(stdout);
    assert.ok(
      typeof output === "object" &&
        output !== null &&
        "completed" in output &&
        "reused" in output
    );
    assert.equal(output.completed, completed);
    assert.equal(output.reused, reused);
    assert.ok(!stdout.includes("Synthetic Company"));
  }
  run.manifest.tasks[0].prompt = "Changed wording";
  assert.throws(
    () => assertPeopleSearchManifest(run.manifest),
    /approved prompt/
  );
});
