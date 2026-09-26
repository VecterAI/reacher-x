// Temporary local harness for the Jev replay eval (Phase 0). Runs the exact
// same pipeline as convex/jevEvalActions.ts against data exported read-only
// from production, with zero prod writes and zero code pushes. Delete after
// the eval run.
import { readFileSync } from "node:fs";
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
} from "../convex/lib/jevEvalCore";
import { callJevDecisions, getJevModel } from "../convex/lib/jevClient";
import {
  prepareQualificationCandidates,
  type QualificationCandidate,
} from "../convex/lib/qualificationEvidenceCore";
import type { QualificationCriterionResult } from "../convex/lib/qualificationScoringCore";
import { buildLegacyWorkspaceTargetingSpec } from "../convex/lib/targetingSpecCore";
import { getNestedRecord, isRecord } from "../convex/lib/typeGuards";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { QUALIFICATION_THRESHOLD } from "../shared/lib/qualificationConstants";

const DATA_DIR = "/tmp/jev-eval-data";
const STABILITY_PROSPECT_COUNT = 3;
// Optional calibrated support threshold (set after reviewing a sweep run).
const SUPPORT_THRESHOLD_OVERRIDE = Number(process.env.JEV_SUPPORT_THRESHOLD);

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const workspaceExport = JSON.parse(
  readFileSync(`${DATA_DIR}/workspace.json`, "utf8")
);
const chunks = [0, 1, 2, 3, 4, 5].map((index) =>
  JSON.parse(readFileSync(`${DATA_DIR}/chunk_${index}.json`, "utf8"))
);
const prospects = chunks.flat();

const workspace = workspaceExport.workspace;
const targetingSpec =
  workspace.targetingSpec ??
  buildLegacyWorkspaceTargetingSpec({
    description: workspace.description,
    profiles: workspace.icps ?? [],
  });

console.log(
  `[JevEval] Local replay: ${prospects.length} prospects | workspace "${workspace.workspaceName}" | criteria: ${targetingSpec.criteria.length} | model: ${getJevModel()} | support threshold: ${SUPPORT_THRESHOLD_OVERRIDE || "0.5 (default)"}`
);

const comparisons: JevReplayComparison[] = [];
let structuralSkips = 0;
let structuralAgree = 0;
let failedCount = 0;
const stabilityInputs: Array<{
  prospectId: string;
  state: Record<string, unknown>;
  questions: Record<string, unknown>;
  candidates: QualificationCandidate[];
  first: QualificationCriterionResult[];
}> = [];

for (const [index, prospect] of prospects.entries()) {
  try {
    const prospectData = isRecord(prospect.data) ? prospect.data : {};
    const profileData =
      getNestedRecord(prospectData, "user") ??
      getNestedRecord(prospectData, "author") ??
      prospectData;
    const candidates = prepareQualificationCandidates({
      platform: prospect.platform,
      evidencePosts: (prospect.evidencePosts ?? []).slice(0, 20),
      profileData,
      discoveryQueries: prospect.qualificationKeywords ?? [],
    });

    const stored: StoredQualificationSnapshot = {
      status: prospect.qualificationStatus ?? undefined,
      score: prospect.qualificationScore,
      breakdown: prospect.qualificationScoreBreakdown ?? undefined,
      criterionResults: prospect.qualificationCriterionResults ?? [],
      isLikelyBot: prospect.isLikelyBot,
      sourceIds: prospect.storedSourceIds ?? [],
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

    const call = await callJevDecisions({
      state: bundle.state,
      questions,
      sessionId: "jev-eval-local",
    });

    const replay = replayJevQualification({
      targetingSpec,
      candidates,
      answers: call.response.answers,
      now,
      threshold: QUALIFICATION_THRESHOLD,
      supportThreshold: SUPPORT_THRESHOLD_OVERRIDE || undefined,
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

    if (stabilityInputs.length < STABILITY_PROSPECT_COUNT) {
      stabilityInputs.push({
        prospectId: prospect.prospectId,
        state: bundle.state,
        questions,
        candidates,
        first: replay.raw.criterionResults,
      });
    }

    console.log(
      `[JevEval] ${index + 1}/${prospects.length} prospect=${prospect.prospectId} criteria=${comparison.criterionAgree}/${comparison.criterionTotal} status=${comparison.statusStored ?? "?"}->${comparison.statusJev} score=${comparison.scoreStored ?? "?"}->${comparison.scoreJev} cost=$${comparison.cost.toFixed(4)} latency=${comparison.latencyMs}ms`
    );
  } catch (error) {
    failedCount += 1;
    console.warn(
      `[JevEval] ${index + 1}/${prospects.length} prospect=${prospect.prospectId} failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

let stability;
if (stabilityInputs.length > 0) {
  let agree = 0;
  let total = 0;
  for (const input of stabilityInputs) {
    let repeatCall;
    try {
      repeatCall = await callJevDecisions({
        state: input.state,
        questions: input.questions as never,
        sessionId: "jev-eval-local-stability",
      });
    } catch (error) {
      console.warn(
        `[JevEval] stability replay skipped for ${input.prospectId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      continue;
    }
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

const summary = aggregateJevComparisons(comparisons);
summary.structuralSkipCount = structuralSkips;

console.log(
  formatJevEvalReport({
    workspaceName: workspace.workspaceName,
    workspaceId: workspace.workspaceId,
    jevModel: getJevModel(),
    summary,
    stability,
  })
);

if (structuralSkips > 0) {
  console.log(
    `[JevEval] Structural skips (no replayable candidates): ${structuralSkips}, of which stored status was disqualified: ${structuralAgree}`
  );
}
if (failedCount > 0) {
  console.log(`[JevEval] Failed replays: ${failedCount}`);
}
