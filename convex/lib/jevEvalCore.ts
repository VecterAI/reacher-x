// Pure Jev qualification-replay logic. No Convex runtime imports and no I/O,
// so it stays unit-testable in vitest. The action layer owns database reads
// and the network call; this module owns state construction, question design,
// answer interpretation, deterministic re-scoring, and comparison.

import type { JevAnswer, JevQuestion, JevUsage } from "./jevClient";
import {
  calculateTargetingQualificationScore,
  reconcileQualificationCriterionResults,
  type QualificationCriterionResult,
  type QualificationScoreBreakdown,
} from "./qualificationScoringCore";
import {
  passesQualificationGate,
  type QualificationCandidate,
} from "./qualificationEvidenceCore";
import {
  getWorkflowEvidencePostLikeCount,
  getWorkflowEvidencePostRepostCount,
  sanitizeWorkflowString,
} from "./workflowSafeProspect";
import type {
  TargetingCriterion,
  WorkspaceTargetingSpec,
} from "./targetingSpecCore";

export const JEV_VERDICTS = [
  "matched",
  "partial",
  "not_matched",
  "unknown",
] as const;
export type JevVerdict = (typeof JEV_VERDICTS)[number];

export const JEV_GOAL_VERDICTS = [
  "compatible",
  "unknown",
  "contradicted",
] as const;
export type JevGoalVerdict = (typeof JEV_GOAL_VERDICTS)[number];

export const JEV_SUPPORT_THRESHOLD = 0.5;
export const JEV_BOT_THRESHOLD = 0.5;
export const JEV_DEFAULT_TEXT_CAP_CHARS = 1200;
export const JEV_MAX_STATE_CHARS = 90_000;
const TEXT_CAP_LADDER = [1200, 800, 500, 300, 200, 120];
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const PROFILE_PROJECTION_KEYS = [
  "id_str",
  "id",
  "urn",
  "profileID",
  "publicIdentifier",
  "name",
  "screen_name",
  "firstName",
  "lastName",
  "headline",
  "description",
  "bio",
  "location",
  "created_at",
  "followers_count",
  "friends_count",
  "statuses_count",
  "verified",
  "title",
  "company",
] as const;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function sanitizeStateText(value: string): string {
  return stripUnpairedSurrogates(sanitizeWorkflowString(value));
}

/** Unpaired surrogate code units cannot be encoded as UTF-8 and are rejected by the Jev API. */
function stripUnpairedSurrogates(value: string): string {
  let output = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const isHighSurrogate = code >= 0xd800 && code <= 0xdbff;
    const isLowSurrogate = code >= 0xdc00 && code <= 0xdfff;
    const nextCode = index + 1 < value.length ? value.charCodeAt(index + 1) : 0;
    const nextIsLowSurrogate = nextCode >= 0xdc00 && nextCode <= 0xdfff;
    if (isHighSurrogate && nextIsLowSurrogate) {
      output += value[index] + value[index + 1];
      index += 1;
    } else if (!isHighSurrogate && !isLowSurrogate) {
      output += value[index];
    }
  }
  return output;
}

function truncateText(value: string, maxChars: number): string {
  const normalized = sanitizeStateText(value).trim();
  if (normalized.length <= maxChars) return normalized;
  // Slicing can cut inside a surrogate pair (emoji), so strip any lone
  // surrogates the cut just created before returning.
  return `${stripUnpairedSurrogates(normalized.slice(0, maxChars)).trimEnd()}…`;
}

function projectProfileData(
  profileData: Record<string, unknown>
): Record<string, unknown> {
  const projected: Record<string, unknown> = {};
  for (const key of PROFILE_PROJECTION_KEYS) {
    const value = profileData[key];
    if (typeof value === "string") {
      projected[key] = sanitizeStateText(value);
    } else if (typeof value === "number" || typeof value === "boolean") {
      projected[key] = value;
    }
  }
  if (Object.keys(projected).length === 0) {
    return { note: "Structured profile data was unavailable for replay." };
  }
  return projected;
}

