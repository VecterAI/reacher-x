// convex/workflows/enrichment.ts
// Per-prospect enrichment workflow
// Triggered after qualification
// Uses core logic from lib/enrichmentCore.ts

import { v } from "convex/values";
import { workflow } from "../lib/workflow";
import { api, internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { enrichmentPool } from "../lib/enrichmentPool";
import {
  enrichTwitterProfile,
  enrichLinkedInProfile,
  convertToEvidencePosts,
  deduplicateEvidencePosts,
  type EvidencePost,
  type ICP,
} from "../lib/enrichmentCore";
import {
  indexPainPoints,
  indexProfile,
  type PainPointForRag,
} from "../lib/ragIndexing";
import { prospectPlatformValidator } from "../validators";
import {
  isRecord,
  getNestedRecord,
  getStringProperty,
} from "../lib/typeGuards";

// ============================================================================
// Constants
// ============================================================================

/** Finance-related keywords to search for in user's posts */
const FINANCE_KEYWORDS = [
  "MRR",
  "ARR",
  "revenue",
  "raised",
  "funding",
  "Series A",
  "Series B",
  "profit",
  "valuation",
];

/** Max finance posts to fetch per user */
const MAX_FINANCE_POSTS = 10;

// ============================================================================
// Enrichment Core Actions (Node.js runtime)
// ============================================================================

/**
 * Internal action that runs Twitter enrichment in Node.js runtime.
 * Wraps enrichTwitterProfile from enrichmentCore.ts.
 * Required because workflow handlers run in default Convex runtime (no process.env).
 */
export const runTwitterEnrichmentCore = internalAction({
  args: {
    profile: v.any(),
    extendedBio: v.optional(v.string()),
    evidencePosts: v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        url: v.optional(v.string()),
        platform: prospectPlatformValidator,
        raw: v.optional(v.any()),
      })
    ),
    icps: v.array(
      v.object({
        title: v.string(),
        description: v.string(),
        painPoints: v.array(v.string()),
      })
    ),
    workspaceName: v.string(),
  },
  handler: async (_ctx, args) => {
    const result = await enrichTwitterProfile({
      profile: args.profile as Record<string, unknown>,
      extendedBio: args.extendedBio,
      evidencePosts: args.evidencePosts,
      icps: args.icps,
      workspaceName: args.workspaceName,
    });

    // Return serializable result (EnrichmentResult)
    return result;
  },
});

/**
 * Internal action that runs LinkedIn enrichment in Node.js runtime.
 * Wraps enrichLinkedInProfile from enrichmentCore.ts.
 * Required because workflow handlers run in default Convex runtime (no process.env).
 */
export const runLinkedInEnrichmentCore = internalAction({
  args: {
    profile: v.any(),
    contactInfo: v.optional(v.any()),
    companyData: v.optional(v.any()),
    evidencePosts: v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        url: v.optional(v.string()),
        platform: prospectPlatformValidator,
        raw: v.optional(v.any()),
      })
    ),
    icps: v.array(
      v.object({
        title: v.string(),
        description: v.string(),
        painPoints: v.array(v.string()),
      })
    ),
    workspaceName: v.string(),
  },
  handler: async (_ctx, args) => {
    const result = await enrichLinkedInProfile({
      profile: args.profile as Record<string, unknown>,
      contactInfo: args.contactInfo as Record<string, unknown> | undefined,
      companyData: args.companyData as Record<string, unknown> | undefined,
      evidencePosts: args.evidencePosts,
      icps: args.icps,
      workspaceName: args.workspaceName,
    });

    // Return serializable result (EnrichmentResult)
    return result;
  },
});

// ============================================================================
// Enrichment Workflow
// ============================================================================

/**
 * Enriches a single prospect by fetching profile data and extracting insights.
 * Delegates all enrichment logic to enrichmentCore.ts (single source of truth).
 *
 * Flow:
 * 1. Get prospect and workspace data
 * 2. PARALLEL: Fetch profile + Search for finance posts
 * 3. Merge evidence posts + finance posts
 * 4. Call enrichment core for extraction + AI analysis
 * 5. Update prospect with enriched data
 */
