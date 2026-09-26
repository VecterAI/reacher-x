"use node";

// Shadow-mode Jev pre-filter: asks the Jev decision model for hard-fail
// signals (exclusion hit, required miss, near-certain bot) BEFORE paid
// qualification runs, and records what it would have done. This NEVER changes
// qualification behavior: the caller only runs it when JEV_PREFILTER_MODE=shadow,
// and this action never throws so the workflow step cannot fail.

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./lib/functionBuilders";
import { callJevDecisions, getJevModel } from "./lib/jevClient";
import {
  buildJevQualificationQuestions,
  buildJevQualificationState,
} from "./lib/jevEvalCore";
import { evaluateJevHardFailSignals } from "./lib/jevPrefilterCore";
import { prepareQualificationCandidates } from "./lib/qualificationEvidenceCore";
import { buildLegacyWorkspaceTargetingSpec } from "./lib/targetingSpecCore";
import { formatSyntheticTargetingExamples } from "./lib/syntheticProfileCore";
import { getNestedRecord, isRecord } from "./lib/typeGuards";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

// Mirrors qualificationCore.MAX_EVIDENCE_POSTS (kept local to avoid importing
// the qualification model stack into this shadow step).
const MAX_CANDIDATE_POSTS = 20;

type JevPrefilterShadowResult = {
  ok: boolean;
  skipped?: boolean;
  decision?: "would_kill" | "would_pass" | "skipped";
  reasonCodes?: string[];
  error?: string;
};

export const runJevPrefilterShadowInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, args): Promise<JevPrefilterShadowResult> => {
    if (process.env.JEV_PREFILTER_MODE?.trim() !== "shadow") {
      return { ok: true, skipped: true, decision: "skipped" };
    }

    try {
      const [prospect, workspace] = await Promise.all([
        ctx.runQuery(internal.jevEvalQueries.getJevEvalProspectInternal, {
          prospectId: args.prospectId,
        }),
        ctx.runQuery(internal.jevEvalQueries.resolveJevEvalWorkspaceInternal, {
          workspaceId: args.workspaceId,
        }),
      ]);
      if (!prospect || !workspace) {
        return { ok: true, skipped: true, decision: "skipped" };
      }

      const prospectData = isRecord(prospect.data) ? prospect.data : {};
      const profileData =
        getNestedRecord(prospectData, "user") ??
        getNestedRecord(prospectData, "author") ??
        prospectData;
      const candidates = prepareQualificationCandidates({
        platform: prospect.platform,
        evidencePosts: prospect.evidencePosts.slice(0, MAX_CANDIDATE_POSTS),
        profileData,
        discoveryQueries: prospect.qualificationKeywords,
      });

      const now = getCurrentUTCTimestamp();
      if (candidates.length === 0) {
        await ctx.runMutation(
          internal.jevPrefilterStore.recordJevPrefilterShadowEventInternal,
          {
            workspaceId: args.workspaceId,
            userId: args.userId,
            prospectId: args.prospectId,
            decision: "skipped",
            reasons: ["no_replayable_candidates"],
            model: getJevModel(),
            costUsd: 0,
            latencyMs: 0,
            storedQualificationStatus:
              prospect.qualificationStatus ?? undefined,
          }
        );
        return { ok: true, decision: "skipped", reasonCodes: [] };
      }

      const targetingSpec =
        workspace.targetingSpec ??
        buildLegacyWorkspaceTargetingSpec({
          description: workspace.description,
          profiles: workspace.icps ?? [],
        });
      const bundle = buildJevQualificationState({
        icpDescription: workspace.description,
        targetingSpec,
        profileData,
        candidates,
        currentUtcDate: new Date(now).toISOString().slice(0, 10),
        painPoints: (workspace.icps ?? []).flatMap(
          (icp) => icp.painPoints ?? []
        ),
        syntheticExamplesText: formatSyntheticTargetingExamples(
          workspace.icps ?? []
        ),
        discoveryQueries: prospect.qualificationKeywords,
      });
      const questions = buildJevQualificationQuestions({
        targetingSpec,
        candidates,
      });

      const call = await callJevDecisions({
        state: bundle.state,
        questions,
        sessionId: `jev-prefilter-${args.workspaceId}`,
      });
      const signals = evaluateJevHardFailSignals({
        targetingSpec,
        answers: call.response.answers,
      });

      await ctx.runMutation(
        internal.jevPrefilterStore.recordJevPrefilterShadowEventInternal,
        {
          workspaceId: args.workspaceId,
          userId: args.userId,
          prospectId: args.prospectId,
          decision: signals.decision,
          reasons: signals.reasonCodes,
          botProbability: signals.botProbability,
          model: call.response.model || getJevModel(),
          costUsd: call.response.usage.cost,
          latencyMs: call.latencyMs,
          storedQualificationStatus: prospect.qualificationStatus ?? undefined,
        }
      );

      console.log(
        `[JevPrefilter] prospect=${args.prospectId} decision=${signals.decision} reasons=${signals.reasonCodes.join(",") || "none"} cost=$${call.response.usage.cost.toFixed(4)} latency=${call.latencyMs}ms`
      );

      return {
        ok: true,
        decision: signals.decision,
        reasonCodes: signals.reasonCodes,
      };
    } catch (error) {
      // Shadow telemetry must never break qualification.
      const message = error instanceof Error ? error.message : String(error);
      console.error("[JevPrefilter] Shadow evaluation failed:", message);
      return { ok: false, error: message };
    }
  },
});
