"use node";

// Core qualification logic - single source of truth
// Used by: workflows/qualification.ts, agents/tools/qualifyProspect.ts

import { z } from "zod";
import {
  getRoutingTelemetry,
  robustGenerateObject,
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
  type QualificationSource,
  type QualificationExternalArticle,
  type QualificationVerification,
} from "./qualificationEvidenceCore";
import { buildQualificationPrompt } from "../agents/prompts";
import {
  calculateQualificationScore,
  createEmptyQualificationScoreBreakdown,
  QUALIFICATION_SCORE_MAXIMUMS,
  type QualificationScoreBreakdown,
} from "./qualificationScoringCore";
import { formatQualificationModelFailure } from "./qualificationFailureCore";

const qualificationLogger = logger.withScope("QualificationCore");

export const QUALIFICATION_THRESHOLD = SHARED_QUALIFICATION_THRESHOLD;
export const MAX_EVIDENCE_POSTS = 20;
export const MAX_KEYWORDS_TO_SEARCH = 10;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const llmQualificationSchema = z.object({
  scoreBreakdown: z.object({
    profileFit: z.number().min(0).max(QUALIFICATION_SCORE_MAXIMUMS.profileFit),
    signalQuality: z
      .number()
      .min(0)
      .max(QUALIFICATION_SCORE_MAXIMUMS.signalQuality),
    intentStrength: z
      .number()
      .min(0)
      .max(QUALIFICATION_SCORE_MAXIMUMS.intentStrength),
    recency: z.number().min(0).max(QUALIFICATION_SCORE_MAXIMUMS.recency),
  }),
  qualified: z.boolean(),
  reasoning: z.string(),
  isLikelyBot: z.boolean(),
  botFlags: z.array(z.string()),
  evidenceDecisions: z.array(
    z.object({
      candidateId: z.string(),
      supportsQualification: z.boolean(),
      supportingQuote: z.string(),
    })
  ),
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
  readonly attemptCount = 2;
  readonly originalMessage: string;

  constructor(args: { message: string; provider: string; model: string }) {
    super(
      formatQualificationModelFailure({
        provider: args.provider,
        model: args.model,
        attemptCount: 2,
        message: args.message,
      })
    );
    this.name = "QualificationEvaluationError";
    this.originalMessage = args.message;
    this.provider = args.provider;
    this.model = args.model;
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
    const scoreBreakdown = calculateQualificationScore(object.scoreBreakdown);
    const finalQualified = passesQualificationGate({
      modelQualified: object.qualified,
      isLikelyBot: object.isLikelyBot,
      score: scoreBreakdown.total,
      threshold: QUALIFICATION_THRESHOLD,
      verifiedSourceCount: qualificationSources.length,
    });

    return {
      qualified: finalQualified,
      score: scoreBreakdown.total,
      scoreBreakdown,
      status: finalQualified ? "qualified" : "disqualified",
      matchedKeywords: getVerifiedDiscoveryQueries(qualificationSources),
      evidenceCount: qualificationSources.length,
      qualificationSources,
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
      reasoning: object.reasoning,
      qualifiedAt: finalQualified ? now : undefined,
    };
  } catch (error) {
    const routingTelemetry = getRoutingTelemetry(routing);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown model evaluation error";
    qualificationLogger.error("LLM qualification failed", {
      error: errorMessage,
      model: routingTelemetry.model,
      provider: routingTelemetry.providerLabel,
    });
    throw new QualificationEvaluationError({
      message: errorMessage,
      model: routingTelemetry.model,
      provider: routingTelemetry.providerLabel,
    });
  }
}
