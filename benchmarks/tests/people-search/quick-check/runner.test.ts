import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { BudgetStop, type SpendReader } from "../../../core/execution/spend";
import { captureReplaySet } from "../../../people-search/quick-check/capture";
import { LinkedPageReader } from "../../../people-search/quick-check/linkedPages";
import {
  ModelCheckError,
  unreadableSpend,
  modelMatches,
  restoreQuickCheckModel,
  runQuickCheck,
} from "../../../people-search/quick-check/runner";
import { fakeExa, fakeReplay, temporaryStore } from "./fakeReplay";

// Synthetic prospects: p1 and p2 are verified matches, p3 is not.
const prospects = {
  p1: {
    workspaceId: "w1",
    prospectType: "individual",
    decision: { qualified: true, score: 90 },
    linkedPages: [],
  },
  p2: {
    workspaceId: "w1",
    prospectType: "individual",
    decision: { qualified: false, score: 40 },
    linkedPages: [],
  },
  p3: {
    workspaceId: "w1",
    prospectType: "individual",
    decision: { qualified: true, score: 75 },
    linkedPages: [],
  },
} as const;

async function captured(
  t: TestContext,
  options: Parameters<typeof fakeReplay>[1] = {}
) {
  const store = await temporaryStore(t);
  const fake = fakeReplay(prospects, options);
  const pages = new LinkedPageReader(fakeExa({}).transport, "synthetic-key");
  await store.withLock(() =>
    captureReplaySet(
      {
        setId: "set-1",
        seed: 1,
        cases: (["p1", "p2", "p3"] as const).map((prospectId, index) => ({
          caseId: `case-${index + 1}`,
          taskId: "t1",
          referenceDate: "2026-11-14T00:00:00Z",
          entityType: "individual" as const,
          workspaceId: "w1",
          prospectId,
          expectedMatch: prospectId !== "p3",
        })),
      },
      { deployment: fake.deployment, pages, store }
    )
  );
  fake.calls.length = 0;
  return { store, fake };
}

/** A key whose spend grows by `perRead` each time it is read. */
const growingSpend = (perRead: number): SpendReader => {
  let total = 10;
  return {
    accountId: "openrouter:synthetic",
    read: async () => ({
      accountId: "openrouter:synthetic",
      recordedAt: "2026-11-15T00:00:00Z",
      cumulativeUsd: (total += perRead),
    }),
  };
};

test("recorded models must be the requested one, allowing a dated snapshot", () => {
  assert.ok(modelMatches("openai/gpt-6-luna-pro", "openai/gpt-6-luna-pro"));
  assert.ok(modelMatches("openai/gpt-6-luna-pro", "gpt-6-luna-pro-2026-10-01"));
  assert.ok(
    !modelMatches("openai/gpt-6-luna-pro", "openai/gpt-6-luna-pro-mini")
  );
  assert.ok(!modelMatches("openai/gpt-6-luna-pro", "azure/gpt-6-luna-pro"));
  assert.ok(!modelMatches("openai/gpt-6-luna-pro", "unknown"));
});

test("the quick check scores the deployed model without changing any setting", async (t) => {
  const { store, fake } = await captured(t, {
    // The replay accepts everyone: one wrong acceptance (p3).
    decide: () => true,
  });
  const result = await runQuickCheck(
    {},
    {
      deployment: fake.deployment,
      store,
      spend: growingSpend(0.01),
      runId: "qc-1",
    }
  );
  assert.equal(result.model, "openai/gpt-6-luna-pro");
  const [score] = result.scores;
  assert.deepEqual(score.confusion, {
    trueAccept: 2,
    falseAccept: 1,
    trueReject: 0,
    falseReject: 0,
  });
  assert.equal(score.recordedUsd, 0.012);
  assert.ok(score.keySpendUsd! > 0);
  assert.equal(
    fake.calls.some((call) => call.startsWith("env set")),
    false
  );
  // Aggregates only: no prospect, profile or reasoning text in the report.
  assert.doesNotMatch(
    result.markdown,
    /synthetic-p|Synthetic reasoning|case-1/
  );
  const saved = await store.readPrivate(
    "benchmarks/.local/people-search/quick-check/set-1/results/qc-1.json"
  );
  assert.match(saved!, /"runId":"qc-1"/);
});

