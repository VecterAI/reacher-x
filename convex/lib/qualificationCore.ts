"use node";

// convex/lib/qualificationCore.ts
// Core qualification logic - single source of truth
// Used by: workflows/qualification.ts, agents/tools/qualifyProspect.ts
//
// v2: LLM-based qualification replaces hardcoded scoring.
// The LLM evaluates ICP fit, engagement, authenticity holistically.

import { z } from "zod";
import { robustGenerateObject } from "./ai";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";

// ============================================================================
// Constants
// ============================================================================

export const QUALIFICATION_THRESHOLD = 70; // Updated: LLM uses 70+ for qualified
export const MAX_EVIDENCE_POSTS = 20;
export const MAX_KEYWORDS_TO_SEARCH = 10;

// ============================================================================
// Schemas
// ============================================================================

/**
 * Schema for LLM qualification response.
 * The LLM evaluates everything in one call: ICP fit, engagement, authenticity.
 */
const llmQualificationSchema = z.object({
  score: z
    .number()
    .min(0)
    .max(100)
    .describe("Overall qualification score 0-100"),
  qualified: z
    .boolean()
    .describe("True if prospect is a strong ICP fit worth pursuing"),
  reasoning: z
    .string()
    .describe("Brief 1-2 sentence explanation of the qualification decision"),
  isLikelyBot: z
    .boolean()
    .describe("True if account shows bot/fake indicators"),
  botFlags: z
    .array(z.string())
    .describe(
      "Specific bot indicators: 'new_account', 'no_bio', 'spam_patterns', 'engagement_farming', etc."
    ),
});

// ============================================================================
// Types
// ============================================================================

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
  status: "qualified" | "disqualified";
  matchedKeywords: string[];
  evidenceCount: number;
  authenticity: AuthenticityResult;
  qualifiedAt?: number;
}

// Import prompt from central location (per AGENT_CONTEXT.txt standards)
import { QUALIFICATION_PROMPT } from "../agents/prompts";

// ============================================================================
// Main Qualification Function
// ============================================================================

/**
 * Calculate complete qualification result for a prospect using LLM.
 * This is the single source of truth for qualification logic.
 *
 * The LLM evaluates ICP fit, engagement, recency, and authenticity
 * in a single holistic call, replacing the previous hardcoded scoring.
 */
export async function qualifyProspectCore(params: {
  evidencePosts: Array<Record<string, unknown>>;
  matchedKeywords: string[];
  totalKeywords: number;
  profileData: Record<string, unknown>;
  icpDescription?: string;
  icpPainPoints?: string[];
}): Promise<QualificationResult> {
  const {
    evidencePosts,
    matchedKeywords,
    profileData,
    icpDescription,
    icpPainPoints,
  } = params;

  // Build posts context with engagement metrics
  const postsContext = evidencePosts
    .slice(0, MAX_EVIDENCE_POSTS)
    .map((p) => {
      const text = ((p.full_text || p.text || "") as string).trim();
      const likes = (p.favorite_count || 0) as number;
      const rts = (p.retweet_count || 0) as number;
      const createdAt = (p.tweet_created_at || p.created_at || "") as string;
      if (!text) return null;
      return `"${text}" (${likes} likes, ${rts} RTs${createdAt ? `, ${createdAt}` : ""})`;
    })
    .filter(Boolean)
    .join("\n\n");

  // Build prompt with all context
  const prompt = `## ICP (Ideal Customer Profile)
${icpDescription || "No description provided - use general B2B prospect criteria"}

## Target Pain Points
${(icpPainPoints || matchedKeywords).join(", ") || "None specified"}

## Matched Keywords in Their Content
${matchedKeywords.join(", ") || "None"}

## Prospect Profile Data
\`\`\`json
${JSON.stringify(profileData, null, 2)}
\`\`\`

## Their Posts (Evidence of Pain Points)
${postsContext || "⚠️ NO POSTS AVAILABLE - Be conservative in scoring without evidence"}

Evaluate this prospect against the ICP.`;

  try {
    const { object } = await robustGenerateObject({
      operation: "qualifyProspect",
      schema: llmQualificationSchema,
      system: QUALIFICATION_PROMPT,
      prompt,
    });

    console.info("[qualifyProspectCore] LLM qualification result:", {
      score: object.score,
      qualified: object.qualified,
      reasoning: object.reasoning,
      isBot: object.isLikelyBot,
      botFlags: object.botFlags,
      evidencePostsCount: evidencePosts.length,
    });

    // Final qualification: LLM qualified AND not a bot
    const finalQualified = object.qualified && !object.isLikelyBot;

    // Extract profile metadata for authenticity result
    const authenticity: AuthenticityResult = {
      isLikelyBot: object.isLikelyBot,
      flags: object.botFlags,
    };

    // Add profile metrics if available
    if (profileData.followers_count) {
      authenticity.followersCount = profileData.followers_count as number;
    }
    if (profileData.friends_count) {
      authenticity.followingCount = profileData.friends_count as number;
    }
    if (profileData.created_at) {
      const createdAt = new Date(profileData.created_at as string).getTime();
      authenticity.accountAge = Math.floor(
        (getCurrentUTCTimestamp() - createdAt) / (1000 * 60 * 60 * 24)
      );
    }

    return {
      qualified: finalQualified,
      score: object.score,
      status: finalQualified ? "qualified" : "disqualified",
      matchedKeywords,
      evidenceCount: evidencePosts.length,
      authenticity,
      qualifiedAt: finalQualified ? getCurrentUTCTimestamp() : undefined,
    };
  } catch (error) {
    console.error(
      "[qualifyProspectCore] LLM qualification failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    // Fallback: conservative disqualification on LLM failure
    return {
      qualified: false,
      score: 0,
      status: "disqualified",
      matchedKeywords,
      evidenceCount: evidencePosts.length,
      authenticity: {
        isLikelyBot: false,
        flags: ["llm_qualification_failed"],
      },
    };
  }
}