export const enrichmentWorkflow = workflow.define({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
  },
  returns: v.object({
    success: v.boolean(),
    enrichmentStatus: v.string(),
    error: v.optional(v.string()),
  }),
  handler: async (
    step,
    args
  ): Promise<{
    success: boolean;
    enrichmentStatus: string;
    error?: string;
  }> => {
    // Step 1: Get prospect data
    const prospect = await step.runQuery(
      internal.prospects.getProspectInternal,
      {
        prospectId: args.prospectId,
      }
    );

    if (!prospect) {
      return {
        success: false,
        enrichmentStatus: "failed",
        error: "Prospect not found",
      };
    }

    // Skip if already enriched
    if (prospect.enrichmentStatus === "enriched") {
      return { success: true, enrichmentStatus: "enriched" };
    }

    // Step 2: Get workspace for ICPs
    const workspace = await step.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (!workspace) {
      return {
        success: false,
        enrichmentStatus: "failed",
        error: "Workspace not found",
      };
    }

    // Prepare ICPs
    const icps: ICP[] = (workspace.icps || []).map((icp) => ({
      title: icp.title,
      description: icp.description,
      painPoints: icp.painPoints,
    }));

    const workspaceName = workspace.name;
    const platform = prospect.platform as "twitter" | "linkedin";
    const prospectData = prospect.data as Record<string, unknown>;

    // Convert existing evidence posts (from qualification) to EvidencePost format
    const qualificationEvidence: EvidencePost[] = convertToEvidencePosts(
      (prospect.evidencePosts || []) as Array<Record<string, unknown>>,
      platform
    );

    // Step 3: Platform-specific enrichment with parallel finance search
    let enrichmentResult;

    if (platform === "twitter") {
      enrichmentResult = await enrichTwitterProspect(step, {
        prospectData,
        qualificationEvidence,
        icps,
        workspaceName,
      });
    } else if (platform === "linkedin") {
      enrichmentResult = await enrichLinkedInProspect(step, {
        prospectData,
        qualificationEvidence,
        icps,
        workspaceName,
      });
    } else {
      return {
        success: false,
        enrichmentStatus: "failed",
        error: `Unknown platform: ${platform}`,
      };
    }

    // Step 4: Save enrichment result
    await step.runMutation(internal.prospects.updateProspectEnrichment, {
      prospectId: args.prospectId,
      ...enrichmentResult,
      // Convert pain points for storage
      painPoints: enrichmentResult.painPoints.map((pp) => ({
        pain: pp.pain,
        solution: pp.solution || undefined,
        evidencePosts: pp.evidencePosts.map((ep) => ({
          id: ep.id,
          text: ep.text,
          url: ep.url,
          platform: ep.platform,
          raw: ep.raw,
        })),
      })),
      // Convert finance for storage
      finance: enrichmentResult.finance
        ? {
            displayValue: enrichmentResult.finance.displayValue,
            type: enrichmentResult.finance.type,
            amount: enrichmentResult.finance.amount,
            currency: enrichmentResult.finance.currency,
            evidencePosts: enrichmentResult.finance.evidencePosts.map((ep) => ({
              id: ep.id,
              text: ep.text,
              url: ep.url,
              platform: ep.platform,
              raw: ep.raw,
            })),
          }
        : undefined,
    });

    // Step 5: Index pain points and profile to RAG
    if (enrichmentResult.enrichmentStatus !== "failed") {
      await step
        .runAction(internal.workflows.enrichment.indexEnrichmentContext, {
          prospectId: args.prospectId,
          painPoints: enrichmentResult.painPoints.map((pp) => ({
            pain: pp.pain,
            solution: pp.solution || undefined,
            evidencePosts: pp.evidencePosts.map((ep) => ({
              id: ep.id,
              text: ep.text,
              url: ep.url,
              platform: ep.platform,
            })),
          })),
          briefIntro: enrichmentResult.briefIntro,
        })
        .catch((error) => {
          console.warn(
            `[Enrichment] RAG indexing failed:`,
            error instanceof Error ? error.message : "Unknown error"
          );
        });
    }

    // Log enrichment activity
    if (enrichmentResult.enrichmentStatus !== "failed") {
      await step.runMutation(internal.outreach.logActivity, {
        prospectId: args.prospectId,
        workspaceId: args.workspaceId,
        type: "enriched",
        title: "Profile enriched",
        description: `Identified as ${enrichmentResult.prospectType} with ${enrichmentResult.painPoints.length} pain point${enrichmentResult.painPoints.length !== 1 ? "s" : ""}`,
      });
    }

    console.info(
      `[Enrichment] Prospect ${args.prospectId}: ${enrichmentResult.enrichmentStatus} (type: ${enrichmentResult.prospectType}, painPoints: ${enrichmentResult.painPoints.length})`
    );

    // Step 6: Auto-generate outreach plan for high-match prospects (>= 90 score)
    // Uses Workpool for parallel processing (same pattern as qualification/enrichment)
    const AUTO_PLAN_THRESHOLD = 90;
    if (
      enrichmentResult.enrichmentStatus !== "failed" &&
      prospect.qualificationScore !== undefined &&
      prospect.qualificationScore >= AUTO_PLAN_THRESHOLD
    ) {
      // Check if plan already exists
      const existingPlan = await step.runQuery(
        internal.outreach.getProspectActivePlanInternal,
        { prospectId: args.prospectId }
      );

      if (!existingPlan) {
        // Set status to generating (for UI loading indicator)
        await step.runMutation(internal.prospects.updatePlanGenerationStatus, {
          prospectId: args.prospectId,
          status: "generating",
        });

        // Enqueue to Workpool for parallel processing
        await step
          .runAction(internal.outreachActions.startAutoPlanGeneration, {
            prospectId: args.prospectId,
            workspaceId: args.workspaceId,
            userId: prospect.userId,
          })
          .catch((error) => {
            console.warn(
              `[Enrichment] Auto plan generation enqueue failed:`,
              error instanceof Error ? error.message : "Unknown error"
            );
            // Don't fail enrichment if plan generation fails to enqueue
          });

        console.info(
          `[Enrichment] Triggered auto plan generation for prospect ${args.prospectId} (score: ${prospect.qualificationScore})`
        );
      } else {
        console.info(
          `[Enrichment] Plan already exists for prospect ${args.prospectId}, skipping auto-generation`
        );
      }
    }

    return {
      success: enrichmentResult.enrichmentStatus !== "failed",
      enrichmentStatus: enrichmentResult.enrichmentStatus,
    };
  },
});

