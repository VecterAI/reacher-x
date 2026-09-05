"use node";

// Core qualification logic - single source of truth
// Used by: workflows/qualification.ts, agents/tools/qualifyProspect.ts

import { z } from "zod";
import {
  getRoutingTelemetry,
  robustGenerateObject,
  StructuredGenerationError,
  type ModelRouting,
} from "./ai";
import { runWithWorkspaceMemoryCompliance } from "./workspaceMemoryCompliance";
import { logger } from "../../shared/lib/logger";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import type { WorkspaceUseCaseKey } from "../../shared/lib/workspaceUseCases";
import { QUALIFICATION_THRESHOLD as SHARED_QUALIFICATION_THRESHOLD } from "../../shared/lib/qualificationConstants";
import {
  getWorkflowEvidencePostLikeCount,
  getWorkflowEvidencePostRepostCount,
} from "./workflowSafeProspect";
import {
  buildQualificationVerification,
  buildVerifiedQualificationSources,
  prepareQualificationCandidates,
  passesQualificationGate,
  hasVerifiedGoalConflict,
  compactQualificationSourcesForWorkflow,
  type QualificationSource,
  type QualificationExternalArticle,
  type QualificationVerification,
} from "./qualificationEvidenceCore";
import { buildQualificationPrompt } from "../agents/prompts";
import {
  calculateTargetingQualificationScore,
  createEmptyQualificationScoreBreakdown,
  reconcileQualificationCriterionResults,
  type QualificationCriterionResult,
  type QualificationScoreBreakdown,
} from "./qualificationScoringCore";
import { formatQualificationModelFailure } from "./qualificationFailureCore";
import type { WorkspaceTargetingSpec } from "./targetingSpecCore";

export const QUALIFICATION_THRESHOLD = SHARED_QUALIFICATION_THRESHOLD;
export const MAX_EVIDENCE_POSTS = 20;
export const MAX_KEYWORDS_TO_SEARCH = 10;

const qualificationLogger = logger.withScope("QualificationCore");

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const llmQualificationSchema = z.object({
  goalAssessment: z.object({
    objective: z
      .string()
      .max(500)
      .describe(
        "The user's actual reason for contacting these people, taken from their description."
      ),
    rationale: z
      .string()
      .max(1000)
      .describe(
        "Consider explicit counterevidence anywhere in the complete source, including stylized Unicode and non-English text. Do not confuse missing preferences with refusal of the user's objective."
      ),
    verdict: z.enum(["compatible", "unknown", "contradicted"]),
    candidateId: z
      .string()
      .max(120)
      .describe(
        "Exact candidate ID containing a direct contradiction of the user's objective, otherwise empty."
      ),
    conflictingQuote: z
      .string()
      .max(1000)
      .describe(
        "Exact verbatim quote that contradicts the user's objective, otherwise empty. Preserve original Unicode."
      ),
  }),
  criterionResults: z
    .array(
      z.object({
        criterionId: z.string().max(48),
        verdict: z.enum(["matched", "partial", "not_matched", "unknown"]),
        confidence: z.number().min(0).max(1),
        rationale: z.string().max(1_000),
        candidateIds: z.array(z.string().max(120)).max(MAX_EVIDENCE_POSTS),
      })
    )
    .max(12),
  reasoning: z.string().max(2_000),
  isLikelyBot: z.boolean(),
  botFlags: z.array(z.string().max(240)).max(20),
  evidenceDecisions: z
    .array(
      z.object({
        candidateId: z.string().max(120),
        supportsQualification: z.boolean(),
        supportingQuote: z.string().max(1_000),
      })
    )
    .max(MAX_EVIDENCE_POSTS),
});

export interface AuthenticityResult {
  isLikelyBot: boolean;
  flags: string[];
  accountAge?: number;
  followersCount?: number;
  followingCount?: number;
  engagementRate?: number;
}

export interface QualificationResult {
  qualified: boolean;
  score: number;
  scoreBreakdown: QualificationScoreBreakdown;
  criterionResults: QualificationCriterionResult[];
  status: "qualified" | "disqualified";
  /** Discovery queries attached only to sources that became verified proof. */
  matchedKeywords: string[];
  evidenceCount: number;
  qualificationSources: QualificationSource[];
  qualificationVerification: QualificationVerification;
  authenticity: AuthenticityResult;
  reasoning: string;
  qualifiedAt?: number;
}

