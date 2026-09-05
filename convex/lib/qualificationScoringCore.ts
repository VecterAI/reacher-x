import type { Infer } from "convex/values";
import type {
  TargetingCriterion,
  WorkspaceTargetingSpec,
} from "./targetingSpecCore";
import type { qualificationCriterionResultValidator } from "../validators";

export interface QualificationScoreBreakdown {
  profileFit: number;
  signalQuality: number;
  intentStrength: number;
  recency: number;
  total: number;
}

export type QualificationCriterionResult = Infer<
  typeof qualificationCriterionResultValidator
>;

export type TargetingQualificationScore = {
  breakdown: QualificationScoreBreakdown;
  hardFailureCriterionIds: string[];
  qualified: boolean;
};

export type QualificationScoreComponents = Omit<
  QualificationScoreBreakdown,
  "total"
>;

export const QUALIFICATION_SCORE_MAXIMUMS = {
  profileFit: 30,
  signalQuality: 30,
  intentStrength: 25,
  recency: 15,
} as const;

export function calculateQualificationScore(
  components: QualificationScoreComponents
): QualificationScoreBreakdown {
  const profileFit = Math.round(components.profileFit);
  const signalQuality = Math.round(components.signalQuality);
  const intentStrength = Math.round(components.intentStrength);
  const recency = Math.round(components.recency);

  return {
    profileFit,
    signalQuality,
    intentStrength,
    recency,
    total: profileFit + signalQuality + intentStrength + recency,
  };
}

