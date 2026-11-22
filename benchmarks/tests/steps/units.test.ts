import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { z } from "zod";
import {
  FileCheckpointStore,
  RunnerStateError,
} from "../../core/execution/checkpoints";
import { UnitFailed, UnitLedger, type UnitSpec } from "../../core/steps/units";

// Synthetic units and values only.
async function ledger(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "reacherx-units-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new FileCheckpointStore(root, "synthetic-step");
  return { store, ledger: new UnitLedger(store) };
}

const spec = (id: string, input: UnitSpec["input"] = { id }): UnitSpec => ({
  id,
  taskId: "p01",
  toolId: "synthetic",
  learning: null,
  cycle: null,
  input,
});
const value = z.object({ count: z.number() });

test("a completed unit is reused and never executed again", async (t) => {
  const { store, ledger: units } = await ledger(t);
  let calls = 0;
  const work = async () => ({ count: ++calls });
  const first = await store.withLock(async () => {
    await units.open({ schedule: ["a"] });
    return units.run(spec("a"), value, work);
  });
  assert.deepEqual(first, {
    status: "completed",
    value: { count: 1 },
    reused: false,
  });
  const again = await store.withLock(() =>
    new UnitLedger(store).run(spec("a"), value, work)
  );
  assert.deepEqual(again, {
    status: "completed",
    value: { count: 1 },
    reused: true,
  });
  assert.equal(calls, 1);
});

test("a failed unit keeps its receipt for review and is not repeated", async (t) => {
  const { store, ledger: units } = await ledger(t);
  let calls = 0;
  const failing = async (): Promise<{ count: number }> => {
    calls += 1;
    throw new UnitFailed("Provider returned HTTP 500.", { responses: 1 });
  };
  const outcome = await store.withLock(() =>
    units.run(spec("b"), value, failing)
  );
  assert.equal(outcome.status, "needs-review");
  if (outcome.status !== "needs-review") return;
  assert.equal(outcome.reason, "Provider returned HTTP 500.");
  assert.deepEqual(await store.readArtifact(outcome.receipt!), {
    reason: "Provider returned HTTP 500.",
    receipt: { responses: 1 },
  });
  const again = await store.withLock(() =>
    units.run(spec("b"), value, failing)
  );
  assert.equal(again.status, "needs-review");
  assert.equal(calls, 1);
});

test("a unit that started without finishing becomes needs-review instead of running again", async (t) => {
  const { store, ledger: units } = await ledger(t);
  // An earlier attempt was killed mid-unit: the checkpoint says started.
  await store.withLock(async () => {
    const input = await store.saveFrozenJson(store.runFile("inputs/c.json"), {
      id: "c",
    });
    const unit = {
      id: "c",
      runId: store.runId,
      taskId: "p01",
      toolId: "synthetic",
      learning: null,
      cycle: null,
      input,
    };
    const at = new Date().toISOString();
    await store.write({ unit, status: "pending", updatedAt: at });
    await store.write({
      unit,
      status: "started",
      startedAt: at,
      updatedAt: at,
    });
  });
  let calls = 0;
  const outcome = await store.withLock(() =>
    units.run(spec("c"), value, async () => ({ count: ++calls }))
  );
  assert.equal(outcome.status, "needs-review");
  assert.equal(calls, 0);
  assert.equal((await store.read("c"))?.status, "needs-review");
});

test("a finished value can be held for review, and a changed unit or schedule is refused", async (t) => {
  const { store, ledger: units } = await ledger(t);
  await store.withLock(() => units.open({ schedule: ["d"] }));
  const held = await store.withLock(() =>
    units.run(
      spec("d"),
      value,
      async () => ({ count: 2 }),
      (result) => (result.count > 1 ? "Ended early." : null)
    )
  );
  assert.equal(held.status, "needs-review");
  await assert.rejects(
    store.withLock(() =>
      units.run(spec("d", { id: "d", changed: true }), value, async () => ({
        count: 1,
      }))
    ),
    RunnerStateError
  );
  assert.equal(
    await store.withLock(() => units.open({ schedule: ["d"] })),
    false
  );
  await assert.rejects(
    store.withLock(() => units.open({ schedule: ["d", "e"] })),
    /different frozen plan/
  );
  assert.deepEqual(units.tally, { executed: 0, reused: 0 });
});

