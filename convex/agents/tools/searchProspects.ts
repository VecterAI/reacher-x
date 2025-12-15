"use node";

// convex/agents/tools/searchProspects.ts
// Orchestrator tool that runs the complete prospecting workflow

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { api, internal } from "../../_generated/api";
import { logAI } from "../../lib/ai";
import { Id } from "../../_generated/dataModel";
import type { TwitterPost } from "../../integrations/twitter/searchPosts";
import type { LinkedInPost } from "../../integrations/linkedin/searchPosts";

// ============================================================================
// Types
// ============================================================================

interface ProspectingProgress {
  step: string;
  status: "pending" | "running" | "completed" | "failed";
  details?: string;
  count?: number;
}

// ============================================================================
// Tool
// ============================================================================

/**
 * Orchestrates the complete prospecting workflow:
 * 1. Generate seed keywords from ICP
 * 2. Convert keywords to social queries
 * 3. Search Twitter and/or LinkedIn
 * 4. Save prospects to database
 *
 * @example
 * const result = await searchProspects({
 *   workspaceId: "workspaces:abc123",
 *   platforms: ["twitter", "linkedin"]
 * });
 */
export const searchProspects = createTool({
  description:
    "Search for prospects on Twitter and LinkedIn based on the workspace's ICP. This runs the full prospecting workflow: generates keywords, converts to social queries, searches platforms, and saves results. Use this when the user wants to find prospects or after workspace setup is complete.",
  args: z.object({
    workspaceId: z
      .string()
      .describe("The workspace ID to search prospects for"),
    platforms: z
      .array(z.union([z.literal("twitter"), z.literal("linkedin")]))
      .default(["twitter", "linkedin"])
      .describe("Platforms to search (defaults to both)"),
    maxQueriesPerPlatform: z
      .number()
      .min(1)
      .max(20)
      .default(10)
      .describe("Maximum queries to execute per platform (default: 10)"),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    progress: ProspectingProgress[];
    results?: {
      twitterProspects: number;
      linkedinProspects: number;
      totalProspects: number;
      savedProspects: number;
    };
    error?: string;
  }> => {
    const startTime = Date.now();
    const progress: ProspectingProgress[] = [];

    const addProgress = (
      step: string,
      status: ProspectingProgress["status"],
      details?: string,
      count?: number
    ) => {
      progress.push({ step, status, details, count });
    };

    logAI("info", "Starting prospect search workflow", {
      operation: "searchProspects",
      workspaceId: args.workspaceId,
      platforms: args.platforms.join(", "),
    });

    try {
      // Step 1: Get workspace data
      addProgress("Fetching workspace data", "running");

      // Use internal query to bypass auth (agent runs in action context)
      const workspace = await ctx.runQuery(internal.workspaces.getById, {
        workspaceId: args.workspaceId as Id<"workspaces">,
      });

      if (!workspace) {
        addProgress("Fetching workspace data", "failed", "Workspace not found");
        return {
          success: false,
          progress,
          error: "Workspace not found",
        };
      }

      if (!workspace.improvedDescription || !workspace.icps?.length) {
        addProgress(
          "Fetching workspace data",
          "failed",
          "Workspace setup incomplete"
        );
        return {
          success: false,
          progress,
          error:
            "Workspace setup is incomplete. Please complete the setup first.",
        };
      }

      addProgress("Fetching workspace data", "completed", workspace.name);

      // Step 2: Generate seed keywords
      addProgress("Generating seed keywords", "running");

      const seedKeywordsResult = await ctx.runAction(
        internal.agents.internal.generateSeedKeywordsAction,
        {
          improvedDescription: workspace.improvedDescription,
          icps: workspace.icps,
        }
      );

      if (!seedKeywordsResult.success || !seedKeywordsResult.seedKeywords) {
        addProgress(
          "Generating seed keywords",
          "failed",
          seedKeywordsResult.error
        );
        return {
          success: false,
          progress,
          error: seedKeywordsResult.error || "Failed to generate keywords",
        };
      }

      addProgress(
        "Generating seed keywords",
        "completed",
        `Generated ${seedKeywordsResult.seedKeywords.length} keywords`,
        seedKeywordsResult.seedKeywords.length
      );

      // Step 2.5: Discover keywords via Bishopi
      addProgress("Discovering keywords via Bishopi", "running");

      // Store full DiscoveredKeyword objects for DB, string array for conversion
      let discoveredKeywordObjects: Array<{
        keyword: string;
        searchVolume: number;
        competition?: number;
        competitionLevel?: string;
        cpc?: number;
        trend?: { monthly?: number; quarterly?: number; yearly?: number };
        keywordDifficulty?: number;
        searchIntent?: string;
      }> = [];
      let discoveredKeywordStrings: string[] = [];

      try {
        const bishopiResult = await ctx.runAction(
          internal.agents.internal.discoverKeywordsAction,
          {
            seedKeywords: seedKeywordsResult.seedKeywords,
          }
        );

        if (bishopiResult.success && bishopiResult.discoveredKeywords && bishopiResult.discoveredKeywords.length > 0) {
          // Keep full objects for saving to DB
          discoveredKeywordObjects = bishopiResult.discoveredKeywords;
          // Extract just strings for keyword conversion
          discoveredKeywordStrings = bishopiResult.keywordStrings || [];
          addProgress(
            "Discovering keywords via Bishopi",
            "completed",
            `Discovered ${discoveredKeywordStrings.length} additional keywords`,
            discoveredKeywordStrings.length
          );
        } else {
          addProgress(
            "Discovering keywords via Bishopi",
            "completed",
            bishopiResult.error || "No additional keywords found",
            0
          );
        }
      } catch (err) {
        // Bishopi is optional, don't fail the whole workflow
        addProgress(
          "Discovering keywords via Bishopi",
          "completed",
          `Skipped: ${err instanceof Error ? err.message : "API unavailable"}`,
          0
        );
      }

      // Combine seed keywords with discovered keywords (deduplicated) for conversion
      const allKeywords = [
        ...new Set([...seedKeywordsResult.seedKeywords, ...discoveredKeywordStrings]),
      ];

      // Step 3: Convert to social queries
      addProgress("Converting to social queries", "running");

      const socialQueriesResult = await ctx.runAction(
        internal.agents.internal.convertToSocialQueriesAction,
        {
          keywords: allKeywords,
          platforms: args.platforms,
          businessContext: workspace.improvedDescription,
        }
      );

      if (!socialQueriesResult.success || !socialQueriesResult.socialQueries) {
        addProgress(
          "Converting to social queries",
          "failed",
          socialQueriesResult.error
        );
        return {
          success: false,
          progress,
          error: socialQueriesResult.error || "Failed to convert queries",
        };
      }

      const queriesToUse = socialQueriesResult.socialQueries.slice(
        0,
        args.maxQueriesPerPlatform * args.platforms.length
      );

      addProgress(
        "Converting to social queries",
        "completed",
        `Created ${queriesToUse.length} queries`,
        queriesToUse.length
      );

      // Step 4: Search platforms
      let twitterPosts: TwitterPost[] = [];
      let linkedinPosts: LinkedInPost[] = [];

      if (args.platforms.includes("twitter")) {
        addProgress("Searching Twitter", "running");

        try {
          const twitterResult = await ctx.runAction(
            api.integrations.twitter.searchPosts.searchBatch,
            {
              queries: queriesToUse.slice(0, args.maxQueriesPerPlatform),
              type: "Latest",
              maxQueriesPerBatch: args.maxQueriesPerPlatform,
            }
          );

          twitterPosts = twitterResult.posts || [];
          addProgress(
            "Searching Twitter",
            twitterResult.success ? "completed" : "failed",
            twitterResult.success
              ? `Found ${twitterPosts.length} posts`
              : "Search failed",
            twitterPosts.length
          );
        } catch (err) {
          addProgress(
            "Searching Twitter",
            "failed",
            err instanceof Error ? err.message : "Unknown error"
          );
        }
      }

      if (args.platforms.includes("linkedin")) {
        addProgress("Searching LinkedIn", "running");

        try {
          const linkedinResult = await ctx.runAction(
            api.integrations.linkedin.searchPosts.searchBatch,
            {
              queries: queriesToUse.slice(0, args.maxQueriesPerPlatform),
              sortBy: "relevance",
              datePosted: "past-week",
              maxQueriesPerBatch: args.maxQueriesPerPlatform,
            }
          );

          linkedinPosts = linkedinResult.posts || [];
          addProgress(
            "Searching LinkedIn",
            linkedinResult.success ? "completed" : "failed",
            linkedinResult.success
              ? `Found ${linkedinPosts.length} posts`
              : "Search failed",
            linkedinPosts.length
          );
        } catch (err) {
          addProgress(
            "Searching LinkedIn",
            "failed",
            err instanceof Error ? err.message : "Unknown error"
          );
        }
      }

      // Step 5: Save prospects
      addProgress("Saving prospects", "running");

      const prospectsToSave: Array<{
        platform: "twitter" | "linkedin";
        externalId: string;
        data: unknown;
        matchedKeywords: string[];
      }> = [];

      // Transform Twitter posts
      for (const post of twitterPosts) {
        prospectsToSave.push({
          platform: "twitter",
          externalId: post.id_str,
          data: post,
          matchedKeywords: queriesToUse.slice(0, 5),
        });
      }

      // Transform LinkedIn posts
      for (const post of linkedinPosts) {
        prospectsToSave.push({
          platform: "linkedin",
          externalId: post.postID || post.urn || "",
          data: post,
          matchedKeywords: queriesToUse.slice(0, 5),
        });
      }

      // Batch save using internal mutation
      let savedCount = 0;
      if (prospectsToSave.length > 0) {
        const saveResult = await ctx.runMutation(
          internal.prospects.createProspectsBatch,
          {
            userId: workspace.userId,
            workspaceId: args.workspaceId as Id<"workspaces">,
            prospects: prospectsToSave,
          }
        );
        savedCount = saveResult.created + saveResult.updated;
      }

      addProgress(
        "Saving prospects",
        "completed",
        `Saved ${savedCount} prospects`,
        savedCount
      );

      // Save keywords to new row-based keywords table
      const keywordsToSave: Array<{
        type: "seed" | "discovered" | "social_query";
        value: string;
        source?: string;
        searchVolume?: number;
        competition?: number;
        competitionLevel?: string;
        cpc?: number;
        keywordDifficulty?: number;
        searchIntent?: string;
        trend?: { monthly?: number; quarterly?: number; yearly?: number };
      }> = [];

      // Add seed keywords
      for (const kw of seedKeywordsResult.seedKeywords) {
        keywordsToSave.push({
          type: "seed",
          value: kw,
          source: "agent",
        });
      }

      // Add discovered keywords with metadata
      for (const kw of discoveredKeywordObjects) {
        keywordsToSave.push({
          type: "discovered",
          value: kw.keyword,
          source: "bishopi",
          searchVolume: kw.searchVolume,
          competition: kw.competition,
          competitionLevel: kw.competitionLevel,
          cpc: kw.cpc,
          keywordDifficulty: kw.keywordDifficulty,
          searchIntent: kw.searchIntent,
          trend: kw.trend,
        });
      }

      // Add social queries
      for (const query of queriesToUse) {
        keywordsToSave.push({
          type: "social_query",
          value: query,
          source: "agent",
        });
      }

      await ctx.runMutation(internal.keywords.saveKeywordsBatch, {
        workspaceId: args.workspaceId as Id<"workspaces">,
        keywords: keywordsToSave,
      });

      // Step 6: Create SocialAPI monitors for Twitter 24/7 prospecting
      if (args.platforms.includes("twitter") && queriesToUse.length > 0) {
        addProgress("Setting up 24/7 Twitter monitoring", "running");

        try {
          const monitorResult = await ctx.runAction(
            internal.socialapiMonitors.createMonitorsFromSocialQueriesInternal,
            {
              workspaceId: args.workspaceId as Id<"workspaces">,
            }
          );

          addProgress(
            "Setting up 24/7 Twitter monitoring",
            "completed",
            `Created ${monitorResult.created} monitors`,
            monitorResult.created
          );
        } catch (err) {
          // Monitor creation is optional, don't fail the workflow
          addProgress(
            "Setting up 24/7 Twitter monitoring",
            "completed",
            `Skipped: ${err instanceof Error ? err.message : "Failed to create monitors"}`,
            0
          );
        }
      }

      // Step 7: Start continuous prospecting workflow (if not already running)
      addProgress("Starting continuous prospecting workflow", "running");
      
      try {
        const workflowResult = await ctx.runAction(
          internal.workspaces.startProspectingWorkflowInternal,
          {
            workspaceId: args.workspaceId as Id<"workspaces">,
          }
        );

        if (workflowResult.success) {
          addProgress(
            "Starting continuous prospecting workflow",
            "completed",
            "24/7 prospecting workflow started",
            1
          );
        } else {
          addProgress(
            "Starting continuous prospecting workflow",
            "completed",
            workflowResult.error || "Workflow already running",
            0
          );
        }
      } catch (err) {
        // Workflow start is optional, don't fail
        addProgress(
          "Starting continuous prospecting workflow",
          "completed",
          `Skipped: ${err instanceof Error ? err.message : "Failed to start workflow"}`,
          0
        );
      }

      const durationMs = Date.now() - startTime;

      logAI("info", "Prospect search completed", {
        operation: "searchProspects",
        twitterPosts: twitterPosts.length,
        linkedinPosts: linkedinPosts.length,
        savedCount,
        durationMs,
      });

      return {
        success: true,
        progress,
        results: {
          twitterProspects: twitterPosts.length,
          linkedinProspects: linkedinPosts.length,
          totalProspects: twitterPosts.length + linkedinPosts.length,
          savedProspects: savedCount,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logAI("error", "Prospect search failed", {
        operation: "searchProspects",
        error: errorMessage,
        durationMs: Date.now() - startTime,
      });

      addProgress("Prospect search", "failed", errorMessage);

      return {
        success: false,
        progress,
        error: errorMessage,
      };
    }
  },
});

