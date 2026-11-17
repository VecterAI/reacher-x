import { z } from "zod";
import {
  FileCheckpointStore,
  RunnerStateError,
} from "../../core/execution/checkpoints";
import { npxConvexRunner } from "../../core/execution/convex";
import { atRestProblems } from "../../core/execution/liveSession";
import {
  BudgetStop,
  openRouterKeySpend,
  SpendGuard,
  type SpendReader,
} from "../../core/execution/spend";
import {
  inspectBenchmarkEnvironment,
  readBenchmarkEnvironment,
} from "../../core/setup/env";
import { canonicalJson, jsonSchema } from "../../core/setup/manifest";
import type { ArtifactReference, LearningCondition } from "../../core/types";
import type { QualificationReplay, ReplayOutcome } from "../run/replay";
import { peopleSearchPlan } from "../setup/plan";
import { liveTransport } from "../../core/calls/http";
import {
  assertDeploymentQuiet,
  captureReplaySet,
  captureRequestSchema,
  loadReplaySet,
  QUICK_CHECK_DIR,
  type PrivateStore,
  type ReplaySet,
} from "./capture";
import {
  QUALIFICATION_MODEL_SETTING,
  REPLAY_BATCH_SIZE,
  ReplayDeployment,
} from "./deployment";
import { LinkedPageReader } from "./linkedPages";
import {
  compareReplays,
  renderQuickCheckReport,
  scoreReplay,
  type ReplayScore,
} from "./scoring";

/**
 * Proposal 5.6: the quick check replays the frozen set through ReacherX's own
 * qualification function on the development deployment. To try another
 * model, the qualification model setting is changed only while the replay
 * runs and restored afterwards, even on failure; the model recorded for every
 * call must be the one requested. Nothing else may run meanwhile.
 */

// Proposal 3.1: a quick check costs $0.20-1.65; this is the software stop per condition.
export const QUICK_CHECK_MAX_USD = 1.65;
const OVERRIDE_PATH = `${QUICK_CHECK_DIR}/model-override.json`;

export class ModelCheckError extends Error {}

const DATED_SUFFIX = /^-\d{4}-?\d{2}-?\d{2}$/;

/**
 * The recorded model is the requested one: the same name, or the same name
 * with a dated snapshot suffix, under the same provider when both name one.
 */
export function modelMatches(expected: string, observed: string) {
  const split = (model: string) => {
    const value = model.trim().toLowerCase();
    const slash = value.indexOf("/");
    return slash < 0
      ? { provider: null, name: value }
      : { provider: value.slice(0, slash), name: value.slice(slash + 1) };
  };
  const want = split(expected);
  const got = split(observed);
  if (want.provider && got.provider && want.provider !== got.provider)
    return false;
  return (
    got.name === want.name ||
    (got.name.startsWith(want.name) &&
      DATED_SUFFIX.test(got.name.slice(want.name.length)))
  );
}

const sha256AsBase64 = (hex: string) =>
  Buffer.from(hex, "hex").toString("base64");

/** QualificationReplay over convex/benchmarkReplay.ts, in batches of 25, checking the model of every call. */
export class ConvexQualificationReplay implements QualificationReplay {
  usage = { calls: 0, recordedUsd: 0, models: {} as Record<string, number> };

  constructor(
    private readonly deployment: ReplayDeployment,
    private readonly set: ReplaySet,
    private readonly caseIds: readonly string[],
    private readonly options: Readonly<{
      runId: string;
      // Runs before each paid batch: spend and activity checks.
      beforeBatch?: () => Promise<void>;
    }>
  ) {}

