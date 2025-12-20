"use node";

// convex/agents/tools/qualifyProspect.ts
// Qualifies a prospect by gathering evidence and scoring

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { api, internal } from "../../_generated/api";
import { logAI, robustGenerateObject } from "../../lib/ai";
import type { Id } from "../../_generated/dataModel";

// ============================================================================
// Constants
// ============================================================================

const QUALIFICATION_THRESHOLD = 80; // Score >= 80 = qualified
const MAX_EVIDENCE_POSTS = 20;
const MAX_KEYWORDS_TO_SEARCH = 10;

// Scoring weights
const SCORE_WEIGHTS = {
  painPointEvidence: 40, // Posts matching qualificationKeywords
  recency: 20, // Posts within last 30 days
  engagement: 20, // Quality of engagement metrics
  authenticity: 20, // Bot detection and account health
};

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

export interface QualifyProspectResult {
  success: boolean;
  prospectId: string;
  qualified: boolean;
  score: number;
  status: "qualified" | "disqualified" | "pending";
  evidenceCount: number;
  matchedKeywords: string[];
  error?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Calculate recency score based on post dates.
 * Posts within last 30 days get full points.
 */
function calculateRecencyScore(posts: Array<{ timestamp?: number; created_at?: string }>): number {
  if (posts.length === 0) return 0;

  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  
  let recentCount = 0;
  for (const post of posts) {
    let postTime: number;
    if (post.timestamp) {
      postTime = post.timestamp;
    } else if (post.created_at) {
      postTime = new Date(post.created_at).getTime();
    } else {
      continue;
    }
    
    if (now - postTime <= thirtyDaysMs) {
      recentCount++;
    }
  }

  // Score based on percentage of recent posts
  return Math.min((recentCount / posts.length) * SCORE_WEIGHTS.recency, SCORE_WEIGHTS.recency);
}

/**
 * Calculate engagement score based on likes, comments, etc.
 */
function calculateEngagementScore(posts: Array<Record<string, unknown>>): number {
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
  
  // Score: 5-10 avg = half points, 10+ avg = full points
  if (avgEngagement >= 10) return SCORE_WEIGHTS.engagement;
  if (avgEngagement >= 5) return SCORE_WEIGHTS.engagement * 0.5;
  return SCORE_WEIGHTS.engagement * 0.25;
}

/**
 * Calculate pain point evidence score based on matched keywords.
 */
function calculatePainPointScore(matchedKeywords: string[], totalKeywords: number): number {
  if (totalKeywords === 0) return 0;
  
  // Score based on percentage of keywords matched
  const matchRate = matchedKeywords.length / totalKeywords;
  return Math.min(matchRate * SCORE_WEIGHTS.painPointEvidence * 2, SCORE_WEIGHTS.painPointEvidence);
}

// ============================================================================
// Tool
// ============================================================================

/**
 * Qualifies a prospect by:
 * 1. Fetching evidence posts using qualificationKeywords
 * 2. Analyzing authenticity (bot detection)
 * 3. Calculating a qualification score
 * 4. Updating the prospect in the database
 */
export const qualifyProspect = createTool({
  description:
    "Qualify a prospect by gathering evidence from their posts and scoring their fit. Use this after a prospect has been found to determine if they should be shown to the user.",
  args: z.object({
    prospectId: z.string().describe("The ID of the prospect to qualify"),
    workspaceId: z.string().describe("The workspace ID for getting qualificationKeywords"),
  }),
  handler: async (ctx, args): Promise<QualifyProspectResult> => {
    try {
      // 1. Get prospect data
      const prospect = await ctx.runQuery(api.prospects.getProspect, {
        prospectId: args.prospectId as Id<"prospects">,
      });

      if (!prospect) {
        return {
          success: false,
          prospectId: args.prospectId,
          qualified: false,
          score: 0,
          status: "pending",
          evidenceCount: 0,
          matchedKeywords: [],
          error: "Prospect not found",
        };
      }

      // 2. Get workspace and qualificationKeywords
      const workspace = await ctx.runQuery(api.workspaces.getWorkspace, {
        workspaceId: args.workspaceId as Id<"workspaces">,
      });

      if (!workspace || !workspace.icps || workspace.icps.length === 0) {
        return {
          success: false,
          prospectId: args.prospectId,
          qualified: false,
          score: 0,
          status: "pending",
          evidenceCount: 0,
          matchedKeywords: [],
          error: "Workspace has no ICPs configured",
        };
      }

      // Collect all qualificationKeywords from ICPs
      const allQualificationKeywords: string[] = [];
      for (const icp of workspace.icps) {
        if (icp.qualificationKeywords) {
          allQualificationKeywords.push(...icp.qualificationKeywords);
        }
      }

      if (allQualificationKeywords.length === 0) {
        return {
          success: false,
          prospectId: args.prospectId,
          qualified: false,
          score: 0,
          status: "pending",
          evidenceCount: 0,
          matchedKeywords: [],
          error: "No qualificationKeywords found in ICPs",
        };
      }

      // Use top keywords (deduplicated)
      const keywords = [...new Set(allQualificationKeywords)].slice(0, MAX_KEYWORDS_TO_SEARCH);

      // 3. Fetch evidence posts based on platform
      let evidencePosts: Array<Record<string, unknown>> = [];
      let matchedKeywords: string[] = [];

      const prospectData = prospect.data as Record<string, unknown>;
      
      if (prospect.platform === "twitter") {
        // Twitter's from: operator requires screen_name (username), NOT numeric id
        const screenName = (prospectData.user as Record<string, string>)?.screen_name || 
                       (prospectData.author as Record<string, string>)?.screen_name;
        
        if (screenName) {
          const result = await ctx.runAction(
            api.integrations.twitter.searchUserPosts.searchUserPosts,
            {
              screenName,
              keywords,
              maxPosts: MAX_EVIDENCE_POSTS,
            }
          );
          
          if (result.success) {
            evidencePosts = result.posts as unknown as Array<Record<string, unknown>>;
            matchedKeywords = result.matchedKeywords;
          }
        }
      } else if (prospect.platform === "linkedin") {
        // Get URN from prospect data
        const urn = (prospectData.author as Record<string, string>)?.urn ||
                    (prospectData as Record<string, string>).authorUrn;
        
        if (urn) {
          const result = await ctx.runAction(
            api.integrations.linkedin.searchUserPosts.searchUserPosts,
            {
              urn,
              keywords,
              maxPosts: MAX_EVIDENCE_POSTS,
            }
          );
          
          if (result.success) {
            evidencePosts = result.posts as unknown as Array<Record<string, unknown>>;
            matchedKeywords = result.matchedKeywords;
          }
        }
      }

      // 4. Calculate scores
      const painPointScore = calculatePainPointScore(matchedKeywords, keywords.length);
      
      const postsWithTime = evidencePosts.map(p => ({
        timestamp: (p.postedAt as Record<string, number>)?.timestamp,
        created_at: p.tweet_created_at as string,
      }));
      const recencyScore = calculateRecencyScore(postsWithTime);
      
      const engagementScore = calculateEngagementScore(evidencePosts);

      // 5. Analyze authenticity (AI)
      let authenticityScore = SCORE_WEIGHTS.authenticity; // Default to full score
      let authenticityData = {
        isLikelyBot: false,
        flags: [] as string[],
        accountAge: 0,
        followersCount: 0,
        followingCount: 0,
        engagementRate: 0,
      };

      try {
        // Extract profile data for authenticity analysis
        const userProfile = prospectData.user || prospectData.author || {};
        const profileStr = JSON.stringify(userProfile);
        
        const { object } = await robustGenerateObject({
          operation: "analyzeAuthenticity",
          schema: authenticitySchema,
          system: `You are an expert at detecting fake accounts and bots on social media.
Analyze the profile data and determine if this account shows signs of being a bot or fake account.

Red flags to look for:
- Very new account with high follower counts
- Extremely high following/follower ratio
- Generic or missing bio
- Default or AI-generated profile picture
- Unusual posting patterns
- Low engagement on posts
- Engagement farming behavior (like begging, follow-for-follow)

Be conservative - only flag as bot if strongly suspicious.`,
          prompt: `Analyze this profile for authenticity:\n${profileStr}`,
          temperature: 0.3,
          maxRetries: 1,
        });

        if (object.isLikelyBot) {
          authenticityScore = 0;
          authenticityData.isLikelyBot = true;
          authenticityData.flags = object.flags;
        } else if (object.flags.length > 0) {
          authenticityScore = SCORE_WEIGHTS.authenticity * (1 - object.flags.length * 0.1);
          authenticityData.flags = object.flags;
        }

        // Extract numeric data if available
        const user = userProfile as Record<string, unknown>;
        if (user.followers_count) {
          authenticityData.followersCount = user.followers_count as number;
        }
        if (user.friends_count || user.followersCount) {
          authenticityData.followingCount = (user.friends_count || user.followersCount) as number;
        }
        if (user.created_at) {
          const createdAt = new Date(user.created_at as string).getTime();
          authenticityData.accountAge = Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));
        }
      } catch (error) {
        logAI("warn", "Authenticity analysis failed, using default score", {
          operation: "qualifyProspect",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      // 6. Calculate total score
      const totalScore = Math.round(painPointScore + recencyScore + engagementScore + authenticityScore);
      const qualified = totalScore >= QUALIFICATION_THRESHOLD && !authenticityData.isLikelyBot;
      const status = qualified ? "qualified" : "disqualified";

      // 7. Update prospect in database
      await ctx.runMutation(internal.prospects.updateProspectQualification, {
        prospectId: args.prospectId as Id<"prospects">,
        qualificationStatus: status,
        qualificationScore: totalScore,
        qualifiedAt: qualified ? Date.now() : undefined,
        evidencePosts: evidencePosts.slice(0, MAX_EVIDENCE_POSTS),
        qualificationKeywords: matchedKeywords,
        authenticity: authenticityData,
      });

      logAI("info", "Prospect qualified", {
        operation: "qualifyProspect",
        prospectId: args.prospectId,
        score: totalScore,
        qualified,
        evidenceCount: evidencePosts.length,
        matchedKeywords: matchedKeywords.length,
      });

      return {
        success: true,
        prospectId: args.prospectId,
        qualified,
        score: totalScore,
        status,
        evidenceCount: evidencePosts.length,
        matchedKeywords,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logAI("error", "Qualification failed", {
        operation: "qualifyProspect",
        prospectId: args.prospectId,
        error: errorMessage,
      });
      
      return {
        success: false,
        prospectId: args.prospectId,
        qualified: false,
        score: 0,
        status: "pending",
        evidenceCount: 0,
        matchedKeywords: [],
        error: errorMessage,
      };
    }
  },
});
