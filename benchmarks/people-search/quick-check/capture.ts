import { createHash } from "node:crypto";
import { z } from "zod";
import type { FileCheckpointStore } from "../../core/execution/checkpoints";
import { RunnerStateError } from "../../core/execution/checkpoints";
import { LEARNING_OFF_SETTING } from "../../core/execution/convex";
import {
  hasOpenSession,
  sessionFileIn,
} from "../../core/execution/liveSession";
import type { CaseRecord } from "../../core/judging/judgeCandidate";
import { seededRandom, shuffled } from "../../core/random";
import {
  artifactSchema,
  canonicalJson,
  hashBytes,
  identifierSchema,
  jsonSchema,
  type JsonValue,
} from "../../core/setup/manifest";
import { entityTypeSchema, timestampSchema } from "../../core/types";
import type { ReplayCase } from "../run/replay";
import {
  DATASET_KIND,
  REPLAY_BATCH_SIZE,
  type CapturedCase,
  type ReplayDeployment,
} from "./deployment";
import type { ExternalArticle, LinkedPageReader } from "./linkedPages";

/**
 * Proposal 5.6: about 300 judged ReacherX candidates from a finished run are
 * frozen with their labels and everything qualification read. The set holds
 * personal data, so it lives only in the private folder and in the
 * development deployment's file storage; git receives scores only.
 */

export const QUICK_CHECK_DIR = "benchmarks/.local/people-search/quick-check";
export const CURRENT_SET_PATH = `${QUICK_CHECK_DIR}/current.json`;
export const QUICK_CHECK_SET_SIZE = 300;

export type PrivateStore = Pick<
  FileCheckpointStore,
  "readPrivate" | "writePrivate" | "saveFrozenJson" | "readArtifact"
>;

/** One judged ReacherX result, located in the workspace that found it. */
export const judgedCaseSchema = z.strictObject({
  // Opaque judging case ID; never a provider or prospect ID.
  caseId: z.string().regex(/^[a-zA-Z0-9-]{1,96}$/),
  taskId: z.string().min(1),
  referenceDate: timestampSchema,
  entityType: entityTypeSchema,
  workspaceId: z.string().min(1),
  prospectId: z.string().min(1),
  expectedMatch: z.boolean(),
});
export type JudgedCase = z.infer<typeof judgedCaseSchema>;

export const captureRequestSchema = z.strictObject({
  setId: identifierSchema,
  seed: z.number().int().nonnegative().safe(),
  size: z.number().int().positive().default(QUICK_CHECK_SET_SIZE),
  cases: z
    .array(judgedCaseSchema)
    .min(1)
    .refine(
      (cases) =>
        new Set(cases.map((item) => item.caseId)).size === cases.length,
      "Each judged case ID must appear once."
    ),
});
export type CaptureRequest = z.input<typeof captureRequestSchema>;

/** ReacherX's judged results (top K and rejected samples), with the panel's verdict as the label. */
export function judgedReacherXCases(
  records: readonly CaseRecord[],
  workspaceOf: (record: CaseRecord) => string | null
): JudgedCase[] {
  return records.flatMap((record) => {
    const workspaceId =
      record.toolId === "reacherx" ? workspaceOf(record) : null;
    return workspaceId
      ? [
          judgedCaseSchema.parse({
            caseId: record.caseId,
            taskId: record.taskId,
            referenceDate: record.input.referenceDate,
            entityType: record.input.entity.prospectType,
            workspaceId,
            prospectId: record.sourceId,
            expectedMatch: record.panel.verifiedMatch,
          }),
        ]
      : [];
  });
}

/**
 * A seeded draw spread over prompts and both labels: each prompt-and-label
 * group is shuffled, then groups are taken in turn until the size is reached.
 */