export function createEmptyQualificationScoreBreakdown(): QualificationScoreBreakdown {
  return calculateQualificationScore({
    profileFit: 0,
    signalQuality: 0,
    intentStrength: 0,
    recency: 0,
  });
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function getVerdictValue(
  verdict: QualificationCriterionResult["verdict"]
): number {
  if (verdict === "matched") return 1;
  if (verdict === "partial") return 0.5;
  return 0;
}

function getWeightedRatio(args: {
  criteria: TargetingCriterion[];
  resultsById: Map<string, QualificationCriterionResult>;
  fallbackCriteria: TargetingCriterion[];
}): number {
  const criteria =
    args.criteria.length > 0 ? args.criteria : args.fallbackCriteria;
  const totalWeight = criteria.reduce(
    (sum, criterion) => sum + criterion.weight,
    0
  );
  if (totalWeight === 0) return 0;

  return clampUnit(
    criteria.reduce((sum, criterion) => {
      const result = args.resultsById.get(criterion.id);
      return (
        sum + criterion.weight * getVerdictValue(result?.verdict ?? "unknown")
      );
    }, 0) / totalWeight
  );
}

function getRequiredFoundationRatio(args: {
  requiredCriteria: TargetingCriterion[];
  fallbackCriteria: TargetingCriterion[];
  resultsById: Map<string, QualificationCriterionResult>;
}): number {
  if (args.requiredCriteria.length === 0) {
    return getWeightedRatio({
      criteria: args.fallbackCriteria,
      fallbackCriteria: args.fallbackCriteria,
      resultsById: args.resultsById,
    });
  }

  const foundation = Math.min(
    ...args.requiredCriteria.map((criterion) =>
      getVerdictValue(args.resultsById.get(criterion.id)?.verdict ?? "unknown")
    )
  );
  // Core fit supplies the foundation, but preferred profile attributes must
  // still change ranking. Mandatory failures are gated separately below.
  const profileFit = getWeightedRatio({
    criteria: args.fallbackCriteria,
    fallbackCriteria: args.fallbackCriteria,
    resultsById: args.resultsById,
  });
  return foundation * 0.75 + profileFit * 0.25;
}

function getEvidenceQuality(args: {
  criteria: TargetingCriterion[];
  resultsById: Map<string, QualificationCriterionResult>;
  supportedSourceCount: number;
}): number {
  const totalWeight = args.criteria.reduce(
    (sum, criterion) => sum + criterion.weight,
    0
  );
  if (totalWeight === 0 || args.supportedSourceCount === 0) return 0;

  let supportedWeight = 0;
  let confidenceWeight = 0;
  for (const criterion of args.criteria) {
    const result = args.resultsById.get(criterion.id);
    const verdictValue = getVerdictValue(result?.verdict ?? "unknown");
    if (!result || verdictValue === 0 || result.sourceIds.length === 0)
      continue;
    supportedWeight += criterion.weight * verdictValue;
    confidenceWeight +=
      criterion.weight * verdictValue * clampUnit(result.confidence);
  }

  const coverage = supportedWeight / totalWeight;
  const confidence =
    supportedWeight > 0 ? confidenceWeight / supportedWeight : 0;
  const evidenceDepth = Math.min(1, args.supportedSourceCount / 3);
  return clampUnit(coverage * 0.5 + confidence * 0.35 + evidenceDepth * 0.15);
}

function getRecencyRatio(newestEvidenceAgeDays?: number): number {
  if (newestEvidenceAgeDays === undefined) return 0;
  if (newestEvidenceAgeDays <= 7) return 1;
  if (newestEvidenceAgeDays <= 30) return 0.85;
  if (newestEvidenceAgeDays <= 90) return 0.6;
  if (newestEvidenceAgeDays <= 365) return 0.3;
  return 0.1;
}

export function reconcileQualificationCriterionResults(args: {
  spec: WorkspaceTargetingSpec;
  results: QualificationCriterionResult[];
}): QualificationCriterionResult[] {
  const incomingById = new Map(
    args.results.map((result) => [result.criterionId, result])
  );

  return args.spec.criteria.map((criterion) => {
    const result = incomingById.get(criterion.id);
    if (!result) {
      return {
        criterionId: criterion.id,
        verdict: "unknown" as const,
        confidence: 0,
        rationale: "The evaluation did not return a result for this criterion.",
        sourceIds: [],
      };
    }

    if (
      criterion.kind !== "exclusion" &&
      criterion.evidence === "activity" &&
      (result.verdict === "matched" || result.verdict === "partial") &&
      result.sourceIds.length === 0
    ) {
      return {
        ...result,
        verdict: "unknown" as const,
        confidence: 0,
        rationale: `${result.rationale} No verified activity source supports this criterion.`,
        sourceIds: [],
      };
    }

    return {
      ...result,
      confidence: clampUnit(result.confidence),
      sourceIds: Array.from(new Set(result.sourceIds)).slice(0, 10),
    };
  });
}

/**
 * Deterministic scoring over the workspace's own atomic criteria. The model
 * classifies evidence; it never assigns the final score or qualification flag.
 */
export function calculateTargetingQualificationScore(args: {
  spec: WorkspaceTargetingSpec;
  results: QualificationCriterionResult[];
  supportedSourceCount: number;
  newestEvidenceAgeDays?: number;
  isLikelyBot: boolean;
  threshold: number;
}): TargetingQualificationScore {
  const results = reconcileQualificationCriterionResults({
    spec: args.spec,
    results: args.results,
  });
  const resultsById = new Map(
    results.map((result) => [result.criterionId, result])
  );
  const positiveCriteria = args.spec.criteria.filter(
    (criterion) => criterion.kind !== "exclusion"
  );
  const requiredCriteria = positiveCriteria.filter(
    (criterion) => criterion.kind === "required"
  );
  const profileCriteria = positiveCriteria.filter(
    (criterion) => criterion.category === "profile_fit"
  );
  const intentCriteria = positiveCriteria.filter(
    (criterion) => criterion.category === "intent"
  );
  const timingCriteria = positiveCriteria.filter(
    (criterion) => criterion.category === "timing"
  );
  const profileFitRatio = getRequiredFoundationRatio({
    requiredCriteria,
    fallbackCriteria:
      profileCriteria.length > 0 ? profileCriteria : positiveCriteria,
    resultsById,
  });
  const rawIntentRatio = getWeightedRatio({
    criteria: intentCriteria,
    fallbackCriteria: positiveCriteria,
    resultsById,
  });
  const requiredIntentCriteria = intentCriteria.filter(
    (criterion) => criterion.kind === "required"
  );
  const intentRatio =
    requiredIntentCriteria.length > 0 &&
    requiredIntentCriteria.every(
      (criterion) => resultsById.get(criterion.id)?.verdict === "matched"
    )
      ? 0.75 + rawIntentRatio * 0.25
      : rawIntentRatio;
  const evidenceCriteria = positiveCriteria.filter(
    (criterion) => criterion.evidence !== "profile"
  );
  const recencyRatio =
    timingCriteria.length > 0
      ? Math.max(
          getWeightedRatio({
            criteria: timingCriteria,
            fallbackCriteria: positiveCriteria,
            resultsById,
          }),
          getRecencyRatio(args.newestEvidenceAgeDays) * 0.75
        )
      : getRecencyRatio(args.newestEvidenceAgeDays);
  const signalQualityRatio = getEvidenceQuality({
    criteria: evidenceCriteria,
    resultsById,
    supportedSourceCount: args.supportedSourceCount,
  });
  const breakdown = calculateQualificationScore({
    profileFit: QUALIFICATION_SCORE_MAXIMUMS.profileFit * profileFitRatio,
    signalQuality:
      QUALIFICATION_SCORE_MAXIMUMS.signalQuality * signalQualityRatio,
    intentStrength: QUALIFICATION_SCORE_MAXIMUMS.intentStrength * intentRatio,
    recency: QUALIFICATION_SCORE_MAXIMUMS.recency * recencyRatio,
  });

  const hardFailureCriterionIds = args.spec.criteria.flatMap((criterion) => {
    const result = resultsById.get(criterion.id);
    if (!result) return [criterion.id];
    if (criterion.kind === "required" && result.verdict !== "matched") {
      return [criterion.id];
    }
    if (
      criterion.kind === "exclusion" &&
      result.verdict === "matched" &&
      result.confidence >= 0.7
    ) {
      return [criterion.id];
    }
    return [];
  });
  if (args.isLikelyBot) hardFailureCriterionIds.push("authenticity");
  if (args.supportedSourceCount === 0) {
    hardFailureCriterionIds.push("verified_evidence");
  }

  return {
    breakdown,
    hardFailureCriterionIds,
    qualified:
      breakdown.total >= args.threshold && hardFailureCriterionIds.length === 0,
  };
}