function buildCriterionContext(criterion: TargetingCriterion): string {
  const parts = [
    `Criterion "${sanitizeStateText(criterion.label)}"`,
    `kind: ${criterion.kind}`,
    `category: ${criterion.category}`,
    `evidence: ${criterion.evidence}`,
    `Specification: ${sanitizeStateText(criterion.description)}`,
  ];
  if (criterion.terms.length > 0) {
    parts.push(
      `Key terms: ${criterion.terms.map(sanitizeStateText).join(", ")}.`
    );
  }
  if (criterion.kind === "exclusion") {
    parts.push(
      "This is an exclusion criterion: matched means the prospect exhibits the excluded trait and must be rejected; not_matched means the prospect does not exhibit that trait."
    );
  }
  if (criterion.evidence === "activity") {
    parts.push(
      "Profile data alone describes responsibilities, not dated activity, and cannot satisfy an activity criterion by itself."
    );
  }
  return parts.join(". ");
}

export type JevQualificationStateBundle = {
  state: Record<string, unknown>;
  approxChars: number;
  textCapChars: number;
};

export function buildJevQualificationState(args: {
  icpDescription: string;
  targetingSpec: WorkspaceTargetingSpec;
  profileData: Record<string, unknown>;
  candidates: QualificationCandidate[];
  currentUtcDate: string;
}): JevQualificationStateBundle {
  const buildAtCap = (textCapChars: number) => {
    const state: Record<string, unknown> = {
      current_date_utc: args.currentUtcDate,
      workspace_objective: sanitizeStateText(args.icpDescription),
      targeting_spec: {
        summary: sanitizeStateText(args.targetingSpec.summary),
        criteria: args.targetingSpec.criteria.map((criterion) => ({
          id: criterion.id,
          label: sanitizeStateText(criterion.label),
          description: sanitizeStateText(criterion.description),
          terms: criterion.terms.map(sanitizeStateText),
          kind: criterion.kind,
          category: criterion.category,
          evidence: criterion.evidence,
          weight: criterion.weight,
        })),
      },
      prospect_profile: projectProfileData(args.profileData),
      candidate_sources: args.candidates.map((candidate) => ({
        candidate_id: candidate.candidateId,
        source_type: candidate.contentType,
        evidence_kind: candidate.evidenceKind,
        platform: candidate.platform,
        published_at: candidate.publishedAt ?? "unknown",
        engagement: {
          likes: getWorkflowEvidencePostLikeCount(candidate.sourcePost),
          reposts: getWorkflowEvidencePostRepostCount(candidate.sourcePost),
        },
        text: truncateText(candidate.text, textCapChars),
      })),
    };
    return state;
  };

  let textCapChars = JEV_DEFAULT_TEXT_CAP_CHARS;
  let state = buildAtCap(textCapChars);
  let approxChars = JSON.stringify(state).length;
  for (const cap of TEXT_CAP_LADDER) {
    if (approxChars <= JEV_MAX_STATE_CHARS) break;
    textCapChars = cap;
    state = buildAtCap(textCapChars);
    approxChars = JSON.stringify(state).length;
  }

  return { state, approxChars, textCapChars };
}