  async evaluate(args: {
    frozenDataset: ArtifactReference;
    model: string;
    learning: LearningCondition;
  }): Promise<ReplayOutcome[]> {
    const { dataset, datasetId } = this.set;
    if (
      args.frozenDataset.path !== dataset.path ||
      args.frozenDataset.sha256 !== dataset.sha256
    )
      throw new RunnerStateError(
        "The dataset is not the current quick-check set."
      );
    const info = await this.deployment.datasetInfo(datasetId);
    if (
      !info ||
      (info.sha256 !== dataset.sha256 &&
        info.sha256 !== sha256AsBase64(dataset.sha256))
    )
      throw new RunnerStateError(
        "The deployment's stored dataset no longer matches the private copy."
      );
    const outcomes: ReplayOutcome[] = [];
    for (
      let start = 0, batch = 1;
      start < this.caseIds.length;
      start += REPLAY_BATCH_SIZE, batch += 1
    ) {
      await this.options.beforeBatch?.();
      const replayId = `${this.options.runId}-${args.learning}-${batch}`;
      const results = await this.deployment.replay(
        datasetId,
        replayId,
        this.caseIds.slice(start, start + REPLAY_BATCH_SIZE),
        args.learning
      );
      const usage = await this.deployment.usage(replayId);
      const completed = results.filter((result) => result.status === "ok");
      if (usage.capped || usage.calls < completed.length)
        throw new ModelCheckError(
          "The model of every replay call could not be confirmed."
        );
      const wrong = Object.keys(usage.models).filter(
        (model) => !modelMatches(args.model, model)
      );
      if (wrong.length)
        throw new ModelCheckError(
          `A replay call used ${wrong.join(", ")} instead of ${args.model}.`
        );
      this.usage.calls += usage.calls;
      this.usage.recordedUsd += usage.recordedUsd;
      for (const [model, calls] of Object.entries(usage.models))
        this.usage.models[model] = (this.usage.models[model] ?? 0) + calls;
      const modelObserved = Object.keys(usage.models).sort().join(", ");
      outcomes.push(
        ...results.map(
          (result): ReplayOutcome =>
            result.status === "ok"
              ? {
                  caseId: result.caseId,
                  modelObserved,
                  latencyMs: result.latencyMs,
                  status: "ok",
                  result: {
                    qualified: result.qualified,
                    score: result.score,
                    reasoning: result.reasoning,
                  },
                }
              : {
                  caseId: result.caseId,
                  modelObserved,
                  latencyMs: result.latencyMs,
                  status: "error",
                  error: result.error,
                }
        )
      );
    }
    return outcomes;
  }
}

const overrideSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("active"),
    deployment: z.string(),
    original: z.string().nullable(),
    model: z.string(),
    startedAt: z.string(),
  }),
  z.strictObject({
    status: z.literal("restored"),
    deployment: z.string(),
    restoredAt: z.string(),
  }),
]);

export type QuickCheckOptions = Readonly<{
  // Another qualification model, as an OpenRouter ID; omitted, the deployed one.
  model?: string;
  learning?: LearningCondition | "both";
  // Software limit on the OpenRouter key's spend for the whole quick check.
  maxUsd?: number;
}>;

export type QuickCheckDependencies = Readonly<{
  deployment: ReplayDeployment;
  store: PrivateStore & Pick<FileCheckpointStore, "withLock">;
  // The deployment's OpenRouter key spend. It enforces the limit before
  // every paid batch; a reader that cannot read refuses the run.
  spend: SpendReader;
  runId?: string;
  now?: () => Date;
}>;

/** Puts back a qualification model a quick check left changed; does nothing when none is open. */
export async function restoreQuickCheckModel(
  dependencies: Pick<QuickCheckDependencies, "deployment" | "store" | "now">
) {
  const { deployment, store } = dependencies;
  const text = await store.readPrivate(OVERRIDE_PATH);
  const record = text === null ? null : overrideSchema.parse(JSON.parse(text));
  if (record?.status !== "active") return false;
  if (record.deployment !== deployment.deployment)
    throw new RunnerStateError(
      "The open model change belongs to another deployment."
    );
  await deployment.setQualificationModel(record.original);
  await store.writePrivate(
    OVERRIDE_PATH,
    JSON.stringify({
      status: "restored",
      deployment: record.deployment,
      restoredAt: (dependencies.now ?? (() => new Date()))().toISOString(),
    })
  );
  return true;
}

