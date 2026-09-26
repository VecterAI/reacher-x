// Pure decision logic for the Jev qualification pre-filter (shadow mode).
// The filter may only act on hard-fail signals measured to be safe on stored
// verdicts; soft judgment stays with the qualification model.

import type { JevAnswer } from "./jevClient";
import type { WorkspaceTargetingSpec } from "./targetingSpecCore";

export const JEV_PREFILTER_HARD_FAIL_CONFIDENCE = 0.9;
export const JEV_PREFILTER_BOT_CONFIDENCE = 0.9;

export type JevPrefilterSignalReason = {
  kind: "exclusion_match" | "required_miss" | "likely_bot";
  criterionId?: string;
  probability: number;
};

export type JevPrefilterDecision = {
  decision: "would_kill" | "would_pass";
  reasons: JevPrefilterSignalReason[];
  /** Compact machine-readable codes for storage: e.g. "exclusion:comp_fit@0.95". */
  reasonCodes: string[];
  botProbability: number;
};

function getChoiceProbability(answer: JevAnswer): number | undefined {
  if (answer.type !== "choice") return undefined;
  if (typeof answer.confidence === "number") return answer.confidence;
  return answer.probabilities?.[answer.choice];
}

export function evaluateJevHardFailSignals(args: {
  targetingSpec: WorkspaceTargetingSpec;
  answers: Record<string, JevAnswer>;
}): JevPrefilterDecision {
  const reasons: JevPrefilterSignalReason[] = [];

  const botAnswer = args.answers.likely_bot;
  const botProbability =
    botAnswer && botAnswer.type === "noul"
      ? Math.min(1, Math.max(0, botAnswer.noul))
      : 0;
  if (botProbability >= JEV_PREFILTER_BOT_CONFIDENCE) {
    reasons.push({ kind: "likely_bot", probability: botProbability });
  }

  for (const criterion of args.targetingSpec.criteria) {
    const answer = args.answers[`criterion_${criterion.id}`];
    if (!answer || answer.type !== "choice") continue;
    const probability = getChoiceProbability(answer);
    if (
      probability === undefined ||
      probability < JEV_PREFILTER_HARD_FAIL_CONFIDENCE
    ) {
      continue;
    }
    if (criterion.kind === "exclusion" && answer.choice === "matched") {
      reasons.push({
        kind: "exclusion_match",
        criterionId: criterion.id,
        probability,
      });
    }
    if (criterion.kind === "required" && answer.choice === "not_matched") {
      reasons.push({
        kind: "required_miss",
        criterionId: criterion.id,
        probability,
      });
    }
  }

  return {
    decision: reasons.length > 0 ? "would_kill" : "would_pass",
    reasons,
    reasonCodes: reasons.map((reason) =>
      reason.criterionId
        ? `${reason.kind === "exclusion_match" ? "exclusion" : "required"}:${reason.criterionId}@${reason.probability.toFixed(2)}`
        : `bot@${reason.probability.toFixed(2)}`
    ),
    botProbability,
  };
}