export class QualificationEvaluationError extends Error {
  readonly code = "qualification_model_evaluation_failed";
  readonly stage = "model_evaluation" as const;
  readonly provider: string;
  readonly model: string;
  readonly attemptCount: number;
  readonly originalMessage: string;

  constructor(args: {
    message: string;
    provider: string;
    model: string;
    attemptCount: number;
  }) {
    super(
      formatQualificationModelFailure({
        provider: args.provider,
        model: args.model,
        attemptCount: args.attemptCount,
        message: args.message,
      })
    );
    this.name = "QualificationEvaluationError";
    this.originalMessage = args.message;
    this.provider = args.provider;
    this.model = args.model;
    this.attemptCount = args.attemptCount;
  }
}

function formatUtcDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function buildEvidenceRecencySummary(args: {
  createdDates: Array<string | undefined>;
  now: number;
}): string {
  const recencyDays = args.createdDates
    .map((createdAt) => {
      if (!createdAt) return null;
      const timestamp = Date.parse(createdAt);
      if (!Number.isFinite(timestamp)) return null;
      return Math.max(0, Math.floor((args.now - timestamp) / MS_PER_DAY));
    })
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);

  if (recencyDays.length === 0) {
    return "No valid candidate-source dates available.";
  }

  return [
    `Most recent candidate source: ${recencyDays[0]} day(s) ago`,
    `Oldest candidate source: ${recencyDays[recencyDays.length - 1]} day(s) ago`,
    `Candidate sources with valid dates: ${recencyDays.length}`,
  ].join("\n");
}

function getVerifiedDiscoveryQueries(sources: QualificationSource[]): string[] {
  return [
    ...new Set(
      sources.flatMap((source) =>
        source.discoveryQueries.map((query) => query.trim())
      )
    ),
  ].filter(Boolean);
}

function getNewestEvidenceAgeDays(args: {
  sources: QualificationSource[];
  now: number;
}): number | undefined {
  const ages = args.sources.flatMap((source) => {
    if (!source.publishedAt) return [];
    const timestamp = Date.parse(source.publishedAt);
    if (!Number.isFinite(timestamp)) return [];
    return [Math.max(0, Math.floor((args.now - timestamp) / MS_PER_DAY))];
  });
  return ages.length > 0 ? Math.min(...ages) : undefined;
}

function buildAuthenticityResult(args: {
  profileData: Record<string, unknown>;
  isLikelyBot: boolean;
  flags: string[];
  now: number;
}): AuthenticityResult {
  const result: AuthenticityResult = {
    isLikelyBot: args.isLikelyBot,
    flags: args.flags,
  };

  if (typeof args.profileData.followers_count === "number") {
    result.followersCount = args.profileData.followers_count;
  }
  if (typeof args.profileData.friends_count === "number") {
    result.followingCount = args.profileData.friends_count;
  }
  if (typeof args.profileData.created_at === "string") {
    const createdAt = Date.parse(args.profileData.created_at);
    if (Number.isFinite(createdAt)) {
      result.accountAge = Math.floor((args.now - createdAt) / MS_PER_DAY);
    }
  }

  return result;
}

export interface QualificationCoreParams {
  platform: "twitter" | "linkedin";
  evidencePosts: Array<Record<string, unknown>>;
  externalArticles?: QualificationExternalArticle[];
  discoveryQueries: string[];
  totalKeywords: number;
  profileData: Record<string, unknown>;
  targetingSpec: WorkspaceTargetingSpec;
  icpDescription?: string;
  icpPainPoints?: string[];
  useCaseKey?: WorkspaceUseCaseKey;
  relevantMemories?: string[];
  workspaceMemoryPolicy?: string;
  complianceInstructions?: string[];
  similarQualifiedCases?: string[];
  similarDisqualifiedCases?: string[];
  routing?: ModelRouting;
}