async function quickCheck(
  options: QuickCheckOptions,
  dependencies: QuickCheckDependencies
) {
  const { deployment, store, spend } = dependencies;
  const now = dependencies.now ?? (() => new Date());
  const { set, cases } = await loadReplaySet(store);
  if (set.deployment !== deployment.deployment)
    throw new RunnerStateError(
      "The quick-check set was uploaded to another deployment."
    );
  const open = await store.readPrivate(OVERRIDE_PATH);
  if (
    open !== null &&
    overrideSchema.parse(JSON.parse(open)).status === "active"
  )
    throw new RunnerStateError(
      "An earlier quick check left the qualification model changed. Restore it first."
    );
  await assertDeploymentQuiet(deployment, store);
  const snapshot = await deployment.driver.snapshotRuntime();
  const problems = atRestProblems(snapshot.settings);
  if (problems.length) throw new RunnerStateError(problems.join(" "));

  const original = snapshot.settings[QUALIFICATION_MODEL_SETTING];
  const deployed =
    original?.trim() || peopleSearchPlan.models.planningAndQualification;
  const model = options.model?.trim() || deployed;
  const conditions: LearningCondition[] =
    options.learning === "both" ? ["on", "off"] : [options.learning ?? "on"];
  const runId =
    dependencies.runId ??
    `qc-${now()
      .toISOString()
      .replace(/[^0-9]/g, "")
      .slice(0, 14)}`;
  const maxUsd = options.maxUsd ?? QUICK_CHECK_MAX_USD * conditions.length;
  // Recorded cost is known only afterwards, so it is never the limit: the
  // key's spend must be readable before anything paid runs.
  const guard = new SpendGuard(
    {
      approvalReference: `quick-check ${runId}`,
      accountLimits: [{ accountId: spend.accountId, maxAdditionalUsd: maxUsd }],
      approvedAt: now().toISOString(),
    },
    [spend]
  );
  await guard.start();
  const replay = new ConvexQualificationReplay(
    deployment,
    set,
    cases.map((item) => item.caseId),
    {
      runId,
      beforeBatch: async () => {
        await guard.check();
        const activity = await deployment.driver.activity();
        if (activity.workspaceIds.length || activity.truncated)
          throw new RunnerStateError(
            "Another workspace started during the quick check."
          );
      },
    }
  );

  const changeModel = model !== deployed;
  // The recovery record is written first, so a crash at any point after it
  // leaves enough to restore the original model.
  if (changeModel)
    await store.writePrivate(
      OVERRIDE_PATH,
      JSON.stringify({
        status: "active",
        deployment: deployment.deployment,
        original,
        model,
        startedAt: now().toISOString(),
      })
    );
  const runs: {
    learning: LearningCondition;
    outcomes: ReplayOutcome[];
    score: ReplayScore;
  }[] = [];
  try {
    // Inside the protected scope: a failed write or read-back is still restored.
    if (changeModel) await deployment.setQualificationModel(model);
    for (const learning of conditions) {
      const before = await spend.read();
      const recordedBefore = replay.usage.recordedUsd;
      const outcomes = await replay.evaluate({
        frozenDataset: set.dataset,
        model,
        learning,
      });
      const after = await spend.read();
      runs.push({
        learning,
        outcomes,
        score: scoreReplay(cases, outcomes, {
          model,
          learning,
          recordedUsd: replay.usage.recordedUsd - recordedBefore,
          keySpendUsd: after.cumulativeUsd - before.cumulativeUsd,
        }),
      });
    }
  } finally {
    if (changeModel) await restoreQuickCheckModel(dependencies);
  }
  const comparison =
    runs.length === 2
      ? compareReplays(runs[0].outcomes, runs[1].outcomes)
      : undefined;
  const scores = runs.map((run) => run.score);
  const markdown = renderQuickCheckReport(set.setId, scores, comparison);
  // Decisions and reasoning are private; only the scores are aggregate.
  await store.writePrivate(
    `${QUICK_CHECK_DIR}/${set.setId}/results/${runId}.json`,
    canonicalJson(
      jsonSchema.parse({
        runId,
        setId: set.setId,
        model,
        modelsObserved: replay.usage.models,
        scores,
        comparison: comparison ?? null,
        outcomes: Object.fromEntries(
          runs.map((run) => [run.learning, run.outcomes])
        ),
      })
    )
  );
  return { runId, setId: set.setId, model, scores, comparison, markdown };
}

