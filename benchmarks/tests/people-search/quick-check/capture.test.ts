import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import {
  captureReplaySet,
  judgedReacherXCases,
  loadReplaySet,
  selectReplayCases,
  type JudgedCase,
} from "../../../people-search/quick-check/capture";
import { LinkedPageReader } from "../../../people-search/quick-check/linkedPages";
import type { CaseRecord } from "../../../core/judging/judgeCandidate";
import {
  fakeExa,
  fakeReplay,
  temporaryStore,
  type FakeProspect,
} from "./fakeReplay";

// Synthetic judged results only.
const judged = (
  index: number,
  taskId: string,
  expectedMatch: boolean,
  workspaceId = "w-people"
): JudgedCase => ({
  caseId: `case-${index}`,
  taskId,
  referenceDate: "2026-11-14T00:00:00Z",
  entityType: "individual",
  workspaceId,
  prospectId: `p${index}`,
  expectedMatch,
});

const prospect = (
  workspaceId: string,
  qualified: boolean,
  linkedPages: FakeProspect["linkedPages"] = []
): FakeProspect => ({
  workspaceId,
  prospectType: "individual",
  decision: { qualified, score: qualified ? 85 : 20 },
  linkedPages,
});

test("the draw spreads over prompts and both labels and is reproducible", () => {
  const cases = [
    ...Array.from({ length: 10 }, (_, i) => judged(i, "t1", i % 5 === 0)),
    ...Array.from({ length: 4 }, (_, i) => judged(20 + i, "t2", false)),
  ];
  const first = selectReplayCases(cases, 6, 7);
  assert.deepEqual(first, selectReplayCases([...cases].reverse(), 6, 7));
  // t1 matches, t1 non-matches and t2 non-matches take turns.
  assert.equal(first.filter((item) => item.taskId === "t2").length, 2);
  assert.equal(first.filter((item) => item.expectedMatch).length, 2);
  // The same prospect judged twice is captured once.
  assert.equal(
    selectReplayCases(
      [judged(1, "t1", true), { ...judged(1, "t1", true), caseId: "case-x" }],
      5,
      1
    ).length,
    1
  );
});

test("only ReacherX's judged results become capture cases, labelled by the panel", () => {
  const record = (toolId: string, verifiedMatch: boolean) =>
    ({
      caseId: "8d1b6f0e-2f7a-4c41-9a39-6f7cbd1f4e10",
      taskId: "p6",
      toolId,
      sourceId: "prospect-1",
      rank: 1,
      identity: null,
      webEvidence: null,
      input: {
        caseId: "8d1b6f0e-2f7a-4c41-9a39-6f7cbd1f4e10",
        prompt: "Synthetic prompt",
        referenceDate: "2026-11-14T00:00:00Z",
        definitionNotes: [],
        criteria: [{ id: "role", requirement: "Synthetic", required: true }],
        entity: {
          prospectType: "organization",
          name: "Synthetic Co",
          profileUrl: null,
          location: null,
          description: null,
          evidence: [],
          domain: "synthetic.example",
          industry: null,
          employeeCount: null,
        },
      },
      panel: { verifiedMatch },
      newestCitedEvidenceAgeDays: null,
    }) as unknown as CaseRecord;
  assert.deepEqual(
    judgedReacherXCases(
      [record("reacherx", true), record("exa", true)],
      () => "w-1"
    ),
    [
      {
        caseId: "8d1b6f0e-2f7a-4c41-9a39-6f7cbd1f4e10",
        taskId: "p6",
        referenceDate: "2026-11-14T00:00:00Z",
        entityType: "organization",
        workspaceId: "w-1",
        prospectId: "prospect-1",
        expectedMatch: true,
      },
    ]
  );
});

test("capture freezes inputs, operator-only policies and linked pages, then uploads the same bytes", async (t) => {
  const store = await temporaryStore(t);
  const fake = fakeReplay({
    p1: prospect("w-people", true, [
      { url: "https://blog.example/post", sourcePostIds: ["post-1", "post-2"] },
      { url: "https://no-author.example/x", sourcePostIds: ["post-1"] },
    ]),
    p2: prospect("w-people", false),
    p3: prospect("w-other", false),
  });
  const exa = fakeExa({
    "https://blog.example/post": {
      text: "  Synthetic   article ",
      author: "A. Writer",
    },
    "https://no-author.example/x": { text: "No author here." },
  });
  const pages = new LinkedPageReader(exa.transport, "synthetic-key");
  const request = {
    setId: "set-1",
    seed: 3,
    cases: [
      judged(1, "t1", true),
      judged(2, "t1", false),
      judged(3, "t2", false, "w-other"),
    ],
  };
  const set = await store.withLock(() =>
    captureReplaySet(request, { deployment: fake.deployment, pages, store })
  );
  assert.equal(set.cases, 3);
  assert.equal(set.deployment, "dev:test");
  assert.equal(set.linkedPages.requests, 1);
  assert.equal(set.linkedPages.spentUsd, 0.002);
  // The learning switch named each workspace only for its own pass, then was cleared.
  assert.equal(fake.env.has("BENCHMARK_LEARNING_OFF_WORKSPACE_IDS"), false);
  assert.deepEqual(
    fake.calls.filter((call) => call.startsWith("env")),
    [
      "env set BENCHMARK_LEARNING_OFF_WORKSPACE_IDS",
      "env remove BENCHMARK_LEARNING_OFF_WORKSPACE_IDS",
      "env set BENCHMARK_LEARNING_OFF_WORKSPACE_IDS",
      "env remove BENCHMARK_LEARNING_OFF_WORKSPACE_IDS",
    ]
  );
  // The stored copy is byte-for-byte the private dataset.
  const stored = JSON.parse(fake.storage.get(set.datasetId)!);
  const first = stored.cases.find(
    (item: { caseId: string }) => item.caseId === "case-1"
  );
  assert.deepEqual(first.input.externalArticles, [
    {
      sourcePostId: "post-1",
      url: "https://blog.example/post",
      author: "A. Writer",
      text: "Synthetic article",
    },
    {
      sourcePostId: "post-2",
      url: "https://blog.example/post",
      author: "A. Writer",
      text: "Synthetic article",
    },
  ]);
  assert.equal(first.operatorOnlyMemoryPolicy, "Operator: Europe only.");
  // Labels stay private and out of the uploaded dataset.
  assert.equal("expectedMatch" in first, false);

  const loaded = await loadReplaySet(store);
  assert.deepEqual(
    loaded.cases
      .map((item) => [
        item.caseId,
        item.expectedMatch,
        item.originalDecision.qualified,
      ])
      .sort(),
    [
      ["case-1", true, true],
      ["case-2", false, false],
      ["case-3", false, false],
    ]
  );

  // A repeated capture reuses the private dataset: nothing is captured or read again.
  const captures = fake.calls.filter((call) =>
    call.endsWith("captureQualificationInputs")
  ).length;
  await store.withLock(() =>
    captureReplaySet(request, { deployment: fake.deployment, pages, store })
  );
  assert.equal(
    fake.calls.filter((call) => call.endsWith("captureQualificationInputs"))
      .length,
    captures
  );
  assert.equal(exa.requests.length, 1);
});

