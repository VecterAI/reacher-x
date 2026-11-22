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
 *
 * Capture reads the inputs of benchmark workspaces only, after their
 * qualification has finished; linked pages are read by the harness, not here.
 * The harness uploads the dataset through `createDatasetUploadUrl` and checks
 * the stored copy with `replayDatasetInfo`.
 */
import { v } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./lib/functionBuilders";
import {
  qualifyProspectCore,
  type QualificationCoreParams,
} from "./lib/qualificationCore";
import { isBenchmarkLearningOff } from "./lib/benchmarkLearningControl";
import { getQualificationProfileText } from "./lib/qualificationDiscoveryEvidenceCore";
import { formatSyntheticTargetingExamples } from "./lib/syntheticProfileCore";
import { buildLegacyWorkspaceTargetingSpec } from "./lib/targetingSpecCore";
import { getNestedRecord, isRecord } from "./lib/typeGuards";
import {
  getWorkflowEvidencePostId,
  getWorkflowEvidencePostText,
} from "./lib/workflowSafeProspect";
import { resolveWorkspaceUseCaseKey } from "../shared/lib/workspaceUseCases";

const MAX_CASES_PER_CALL = 25;
const REPLAY_USAGE_PREFIX = "benchmark-replay:";
const MAX_USAGE_EVENTS_READ = 5000;
// Marks a dataset written by the benchmark harness; anything else is refused.
const DATASET_KIND = "reacherx-benchmark-qualification-replay";
const BENCHMARK_NAME_PREFIX = "Benchmark ";
// Qualification reads at most two linked pages per candidate (researchCore).
const MAX_LINKED_PAGES = 2;
const MAX_EVIDENCE_HIGHLIGHTS = 5;

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
  kind: z.literal(DATASET_KIND),
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
    const parsed = frozenDatasetSchema.safeParse(JSON.parse(await blob.text()));
    if (!parsed.success)
      throw new Error("The stored file is not a benchmark replay dataset");
    const dataset = parsed.data;
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

/** A one-time upload URL for the harness to store a frozen dataset in this deployment. */
export const createDatasetUploadUrl = internalMutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

/** Size and digest of a stored dataset, so the harness can match it to its private copy. */
export const replayDatasetInfo = internalQuery({
  args: { datasetId: v.id("_storage") },
  handler: async (ctx, { datasetId }) => {
    const file = await ctx.db.system.get("_storage", datasetId);
    return file ? { size: file.size, sha256: file.sha256 } : null;
  },
});

type LinkedPage = { url: string; sourcePostIds: string[] };

/** The first linked pages qualification would read, with the posts that link them. */
function linkedPagesOf(posts: readonly Record<string, unknown>[]) {
  const byUrl = new Map<string, string[]>();
  for (const post of posts) {
    const sourcePostId = getWorkflowEvidencePostId(post);
    if (!sourcePostId || !Array.isArray(post.externalUrls)) continue;
    for (const value of post.externalUrls) {
      const url = typeof value === "string" ? value.trim() : "";
      if (url) byUrl.set(url, [...(byUrl.get(url) ?? []), sourcePostId]);
    }
  }
  return [...byUrl.entries()]
    .slice(0, MAX_LINKED_PAGES)
    .map(([url, sourcePostIds]): LinkedPage => ({ url, sourcePostIds }));
}

type CapturedCase =
  | {
      prospectId: Id<"prospects">;
      learning: "on";
      prospectType: string | null;
      decision: { qualified: boolean; score: number | null };
      linkedPages: LinkedPage[];
      input: Omit<QualificationCoreParams, "telemetry" | "routing" | "now"> & {
        now: number;
      };
    }
  | {
      prospectId: Id<"prospects">;
      learning: "off";
      operatorOnlyMemoryPolicy: string;
    };

/**
 * Rebuilds, for decided prospects of one benchmark workspace, the inputs the
 * qualification workflow passes to `qualifyProspectCore`. With learning "on"
 * it returns the full inputs; with "off" (the learning switch must name the
 * workspace) only the operator-only policy. Stored data is read; nothing is
 * fetched from the web and no qualification runs.
 */