/** A spend reader that always refuses, so no paid batch runs without a limit. */
export function unreadableSpend(reason: string): SpendReader {
  return {
    accountId: "openrouter:unreadable",
    read: async () => {
      throw new BudgetStop(reason);
    },
  };
}

/** Quick-check dependencies from the private environment file: the dev deployment and its key's spend. */
export async function quickCheckDependencies(
  root: string
): Promise<QuickCheckDependencies> {
  const environment = await readBenchmarkEnvironment(root);
  const selected = environment.CONVEX_DEPLOYMENT;
  if (
    !selected?.startsWith("dev:") ||
    inspectBenchmarkEnvironment(environment).issues.some((issue) =>
      /CONVEX|deployment/.test(issue)
    )
  )
    throw new RunnerStateError(
      "Select the development deployment first. Run pnpm benchmark --check-env."
    );
  const dev = selected as `dev:${string}`;
  const deployment = new ReplayDeployment(dev, npxConvexRunner(dev, root));
  const key = environment.OPENROUTER_API_KEY;
  // The limit is enforced on the deployment's key, which must be the local
  // (shared) key. Otherwise the reader refuses, so restoring a model still works.
  const spend =
    key && (await deployment.driver.readSecret("OPENROUTER_API_KEY")) === key
      ? openRouterKeySpend(key)
      : unreadableSpend(
          key
            ? "The local OPENROUTER_API_KEY is not the development deployment's key, so the quick check's spend limit cannot be enforced. Nothing was run."
            : "OPENROUTER_API_KEY is not set, so the quick check's spend limit cannot be enforced. Nothing was run."
        );
  return {
    deployment,
    store: new FileCheckpointStore(root, "quick-check"),
    spend,
  };
}

/**
 * `pnpm benchmark` and `pnpm benchmark --model <id>`: replays the current
 * quick-check set under the runner lock and returns the scores and report.
 */
export async function runQuickCheck(
  options: QuickCheckOptions = {},
  dependencies?: QuickCheckDependencies
) {
  const resolved =
    dependencies ?? (await quickCheckDependencies(process.cwd()));
  return resolved.store.withLock(() => quickCheck(options, resolved));
}

export type QuickCheckResult = Awaited<ReturnType<typeof runQuickCheck>>;

/**
 * Captures the quick-check set from a private capture request (judged
 * ReacherX cases with their workspaces), reading linked pages with the
 * benchmark's Exa key. Paid calls: Exa contents only, at most $1.20.
 */
export async function captureQuickCheck(
  requestPath: string,
  root = process.cwd()
) {
  const environment = await readBenchmarkEnvironment(root);
  const dependencies = await quickCheckDependencies(root);
  const text = await dependencies.store.readPrivate(requestPath);
  if (text === null)
    throw new RunnerStateError("The capture request file was not found.");
  const request = captureRequestSchema.parse(JSON.parse(text));
  const pages = new LinkedPageReader(
    liveTransport(),
    environment.EXA_API_KEY ?? ""
  );
  return dependencies.store.withLock(() =>
    captureReplaySet(request, {
      deployment: dependencies.deployment,
      pages,
      store: dependencies.store,
    })
  );
}
