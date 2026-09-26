"use node";

// One-off replay evaluation for the Jev decision model (Phase 0 gate).
// Read-only against the database: every query is indexed and bounded, and no
// mutation is performed. Only Jev decisions calls are billed (output tokens
// are free); stored GPT-5.6 verdicts provide the comparison ground truth.

import { v } from "convex/values";
import { internalAction } from "./lib/functionBuilders";
import { internal } from "./_generated/api";
import {
  callJevDecisions,
  getJevModel,
  type JevQuestion,
} from "./lib/jevClient";
import {
  aggregateJevComparisons,
  buildJevQualificationQuestions,
  buildJevQualificationState,
  compareJevReplayWithStored,
  formatJevEvalReport,
  replayJevQualification,
  summarizeJevStability,
  type JevReplayComparison,
  type StoredQualificationSnapshot,
} from "./lib/jevEvalCore";
import {
  prepareQualificationCandidates,
  type QualificationCandidate,
} from "./lib/qualificationEvidenceCore";
import type { QualificationCriterionResult } from "./lib/qualificationScoringCore";
import { buildLegacyWorkspaceTargetingSpec } from "./lib/targetingSpecCore";
import { getNestedRecord, isRecord } from "./lib/typeGuards";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { QUALIFICATION_THRESHOLD } from "../shared/lib/qualificationConstants";

// Mirrors qualificationCore.MAX_EVIDENCE_POSTS (kept local to avoid importing
// the qualification model stack into this read-only eval action).
const MAX_CANDIDATE_POSTS = 20;

const STABILITY_PROSPECT_COUNT = 3;

type ReplayableProspect = {
  prospectId: string;
  platform: "twitter" | "linkedin";
  qualificationStatus: "qualified" | "disqualified" | "pending" | null;
  qualificationScore: number | undefined;
  qualificationScoreBreakdown: {
    profileFit: number;
    signalQuality: number;
    intentStrength: number;
    recency: number;
    total: number;
  } | null;
  qualificationCriterionResults: StoredQualificationSnapshot["criterionResults"];
  storedSourceIds: string[];
  isLikelyBot: boolean | null;
  qualificationKeywords: string[];
  evidencePosts: Array<Record<string, unknown>>;
  data: unknown;
};

type JevEvalActionReturn = {
  workspaceId: string;
  workspaceName: string;
  prospectsReplayed: number;
  criterionAgreement: number | null;
  statusAgreement: number | null;
  totalCost: number;
};