export function buildJevQualificationQuestions(args: {
  targetingSpec: WorkspaceTargetingSpec;
  candidates: QualificationCandidate[];
}): Record<string, JevQuestion> {
  const questions: Record<string, JevQuestion> = {};

  const verdictCriteria: Record<string, string> = {
    matched:
      "The available profile or prospect-authored evidence directly satisfies the criterion.",
    partial: "There is genuine but incomplete support for the criterion.",
    not_matched:
      "The available evidence directly contradicts or fails the criterion.",
    unknown: "The available data cannot determine the criterion.",
  };

  for (const criterion of args.targetingSpec.criteria) {
    questions[`criterion_${criterion.id}`] = {
      type: "choice",
      instructions: `${buildCriterionContext(criterion)} Decide the verdict for this criterion only.`,
      criteria: verdictCriteria,
    };
  }

  questions.goal_assessment = {
    type: "choice",
    instructions:
      "Separate the factual audience match from usefulness for the user's objective in the state. Missing proof that the author wants the offered service is unknown, not a contradiction. Missing preferred geography or format is not a contradiction.",
    criteria: {
      compatible:
        "Nothing in the evidence contradicts the user's objective; the author is plausibly useful to contact for this goal.",
      unknown:
        "The evidence does not establish whether contacting this person serves the user's objective.",
      contradicted:
        "The evidence directly contradicts the user's objective, such as an explicit refusal of the offered service.",
    },
  };

  questions.likely_bot = {
    type: "noul",
    instructions:
      "Decide whether this account is an automated bot rather than a real person. Answer true only with strong concrete signals, such as near-zero engagement relative to posting volume, incoherent template bios, bursts of identical posts, or an obviously stolen identity. Business, marketing, and promotional accounts run by real people are not bots.",
    criteria: {
      true: "Concrete automation or spam signals are present in the account data.",
      false:
        "No strong automation or spam signals; this is a real person or a real person's business account.",
    },
  };

  args.candidates.forEach((candidate, index) => {
    const published =
      candidate.publishedAt === undefined ? "unknown" : candidate.publishedAt;
    questions[`support_${index}`] = {
      type: "noul",
      instructions: `Candidate source "${candidate.candidateId}" (${candidate.contentType}, published ${published}). Decide whether this post is usable evidence for the workspace's targeting criteria: authored by the prospect and about their own work, role, company, or the topics the criteria describe.`,
      criteria: {
        true: "The post is prospect-authored and relevant to at least one targeting criterion in the state.",
        false:
          "The post is unrelated to the targeting criteria, is not prospect-authored, or is unusable as evidence.",
      },
    };
  });

  return questions;
}

export type JevRawQualification = {
  criterionResults: QualificationCriterionResult[];
  goalAssessment: {
    verdict: JevGoalVerdict;
    candidateId: string;
    conflictingQuote: string;
  };
  isLikelyBot: boolean;
  botProbability: number;
  evidenceDecisions: Array<{
    candidateId: string;
    supportsQualification: boolean;
    supportingQuote: string;
  }>;
  supportProbabilityByCandidateId: Record<string, number>;
  lowConfidenceAnswerCount: number;
};

export const JEV_LOW_CONFIDENCE_THRESHOLD = 0.25;

export function mapJevAnswersToQualification(args: {
  targetingSpec: WorkspaceTargetingSpec;
  candidates: QualificationCandidate[];
  answers: Record<string, JevAnswer>;
  supportThreshold?: number;
}): JevRawQualification {
  const supportThreshold = args.supportThreshold ?? JEV_SUPPORT_THRESHOLD;
  const supportProbabilityByCandidateId: Record<string, number> = {};
  const evidenceDecisions: JevRawQualification["evidenceDecisions"] = [];

  args.candidates.forEach((candidate, index) => {
    const answer = args.answers[`support_${index}`];
    const probability =
      answer && answer.type === "noul" ? clamp01(answer.noul) : 0;
    supportProbabilityByCandidateId[candidate.candidateId] = probability;
    evidenceDecisions.push({
      candidateId: candidate.candidateId,
      supportsQualification: probability >= supportThreshold,
      supportingQuote: "",
    });
  });

  const supportedSourceIds = args.candidates
    .filter(
      (candidate) =>
        supportProbabilityByCandidateId[candidate.candidateId] >=
        supportThreshold
    )
    .map((candidate) => candidate.sourceId);

  const candidateKindBySourceId = new Map(
    args.candidates.map((candidate) => [
      candidate.sourceId,
      candidate.evidenceKind,
    ])
  );

  const criterionResults = args.targetingSpec.criteria.map((criterion) => {
    const answer = args.answers[`criterion_${criterion.id}`];
    const emptyResult: QualificationCriterionResult = {
      criterionId: criterion.id,
      verdict: "unknown",
      confidence: 0,
      rationale: "",
      sourceIds: [],
    };
    if (!answer || answer.type !== "choice") return emptyResult;

    const verdict = JEV_VERDICTS.find((value) => value === answer.choice);
    if (!verdict) return emptyResult;

    const confidence = clamp01(
      answer.confidence ?? answer.probabilities?.[verdict] ?? 0
    );
    const sourceIds =
      verdict === "matched" || verdict === "partial"
        ? Array.from(
            new Set(
              supportedSourceIds.filter((sourceId) => {
                if (criterion.evidence !== "activity") return true;
                return candidateKindBySourceId.get(sourceId) !== "profile";
              })
            )
          ).slice(0, 10)
        : [];

    return {
      criterionId: criterion.id,
      verdict,
      confidence,
      rationale: "",
      sourceIds,
    };
  });

  const goalAnswer = args.answers.goal_assessment;
  const goalVerdict =
    goalAnswer && goalAnswer.type === "choice"
      ? (JEV_GOAL_VERDICTS.find((value) => value === goalAnswer.choice) ??
        "unknown")
      : "unknown";

  const botAnswer = args.answers.likely_bot;
  const botProbability =
    botAnswer && botAnswer.type === "noul" ? clamp01(botAnswer.noul) : 0;

  const lowConfidenceAnswerCount = criterionResults.filter(
    (result) => result.confidence < JEV_LOW_CONFIDENCE_THRESHOLD
  ).length;

  return {
    criterionResults,
    goalAssessment: {
      verdict: goalVerdict,
      candidateId: "",
      conflictingQuote: "",
    },
    isLikelyBot: botProbability >= JEV_BOT_THRESHOLD,
    botProbability,
    evidenceDecisions,
    supportProbabilityByCandidateId,
    lowConfidenceAnswerCount,
  };
}