export async function qualifyProspectCore(
  params: QualificationCoreParams
): Promise<QualificationResult> {
  const {
    platform,
    evidencePosts,
    externalArticles,
    discoveryQueries,
    profileData,
    targetingSpec,
    icpDescription,
    icpPainPoints,
    useCaseKey,
    relevantMemories,
    workspaceMemoryPolicy,
    complianceInstructions,
    similarQualifiedCases,
    similarDisqualifiedCases,
    routing = "reasoning",
  } = params;
  const now = getCurrentUTCTimestamp();
  const candidates = prepareQualificationCandidates({
    platform,
    evidencePosts: evidencePosts.slice(0, MAX_EVIDENCE_POSTS),
    profileData,
    discoveryQueries,
    externalArticles,
  });

  if (candidates.length === 0) {
    return {
      qualified: false,
      score: 0,
      scoreBreakdown: createEmptyQualificationScoreBreakdown(),
      criterionResults: reconcileQualificationCriterionResults({
        spec: targetingSpec,
        results: [],
      }),
      status: "disqualified",
      matchedKeywords: [],
      evidenceCount: 0,
      qualificationSources: [],
      qualificationVerification: buildQualificationVerification({
        status: "validated",
        candidates,
        sources: [],
        discoveryQueries,
        validatedAt: now,
      }),
      authenticity: { isLikelyBot: false, flags: [] },
      reasoning:
        "No persisted, prospect-authored source with text, a stable ID, and a URL was available.",
    };
  }

  const sourcesContext = candidates
    .map((candidate) => {
      const likes = getWorkflowEvidencePostLikeCount(candidate.sourcePost);
      const reposts = getWorkflowEvidencePostRepostCount(candidate.sourcePost);
      return [
        `Candidate ID: ${candidate.candidateId}`,
        `Source post ID: ${candidate.sourceId}`,
        `Source type: ${candidate.contentType}`,
        `Source URL: ${candidate.sourceUrl}`,
        `Evidence kind: ${candidate.evidenceKind}`,
        candidate.evidenceUrl
          ? `Linked article URL: ${candidate.evidenceUrl}`
          : null,
        `Published: ${candidate.publishedAt ?? "unknown"}`,
        `Engagement: ${likes} likes/reactions, ${reposts} reposts`,
        `Persisted text: ${JSON.stringify(candidate.text)}`,
      ]
        .filter((line): line is string => typeof line === "string")
        .join("\n");
    })
    .join("\n\n");

  const prompt = `## ICP (Ideal Customer Profile)
${icpDescription || "No description provided - use general B2B prospect criteria"}

## Authoritative Workspace Targeting Specification
\`\`\`json
${JSON.stringify(targetingSpec, null, 2)}
\`\`\`

## Target Pain Points
${(icpPainPoints || []).join(", ") || "None specified"}

## Discovery Queries (routing metadata only; never proof)
${discoveryQueries.join(", ") || "None"}

## Prospect Profile Data
\`\`\`json
${JSON.stringify(profileData, null, 2)}
\`\`\`

## Persisted Prospect-Authored Candidate Sources
${sourcesContext}

For every candidate source, return one evidenceDecisions entry using its exact Candidate ID.
Set supportsQualification=true only when that source's own persisted text supports ICP fit.
When true, supportingQuote must be an exact verbatim substring of Persisted text.
When false, supportingQuote must be an empty string.

First complete goalAssessment: separate factual audience matches from usefulness for the user's intended contact. Explicit refusal of the offered service can contradict that goal even if the author matches every audience attribute. Evaluate the whole text, including stylized Unicode and non-English text. Record the exact conflicting quote and candidate ID. Missing proof that someone wants the service is merely unknown, NOT a contradiction. Missing preferred geography or format is NOT a goal contradiction. Do not invent universal exclusions for professions, employers, or satisfied product users.

Return exactly one criterionResults entry for every targeting criterion ID.
- matched means the available profile or prospect-authored evidence directly satisfies the criterion.
- partial means there is genuine but incomplete support.
- For a required role, authority, affiliation, or relationship, evidence of participation alone is partial unless it establishes the specific requested relationship. First-person company language is evidence of involvement, not by itself proof of an unmentioned title or final decision authority. A preferred relationship can remain partial and still be useful. Apply this distinction consistently without assuming a title from an announcement.
- not_matched means the available evidence directly contradicts or fails the criterion.
- unknown means the available data cannot determine it.
- For an exclusion criterion, matched means the prospect exhibits the excluded trait and must be rejected. not_matched means the prospect does not exhibit that trait. Never mark an exclusion matched merely because the prospect correctly passes the exclusion.
- candidateIds must contain only exact Candidate IDs above that support the criterion. Profile-only criteria may have an empty candidateIds array.
- Interpret every criterion from the workspace specification and original description. Do not apply a fixed use-case rubric or keyword list.
- When a criterion requires a relationship or behavior, require evidence of that specific relationship or behavior; a generic entity mention alone is not proof.
- Read the ENTIRE source before deciding. Resolve negation, hypothetical/future plans, quoted third parties, and explicit counterevidence in any language. A request to join a future talent pool is not an active opening; a question addressed to product users is not the author's own usage. Explain conflicting evidence rather than selecting a convenient fragment.
- Judge whether the author has the relationship requested by this workspace, not merely whether the topic occurs. An intermediary discussing someone else's need is not automatically the company-side decision-maker, but intermediaries are valid when the user's goal includes them.
- supportsQualification must reflect usefulness for the stated goal, not just a topic match. An explicit refusal of the very service the user wants to offer is counterevidence of that fit. This is contextual, never a universal ban on any profession or account type.
- Prior lessons and generated ICPs are context, not authority to invent mandatory criteria. Keep criterion verdicts factual and identical for the same evidence even when the criterion changes from preferred to required; importance changes scoring, not facts.
- Do not convert preferences into requirements and do not ignore explicit exclusions.

## Current Date Context
Today (UTC): ${formatUtcDate(now)}

## Candidate Evidence Recency
${buildEvidenceRecencySummary({
  createdDates: candidates.map((candidate) => candidate.publishedAt),
  now,
})}

## Prior Reusable Lessons
${relevantMemories?.join("\n") || "None"}

## Similar Qualified Cases
${similarQualifiedCases?.join("\n") || "None"}

## Similar Disqualified Cases
${similarDisqualifiedCases?.join("\n") || "None"}

Evaluate this prospect against the ICP.`;

  try {
    const generateQualificationCandidate = async (repairInstruction?: string) =>
      await robustGenerateObject({
        operation: "qualifyProspect",
        schema: llmQualificationSchema,
        system: [buildQualificationPrompt(useCaseKey), workspaceMemoryPolicy]
          .filter(Boolean)
          .join("\n\n"),
        prompt: repairInstruction
          ? `${prompt}\n\nThe previous candidate violated workspace policy. Regenerate the complete object with this repair: ${repairInstruction}`
          : prompt,
        routing,
        // The onboarding route uses the established JSON + schema validation
        // path: its configured endpoints do not accept native structured output.
        nativeStructuredOutput: routing !== "onboarding",
      });
    const generation = await runWithWorkspaceMemoryCompliance<
      Awaited<ReturnType<typeof generateQualificationCandidate>>
    >({
      instructions: complianceInstructions ?? [],
      taskContext: prompt,
      maxAttempts: 2,
      serialize: (result) => JSON.stringify(result.object),
      generate: generateQualificationCandidate,
    });
    const { object } = generation.value;
    const qualificationSources = buildVerifiedQualificationSources({
      candidates,
      decisions: object.evidenceDecisions,
      verifiedAt: now,
    });
    const verifiedSourceIds = new Set(
      qualificationSources.map((source) => source.sourceId)
    );
    const candidateSourceIdById = new Map(
      candidates.map((candidate) => [candidate.candidateId, candidate.sourceId])
    );
    const criterionResults = reconcileQualificationCriterionResults({
      spec: targetingSpec,
      results: object.criterionResults.map((result) => ({
        criterionId: result.criterionId,
        verdict: result.verdict,
        confidence: result.confidence,
        rationale: result.rationale,
        sourceIds: Array.from(
          new Set(
            result.candidateIds
              .map((candidateId) => candidateSourceIdById.get(candidateId))
              .filter(
                (sourceId): sourceId is string =>
                  sourceId !== undefined && verifiedSourceIds.has(sourceId)
              )
          )
        ),
      })),
    });
    const targetingScore = calculateTargetingQualificationScore({
      spec: targetingSpec,
      results: criterionResults,
      supportedSourceCount: qualificationSources.length,
      newestEvidenceAgeDays: getNewestEvidenceAgeDays({
        sources: qualificationSources,
        now,
      }),
      isLikelyBot: object.isLikelyBot,
      threshold: QUALIFICATION_THRESHOLD,
    });
    const scoreBreakdown = targetingScore.breakdown;
    const goalConflict = hasVerifiedGoalConflict(
      candidates,
      object.goalAssessment
    );
    const finalQualified = passesQualificationGate({
      modelQualified: targetingScore.qualified && !goalConflict,
      isLikelyBot: object.isLikelyBot,
      score: scoreBreakdown.total,
      threshold: QUALIFICATION_THRESHOLD,
      verifiedSourceCount: qualificationSources.length,
    });

    // A first-pass source-reference mistake must not hide a potential essential
    // activity match from verification. This is only a routing signal: the strong
    // evaluation must still independently produce valid evidence and pass gates.
    const claimsRequiredActivityMatch = targetingSpec.criteria.some(
      (criterion) =>
        criterion.kind === "required" &&
        criterion.category !== "profile_fit" &&
        criterion.evidence !== "profile" &&
        object.criterionResults.some(
          (result) =>
            result.criterionId === criterion.id &&
            (result.verdict === "matched" || result.verdict === "partial")
        )
    );
    // Review evidence-backed candidates, including first-pass false negatives.
    // Use the same full evidence and rubric without anchoring on the first verdict.
    // Preview qualification already uses this route, so it needs no extra pass.
    if (
      routing !== "onboarding" &&
      (qualificationSources.length > 0 ||
        (candidates.length > 0 && claimsRequiredActivityMatch))
    ) {
      return await qualifyProspectCore({ ...params, routing: "onboarding" });
    }

    return {
      qualified: finalQualified,
      score: scoreBreakdown.total,
      scoreBreakdown,
      criterionResults,
      status: finalQualified ? "qualified" : "disqualified",
      matchedKeywords: getVerifiedDiscoveryQueries(qualificationSources),
      evidenceCount: qualificationSources.length,
      qualificationSources:
        compactQualificationSourcesForWorkflow(qualificationSources),
      qualificationVerification: buildQualificationVerification({
        status: "validated",
        candidates,
        sources: qualificationSources,
        discoveryQueries,
        validatedAt: now,
      }),
      authenticity: buildAuthenticityResult({
        profileData,
        isLikelyBot: object.isLikelyBot,
        flags: object.botFlags,
        now,
      }),
      reasoning: goalConflict
        ? `${object.reasoning} Evidence contradicts the user's contact goal: ${object.goalAssessment.rationale} Quote: ${object.goalAssessment.conflictingQuote}`
        : targetingScore.hardFailureCriterionIds.length > 0
          ? `${object.reasoning} Hard qualification gates not satisfied: ${targetingScore.hardFailureCriterionIds.join(", ")}.`
          : object.reasoning,
      qualifiedAt: finalQualified ? now : undefined,
    };
  } catch (error) {
    // Preserve the verifier's actual model/provider and retry classification.
    if (error instanceof QualificationEvaluationError) throw error;
    // Rebuild route-specific request options instead of forwarding native
    // structured-output parameters to an endpoint that cannot accept them.
    // The strong route never falls back to the first-pass model.
    if (routing !== "onboarding") {
      return await qualifyProspectCore({ ...params, routing: "onboarding" });
    }
    const structuredFailure =
      error instanceof StructuredGenerationError ? error : undefined;
    const routingTelemetry = getRoutingTelemetry(routing);
    const attemptedProviders = structuredFailure?.attempts.map(
      (attempt) => attempt.providerSelected ?? attempt.configuredProvider
    );
    const attemptedModels = structuredFailure?.attempts.map(
      (attempt) => attempt.modelSelected ?? attempt.model
    );
    const provider = attemptedProviders?.length
      ? [...new Set(attemptedProviders)].join(" -> ")
      : routingTelemetry.providerLabel;
    const model = attemptedModels?.length
      ? [...new Set(attemptedModels)].join(" -> ")
      : routingTelemetry.model;
    const attemptCount = structuredFailure?.attempts.length ?? 2;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown model evaluation error";
    qualificationLogger.error("LLM qualification failed", {
      error: errorMessage,
      model,
      provider,
      attemptCount,
      attempts: structuredFailure?.attempts,
    });
    throw new QualificationEvaluationError({
      message: errorMessage,
      model,
      provider,
      attemptCount,
    });
  }
}