export const runJevReplayEval = internalAction({
  args: {
    email: v.optional(v.string()),
    workspaceId: v.optional(v.id("workspaces")),
    limit: v.optional(v.number()),
    stability: v.optional(v.boolean()),
    supportThreshold: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<JevEvalActionReturn> => {
    const limit = Math.max(1, Math.min(40, args.limit ?? 20));
    const qualifiedLimit = Math.ceil(limit / 2);
    const disqualifiedLimit = Math.floor(limit / 2);

    if (!args.email && !args.workspaceId) {
      throw new Error("Provide either an email or a workspaceId.");
    }
    const workspace = await ctx.runQuery(
      internal.jevEvalQueries.resolveJevEvalWorkspaceInternal,
      {
        email: args.email?.trim(),
        workspaceId: args.workspaceId,
      }
    );
    if (!workspace) {
      throw new Error("No workspace resolved for the evaluation target.");
    }

    const targetingSpec =
      workspace.targetingSpec ??
      buildLegacyWorkspaceTargetingSpec({
        description: workspace.description,
        profiles: workspace.icps ?? [],
      });

    const { qualifiedIds, disqualifiedIds, incomplete } = await ctx.runQuery(
      internal.jevEvalQueries.getJevEvalSampleIdsInternal,
      {
        workspaceId: workspace.workspaceId,
        limitPerStatus: Math.max(qualifiedLimit, disqualifiedLimit),
      }
    );
    if (incomplete) {
      console.log(
        "[JevEval] Sample incomplete: the bounded scan budget ran out before filling the requested limit."
      );
    }
    const prospectIds = [
      ...qualifiedIds.slice(0, qualifiedLimit),
      ...disqualifiedIds.slice(0, disqualifiedLimit),
    ];
    if (prospectIds.length === 0) {
      throw new Error(
        "No replayable prospects found (need stored criterion results and evidence posts)."
      );
    }

    console.log(
      `[JevEval] Replaying ${prospectIds.length} prospects from workspace "${workspace.workspaceName}" with model ${getJevModel()}`
    );

    const comparisons: JevReplayComparison[] = [];
    let structuralSkips = 0;
    let structuralAgree = 0;
    let failedCount = 0;
    const stabilityInputs: Array<{
      prospectId: string;
      state: Record<string, unknown>;
      questions: Record<string, JevQuestion>;
      candidates: QualificationCandidate[];
      first: QualificationCriterionResult[];
    }> = [];

    for (const [index, prospectId] of prospectIds.entries()) {
      const prospect = (await ctx.runQuery(
        internal.jevEvalQueries.getJevEvalProspectInternal,
        { prospectId }
      )) as ReplayableProspect | null;
      if (!prospect) continue;

      const prospectData = isRecord(prospect.data) ? prospect.data : {};
      const profileData =
        getNestedRecord(prospectData, "user") ??
        getNestedRecord(prospectData, "author") ??
        prospectData;
      const candidates: QualificationCandidate[] =
        prepareQualificationCandidates({
          platform: prospect.platform,
          evidencePosts: prospect.evidencePosts.slice(0, MAX_CANDIDATE_POSTS),
          profileData,
          discoveryQueries: prospect.qualificationKeywords,
        });

      const stored: StoredQualificationSnapshot = {
        status: prospect.qualificationStatus ?? undefined,
        score: prospect.qualificationScore,
        breakdown: prospect.qualificationScoreBreakdown ?? undefined,
        criterionResults: prospect.qualificationCriterionResults,
        isLikelyBot: prospect.isLikelyBot,
        sourceIds: prospect.storedSourceIds,
      };

      if (candidates.length === 0) {
        structuralSkips += 1;
        if (stored.status === "disqualified") structuralAgree += 1;
        continue;
      }

      const now = getCurrentUTCTimestamp();
      const bundle = buildJevQualificationState({
        icpDescription: workspace.description,
        targetingSpec,
        profileData,
        candidates,
        currentUtcDate: new Date(now).toISOString().slice(0, 10),
      });
      const questions = buildJevQualificationQuestions({
        targetingSpec,
        candidates,
      });

      let call;
      try {
        call = await callJevDecisions({
          state: bundle.state,
          questions,
          sessionId: `jev-eval-${workspace.workspaceId}`,
        });
      } catch (error) {
        failedCount += 1;
        console.warn(
          `[JevEval] ${index + 1}/${prospectIds.length} prospect=${prospect.prospectId} failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        continue;
      }

      const replay = replayJevQualification({
        targetingSpec,
        candidates,
        answers: call.response.answers,
        now,
        threshold: QUALIFICATION_THRESHOLD,
        supportThreshold:
          args.supportThreshold !== undefined && args.supportThreshold > 0
            ? args.supportThreshold
            : undefined,
      });

      const comparison = compareJevReplayWithStored({
        prospectId: prospect.prospectId,
        stored,
        replay,
        candidates,
        answers: call.response.answers,
        sentQuestionIds: Object.keys(questions),
        usage: call.response.usage,
        latencyMs: call.latencyMs,
        stateChars: bundle.approxChars,
        questionCount: Object.keys(questions).length,
      });
      comparisons.push(comparison);

      if (args.stability && stabilityInputs.length < STABILITY_PROSPECT_COUNT) {
        stabilityInputs.push({
          prospectId: prospect.prospectId,
          state: bundle.state,
          questions,
          candidates,
          first: replay.raw.criterionResults,
        });
      }

      console.log(
        `[JevEval] ${index + 1}/${prospectIds.length} prospect=${prospect.prospectId} criteria=${comparison.criterionAgree}/${comparison.criterionTotal} status=${comparison.statusStored ?? "?"}->${comparison.statusJev} cost=$${comparison.cost.toFixed(4)} latency=${comparison.latencyMs}ms`
      );
    }

    if (comparisons.length === 0) {
      throw new Error(
        "Every sampled prospect was skipped; nothing to compare against Jev."
      );
    }

    const summary = aggregateJevComparisons(comparisons);
    summary.structuralSkipCount = structuralSkips;

    let stability: { agree: number; total: number } | undefined;
    if (stabilityInputs.length > 0) {
      let agree = 0;
      let total = 0;
      for (const input of stabilityInputs) {
        const repeatCall = await callJevDecisions({
          state: input.state,
          questions: input.questions,
          sessionId: `jev-eval-stability-${workspace.workspaceId}`,
        });
        const repeatReplay = replayJevQualification({
          targetingSpec,
          candidates: input.candidates,
          answers: repeatCall.response.answers,
          now: getCurrentUTCTimestamp(),
          threshold: QUALIFICATION_THRESHOLD,
        });
        const stabilityResult = summarizeJevStability({
          first: input.first,
          second: repeatReplay.raw.criterionResults,
        });
        agree += stabilityResult.agree;
        total += stabilityResult.total;
      }
      stability = { agree, total };
    }

    const report = formatJevEvalReport({
      workspaceName: workspace.workspaceName,
      workspaceId: workspace.workspaceId,
      jevModel: getJevModel(),
      summary,
      stability,
    });
    console.log(report);

    if (structuralSkips > 0) {
      console.log(
        `[JevEval] Structural skips (no replayable candidates): ${structuralSkips}, of which stored status was disqualified: ${structuralAgree}`
      );
    }
    if (failedCount > 0) {
      console.log(`[JevEval] Failed replays: ${failedCount}`);
    }

    return {
      workspaceId: workspace.workspaceId,
      workspaceName: workspace.workspaceName,
      prospectsReplayed: summary.prospectCount,
      criterionAgreement:
        summary.criterionTotal === 0
          ? null
          : summary.criterionAgree / summary.criterionTotal,
      statusAgreement:
        summary.statusCompared === 0
          ? null
          : summary.statusAgree / summary.statusCompared,
      totalCost: summary.totalCost,
    };
  },
});