export type JevReplayQualification = {
  raw: JevRawQualification;
  criterionResults: QualificationCriterionResult[];
  breakdown: QualificationScoreBreakdown;
  total: number;
  qualified: boolean;
  hardFailureCriterionIds: string[];
  supportedSourceCount: number;
  newestEvidenceAgeDays?: number;
};

export function replayJevQualification(args: {
  targetingSpec: WorkspaceTargetingSpec;
  candidates: QualificationCandidate[];
  answers: Record<string, JevAnswer>;
  now: number;
  threshold: number;
  supportThreshold?: number;
}): JevReplayQualification {
  const raw = mapJevAnswersToQualification({
    targetingSpec: args.targetingSpec,
    candidates: args.candidates,
    answers: args.answers,
    supportThreshold: args.supportThreshold,
  });

  const supportedSourceIds = new Set(
    raw.evidenceDecisions
      .filter((decision) => decision.supportsQualification)
      .map(
        (decision) =>
          args.candidates.find(
            (candidate) => candidate.candidateId === decision.candidateId
          )?.sourceId
      )
      .filter((sourceId): sourceId is string => Boolean(sourceId))
  );
  const supportedSourceCount = supportedSourceIds.size;

  const supportedAges = args.candidates.flatMap((candidate) => {
    if (!supportedSourceIds.has(candidate.sourceId)) return [];
    if (!candidate.publishedAt) return [];
    const timestamp = Date.parse(candidate.publishedAt);
    if (!Number.isFinite(timestamp)) return [];
    return [Math.max(0, Math.floor((args.now - timestamp) / MS_PER_DAY))];
  });
  const newestEvidenceAgeDays =
    supportedAges.length > 0 ? Math.min(...supportedAges) : undefined;

  const targetingScore = calculateTargetingQualificationScore({
    spec: args.targetingSpec,
    results: raw.criterionResults,
    supportedSourceCount,
    newestEvidenceAgeDays,
    isLikelyBot: raw.isLikelyBot,
    threshold: args.threshold,
  });

  return {
    raw,
    criterionResults: reconcileQualificationCriterionResults({
      spec: args.targetingSpec,
      results: raw.criterionResults,
    }),
    breakdown: targetingScore.breakdown,
    total: targetingScore.breakdown.total,
    qualified: passesQualificationGate({
      modelQualified: targetingScore.qualified,
      isLikelyBot: raw.isLikelyBot,
      score: targetingScore.breakdown.total,
      threshold: args.threshold,
      verifiedSourceCount: supportedSourceCount,
    }),
    hardFailureCriterionIds: targetingScore.hardFailureCriterionIds,
    supportedSourceCount,
    newestEvidenceAgeDays,
  };
}

export type StoredQualificationSnapshot = {
  status: "qualified" | "disqualified" | "pending" | undefined;
  score: number | undefined;
  breakdown: QualificationScoreBreakdown | undefined;
  criterionResults: QualificationCriterionResult[];
  isLikelyBot: boolean | null;
  sourceIds: string[];
};