test("capture refuses a busy deployment and a type that does not match the judged result", async (t) => {
  const store = await temporaryStore(t);
  const pages = new LinkedPageReader(fakeExa({}).transport, "synthetic-key");
  const request = { setId: "set-2", seed: 1, cases: [judged(1, "t1", true)] };
  const busy = fakeReplay(
    { p1: prospect("w-people", true) },
    { activeWorkspaces: ["w-9"] }
  );
  await assert.rejects(
    store.withLock(() =>
      captureReplaySet(request, { deployment: busy.deployment, pages, store })
    ),
    /needs the deployment to itself/
  );
  const company = fakeReplay({
    p1: { ...prospect("w-people", true), prospectType: "organization" },
  });
  await assert.rejects(
    store.withLock(() =>
      captureReplaySet(request, {
        deployment: company.deployment,
        pages,
        store,
      })
    ),
    /type does not match/
  );
  await store.withLock(() =>
    store.writePrivate(
      "benchmarks/.local/live-session.json",
      JSON.stringify({ status: "active" })
    )
  );
  await assert.rejects(
    store.withLock(() =>
      captureReplaySet(request, {
        deployment: fakeReplay({ p1: prospect("w-people", true) }).deployment,
        pages,
        store,
      })
    )
  );
});

test("duplicate case IDs are refused before any capture or page read", async (t) => {
  const store = await temporaryStore(t);
  const fake = fakeReplay({ p1: prospect("w-people", true) });
  const exa = fakeExa({});
  const pages = new LinkedPageReader(exa.transport, "synthetic-key");
  await assert.rejects(
    store.withLock(() =>
      captureReplaySet(
        {
          setId: "set-dup",
          seed: 1,
          cases: [
            judged(1, "t1", true),
            { ...judged(2, "t1", false), caseId: "case-1" },
          ],
        },
        { deployment: fake.deployment, pages, store }
      )
    ),
    /must appear once/
  );
  assert.deepEqual(fake.calls, []);
  assert.equal(exa.requests.length, 0);
});

test("a stop after the dataset but before the labels resumes without reading pages again", async (t) => {
  const store = await temporaryStore(t);
  const fake = fakeReplay({
    p1: prospect("w-people", true, [
      { url: "https://blog.example/post", sourcePostIds: ["post-1"] },
    ]),
  });
  const exa = fakeExa({
    "https://blog.example/post": {
      text: "Synthetic article",
      author: "A. Writer",
    },
  });
  const request = {
    setId: "set-resume",
    seed: 1,
    cases: [judged(1, "t1", true)],
  };
  const first = await store.withLock(() =>
    captureReplaySet(request, {
      deployment: fake.deployment,
      pages: new LinkedPageReader(exa.transport, "synthetic-key"),
      store,
    })
  );
  // Simulate the stop: the labels and the set record were never written.
  const dir = "benchmarks/.local/people-search/quick-check/set-resume";
  for (const file of ["labels.json", "set.json"])
    await rm(join(store.repositoryRoot, dir, file));
  const captures = fake.calls.filter((call) =>
    call.endsWith("captureQualificationInputs")
  ).length;
  const resumed = await store.withLock(() =>
    captureReplaySet(request, {
      deployment: fake.deployment,
      pages: new LinkedPageReader(exa.transport, "synthetic-key"),
      store,
    })
  );
  assert.equal(exa.requests.length, 1);
  assert.equal(
    fake.calls.filter((call) => call.endsWith("captureQualificationInputs"))
      .length,
    captures
  );
  // The page spend stays the first capture's, and the set is complete again.
  assert.deepEqual(resumed.linkedPages, first.linkedPages);
  assert.equal(resumed.linkedPages.requests, 1);
  assert.deepEqual(resumed.labels, first.labels);
  assert.equal((await loadReplaySet(store)).cases.length, 1);
});