test("a held unit continues only as an explicit resume of its receipt, and its earlier checkpoint is kept", async (t) => {
  const { store, ledger: units } = await ledger(t);
  const held = await store.withLock(async () => {
    await units.open({ schedule: ["w"] });
    return units.run(spec("w"), value, async () => {
      throw new UnitFailed("Budget stop.", { count: 1 });
    });
  });
  assert.equal(held.status, "needs-review");
  if (held.status !== "needs-review" || !held.receipt) throw new Error();
  const receipt = held.receipt;

  const saved = await store.withLock(() => units.held("w"));
  assert.deepEqual(saved?.value, {
    reason: "Budget stop.",
    receipt: { count: 1 },
  });
  // A plain run never repeats it, and a held unit cannot restart without a resume.
  const plain = await store.withLock(() =>
    units.run(spec("w"), value, async () => ({ count: 9 }))
  );
  assert.equal(plain.status, "needs-review");
  const checkpoint = await store.read("w");
  await assert.rejects(
    store.withLock(() =>
      store.write({
        unit: checkpoint!.unit,
        status: "started",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    ),
    RunnerStateError
  );
  // A receipt that is not the held one is refused.
  await assert.rejects(
    store.withLock(() =>
      units.resume(
        spec("w"),
        { ...receipt, sha256: "0".repeat(64) },
        value,
        async () => ({ count: 2 })
      )
    ),
    RunnerStateError
  );

  const resumed = await store.withLock(() =>
    units.resume(spec("w"), receipt, value, async () => ({ count: 2 }))
  );
  assert.deepEqual(resumed, {
    status: "completed",
    value: { count: 2 },
    reused: false,
  });
  // The held checkpoint is kept under held/, and its receipt still reads.
  const runDir = join(
    store.repositoryRoot,
    "benchmarks/.local/runs/synthetic-step"
  );
  const kept = (await readdir(join(runDir, "held"))).filter((name) =>
    name.startsWith("w.before-resume-")
  );
  assert.equal(kept.length, 1);
  assert.equal(
    JSON.parse(await readFile(join(runDir, "held", kept[0]), "utf8")).status,
    "needs-review"
  );
  assert.deepEqual(await store.readArtifact(receipt), {
    reason: "Budget stop.",
    receipt: { count: 1 },
  });
  // Completed now: reused, never resumed again.
  assert.equal(await store.withLock(() => units.held("w")), null);
});

test("a continuation that crashed is held again with the receipt it continued", async (t) => {
  const { store, ledger: units } = await ledger(t);
  const held = await store.withLock(async () => {
    await units.open({ schedule: ["w"] });
    return units.run(spec("w"), value, async () => {
      throw new UnitFailed("Budget stop.", { count: 1 });
    });
  });
  if (held.status !== "needs-review" || !held.receipt) throw new Error();
  // The process dies mid-continuation: the checkpoint stays started.
  const checkpoint = await store.read("w");
  const now = new Date().toISOString();
  await store.withLock(() =>
    store.write({
      unit: checkpoint!.unit,
      status: "started",
      startedAt: now,
      updatedAt: now,
      resumedFrom: held.receipt!,
    })
  );
  const next = await store.withLock(() =>
    new UnitLedger(store).run(spec("w"), value, async () => ({ count: 9 }))
  );
  assert.equal(next.status, "needs-review");
  const again = await store.withLock(() => units.held("w"));
  assert.deepEqual(again?.value, {
    reason:
      "Started in an earlier attempt that did not finish; it may have been billed.",
    receipt: { count: 1 },
  });
});