// ============================================================================
// Platform-specific Enrichment Functions
// ============================================================================

/**
 * Enrich a Twitter prospect.
 * Runs profile fetch and finance post search in parallel.
 */
async function enrichTwitterProspect(
  step: Parameters<Parameters<typeof workflow.define>[0]["handler"]>[0],
  params: {
    prospectData: Record<string, unknown>;
    qualificationEvidence: EvidencePost[];
    icps: ICP[];
    workspaceName: string;
  }
) {
  const { prospectData, qualificationEvidence, icps, workspaceName } = params;

  // Extract screen_name for API calls (with runtime type guards)
  const user = getNestedRecord(prospectData, "user");
  const author = getNestedRecord(prospectData, "author");
  const screenName =
    getStringProperty(user, "screen_name") ||
    getStringProperty(author, "screen_name") ||
    null;

  if (!screenName) {
    // No screen_name, use existing data only - use step.runAction for Node.js runtime
    return step.runAction(
      internal.workflows.enrichment.runTwitterEnrichmentCore,
      {
        profile: (user || author || prospectData) as Record<string, unknown>,
        evidencePosts: qualificationEvidence,
        icps,
        workspaceName,
      }
    );
  }

  // Run profile fetch and finance search in PARALLEL
  const [profileResult, financePostsResult] = await Promise.all([
    // Fetch profile with extended bio
    step
      .runAction(internal.integrations.twitter.getProfile.getProfile, {
        username: screenName,
        includeExtendedBio: true,
      })
      .catch((error) => {
        console.warn(
          `[Enrichment] Twitter profile fetch failed:`,
          error instanceof Error ? error.message : "Unknown error"
        );
        return { success: false, profile: null, extendedBio: undefined };
      }),

    // Search for finance posts
    step
      .runAction(api.integrations.twitter.searchUserPosts.searchUserPosts, {
        screenName,
        keywords: FINANCE_KEYWORDS,
        maxPosts: MAX_FINANCE_POSTS,
      })
      .catch((error) => {
        console.warn(
          `[Enrichment] Twitter finance search failed:`,
          error instanceof Error ? error.message : "Unknown error"
        );
        return { success: false, posts: [], matchedKeywords: [] };
      }),
  ]);

  // Convert finance posts to EvidencePost format
  const financePosts = convertToEvidencePosts(
    (financePostsResult.posts || []) as unknown as Array<
      Record<string, unknown>
    >,
    "twitter"
  );

  // Merge and deduplicate all posts
  const allPosts = deduplicateEvidencePosts([
    ...qualificationEvidence,
    ...financePosts,
  ]);

  console.info(
    `[Enrichment] Twitter evidence: ${qualificationEvidence.length} qualification + ${financePosts.length} finance = ${allPosts.length} total`
  );

  // Determine profile to use
  const profile =
    profileResult.success && profileResult.profile
      ? (profileResult.profile as unknown as Record<string, unknown>)
      : ((user || author || prospectData) as Record<string, unknown>);

  // Call enrichment via step.runAction for Node.js runtime (process.env support)
  return step.runAction(
    internal.workflows.enrichment.runTwitterEnrichmentCore,
    {
      profile,
      extendedBio: profileResult.extendedBio,
      evidencePosts: allPosts,
      icps,
      workspaceName,
    }
  );
}