export function selectReplayCases(
  cases: readonly JudgedCase[],
  size: number,
  seed: number
) {
  const random = seededRandom(seed);
  const seen = new Set<string>();
  const unique = [...cases]
    .sort((a, b) => a.caseId.localeCompare(b.caseId))
    .filter(
      (item) =>
        !seen.has(`${item.workspaceId}:${item.prospectId}`) &&
        Boolean(seen.add(`${item.workspaceId}:${item.prospectId}`))
    );
  const groups = new Map<string, JudgedCase[]>();
  for (const item of unique) {
    const key = `${item.taskId}:${item.expectedMatch}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const queues = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, group]) => shuffled(group, random));
  const selected: JudgedCase[] = [];
  while (selected.length < size && queues.some((queue) => queue.length))
    for (const queue of queues) {
      const next = queue.shift();
      if (next && selected.length < size) selected.push(next);
    }
  return selected;
}

const labelSchema = z.strictObject({
  caseId: z.string(),
  taskId: z.string(),
  referenceDate: timestampSchema,
  entityType: entityTypeSchema,
  expectedMatch: z.boolean(),
  originalDecision: z.strictObject({
    qualified: z.boolean(),
    score: z.number().nullable(),
  }),
});

const datasetSchema = z.strictObject({
  kind: z.literal(DATASET_KIND),
  schemaVersion: z.literal(1),
  cases: z
    .array(
      z.strictObject({
        caseId: z.string(),
        input: z.looseObject({ now: z.number() }),
        operatorOnlyMemoryPolicy: z.string().optional(),
      })
    )
    .min(1),
});

const linkedPageSpendSchema = z.strictObject({
  requests: z.number().int().nonnegative(),
  pages: z.number().int().nonnegative(),
  failedRequests: z.number().int().nonnegative(),
  spentUsd: z.number().nonnegative(),
});

// The dataset, labels and page spend saved together before the separate files.
const checkpointSchema = z.strictObject({
  dataset: jsonSchema,
  labels: jsonSchema,
  linkedPages: linkedPageSpendSchema,
});

export const replaySetSchema = z.strictObject({
  schemaVersion: z.literal(1),
  setId: identifierSchema,
  createdAt: timestampSchema,
  deployment: z.string().regex(/^dev:.+/),
  datasetId: z.string().min(1),
  dataset: artifactSchema,
  labels: artifactSchema,
  cases: z.number().int().positive(),
  linkedPages: linkedPageSpendSchema,
});
export type ReplaySet = z.infer<typeof replaySetSchema>;

const setDir = (setId: string) => `${QUICK_CHECK_DIR}/${setId}`;

/** Nothing else may run: no open live step, no learning switch left set, no active workspace. */
export async function assertDeploymentQuiet(
  deployment: Pick<ReplayDeployment, "driver">,
  store: Pick<PrivateStore, "readPrivate" | "writePrivate">
) {
  if (await hasOpenSession(sessionFileIn(store)))
    throw new RunnerStateError(
      "A live step is open. Run pnpm benchmark --reset first."
    );
  if ((await deployment.driver.getSetting(LEARNING_OFF_SETTING)) !== null)
    throw new RunnerStateError(
      `${LEARNING_OFF_SETTING} is set; the deployment is not at rest.`
    );
  const activity = await deployment.driver.activity();
  if (activity.workspaceIds.length || activity.truncated)
    throw new RunnerStateError(
      "Another workspace is running or due to restart; the quick check needs the deployment to itself."
    );
}

async function captureAll(
  deployment: ReplayDeployment,
  selected: readonly JudgedCase[],
  learning: "on" | "off"
) {
  const byWorkspace = new Map<string, JudgedCase[]>();
  for (const item of selected)
    byWorkspace.set(item.workspaceId, [
      ...(byWorkspace.get(item.workspaceId) ?? []),
      item,
    ]);
  const captured = new Map<string, CapturedCase>();
  for (const [workspaceId, items] of byWorkspace) {
    const workspace = { workspaceId, createdAt: 0, label: "quick-check" };
    // The learning-off pass names this workspace in the switch, then clears it.
    if (learning === "off")
      await deployment.driver.setLearning(workspace, "off");
    try {
      for (let start = 0; start < items.length; start += REPLAY_BATCH_SIZE) {
        const batch = items.slice(start, start + REPLAY_BATCH_SIZE);
        const results = await deployment.capture(
          workspaceId,
          batch.map((item) => item.prospectId),
          learning
        );
        batch.forEach((item, index) =>
          captured.set(item.caseId, results[index])
        );
      }
    } finally {
      if (learning === "off")
        await deployment.driver.setLearning(workspace, "on");
    }
    if (
      learning === "off" &&
      (await deployment.driver.getSetting(LEARNING_OFF_SETTING)) !== null
    )
      throw new RunnerStateError(
        `${LEARNING_OFF_SETTING} could not be cleared after capture.`
      );
  }
  return captured;
}

const digestMatches = (stored: string, data: string) => {
  const digest = createHash("sha256").update(data).digest();
  return (
    stored === digest.toString("hex") || stored === digest.toString("base64")
  );
};

/**
 * Captures the set, reads linked pages within budget, keeps a private copy
 * and uploads the same bytes to the deployment's file storage. Free reads
 * come first and linked pages last, so a failed read costs nothing. If the
 * private dataset already exists for this set ID, nothing is captured or
 * fetched again; only the upload is repeated. Call under the runner lock.
 *
 * The dataset, labels and linked-page spend are first saved together in one
 * checkpoint, so a stop between the separate files resumes from it without
 * reading any page again.
 */
export async function captureReplaySet(
  request: CaptureRequest,
  dependencies: Readonly<{
    deployment: ReplayDeployment;
    pages: LinkedPageReader;
    store: PrivateStore;
    now?: () => Date;
  }>
): Promise<ReplaySet> {
  const { setId, seed, size, cases } = captureRequestSchema.parse(request);
  const { deployment, pages, store } = dependencies;
  const now = dependencies.now ?? (() => new Date());
  const datasetPath = `${setDir(setId)}/dataset.json`;
  const labelsPath = `${setDir(setId)}/labels.json`;
  const checkpointPath = `${setDir(setId)}/capture.json`;
  await assertDeploymentQuiet(deployment, store);

  const saved = await store.readPrivate(checkpointPath);
  let checkpoint =
    saved === null ? null : checkpointSchema.parse(JSON.parse(saved));
  if (checkpoint === null && (await store.readPrivate(datasetPath)) !== null)
    throw new RunnerStateError(
      "A dataset exists for this set without its capture checkpoint; review it before capturing again."
    );
  if (checkpoint === null) {
    const selected = selectReplayCases(cases, size, seed);
    const full = await captureAll(deployment, selected, "on");
    for (const item of selected) {
      const captured = full.get(item.caseId);
      if (
        captured?.learning !== "on" ||
        captured.prospectType !== item.entityType
      )
        throw new RunnerStateError(
          "A captured prospect's type does not match its judged result."
        );
    }
    const policies = await captureAll(deployment, selected, "off");
    const articles = new Map<string, ExternalArticle[]>();
    for (const [index, item] of selected.entries()) {
      const captured = full.get(item.caseId)!;
      if (captured.learning === "on")
        articles.set(
          item.caseId,
          await pages.read(`pages#${index + 1}`, captured.linkedPages)
        );
    }
    const replayCases = selected.map((item) => {
      const captured = full.get(item.caseId)!;
      const policy = policies.get(item.caseId);
      if (captured.learning !== "on" || policy?.learning !== "off")
        throw new RunnerStateError("A case is missing from the capture.");
      return {
        caseId: item.caseId,
        taskId: item.taskId,
        referenceDate: item.referenceDate,
        entityType: item.entityType,
        expectedMatch: item.expectedMatch,
        originalDecision: captured.decision,
        input: {
          ...captured.input,
          externalArticles: articles.get(item.caseId) ?? [],
        },
        operatorOnlyMemoryPolicy: policy.operatorOnlyMemoryPolicy,
      };
    });
    const datasetValue = jsonSchema.parse({
      kind: DATASET_KIND,
      schemaVersion: 1,
      cases: replayCases.map(({ caseId, input, operatorOnlyMemoryPolicy }) => ({
        caseId,
        input,
        operatorOnlyMemoryPolicy,
      })),
    });
    const labelValue: JsonValue = replayCases.map((item) =>
      labelSchema.parse({
        caseId: item.caseId,
        taskId: item.taskId,
        referenceDate: item.referenceDate,
        entityType: item.entityType,
        expectedMatch: item.expectedMatch,
        originalDecision: item.originalDecision,
      })
    );
    checkpoint = checkpointSchema.parse({
      dataset: datasetValue,
      labels: labelValue,
      linkedPages: {
        requests: pages.requests,
        pages: pages.pagesRequested,
        failedRequests: pages.failedRequests,
        spentUsd: pages.spentUsd,
      },
    });
    await store.writePrivate(checkpointPath, canonicalJson(checkpoint));
  }
  // Writing the same content again is a no-op, so a resume completes both files.
  await store.saveFrozenJson(datasetPath, checkpoint.dataset);
  await store.saveFrozenJson(labelsPath, checkpoint.labels);
  const dataset = canonicalJson(checkpoint.dataset);
  const labels = canonicalJson(checkpoint.labels);
  const caseCount = datasetSchema.parse(JSON.parse(dataset)).cases.length;

  const datasetId = await deployment.upload(dataset);
  const info = await deployment.datasetInfo(datasetId);
  if (
    !info ||
    info.size !== Buffer.byteLength(dataset) ||
    !digestMatches(info.sha256, dataset)
  )
    throw new RunnerStateError(
      "The uploaded dataset does not match the private copy."
    );
  const record = replaySetSchema.parse({
    schemaVersion: 1,
    setId,
    createdAt: now().toISOString(),
    deployment: deployment.deployment,
    datasetId,
    dataset: { path: datasetPath, sha256: hashBytes(dataset) },
    labels: { path: labelsPath, sha256: hashBytes(labels) },
    cases: caseCount,
    // Cumulative over the first capture and any resumed one.
    linkedPages: checkpoint.linkedPages,
  });
  await store.writePrivate(`${setDir(setId)}/set.json`, canonicalJson(record));
  await store.writePrivate(CURRENT_SET_PATH, canonicalJson(record));
  return record;
}

/** The current set with its labels and frozen inputs, each checked against its digest. */
export async function loadReplaySet(store: PrivateStore) {
  const text = await store.readPrivate(CURRENT_SET_PATH);
  if (text === null)
    throw new RunnerStateError(
      "No quick-check set has been captured yet. Capture one from a judged run first."
    );
  const set = replaySetSchema.parse(JSON.parse(text));
  const labels = z
    .array(labelSchema)
    .parse(await store.readArtifact(set.labels));
  const dataset = datasetSchema.parse(await store.readArtifact(set.dataset));
  const inputs = new Map(dataset.cases.map((item) => [item.caseId, item]));
  const cases: ReplayCase[] = labels.map((label) => {
    const frozen = inputs.get(label.caseId);
    if (!frozen)
      throw new RunnerStateError("A labelled case has no frozen input.");
    return {
      ...label,
      input: frozen.input as unknown as ReplayCase["input"],
      operatorOnlyMemoryPolicy: frozen.operatorOnlyMemoryPolicy,
    };
  });
  if (cases.length !== dataset.cases.length || cases.length !== set.cases)
    throw new RunnerStateError("The quick-check set's files do not agree.");
  return { set, cases };
}