export type JevCriterionComparison = {
  criterionId: string;
  stored: JevVerdict;
  jev: JevVerdict;
  jevConfidence: number;
  agree: boolean;
};

export type JevReplayComparison = {
  prospectId: string;
  criterionComparisons: JevCriterionComparison[];
  criterionAgree: number;
  criterionTotal: number;
  botStored: boolean | null;
  botJev: boolean;
  botAgree: boolean | null;
  supportStoredSourceIds: string[];
  supportJevSourceIds: string[];
  supportRows: Array<{
    sourceId: string;
    jevProbability: number;
    storedVerified: boolean;
  }>;
  supportAgree: number;
  supportTotal: number;
  statusStored: "qualified" | "disqualified" | null;
  statusJev: "qualified" | "disqualified";
  statusAgree: boolean | null;
  scoreStored: number | null;
  scoreJev: number;
  scoreDelta: number | null;
  breakdownStored: QualificationScoreBreakdown | null;
  breakdownJev: QualificationScoreBreakdown;
  meanJevConfidence: number;
  goalVerdict: JevGoalVerdict;
  stateChars: number;
  questionCount: number;
  missingAnswerCount: number;
  lowConfidenceAnswerCount: number;
  usage: JevUsage;
  latencyMs: number;
  cost: number;
};

export function compareJevReplayWithStored(args: {
  prospectId: string;
  stored: StoredQualificationSnapshot;
  replay: JevReplayQualification;
  candidates: QualificationCandidate[];
  answers: Record<string, JevAnswer>;
  sentQuestionIds: string[];
  usage: JevUsage;
  latencyMs: number;
  stateChars: number;
  questionCount: number;
}): JevReplayComparison {
  const replayByCriterionId = new Map(
    args.replay.criterionResults.map((result) => [result.criterionId, result])
  );
  const storedByCriterionId = new Map(
    args.stored.criterionResults.map((result) => [result.criterionId, result])
  );

  const criterionComparisons: JevCriterionComparison[] = [];
  for (const criterionId of storedByCriterionId.keys()) {
    const storedResult = storedByCriterionId.get(criterionId);
    const replayResult = replayByCriterionId.get(criterionId);
    if (!storedResult || !replayResult) continue;
    criterionComparisons.push({
      criterionId,
      stored: storedResult.verdict as JevVerdict,
      jev: replayResult.verdict as JevVerdict,
      jevConfidence: replayResult.confidence,
      agree: storedResult.verdict === replayResult.verdict,
    });
  }

  const sourceIdByCandidateId = new Map(
    args.candidates.map((candidate) => [
      candidate.candidateId,
      candidate.sourceId,
    ])
  );
  const replaySourceIds = args.replay.raw.evidenceDecisions
    .filter((decision) => decision.supportsQualification)
    .map((decision) => sourceIdByCandidateId.get(decision.candidateId))
    .filter((sourceId): sourceId is string => Boolean(sourceId));

  const storedSupportSet = new Set(args.stored.sourceIds);
  const jevSupportSet = new Set(replaySourceIds);
  const supportKeys = new Set([...storedSupportSet, ...jevSupportSet]);
  let supportAgree = 0;
  for (const key of supportKeys) {
    if (storedSupportSet.has(key) === jevSupportSet.has(key)) supportAgree += 1;
  }

  const supportRows: JevReplayComparison["supportRows"] = [];
  for (const candidate of args.candidates) {
    const sourceId = candidate.sourceId;
    if (supportRows.some((row) => row.sourceId === sourceId)) continue;
    supportRows.push({
      sourceId,
      jevProbability:
        args.replay.raw.supportProbabilityByCandidateId[
          candidate.candidateId
        ] ?? 0,
      storedVerified: storedSupportSet.has(sourceId),
    });
  }

  const botAgree =
    args.stored.isLikelyBot === null
      ? null
      : args.stored.isLikelyBot === args.replay.raw.isLikelyBot;

  const statusStored =
    args.stored.status === "qualified" || args.stored.status === "disqualified"
      ? args.stored.status
      : null;
  const statusJev: "qualified" | "disqualified" = args.replay.qualified
    ? "qualified"
    : "disqualified";

  const confidences = args.replay.criterionResults
    .filter((result) => result.verdict !== "unknown")
    .map((result) => result.confidence);
  const meanJevConfidence =
    confidences.length > 0
      ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
      : 0;

  const missingAnswerCount = args.sentQuestionIds.filter(
    (questionId) => !args.answers[questionId]
  ).length;

  return {
    prospectId: args.prospectId,
    criterionComparisons,
    criterionAgree: criterionComparisons.filter((entry) => entry.agree).length,
    criterionTotal: criterionComparisons.length,
    botStored: args.stored.isLikelyBot,
    botJev: args.replay.raw.isLikelyBot,
    botAgree,
    supportStoredSourceIds: args.stored.sourceIds,
    supportJevSourceIds: [...jevSupportSet],
    supportRows,
    supportAgree,
    supportTotal: supportKeys.size,
    statusStored,
    statusJev,
    statusAgree: statusStored === null ? null : statusStored === statusJev,
    scoreStored: args.stored.score ?? null,
    scoreJev: args.replay.total,
    scoreDelta:
      args.stored.score === undefined
        ? null
        : Math.abs(args.stored.score - args.replay.total),
    breakdownStored: args.stored.breakdown ?? null,
    breakdownJev: args.replay.breakdown,
    meanJevConfidence,
    goalVerdict: args.replay.raw.goalAssessment.verdict,
    stateChars: args.stateChars,
    questionCount: args.questionCount,
    missingAnswerCount,
    lowConfidenceAnswerCount: args.replay.raw.lowConfidenceAnswerCount,
    usage: args.usage,
    latencyMs: args.latencyMs,
    cost: args.usage.cost,
  };
}

