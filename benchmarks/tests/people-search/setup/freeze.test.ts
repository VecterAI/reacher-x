import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import {
  FileCheckpointStore,
  RunnerStateError,
} from "../../../core/execution/checkpoints";
import { getPlanDigest } from "../../../core/setup/manifest";
import type { BenchmarkEntity } from "../../../core/types";
import {
  FROZEN_PLAN_PATH,
  freezePlan,
  type FreezeInput,
} from "../../../people-search/setup/freeze";
import { peopleSearchPlan } from "../../../people-search/setup/plan";

const referenceDate = "2026-11-20T00:00:00.000Z";
const evidence = [
  {
    id: "e1",
    url: "https://example.test/profile",
    text: "Synthetic evidence",
    publishedAt: null,
    retrievedAt: referenceDate,
  },
];

function example(entityType: "individual" | "organization"): BenchmarkEntity {
  const common = {
    name: "Synthetic Example",
    profileUrl: null,
    location: null,
    description: null,
    evidence,
  };
  return entityType === "individual"
    ? { ...common, prospectType: "individual", title: null, employer: null }
    : {
        ...common,
        prospectType: "organization",
        domain: null,
        industry: null,
        employeeCount: null,
      };
}

function input(): FreezeInput {
  return {
    referenceDate,
    seed: 7,
    referenceExamples: Object.fromEntries(
      peopleSearchPlan.prompts.map((prompt) => [
        String(prompt.id),
        example(peopleSearchPlan.categories[prompt.category].entityType),
      ])
    ),
  };
}

async function store(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "reacherx-freeze-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, store: new FileCheckpointStore(root, "freeze") };
}

test("freezing writes private artifacts and a plan whose digest matches", async (t) => {
  const { root, store: files } = await store(t);
  const plan = await files.withLock(() =>
    freezePlan(files, input(), { allowDraftCriteria: true })
  );
  assert.equal(plan.tasks.length, 20);
  assert.equal(plan.referenceExamples.length, 20);
  assert.equal(plan.planSha256, getPlanDigest(plan));
  assert.ok(
    plan.referenceExamples.every(({ artifact }) =>
      artifact.path.startsWith("benchmarks/.local/")
    )
  );
  assert.equal((await stat(join(root, FROZEN_PLAN_PATH))).mode & 0o077, 0);
  // The same input again returns the same plan; different input is refused.
  const again = await files.withLock(() =>
    freezePlan(files, input(), { allowDraftCriteria: true })
  );
  assert.equal(again.planSha256, plan.planSha256);
  await assert.rejects(
    files.withLock(() =>
      freezePlan(files, { ...input(), seed: 8 }, { allowDraftCriteria: true })
    ),
    RunnerStateError
  );
});

test("freezing refuses draft criteria, missing examples and wrong entity types, writing nothing", async (t) => {
  const { root, store: files } = await store(t);
  await assert.rejects(
    files.withLock(() => freezePlan(files, input())),
    /still a draft/
  );
  const missing = input();
  delete (missing.referenceExamples as Record<string, unknown>)["3"];
  await assert.rejects(
    files.withLock(() =>
      freezePlan(files, missing, { allowDraftCriteria: true })
    ),
    /Missing or wrong type: 3;/
  );
  const wrongType = input();
  wrongType.referenceExamples["13"] = example("individual");
  await assert.rejects(
    files.withLock(() =>
      freezePlan(files, wrongType, { allowDraftCriteria: true })
    ),
    /Missing or wrong type: 13;/
  );
  await assert.rejects(
    stat(join(root, "benchmarks/.local/people-search")),
    /ENOENT/
  );
});
