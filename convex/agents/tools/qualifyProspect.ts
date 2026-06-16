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
import { runLoggedAgentTool } from "./logging";

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
  inputSchema: z.object({
    prospectId: z.string().describe("The ID of the prospect to qualify"),
    workspaceId: z
      .string()
      .describe("The workspace ID for getting qualificationKeywords"),
  }),
  execute: async (ctx, args): Promise<QualifyProspectResult> =>
    runLoggedAgentTool(
      ctx,
      {
        moduleName: "qualifyProspect",
        args,
        includeArgKeys: ["prospectId", "workspaceId"],
      },
      async (logEvent) => {
        try {
          // 1. Get prospect data
          const prospect = await ctx.runQuery(api.prospects.getProspect, {
            prospectId: args.prospectId as Id<"prospects">,
          });

          if (!prospect) {
            logEvent.warn("Prospect not found for qualification");
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

          // 2. Validate prospect belongs to the specified workspace (prevents cross-workspace access)
          if (prospect.workspaceId !== args.workspaceId) {
            logEvent.warn("Prospect workspace mismatch during qualification", {
              prospect: {
                id: args.prospectId,
              },
              workspace: {
                id: args.workspaceId,
              },
            });
            return {
              success: false,
              prospectId: args.prospectId,
              qualified: false,
              score: 0,
              status: "pending",
              evidenceCount: 0,
              matchedKeywords: [],
              error: "Prospect does not belong to this workspace",
            };
          }

          // 3. Get workspace and qualificationKeywords
          const workspace = await ctx.runQuery(api.workspaces.getWorkspace, {
            workspaceId: args.workspaceId as Id<"workspaces">,
          });

          if (!workspace || !workspace.icps || workspace.icps.length === 0) {
            logEvent.warn(
              "Workspace has no ICPs configured for qualification",
              {
                workspace: {
                  id: args.workspaceId,
                },
              }
            );
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
            logEvent.warn("No qualification keywords configured in ICPs", {
              workspace: {
                id: args.workspaceId,
              },
            });
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

          const keywords = [...new Set(allQualificationKeywords)].slice(
            0,
            MAX_KEYWORDS_TO_SEARCH
          );

          // 3. Fetch evidence posts based on platform
          let evidencePosts: Array<Record<string, unknown>> = [];
          let matchedKeywords: string[] = [];

          const prospectData = prospect.data as Record<string, unknown>;

          if (prospect.platform === "twitter") {
            // Type-safe screen_name extraction
            const user = prospectData.user as
              | Record<string, unknown>
              | undefined;
            const author = prospectData.author as
              | Record<string, unknown>
              | undefined;
            const screenName =
              typeof user?.screen_name === "string"
                ? user.screen_name
                : typeof author?.screen_name === "string"
                  ? author.screen_name
                  : null;

            if (!screenName) {
              logEvent.warn("No valid Twitter screen name found for prospect", {
                prospect: {
                  id: args.prospectId,
                },
              });
            } else {
              try {
                const result = await ctx.runAction(
                  api.integrations.twitter.searchUserPosts.searchUserPosts,
                  { screenName, keywords, maxPosts: MAX_EVIDENCE_POSTS }
                );

                if (result.success) {
                  evidencePosts = result.posts as unknown as Array<
                    Record<string, unknown>
                  >;
                  matchedKeywords = result.matchedKeywords;
                } else {
                  logEvent.warn("Twitter evidence search failed", {
                    prospect: {
                      id: args.prospectId,
                    },
                    twitter: {
                      error: result.error || "Unknown error",
                      screen_name: screenName,
                    },
                  });
                }
              } catch {
                logEvent.warn("Twitter evidence fetch threw", {
                  prospect: {
                    id: args.prospectId,
                  },
                  twitter: {
                    screen_name: screenName,
                  },
                });
              }
            }
          } else if (prospect.platform === "linkedin") {
            const socialProfiles =
              prospect.socialProfiles &&
              typeof prospect.socialProfiles === "object"
                ? (prospect.socialProfiles as Record<string, unknown>)
                : null;
            const linkedinProfile =
              socialProfiles?.linkedin &&
              typeof socialProfiles.linkedin === "object"
                ? (socialProfiles.linkedin as Record<string, unknown>)
                : null;
            const author = prospectData.author as
              | Record<string, unknown>
              | undefined;
            const urn =
              (typeof prospect.linkedinUserUrn === "string" &&
                prospect.linkedinUserUrn) ||
              (typeof linkedinProfile?.urn === "string" &&
                linkedinProfile.urn) ||
              (typeof author?.urn === "string" && author.urn) ||
              null;

            if (!urn) {
              logEvent.warn("No valid LinkedIn URN found for prospect", {
                prospect: {
                  id: args.prospectId,
                },
              });
            } else {
              try {
                const result = await ctx.runAction(
                  api.integrations.linkedin.searchUserPosts.searchUserPosts,
                  { urn, keywords, maxPosts: MAX_EVIDENCE_POSTS }
                );

                if (result.success) {
                  evidencePosts = result.posts as unknown as Array<
                    Record<string, unknown>
                  >;
                  matchedKeywords = result.matchedKeywords;
                } else {
                  logEvent.warn("LinkedIn evidence search failed", {
                    linkedin: {
                      error: result.error || "Unknown error",
                      urn,
                    },
                    prospect: {
                      id: args.prospectId,
                    },
                  });
                }
              } catch {
                logEvent.warn("LinkedIn evidence fetch threw", {
                  linkedin: {
                    urn,
                  },
                  prospect: {
                    id: args.prospectId,
                  },
                });
              }
            }
          }

          // 4. Calculate qualification using core logic
          const profileData =
            prospectData.user || prospectData.author || prospectData;

          const result: QualificationResult = await qualifyProspectCore({
            evidencePosts,
            matchedKeywords,
            totalKeywords: keywords.length,
            profileData: profileData as Record<string, unknown>,
            useCaseKey: workspace.useCaseKey,
            routing: "fast",
          });

          // 5. Update prospect in database
          await ctx.runMutation(
            internal.prospects.updateProspectQualification,
            {
              prospectId: args.prospectId as Id<"prospects">,
              qualificationStatus: result.status,
              qualificationScore: result.score,
              qualifiedAt: result.qualifiedAt,
              evidencePosts: evidencePosts.slice(0, MAX_EVIDENCE_POSTS),
              qualificationKeywords: result.matchedKeywords,
              authenticity: result.authenticity,
            }
          );

          logEvent.set({
            prospect: {
              id: args.prospectId,
              platform: prospect.platform,
            },
            qualification: {
              evidence_count: result.evidenceCount,
              matched_keyword_count: result.matchedKeywords.length,
              qualified: result.qualified,
              score: result.score,
              status: result.status,
            },
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
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          logEvent.error(error);
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
      }
    ),
});
