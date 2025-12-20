"use node";

// convex/agents/tools/qualifyProspect.ts
// Agent tool for prospect qualification
// Thin wrapper - delegates to qualificationCore.ts

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { api, internal } from "../../_generated/api";
import {
  qualifyProspectCore,
  MAX_KEYWORDS_TO_SEARCH,
  MAX_EVIDENCE_POSTS,
  type QualificationResult,
} from "../../lib/qualificationCore";
import type { Id } from "../../_generated/dataModel";

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
// Tool
// ============================================================================

/**
 * Agent tool for qualifying a prospect.
 * Thin wrapper that fetches data and calls qualifyProspectCore.
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

      const keywords = [...new Set(allQualificationKeywords)].slice(0, MAX_KEYWORDS_TO_SEARCH);

      // 3. Fetch evidence posts based on platform
      let evidencePosts: Array<Record<string, unknown>> = [];
      let matchedKeywords: string[] = [];

      const prospectData = prospect.data as Record<string, unknown>;

      if (prospect.platform === "twitter") {
        // Type-safe screen_name extraction
        const user = prospectData.user as Record<string, unknown> | undefined;
        const author = prospectData.author as Record<string, unknown> | undefined;
        const screenName = typeof user?.screen_name === 'string' ? user.screen_name :
                           typeof author?.screen_name === 'string' ? author.screen_name : null;

        if (!screenName) {
          console.warn(`[qualifyProspect] No valid screen_name found for prospect ${args.prospectId}`);
        } else {
          try {
            const result = await ctx.runAction(
              api.integrations.twitter.searchUserPosts.searchUserPosts,
              { screenName, keywords, maxPosts: MAX_EVIDENCE_POSTS }
            );

            if (result.success) {
              evidencePosts = result.posts as unknown as Array<Record<string, unknown>>;
              matchedKeywords = result.matchedKeywords;
            } else {
              console.warn(`[qualifyProspect] Twitter search failed for ${args.prospectId}: ${result.error || 'Unknown error'}`);
            }
          } catch (err) {
            console.error(`[qualifyProspect] Twitter evidence fetch error for ${args.prospectId}:`, err);
          }
        }
      } else if (prospect.platform === "linkedin") {
        // LinkedIn disabled - return pending status
        console.log(`[qualifyProspect] LinkedIn disabled, skipping qualification for prospect ${args.prospectId}`);
        return {
          success: true,
          prospectId: args.prospectId,
          qualified: false,
          score: 0,
          status: "pending",
          evidenceCount: 0,
          matchedKeywords: [],
          error: "LinkedIn qualification paused",
        };
      }

      // 4. Calculate qualification using core logic
      const profileData = prospectData.user || prospectData.author || prospectData;

      const result: QualificationResult = await qualifyProspectCore({
        evidencePosts,
        matchedKeywords,
        totalKeywords: keywords.length,
        profileData: profileData as Record<string, unknown>,
      });

      // 5. Update prospect in database
      await ctx.runMutation(internal.prospects.updateProspectQualification, {
        prospectId: args.prospectId as Id<"prospects">,
        qualificationStatus: result.status,
        qualificationScore: result.score,
        qualifiedAt: result.qualifiedAt,
        evidencePosts: evidencePosts.slice(0, MAX_EVIDENCE_POSTS),
        qualificationKeywords: result.matchedKeywords,
        authenticity: result.authenticity,
      });

      console.log(`[qualifyProspect] Prospect ${args.prospectId} qualified:`, {
        score: result.score,
        qualified: result.qualified,
      });

      return {
        success: true,
        prospectId: args.prospectId,
        qualified: result.qualified,
        score: result.score,
        status: result.status,
        evidenceCount: result.evidenceCount,
        matchedKeywords: result.matchedKeywords,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[qualifyProspect] Qualification failed for ${args.prospectId}:`, errorMessage);

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