export type JevEvalSummary = {
  prospectCount: number;
  comparedCount: number;
  structuralSkipCount: number;
  criterionAgree: number;
  criterionTotal: number;
  botAgree: number;
  botCompared: number;
  supportAgree: number;
  supportTotal: number;
  supportCountStoredSum: number;
  supportCountJevSum: number;
  supportThresholdSweep: Array<{
    threshold: number;
    truePositives: number;
    falsePositives: number;
    trueNegatives: number;
    falseNegatives: number;
  }>;
  statusAgree: number;
  statusCompared: number;
  scoreDeltaSum: number;
  scoreDeltaCount: number;
  scoreWithinFive: number;
  meanJevConfidence: number;
  confidenceSampleCount: number;
  missingAnswerCount: number;
  prospectsWithMissingAnswers: number;
  lowConfidenceAnswerCount: number;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  requestCount: number;
  totalLatencyMs: number;
  maxLatencyMs: number;
  maxStateChars: number;
  disagreementSamples: Array<{
    prospectId: string;
    criterionId: string;
    stored: string;
    jev: string;
    jevConfidence: number;
  }>;
};

const MAX_DISAGREEMENT_SAMPLES = 20;

export function aggregateJevComparisons(
  comparisons: JevReplayComparison[]
): JevEvalSummary {
  const summary: JevEvalSummary = {
    prospectCount: comparisons.length,
    comparedCount: 0,
    structuralSkipCount: 0,
    criterionAgree: 0,
    criterionTotal: 0,
    botAgree: 0,
    botCompared: 0,
    supportAgree: 0,
    supportTotal: 0,
    supportCountStoredSum: 0,
    supportCountJevSum: 0,
    supportThresholdSweep: [],
    statusAgree: 0,
    statusCompared: 0,
    scoreDeltaSum: 0,
    scoreDeltaCount: 0,
    scoreWithinFive: 0,
    meanJevConfidence: 0,
    confidenceSampleCount: 0,
    missingAnswerCount: 0,
    prospectsWithMissingAnswers: 0,
    lowConfidenceAnswerCount: 0,
    totalCost: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    requestCount: comparisons.length,
    totalLatencyMs: 0,
    maxLatencyMs: 0,
    maxStateChars: 0,
    disagreementSamples: [],
  };

  let confidenceSum = 0;
  let confidenceCount = 0;

  for (const comparison of comparisons) {
    summary.criterionAgree += comparison.criterionAgree;
    summary.criterionTotal += comparison.criterionTotal;
    if (comparison.botAgree !== null) {
      summary.botCompared += 1;
      if (comparison.botAgree) summary.botAgree += 1;
    }
    summary.supportAgree += comparison.supportAgree;
    summary.supportTotal += comparison.supportTotal;
    summary.supportCountStoredSum += comparison.supportStoredSourceIds.length;
    summary.supportCountJevSum += comparison.supportJevSourceIds.length;
    summary.missingAnswerCount += comparison.missingAnswerCount;
    if (comparison.missingAnswerCount > 0) {
      summary.prospectsWithMissingAnswers += 1;
    }
    summary.lowConfidenceAnswerCount += comparison.lowConfidenceAnswerCount;
    if (comparison.statusAgree !== null) {
      summary.statusCompared += 1;
      if (comparison.statusAgree) summary.statusAgree += 1;
    }
    if (comparison.scoreDelta !== null) {
      summary.scoreDeltaSum += comparison.scoreDelta;
      summary.scoreDeltaCount += 1;
      if (comparison.scoreDelta <= 5) summary.scoreWithinFive += 1;
    }
    confidenceSum += comparison.meanJevConfidence;
    confidenceCount += 1;
    summary.totalCost += comparison.cost;
    summary.totalInputTokens += comparison.usage.inputTokens;
    summary.totalOutputTokens += comparison.usage.outputTokens;
    summary.totalLatencyMs += comparison.latencyMs;
    summary.maxLatencyMs = Math.max(summary.maxLatencyMs, comparison.latencyMs);
    summary.maxStateChars = Math.max(
      summary.maxStateChars,
      comparison.stateChars
    );
    summary.comparedCount += 1;

    for (const entry of comparison.criterionComparisons) {
      if (entry.agree) continue;
      summary.disagreementSamples.push({
        prospectId: comparison.prospectId,
        criterionId: entry.criterionId,
        stored: entry.stored,
        jev: entry.jev,
        jevConfidence: entry.jevConfidence,
      });
    }
  }

  summary.disagreementSamples = summary.disagreementSamples.slice(
    0,
    MAX_DISAGREEMENT_SAMPLES
  );
  summary.meanJevConfidence =
    confidenceCount > 0 ? confidenceSum / confidenceCount : 0;

  const supportRows = comparisons.flatMap(
    (comparison) => comparison.supportRows
  );
  summary.supportThresholdSweep = [];
  for (let step = 1; step <= 19; step += 1) {
    const rounded = step / 20;
    const sweep = {
      threshold: rounded,
      truePositives: 0,
      falsePositives: 0,
      trueNegatives: 0,
      falseNegatives: 0,
    };
    for (const row of supportRows) {
      const predicted = row.jevProbability >= rounded;
      if (predicted && row.storedVerified) sweep.truePositives += 1;
      else if (predicted && !row.storedVerified) sweep.falsePositives += 1;
      else if (!predicted && !row.storedVerified) sweep.trueNegatives += 1;
      else sweep.falseNegatives += 1;
    }
    summary.supportThresholdSweep.push(sweep);
  }

  return summary;
}

