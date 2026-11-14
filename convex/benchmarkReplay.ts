/**
 * Qualification replay for the people-search benchmark (issue #122).
 *
 * Internal only, for development deployments. A frozen dataset in this
 * deployment's file storage holds, for each candidate, everything
 * qualification read when the candidate was captured, including the capture
 * time. Replay passes those inputs unchanged to ReacherX's own qualification
 * function, so a code change, another model or the learning condition can be
 * compared on fixed inputs. Nothing is fetched from the web here.
 *
 * The model comes from the deployment's qualification route. To test another
 * model, the harness changes that setting while nothing else runs, then checks
 * the model recorded for every call with `replayUsageSince`.
 */
import { v } from "convex/values";
import { z } from "zod";
import { internalAction, internalQuery } from "./lib/functionBuilders";
import {
  qualifyProspectCore,
  type QualificationCoreParams,
} from "./lib/qualificationCore";

const MAX_CASES_PER_CALL = 25;
const REPLAY_USAGE_PREFIX = "benchmark-replay:";
const MAX_USAGE_EVENTS_READ = 5000;

const textArray = z.array(z.string());
const record = z.record(z.string(), z.unknown());

// The dataset is written by the harness from captured qualification inputs.
// Nested structures follow the production parameter types.
const frozenInputSchema = z.object({
  platform: z.enum(["twitter", "linkedin"]),
  evidencePosts: z.array(record),
  externalArticles: z.array(record).optional(),
  discoveryQueries: textArray,
  totalKeywords: z.number().int().nonnegative(),
  profileData: record,
  profileEvidence: z
    .object({ url: z.string(), authorId: z.string(), text: z.string() })
    .optional(),
  targetingSpec: record,
  icpDescription: z.string().optional(),
  syntheticTargetingExamples: z.string().optional(),
  icpPainPoints: textArray.optional(),
  useCaseKey: z.string().optional(),
  relevantMemories: textArray.optional(),
  workspaceMemoryPolicy: z.string().optional(),
  complianceInstructions: textArray.optional(),
  similarQualifiedCases: textArray.optional(),
  similarDisqualifiedCases: textArray.optional(),
  now: z.number().int().positive(),
});

const frozenCaseSchema = z.object({
  caseId: z.string().min(1),
  input: frozenInputSchema,
  // The same workspace policy built from operator instructions only, captured
  // with the case so the learning-off replay never edits prompt text.
  operatorOnlyMemoryPolicy: z.string().optional(),
});

const frozenDatasetSchema = z.object({
  schemaVersion: z.literal(1),
  cases: z.array(frozenCaseSchema).min(1),
});

/** Removes learned context for the learning-off replay; operator instructions stay. */
function inputFor(
  frozen: z.infer<typeof frozenCaseSchema>,
  learning: "on" | "off"
): z.infer<typeof frozenInputSchema> {
  if (learning === "on") return frozen.input;
  if (
    frozen.input.workspaceMemoryPolicy !== undefined &&
    frozen.operatorOnlyMemoryPolicy === undefined
  )
    throw new Error(
      `Replay case ${frozen.caseId} has no operator-only policy for learning off`
    );
  return {
    ...frozen.input,
    workspaceMemoryPolicy: frozen.operatorOnlyMemoryPolicy,
    relevantMemories: [],
    similarQualifiedCases: [],
    similarDisqualifiedCases: [],
  };
}

/** Replays a bounded slice of cases sequentially. The harness calls it repeatedly until all cases are done. */
export const replayQualification = internalAction({
  args: {
    datasetId: v.id("_storage"),
    replayId: v.string(),
    caseIds: v.array(v.string()),
    learning: v.union(v.literal("on"), v.literal("off")),
  },
  handler: async (ctx, args) => {
    if (args.caseIds.length === 0 || args.caseIds.length > MAX_CASES_PER_CALL)
      throw new Error(`Replay 1 to ${MAX_CASES_PER_CALL} cases per call`);
    const blob = await ctx.storage.get(args.datasetId);
    if (!blob) throw new Error("Replay dataset not found");
    const dataset = frozenDatasetSchema.parse(JSON.parse(await blob.text()));
    const byId = new Map(dataset.cases.map((item) => [item.caseId, item]));
    // Resolve every case before the first paid call, so a bad case cannot
    // discard results that were already paid for.
    const selected = args.caseIds.map((caseId) => {
      const frozen = byId.get(caseId);
      if (!frozen) throw new Error(`Unknown replay case ${caseId}`);
      return { caseId, input: inputFor(frozen, args.learning) };
    });
    const results = [];
    for (const { caseId, input } of selected) {
      const startedAt = Date.now();
      try {
        const result = await qualifyProspectCore({
          ...(input as QualificationCoreParams),
          routing: "onboarding",
          telemetry: {
            ctx,
            agentName: "Benchmark Replay",
            userId: `${REPLAY_USAGE_PREFIX}${args.replayId}`,
          },
        });
        results.push({
          caseId,
          status: "ok" as const,
          qualified: result.qualified,
          score: result.score,
          reasoning: result.reasoning,
          latencyMs: Date.now() - startedAt,
        });
      } catch (error) {
        results.push({
          caseId,
          status: "error" as const,
          error: error instanceof Error ? error.message.slice(0, 300) : "error",
          latencyMs: Date.now() - startedAt,
        });
      }
    }
    return results;
  },
});

/** Models and recorded cost for one replay, from the usage events its calls wrote. */
export const replayUsageSince = internalQuery({
  args: { replayId: v.string(), since: v.number() },
  handler: async (ctx, { replayId, since }) => {
    const events = await ctx.db
      .query("agentUsageEvents")
      .withIndex("by_user_recorded_at", (q) =>
        q
          .eq("userId", `${REPLAY_USAGE_PREFIX}${replayId}`)
          .gte("recordedAt", since)
      )
      .take(MAX_USAGE_EVENTS_READ);
    const models: Record<string, number> = {};
    let recordedUsd = 0;
    for (const event of events) {
      const model = event.model ?? "unknown";
      models[model] = (models[model] ?? 0) + 1;
      recordedUsd += event.usage.cost ?? 0;
    }
    return {
      calls: events.length,
      models,
      recordedUsd,
      capped: events.length === MAX_USAGE_EVENTS_READ,
    };
  },
});
