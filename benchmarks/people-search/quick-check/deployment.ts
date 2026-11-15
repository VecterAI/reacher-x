import { z } from "zod";
import {
  ConvexCommandError,
  ConvexReacherXDriver,
  type CommandRunner,
} from "../../core/execution/convex";
import type { LearningCondition } from "../../core/types";

/**
 * The quick check's calls to convex/benchmarkReplay.ts on the development
 * deployment, through the same authenticated CLI as the live runner. Captured
 * inputs hold personal data: they stay in memory and private storage and are
 * never logged. The dataset is uploaded through a one-time upload URL, so no
 * personal data appears in a command line.
 */

// Same cap as the Convex functions.
export const REPLAY_BATCH_SIZE = 25;
// The deployment setting behind qualification's "onboarding" model route.
export const QUALIFICATION_MODEL_SETTING = "AI_ONBOARDING_MODEL";
export const DATASET_KIND = "reacherx-benchmark-qualification-replay";

const linkedPageSchema = z.strictObject({
  url: z.string().min(1),
  sourcePostIds: z.array(z.string()),
});
export type LinkedPage = z.infer<typeof linkedPageSchema>;

// The Convex side builds these from the production parameter types; only the
// fields the harness relies on are checked here.
const capturedInputSchema = z.looseObject({
  platform: z.enum(["twitter", "linkedin"]),
  evidencePosts: z.array(z.record(z.string(), z.unknown())),
  now: z.number().int().positive(),
});

export const capturedCaseSchema = z.discriminatedUnion("learning", [
  z.strictObject({
    prospectId: z.string().min(1),
    learning: z.literal("on"),
    prospectType: z.string().nullable(),
    decision: z.strictObject({
      qualified: z.boolean(),
      score: z.number().nullable(),
    }),
    linkedPages: z.array(linkedPageSchema),
    input: capturedInputSchema,
  }),
  z.strictObject({
    prospectId: z.string().min(1),
    learning: z.literal("off"),
    operatorOnlyMemoryPolicy: z.string(),
  }),
]);
export type CapturedCase = z.infer<typeof capturedCaseSchema>;

const replayResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    caseId: z.string(),
    status: z.literal("ok"),
    qualified: z.boolean(),
    score: z.number(),
    reasoning: z.string(),
    latencyMs: z.number(),
  }),
  z.strictObject({
    caseId: z.string(),
    status: z.literal("error"),
    error: z.string(),
    latencyMs: z.number(),
  }),
]);
export type ReplayResult = z.infer<typeof replayResultSchema>;

const usageSchema = z.strictObject({
  calls: z.number().int().nonnegative(),
  models: z.record(z.string(), z.number().int().nonnegative()),
  recordedUsd: z.number().nonnegative(),
  capped: z.boolean(),
});
export type ReplayUsage = z.infer<typeof usageSchema>;

const datasetInfoSchema = z
  .strictObject({ size: z.number(), sha256: z.string() })
  .nullable();

export class ReplayDeployment {
  readonly driver: ConvexReacherXDriver;

  constructor(
    readonly deployment: `dev:${string}`,
    private readonly run: CommandRunner,
    private readonly fetcher: typeof fetch = fetch
  ) {
    this.driver = new ConvexReacherXDriver(deployment, run);
  }

  private async call<T>(
    fn: string,
    args: Record<string, unknown>,
    schema: z.ZodType<T>
  ): Promise<T> {
    const result = await this.run(["run", fn, JSON.stringify(args)]);
    // CLI errors can echo arguments; report the function name only.
    if (result.exitCode !== 0)
      throw new ConvexCommandError(`Convex function ${fn} failed.`);
    return schema.parse(JSON.parse(result.stdout));
  }

  /** Sets the qualification model, or removes the setting with null, and confirms it. */
  async setQualificationModel(value: string | null) {
    if (value !== null)
      await this.driver.setSetting(QUALIFICATION_MODEL_SETTING, value);
    else if (
      (await this.driver.getSetting(QUALIFICATION_MODEL_SETTING)) !== null
    ) {
      const result = await this.run([
        "env",
        "remove",
        QUALIFICATION_MODEL_SETTING,
      ]);
      if (result.exitCode !== 0)
        throw new ConvexCommandError("Convex env remove failed.");
    }
    if ((await this.driver.getSetting(QUALIFICATION_MODEL_SETTING)) !== value)
      throw new ConvexCommandError(
        `${QUALIFICATION_MODEL_SETTING} did not take the requested value.`
      );
  }

  /** Stored qualification inputs of decided prospects in one benchmark workspace. */
  async capture(
    workspaceId: string,
    prospectIds: readonly string[],
    learning: LearningCondition
  ) {
    const captured = await this.call(
      "benchmarkReplay:captureQualificationInputs",
      { workspaceId, prospectIds, learning },
      z.array(capturedCaseSchema)
    );
    if (
      captured.length !== prospectIds.length ||
      captured.some(
        (item, index) =>
          item.prospectId !== prospectIds[index] || item.learning !== learning
      )
    )
      throw new ConvexCommandError("Capture returned unexpected prospects.");
    return captured;
  }

  /** Stores the dataset bytes in the deployment's file storage and returns its storage ID. */
  async upload(data: string) {
    const url = await this.call(
      "benchmarkReplay:createDatasetUploadUrl",
      {},
      z.url()
    );
    let response: Response;
    try {
      response = await this.fetcher(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: data,
        signal: AbortSignal.timeout(120_000),
      });
    } catch {
      // The upload URL carries a token, so it is never part of an error.
      throw new ConvexCommandError("The dataset upload failed.");
    }
    const body = z
      .object({ storageId: z.string().min(1) })
      .safeParse(response.ok ? await response.json() : null);
    if (!body.success)
      throw new ConvexCommandError("The dataset upload failed.");
    return body.data.storageId;
  }

  datasetInfo(datasetId: string) {
    return this.call(
      "benchmarkReplay:replayDatasetInfo",
      { datasetId },
      datasetInfoSchema
    );
  }

  /** One batch of at most 25 cases, replayed one after another. */
  async replay(
    datasetId: string,
    replayId: string,
    caseIds: readonly string[],
    learning: LearningCondition
  ) {
    const results = await this.call(
      "benchmarkReplay:replayQualification",
      { datasetId, replayId, caseIds, learning },
      z.array(replayResultSchema)
    );
    if (
      results.length !== caseIds.length ||
      results.some((result, index) => result.caseId !== caseIds[index])
    )
      throw new ConvexCommandError("Replay returned unexpected cases.");
    return results;
  }

  /** Every model call one replay recorded; replay IDs are unique, so no time bound is needed. */
  usage(replayId: string) {
    return this.call(
      "benchmarkReplay:replayUsageSince",
      { replayId, since: 0 },
      usageSchema
    );
  }
}