export const captureQualificationInputs = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    prospectIds: v.array(v.id("prospects")),
    learning: v.union(v.literal("on"), v.literal("off")),
  },
  handler: async (ctx, args): Promise<CapturedCase[]> => {
    if (
      args.prospectIds.length === 0 ||
      args.prospectIds.length > MAX_CASES_PER_CALL
    )
      throw new Error(`Capture 1 to ${MAX_CASES_PER_CALL} prospects per call`);
    if (
      isBenchmarkLearningOff(String(args.workspaceId)) !==
      (args.learning === "off")
    )
      throw new Error("The learning switch does not match the capture pass");
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });
    if (!workspace?.name.startsWith(BENCHMARK_NAME_PREFIX))
      throw new Error("Only benchmark workspaces can be captured");
    const icps = workspace.icps ?? [];
    const allKeywords = icps.flatMap((icp) => icp.painPoints ?? []);
    const targetingSpec =
      workspace.targetingSpec ??
      buildLegacyWorkspaceTargetingSpec({
        description: workspace.description,
        profiles: icps,
      });
    const captured: CapturedCase[] = [];
    for (const prospectId of args.prospectIds) {
      const prospect = await ctx.runQuery(
        internal.prospects.getProspectInternal,
        { prospectId }
      );
      if (!prospect || prospect.workspaceId !== args.workspaceId)
        throw new Error(`Prospect ${prospectId} is not in this workspace`);
      const decidedAt =
        prospect.qualificationStatus === "qualified"
          ? prospect.qualifiedAt
          : prospect.qualificationStatus === "disqualified"
            ? prospect.disqualifiedAt
            : undefined;
      if (decidedAt === undefined)
        throw new Error(`Prospect ${prospectId} has no qualification decision`);
      const prospectData = isRecord(prospect.data) ? prospect.data : {};
      const evidencePosts = (prospect.evidencePosts ?? []).filter(isRecord);
      // LinkedIn people-search seeds are qualified on their fetched profile,
      // which qualification caches on the prospect.
      const cachedProfile =
        prospect.platform === "linkedin" &&
        prospect.discoverySource === "search_people" &&
        isRecord(prospect.qualificationProfileData) &&
        prospect.qualificationEvidenceFetchedAt
          ? prospect.qualificationProfileData
          : null;
      const profileData =
        cachedProfile ??
        getNestedRecord(prospectData, "user") ??
        getNestedRecord(prospectData, "author") ??
        prospectData;
      let profileEvidence: QualificationCoreParams["profileEvidence"];
      if (cachedProfile) {
        const url = typeof profileData.url === "string" ? profileData.url : "";
        const authorId =
          typeof profileData.urn === "string" ? profileData.urn : "";
        const text = getQualificationProfileText(profileData);
        if (url && authorId && text) profileEvidence = { url, authorId, text };
      }
      const discoveryQueries = Array.isArray(
        prospect.discoveryContext?.matchedQueries
      )
        ? prospect.discoveryContext.matchedQueries
        : [];
      const learningContext = await ctx.runAction(
        internal.memory.getQualificationLearningContextInternal,
        {
          workspaceId: String(args.workspaceId),
          userId: String(workspace.userId),
          prospectId: String(prospectId),
          title:
            prospect.title ||
            (typeof profileData.name === "string"
              ? profileData.name
              : undefined),
          briefIntro: prospect.briefIntro,
          matchedKeywords: discoveryQueries,
          evidenceHighlights: evidencePosts
            .flatMap((post) => {
              const text = getWorkflowEvidencePostText(post).trim();
              return text ? [text] : [];
            })
            .slice(0, MAX_EVIDENCE_HIGHLIGHTS),
        }
      );
      if (args.learning === "off") {
        captured.push({
          prospectId,
          learning: "off",
          operatorOnlyMemoryPolicy: learningContext.policyPrompt,
        });
        continue;
      }
      captured.push({
        prospectId,
        learning: "on",
        prospectType: prospect.prospectType ?? null,
        decision: {
          qualified: prospect.qualificationStatus === "qualified",
          score: prospect.qualificationScore ?? null,
        },
        linkedPages: linkedPagesOf(evidencePosts),
        input: {
          platform: prospect.platform,
          evidencePosts,
          discoveryQueries,
          totalKeywords: allKeywords.length || 1,
          profileData,
          profileEvidence,
          targetingSpec,
          icpDescription: workspace.description,
          syntheticTargetingExamples: formatSyntheticTargetingExamples(icps),
          icpPainPoints: allKeywords,
          useCaseKey: resolveWorkspaceUseCaseKey(workspace.useCaseKey),
          relevantMemories: learningContext.relevantMemories,
          workspaceMemoryPolicy: learningContext.policyPrompt,
          complianceInstructions: learningContext.complianceInstructions,
          similarQualifiedCases: learningContext.similarQualifiedCases,
          similarDisqualifiedCases: learningContext.similarDisqualifiedCases,
          now: decidedAt,
        },
      });
    }
    return captured;
  },
});