test("another model is set only while the replay runs, then restored", async (t) => {
  const seen: (string | undefined)[] = [];
  const { store, fake } = await captured(t, {
    env: { AI_ONBOARDING_MODEL: "openai/gpt-6-luna-pro" },
    decide: () => {
      seen.push(fake.env.get("AI_ONBOARDING_MODEL"));
      return true;
    },
  });
  const result = await runQuickCheck(
    { model: "openai/gpt-cheaper", learning: "both" },
    {
      deployment: fake.deployment,
      store,
      spend: growingSpend(0),
      runId: "qc-2",
    }
  );
  assert.deepEqual([...new Set(seen)], ["openai/gpt-cheaper"]);
  assert.equal(fake.env.get("AI_ONBOARDING_MODEL"), "openai/gpt-6-luna-pro");
  assert.deepEqual(
    result.scores.map((score) => [score.model, score.learning]),
    [
      ["openai/gpt-cheaper", "on"],
      ["openai/gpt-cheaper", "off"],
    ]
  );
  assert.deepEqual(result.comparison, { compared: 3, changedDecisions: 0 });
});

test("a call recorded under another model fails the check, and the setting is still restored", async (t) => {
  const { store, fake } = await captured(t, {
    recordedModel: () => "openai/gpt-6-luna-pro",
  });
  await assert.rejects(
    runQuickCheck(
      { model: "openai/gpt-cheaper" },
      {
        deployment: fake.deployment,
        store,
        spend: growingSpend(0),
        runId: "qc-3",
      }
    ),
    ModelCheckError
  );
  assert.equal(fake.env.has("AI_ONBOARDING_MODEL"), false);
  assert.equal(
    await restoreQuickCheckModel({ deployment: fake.deployment, store }),
    false
  );
});

test("the spend limit stops the replay and the model is restored", async (t) => {
  const { store, fake } = await captured(t);
  await assert.rejects(
    runQuickCheck(
      { model: "openai/gpt-cheaper", maxUsd: 0.5 },
      {
        deployment: fake.deployment,
        store,
        spend: growingSpend(1),
        runId: "qc-4",
      }
    ),
    BudgetStop
  );
  assert.equal(fake.env.has("AI_ONBOARDING_MODEL"), false);
});

test("a deployment that is not at rest is refused before anything changes", async (t) => {
  const { store, fake } = await captured(t);
  fake.env.set("PAUSE_AUTONOMOUS_JOBS", "false");
  await assert.rejects(
    runQuickCheck(
      { model: "openai/gpt-cheaper" },
      { deployment: fake.deployment, store, spend: growingSpend(0) }
    ),
    /not paused/
  );
  assert.equal(
    fake.calls.some((call) => call.startsWith("env set")),
    false
  );
});

test("a model change left open by a crash is restored on request and blocks a new run", async (t) => {
  const { store, fake } = await captured(t, {
    env: { AI_ONBOARDING_MODEL: "openai/original" },
  });
  fake.env.set("AI_ONBOARDING_MODEL", "openai/gpt-cheaper");
  await store.withLock(() =>
    store.writePrivate(
      "benchmarks/.local/people-search/quick-check/model-override.json",
      JSON.stringify({
        status: "active",
        deployment: "dev:test",
        original: "openai/original",
        model: "openai/gpt-cheaper",
        startedAt: "2026-11-15T00:00:00Z",
      })
    )
  );
  await assert.rejects(
    runQuickCheck(
      {},
      { deployment: fake.deployment, store, spend: growingSpend(0) }
    ),
    /Restore it first/
  );
  assert.equal(
    await store.withLock(() =>
      restoreQuickCheckModel({ deployment: fake.deployment, store })
    ),
    true
  );
  assert.equal(fake.env.get("AI_ONBOARDING_MODEL"), "openai/original");
});

test("a failed model read-back is restored like any other failure", async (t) => {
  const { store, fake } = await captured(t, {
    env: { AI_ONBOARDING_MODEL: "openai/original" },
    garbleReadAfterSet: "AI_ONBOARDING_MODEL",
  });
  await assert.rejects(
    runQuickCheck(
      { model: "openai/gpt-cheaper" },
      {
        deployment: fake.deployment,
        store,
        spend: growingSpend(0),
        runId: "qc-5",
      }
    ),
    /did not take the requested value/
  );
  assert.equal(fake.env.get("AI_ONBOARDING_MODEL"), "openai/original");
  assert.equal(
    fake.calls.includes("benchmarkReplay:replayQualification"),
    false
  );
  // The recovery record is closed, so nothing is left to restore.
  assert.equal(
    await store.withLock(() =>
      restoreQuickCheckModel({ deployment: fake.deployment, store })
    ),
    false
  );
});

test("without a readable spend limit nothing paid runs and no setting changes", async (t) => {
  const { store, fake } = await captured(t);
  await assert.rejects(
    runQuickCheck(
      { model: "openai/gpt-cheaper" },
      {
        deployment: fake.deployment,
        store,
        spend: unreadableSpend("The spend limit cannot be enforced."),
      }
    ),
    BudgetStop
  );
  assert.equal(
    fake.calls.includes("benchmarkReplay:replayQualification"),
    false
  );
  assert.equal(
    fake.calls.some((call) => call.startsWith("env set")),
    false
  );
});