export function getSupportSweepF1(sweep: {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
}): number {
  const denominator =
    2 * sweep.truePositives + sweep.falsePositives + sweep.falseNegatives;
  if (denominator === 0) return 0;
  return (2 * sweep.truePositives) / denominator;
}

export type JevStabilityResult = {
  agree: number;
  total: number;
};

export function summarizeJevStability(args: {
  first: QualificationCriterionResult[];
  second: QualificationCriterionResult[];
}): JevStabilityResult {
  const firstById = new Map(
    args.first.map((result) => [result.criterionId, result.verdict])
  );
  const secondById = new Map(
    args.second.map((result) => [result.criterionId, result.verdict])
  );
  const ids = new Set([...firstById.keys(), ...secondById.keys()]);
  let agree = 0;
  for (const id of ids) {
    if (firstById.get(id) === secondById.get(id)) agree += 1;
  }
  return { agree, total: ids.size };
}

export function formatJevEvalReport(args: {
  workspaceName: string;
  workspaceId: string;
  jevModel: string;
  summary: JevEvalSummary;
  stability?: JevStabilityResult;
}): string {
  const { summary } = args;
  const percent = (part: number, total: number) =>
    total === 0
      ? "n/a"
      : `${((part / total) * 100).toFixed(1)}% (${part}/${total})`;
  const lines: string[] = [];

  lines.push("[JevEval] Replay report");
  lines.push(
    `Workspace: "${args.workspaceName}" (${args.workspaceId}) | Jev model: ${args.jevModel}`
  );
  lines.push(
    `Prospects replayed: ${summary.prospectCount} (structural skips excluded: ${summary.structuralSkipCount})`
  );
  lines.push("");
  lines.push(
    `Criterion verdict agreement: ${percent(summary.criterionAgree, summary.criterionTotal)}`
  );
  lines.push(
    `Bot detection agreement: ${percent(summary.botAgree, summary.botCompared)}`
  );
  lines.push(
    `Verified evidence count (stored vs Jev, avg): ${
      summary.prospectCount > 0
        ? (summary.supportCountStoredSum / summary.prospectCount).toFixed(1)
        : "n/a"
    } vs ${
      summary.prospectCount > 0
        ? (summary.supportCountJevSum / summary.prospectCount).toFixed(1)
        : "n/a"
    }`
  );
  if (summary.supportThresholdSweep.length > 0) {
    const best = [...summary.supportThresholdSweep]
      .map((entry) => ({
        threshold: entry.threshold,
        f1: getSupportSweepF1(entry),
        entry,
      }))
      .sort(
        (left, right) => right.f1 - left.f1 || left.threshold - right.threshold
      )[0];
    const atDefault = summary.supportThresholdSweep.find(
      (entry) => entry.threshold === 0.5
    );
    lines.push(
      `Support threshold calibration (F1 vs stored verified sources): best ${best.threshold.toFixed(2)} (F1 ${best.f1.toFixed(2)}) | at default 0.50: F1 ${getSupportSweepF1(atDefault ?? best.entry).toFixed(2)}`
    );
  }
  lines.push(
    `Final qualification outcome agreement: ${percent(summary.statusAgree, summary.statusCompared)}`
  );
  lines.push(
    `Score delta: mean ${summary.scoreDeltaCount > 0 ? (summary.scoreDeltaSum / summary.scoreDeltaCount).toFixed(1) : "n/a"} | within ±5: ${percent(summary.scoreWithinFive, summary.scoreDeltaCount)}`
  );
  lines.push(
    `Mean Jev confidence (decisive verdicts): ${summary.meanJevConfidence.toFixed(2)}`
  );
  lines.push("");
  lines.push(
    `Cost: $${summary.totalCost.toFixed(4)} total | ${summary.totalInputTokens} input tokens | ${summary.totalOutputTokens} output tokens`
  );
  lines.push(
    `Latency: avg ${summary.requestCount > 0 ? Math.round(summary.totalLatencyMs / summary.requestCount) : 0}ms | max ${summary.maxLatencyMs}ms | max state size ${summary.maxStateChars} chars`
  );
  if (summary.missingAnswerCount > 0) {
    lines.push(
      `Missing answers: ${summary.missingAnswerCount} across ${summary.prospectsWithMissingAnswers} request(s)`
    );
  }
  if (summary.lowConfidenceAnswerCount > 0) {
    lines.push(
      `Low-confidence verdicts (below ${JEV_LOW_CONFIDENCE_THRESHOLD}): ${summary.lowConfidenceAnswerCount}`
    );
  }
  if (args.stability) {
    lines.push(
      `Self-stability (repeat runs): ${percent(args.stability.agree, args.stability.total)}`
    );
  }
  if (summary.disagreementSamples.length > 0) {
    lines.push("");
    lines.push("Disagreements (stored vs Jev):");
    for (const sample of summary.disagreementSamples) {
      lines.push(
        `- ${sample.prospectId} | ${sample.criterionId}: stored=${sample.stored} jev=${sample.jev} (confidence ${sample.jevConfidence.toFixed(2)})`
      );
    }
  }
  return lines.join("\n");
}
