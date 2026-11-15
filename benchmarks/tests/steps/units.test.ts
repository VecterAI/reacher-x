import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
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
