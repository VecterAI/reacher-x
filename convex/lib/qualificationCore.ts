"use node";

// convex/lib/qualificationCore.ts
// Core qualification logic - single source of truth
// Used by: workflows/qualification.ts, agents/tools/qualifyProspect.ts

import { z } from "zod";
import { robustGenerateObject } from "./ai";

// ============================================================================
// Constants
// ============================================================================

export const QUALIFICATION_THRESHOLD = 80;
export const MAX_EVIDENCE_POSTS = 20;
export const MAX_KEYWORDS_TO_SEARCH = 10;

export const SCORE_WEIGHTS = {
  painPointEvidence: 40,
  recency: 20,
  engagement: 20,
  authenticity: 20,
} as const;

// ============================================================================
// Schemas
// ============================================================================

const authenticitySchema = z.object({
  isLikelyBot: z.boolean().describe("Whether this account shows bot-like behavior"),
  flags: z.array(z.string()).describe("Suspicious signals detected"),
  confidence: z.number().min(0).max(1).describe("Confidence in the assessment"),
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

export interface QualificationScores {
  painPointScore: number;
  recencyScore: number;
  engagementScore: number;
  authenticityScore: number;
  totalScore: number;
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

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Calculate recency score based on post dates.
 * Posts within last 30 days get full points.
 */
export function calculateRecencyScore(
  posts: Array<{ timestamp?: number; created_at?: string; postedAt?: { timestamp?: number }; tweet_created_at?: string }>
): number {
  if (posts.length === 0) return 0;

  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  let recentCount = 0;
  for (const post of posts) {
    let postTime: number | undefined;
    
    if (post.timestamp) {
      postTime = post.timestamp;
    } else if (post.postedAt?.timestamp) {
      postTime = post.postedAt.timestamp;
    } else if (post.tweet_created_at) {
      postTime = new Date(post.tweet_created_at).getTime();
    } else if (post.created_at) {
      postTime = new Date(post.created_at).getTime();
    }

    if (postTime && now - postTime <= thirtyDaysMs) {
      recentCount++;
    }
  }

  return Math.min((recentCount / posts.length) * SCORE_WEIGHTS.recency, SCORE_WEIGHTS.recency);
}

/**
 * Calculate engagement score based on likes, comments, etc.
 */
export function calculateEngagementScore(posts: Array<Record<string, unknown>>): number {
  if (posts.length === 0) return 0;

  let totalEngagement = 0;
  let postsWithEngagement = 0;

  for (const post of posts) {
    // Twitter format
    const twitterLikes = (post.favorite_count as number) || 0;
    const twitterRts = (post.retweet_count as number) || 0;
    const twitterReplies = (post.reply_count as number) || 0;

    // LinkedIn format
    const linkedInReactions = (post.engagements as Record<string, number>)?.totalReactions || 0;
    const linkedInComments = (post.engagements as Record<string, number>)?.commentsCount || 0;

    const engagement = twitterLikes + twitterRts + twitterReplies + linkedInReactions + linkedInComments;

    if (engagement > 0) {
      totalEngagement += engagement;
      postsWithEngagement++;
    }
  }

  if (postsWithEngagement === 0) return 5; // Base score for having posts

  const avgEngagement = totalEngagement / postsWithEngagement;

  if (avgEngagement >= 10) return SCORE_WEIGHTS.engagement;
  if (avgEngagement >= 5) return SCORE_WEIGHTS.engagement * 0.5;
  return SCORE_WEIGHTS.engagement * 0.25;
}

/**
 * Calculate pain point evidence score based on matched keywords.
 */
export function calculatePainPointScore(matchedKeywords: string[], totalKeywords: number): number {
  if (totalKeywords === 0) return 0;

  const matchRate = matchedKeywords.length / totalKeywords;
  return Math.min(matchRate * SCORE_WEIGHTS.painPointEvidence * 2, SCORE_WEIGHTS.painPointEvidence);
}

// ============================================================================
// AI Bot Detection
// ============================================================================

const BOT_DETECTION_PROMPT = `You are an expert at detecting fake accounts and bots on social media.
Analyze the profile data and determine if this account shows signs of being a bot or fake account.

Red flags to look for:
- Very new account with high follower counts
- Extremely high following/follower ratio
- Generic or missing bio
- Default or AI-generated profile picture
- Unusual posting patterns
- Low engagement on posts
- Engagement farming behavior (like begging, follow-for-follow)

Be conservative - only flag as bot if strongly suspicious.`;

/**
 * Analyze profile authenticity using AI.
 * Returns bot detection result with flags.
 */
export async function analyzeAuthenticity(
  profileData: Record<string, unknown>
): Promise<{ score: number; result: AuthenticityResult }> {
  const defaultResult: AuthenticityResult = {
    isLikelyBot: false,
    flags: [],
  };

  try {
    const profileStr = JSON.stringify(profileData);

    const { object } = await robustGenerateObject({
      operation: "analyzeAuthenticity",
      schema: authenticitySchema,
      system: BOT_DETECTION_PROMPT,
      prompt: `Analyze this profile for authenticity:\n${profileStr}`,
      temperature: 0.3,
      maxRetries: 1,
    });

    let score: number = SCORE_WEIGHTS.authenticity;

    if (object.isLikelyBot) {
      score = 0;
      defaultResult.isLikelyBot = true;
      defaultResult.flags = object.flags;
    } else if (object.flags.length > 0) {
      // Cap at 10 flags to prevent negative scores
      const cappedFlags = Math.min(object.flags.length, 10);
      score = SCORE_WEIGHTS.authenticity * (1 - cappedFlags * 0.1);
      defaultResult.flags = object.flags;
    }

    // Extract numeric data if available
    if (profileData.followers_count) {
      defaultResult.followersCount = profileData.followers_count as number;
    }
    if (profileData.friends_count || profileData.followersCount) {
      defaultResult.followingCount = (profileData.friends_count || profileData.followersCount) as number;
    }
    if (profileData.created_at) {
      const createdAt = new Date(profileData.created_at as string).getTime();
      defaultResult.accountAge = Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));
    }

    return { score, result: defaultResult };
  } catch (error) {
    console.warn("[analyzeAuthenticity] AI analysis failed, using default score:", 
      error instanceof Error ? error.message : "Unknown error"
    );

    return { score: SCORE_WEIGHTS.authenticity, result: defaultResult };
  }
}

// ============================================================================
// Main Qualification Function
// ============================================================================

/**
 * Calculate complete qualification result for a prospect.
 * This is the single source of truth for qualification logic.
 */
export async function qualifyProspectCore(params: {
  evidencePosts: Array<Record<string, unknown>>;
  matchedKeywords: string[];
  totalKeywords: number;
  profileData: Record<string, unknown>;
}): Promise<QualificationResult> {
  const { evidencePosts, matchedKeywords, totalKeywords, profileData } = params;

  // Calculate all scores
  const painPointScore = calculatePainPointScore(matchedKeywords, totalKeywords);
  const recencyScore = calculateRecencyScore(evidencePosts);
  const engagementScore = calculateEngagementScore(evidencePosts);
  const { score: authenticityScore, result: authenticity } = await analyzeAuthenticity(profileData);

  const totalScore = Math.round(painPointScore + recencyScore + engagementScore + authenticityScore);
  const qualified = totalScore >= QUALIFICATION_THRESHOLD && !authenticity.isLikelyBot;

  console.log("[qualifyProspectCore] Qualification calculated:", {
    painPointScore,
    recencyScore,
    engagementScore,
    authenticityScore,
    totalScore,
    qualified,
    isBot: authenticity.isLikelyBot,
  });

  return {
    qualified,
    score: totalScore,
    status: qualified ? "qualified" : "disqualified",
    matchedKeywords,
    evidenceCount: evidencePosts.length,
    authenticity,
    qualifiedAt: qualified ? Date.now() : undefined,
  };
}