/**
 * Enrich a LinkedIn prospect.
 * Runs profile fetch and finance post search in parallel.
 * Note: LinkedIn is currently disabled, but implementation is ready.
 */
async function enrichLinkedInProspect(
  step: Parameters<Parameters<typeof workflow.define>[0]["handler"]>[0],
  params: {
    prospectData: Record<string, unknown>;
    qualificationEvidence: EvidencePost[];
    icps: ICP[];
    workspaceName: string;
  }
) {
  const { prospectData, qualificationEvidence, icps, workspaceName } = params;

  // Extract identifiers for API calls
  const username =
    (prospectData.username as string) ||
    (prospectData.author as Record<string, unknown>)?.url
      ?.toString()
      .split("/in/")[1]
      ?.split("/")[0];
  const urn =
    (prospectData.urn as string) ||
    ((prospectData.author as Record<string, unknown>)?.urn as string);

  if (!username && !urn) {
    // No identifier, use existing data only - use step.runAction for Node.js runtime
    return step.runAction(
      internal.workflows.enrichment.runLinkedInEnrichmentCore,
      {
        profile: prospectData,
        evidencePosts: qualificationEvidence,
        icps,
        workspaceName,
      }
    );
  }

  // Run profile fetch and finance search in PARALLEL
  const [profileResult, financePostsResult] = await Promise.all([
    // Fetch profile with contact info
    step
      .runAction(internal.integrations.linkedin.getProfile.getProfile, {
        username,
        includeContactInfo: true,
      })
      .catch((error) => {
        console.warn(
          `[Enrichment] LinkedIn profile fetch failed:`,
          error instanceof Error ? error.message : "Unknown error"
        );
        return { success: false, profile: null, contactInfo: undefined };
      }),

    // Search for finance posts (using URN if available)
    urn
      ? step
          .runAction(
            api.integrations.linkedin.searchUserPosts.searchUserPosts,
            { urn, keywords: FINANCE_KEYWORDS, maxPosts: MAX_FINANCE_POSTS }
          )
          .catch((error) => {
            console.warn(
              `[Enrichment] LinkedIn finance search failed:`,
              error instanceof Error ? error.message : "Unknown error"
            );
            return { success: false, posts: [], matchedKeywords: [] };
          })
      : Promise.resolve({ success: false, posts: [], matchedKeywords: [] }),
  ]);

  // Convert finance posts to EvidencePost format
  const financePosts = convertToEvidencePosts(
    (financePostsResult.posts || []) as unknown as Array<
      Record<string, unknown>
    >,
    "linkedin"
  );

  // Merge and deduplicate all posts
  const allPosts = deduplicateEvidencePosts([
    ...qualificationEvidence,
    ...financePosts,
  ]);

  console.info(
    `[Enrichment] LinkedIn evidence: ${qualificationEvidence.length} qualification + ${financePosts.length} finance = ${allPosts.length} total`
  );

  // Fetch company data if this is a company profile
  let companyData: Record<string, unknown> | undefined;
  const linkedinUrl =
    ((profileResult.profile as Record<string, unknown> | undefined)
      ?.linkedinUrl as string) || "";

  if (linkedinUrl.includes("/company/")) {
    try {
      const companyResult = await step.runAction(
        internal.integrations.linkedin.getCompany.getCompany,
        { name: username }
      );
      if (companyResult.success && companyResult.company) {
        companyData = companyResult.company as unknown as Record<
          string,
          unknown
        >;
      }
    } catch {
      console.warn(`[Enrichment] Company fetch failed for ${username}`);
    }
  }

  // Determine profile to use
  const profile =
    profileResult.success && profileResult.profile
      ? (profileResult.profile as unknown as Record<string, unknown>)
      : prospectData;

  // Call enrichment via step.runAction for Node.js runtime (process.env support)
  return step.runAction(
    internal.workflows.enrichment.runLinkedInEnrichmentCore,
    {
      profile,
      contactInfo: profileResult.contactInfo as
        | Record<string, unknown>
        | undefined,
      companyData,
      evidencePosts: allPosts,
      icps,
      workspaceName,
    }
  );
}

