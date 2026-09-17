"use node";

// convex/agents/outreach/tools/researchProspect.ts
// Agent tool: deep web research on the current prospect (Exa).
// Thin wrapper - Layer 1. Prospect is resolved from thread context.

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../../_generated/api";
import type { ActionCtx } from "../../../_generated/server";
import {
  readWebPages,
  runDeepResearch,
  type ResearchQueryOutcome,
  type WebPageReadOutcome,
} from "../../../lib/researchCore";
import { extractProspectIdFromThread } from "./helpers";
import { selectProfileWebsiteHref } from "../../../../shared/lib/twitter/profileLinks";

export interface ResearchProspectResult {
  success: boolean;
  website?: WebPageReadOutcome[];
  research?: ResearchQueryOutcome[];
  error?: string;
}

/**
 * Deep web research on the current prospect and their company. Feeds plan
 * generation and refinement with fresh, real-world context.
 */
export const researchProspect = createTool({
  description:
    "Visit the current prospect's saved website when available, then research the prospect and company on the web (recent activity, company news, product launches, funding, public opinions). The saved URL is resolved automatically from profile context; never ask the user to provide it. Use when the user asks to visit the website or requests deeper research.",
  inputSchema: z.object({
    focus: z
      .string()
      .optional()
      .describe(
        "Optional research focus, e.g. 'recent product launches' or 'hiring signals'"
      ),
    extraQueries: z
      .array(z.string())
      .optional()
      .describe("Optional additional web search queries to run (max 2)"),
  }),
  execute: async (ctx, args): Promise<ResearchProspectResult> => {
    try {
      const prospectId = await extractProspectIdFromThread(
        ctx,
        "researchProspect"
      );
      if (!prospectId) {
        return {
          success: false,
          error: "Could not resolve the profile for this thread.",
        };
      }

      const prospect = await ctx.runQuery(
        internal.prospects.getProspectInternal,
        { prospectId }
      );
      if (!prospect) {
        return { success: false, error: "Profile not found." };
      }

      const name = prospect.displayName?.trim();
      const title = prospect.title?.trim();
      if (!name) {
        return {
          success: false,
          error: "Profile has no name to research yet.",
        };
      }

      const queries: string[] = [];
      queries.push(
        args.focus ? `${name} ${args.focus}` : `${name} ${title ?? ""}`.trim()
      );
      if (title) {
        queries.push(`${name} ${title} recent news`);
      }
      for (const extra of args.extraQueries?.slice(0, 2) ?? []) {
        queries.push(extra);
      }

      const websiteUrl = selectProfileWebsiteHref(
        prospect.websiteHref,
        prospect.websiteUrl
      );
      const providerContext = {
        ctx: ctx as unknown as ActionCtx,
        consumer: "outreach.researchProspect",
        workspaceId: prospect.workspaceId,
        prospectId,
      };
      const [website, research] = await Promise.all([
        websiteUrl
          ? readWebPages([websiteUrl], providerContext)
          : Promise.resolve([]),
        runDeepResearch(queries, providerContext),
      ]);
      return { success: true, website, research };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Research failed",
      };
    }
  },
});