// ============================================================================
// Enrichment Starter
// ============================================================================

/**
 * Run enrichment workflow for a prospect.
 */
export const runEnrichmentWorkflow = internalAction({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args): Promise<{ workflowId: string }> => {
    const wfId = await workflow.start(
      ctx,
      internal.workflows.enrichment.enrichmentWorkflow,
      {
        prospectId: args.prospectId,
        workspaceId: args.workspaceId,
      }
    );

    console.info(
      `[Enrichment] Started workflow ${wfId} for prospect ${args.prospectId}`
    );

    return { workflowId: wfId.toString() };
  },
});

/**
 * Start enrichment for a prospect via Workpool.
 * Called after qualification completes successfully.
 * This enqueues the workflow through Workpool to limit concurrent executions.
 */
export const startEnrichment = internalAction({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args): Promise<{ workId: string }> => {
    const workId = await enrichmentPool.enqueueAction(
      ctx,
      internal.workflows.enrichment.runEnrichmentWorkflow,
      {
        prospectId: args.prospectId,
        workspaceId: args.workspaceId,
      }
    );

    console.info(
      `[Enrichment] Enqueued workId ${workId} for prospect ${args.prospectId}`
    );

    return { workId: workId.toString() };
  },
});

/**
 * Index enrichment context to RAG.
 * Called after enrichment completes successfully.
 *
 * Indexes:
 * - Pain points with solutions
 * - Profile/brief intro
 */
export const indexEnrichmentContext = internalAction({
  args: {
    prospectId: v.string(),
    painPoints: v.array(
      v.object({
        pain: v.string(),
        solution: v.optional(v.string()),
        evidencePosts: v.array(
          v.object({
            id: v.string(),
            text: v.string(),
            url: v.optional(v.string()),
            platform: prospectPlatformValidator,
          })
        ),
      })
    ),
    briefIntro: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Index pain points
    const painPointsForRag: PainPointForRag[] = args.painPoints.map((pp) => ({
      pain: pp.pain,
      solution: pp.solution,
      evidencePosts: pp.evidencePosts,
    }));

    const painResult = await indexPainPoints(
      ctx,
      args.prospectId,
      painPointsForRag
    );

    // Index profile/brief intro
    let profileIndexed = false;
    if (args.briefIntro) {
      const profileResult = await indexProfile(
        ctx,
        args.prospectId,
        args.briefIntro
      );
      profileIndexed = profileResult.indexed;
    }

    return {
      painPointsIndexed: painResult.indexed,
      profileIndexed,
    };
  },
});
