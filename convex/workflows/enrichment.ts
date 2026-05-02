// convex/workflows/enrichment.ts
// Per-prospect enrichment workflow
// Triggered after qualification
// Uses core logic from lib/enrichmentCore.ts

import { v } from "convex/values";
import { workflow } from "../lib/workflow";
import type { WorkflowCtx } from "@convex-dev/workflow";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../lib/functionBuilders";
import { enrichmentPool } from "../lib/enrichmentPool";
import {
  PREVIEW_BATCH_LIMITS,
  isSetupPreviewFastPathEnabled,
} from "../lib/previewBatchLimits";
import { previewEnrichmentPool } from "../lib/previewEnrichmentPool";
import {
  enrichTwitterProfile,
  enrichLinkedInProfile,
  convertToEvidencePosts,
  deduplicateEvidencePosts,
  type EnrichmentResult,
  type EvidencePost,
  type ICP,
} from "../lib/enrichmentCore";
import {
  indexPainPoints,
  indexProfile,
  type PainPointForRag,
} from "../lib/ragIndexing";
import {
  enrichmentStatusValidator,
  prospectPlatformValidator,
} from "../validators";
import { getNestedRecord, getStringProperty } from "../lib/typeGuards";
import { formatWorkspaceLogContext } from "../lib/logHelpers";
import {
  sanitizeLinkedInCompanyDataForWorkflow,
  sanitizeLinkedInContactInfoForWorkflow,
  sanitizeLinkedInProfileForWorkflow,
  sanitizeProspectEvidencePostsForWorkflow,
  sanitizeTwitterProfileForWorkflow,
} from "../lib/workflowSafeProspect";
import {
  normalizeLinkedInProfileQueryUrn,
  resolveLinkedInProspectProfileIdentifiers,
} from "../integrations/linkedin/profileIdentity";

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

/** Max recent LinkedIn profile posts to hydrate for profile-only prospects. */
const MAX_LINKEDIN_RECENT_POSTS = 10;

function createEnrichmentClaimToken(prospectId: string) {
  return `pending:${prospectId}:${Date.now().toString(36)}:${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function toWorkflowSafeEvidencePosts(posts: EvidencePost[]): EvidencePost[] {
  return posts.map((post) => ({
    id: post.id,
    text: post.text,
    url: post.url,
    platform: post.platform,
  }));
}

function rehydrateEvidencePosts(
  posts: EvidencePost[],
  sourcePosts: EvidencePost[]
): EvidencePost[] {
  const sourceById = new Map(sourcePosts.map((post) => [post.id, post]));
  return posts.map((post) => sourceById.get(post.id) ?? post);
}

function rehydrateEnrichmentResultEvidence(
  result: EnrichmentResult,
  sourcePosts: EvidencePost[]
): EnrichmentResult {
  return {
    ...result,
    painPoints: result.painPoints.map((painPoint) => ({
      ...painPoint,
      evidencePosts: rehydrateEvidencePosts(
        painPoint.evidencePosts,
        sourcePosts
      ),
    })),
    finance: result.finance
      ? {
          ...result.finance,
          evidencePosts: rehydrateEvidencePosts(
            result.finance.evidencePosts,
            sourcePosts
          ),
        }
      : undefined,
  };
}

type PreparedEnrichmentResult = {
  result: EnrichmentResult;
  evidencePosts: EvidencePost[];
};

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

export const getSetupPreviewFastPathConfigInternal = internalAction({
  args: {},
  returns: v.object({
    enabled: v.boolean(),
  }),
  handler: async () => ({
    enabled: isSetupPreviewFastPathEnabled(),
  }),
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
    force: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    enrichmentStatus: enrichmentStatusValidator,
    skipped: v.optional(v.boolean()),
    error: v.optional(v.string()),
  }),
  handler: async (
    step,
    args
  ): Promise<{
    success: boolean;
    enrichmentStatus: "pending" | "enriched" | "partial" | "failed";
    skipped?: boolean;
    error?: string;
  }> => {
    // Step 1: Get prospect data
    const prospect = await step.runQuery(
      internal.prospects.getProspectWorkflowDataInternal,
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

    await step.runMutation(internal.prospects.setEnrichmentWorkflowId, {
      prospectId: args.prospectId,
      workflowId: String(step.workflowId),
    });

    const isSetupPreview = prospect.origin === "setup_preview";
    if (isSetupPreview) {
      if (!prospect.setupSessionId) {
        await step.runMutation(internal.prospects.clearEnrichmentWorkflowId, {
          prospectId: args.prospectId,
        });
        return {
          success: true,
          enrichmentStatus: prospect.enrichmentStatus ?? "pending",
        };
      }

      const setupSession = await step.runQuery(
        internal.setupSessions.getByIdInternal,
        {
          sessionId: prospect.setupSessionId,
        }
      );
      if (!setupSession || setupSession.status === "discarded") {
        await step.runMutation(internal.prospects.clearEnrichmentWorkflowId, {
          prospectId: args.prospectId,
        });
        return {
          success: true,
          enrichmentStatus: prospect.enrichmentStatus ?? "pending",
        };
      }
    }

    // Skip if already enriched
    if (!args.force && prospect.enrichmentStatus === "enriched") {
      await step.runMutation(internal.prospects.clearEnrichmentWorkflowId, {
        prospectId: args.prospectId,
      });
      return { success: true, enrichmentStatus: "enriched" };
    }

    if (prospect.status === "archived") {
      await step.runMutation(internal.prospects.clearEnrichmentWorkflowId, {
        prospectId: args.prospectId,
      });
      return {
        success: true,
        enrichmentStatus: prospect.enrichmentStatus ?? "pending",
        skipped: true,
      };
    }

    if (prospect.qualificationStatus !== "qualified") {
      await step.runMutation(internal.prospects.clearEnrichmentWorkflowId, {
        prospectId: args.prospectId,
      });
      return {
        success: true,
        enrichmentStatus: prospect.enrichmentStatus ?? "pending",
        skipped: true,
      };
    }

    // Step 2: Get workspace for ICPs
    const workspace = await step.runQuery(internal.workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (!workspace) {
      await step.runMutation(internal.prospects.clearEnrichmentWorkflowId, {
        prospectId: args.prospectId,
      });
      return {
        success: false,
        enrichmentStatus: "failed",
        error: "Workspace not found",
      };
    }

    // Prepare ICPs
    const icps: ICP[] = (workspace.icps || []).map((icp: any) => ({
      title: icp.title,
      description: icp.description,
      painPoints: icp.painPoints,
    }));

    const workspaceName = workspace.name;
    const workspaceLogContext = formatWorkspaceLogContext({
      workspaceId: String(args.workspaceId),
      workspaceName,
    });
    const platform = prospect.platform as "twitter" | "linkedin";
    const prospectData = prospect.data as Record<string, unknown>;
    const previewFastPathConfig =
      isSetupPreview && platform === "twitter"
        ? await step.runAction(
            internal.workflows.enrichment.getSetupPreviewFastPathConfigInternal,
            {}
          )
        : { enabled: false };
    const useFastPreviewPath =
      isSetupPreview && platform === "twitter" && previewFastPathConfig.enabled;

    // Convert existing evidence posts (from qualification) to EvidencePost format
    const qualificationEvidence: EvidencePost[] = convertToEvidencePosts(
      (prospect.evidencePosts || []) as Array<Record<string, unknown>>,
      platform
    );

    // Step 3: Platform-specific enrichment with parallel finance search
    let preparedResult: PreparedEnrichmentResult;

    if (platform === "twitter") {
      preparedResult = await enrichTwitterProspect(step, {
        prospectData,
        qualificationEvidence,
        icps,
        workspaceName,
        includeExtendedBio: !useFastPreviewPath,
        includeFinanceSearch: !useFastPreviewPath,
        forcePartial: useFastPreviewPath,
      });
    } else if (platform === "linkedin") {
      preparedResult = await enrichLinkedInProspect(step, {
        prospect: prospect as Record<string, unknown>,
        prospectData,
        qualificationEvidence,
        icps,
        workspaceName,
      });
    } else {
      await step.runMutation(internal.prospects.clearEnrichmentWorkflowId, {
        prospectId: args.prospectId,
      });
      return {
        success: false,
        enrichmentStatus: "failed",
        error: `Unknown platform: ${platform}`,
      };
    }
    const enrichmentResult = preparedResult.result;

    // Step 4: Save enrichment result
    const enrichmentUpdate = await step.runMutation(
      internal.prospects.updateProspectEnrichment,
      {
        prospectId: args.prospectId,
        ...enrichmentResult,
        // Convert pain points for storage
        painPoints: enrichmentResult.painPoints.map((pp: any) => ({
          pain: pp.pain,
          solution: pp.solution || undefined,
          evidencePosts: pp.evidencePosts.map((ep: any) => ({
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
              evidencePosts: enrichmentResult.finance.evidencePosts.map(
                (ep: any) => ({
                  id: ep.id,
                  text: ep.text,
                  url: ep.url,
                  platform: ep.platform,
                  raw: ep.raw,
                })
              ),
            }
          : undefined,
        evidencePosts: preparedResult.evidencePosts.map(
          (post: EvidencePost) => {
            if (post.raw && typeof post.raw === "object") {
              return post.raw;
            }

            return {
              id: post.id,
              text: post.text,
              url: post.url,
              platform: post.platform,
            };
          }
        ),
        activityLogDescription:
          enrichmentResult.enrichmentStatus !== "failed"
            ? `Identified as ${enrichmentResult.prospectType} with ${enrichmentResult.painPoints.length} pain point${enrichmentResult.painPoints.length !== 1 ? "s" : ""}`
            : undefined,
      }
    );

    // Step 5: Index pain points and profile to RAG
    if (enrichmentResult.enrichmentStatus !== "failed" && !isSetupPreview) {
      await step
        .runAction(internal.workflows.enrichment.indexEnrichmentContext, {
          prospectId: args.prospectId,
          painPoints: enrichmentResult.painPoints.map((pp: any) => ({
            pain: pp.pain,
            solution: pp.solution || undefined,
            evidencePosts: pp.evidencePosts.map((ep: any) => ({
              id: ep.id,
              text: ep.text,
              url: ep.url,
              platform: ep.platform,
            })),
          })),
          briefIntro: enrichmentResult.briefIntro,
        })
        .catch((error: unknown) => {
          console.warn(
            `[Enrichment] ${workspaceLogContext} RAG indexing failed:`,
            error instanceof Error ? error.message : "Unknown error"
          );
        });

      await step
        .runAction(internal.memory.indexWorkspaceProspectSummaryInternal, {
          workspaceId: String(args.workspaceId),
          prospectId: String(args.prospectId),
          namespace: "patterns",
          displayName:
            enrichmentResult.displayName ||
            prospect.displayName ||
            prospect.title ||
            "Unknown prospect",
          title: enrichmentResult.title || prospect.title,
          briefIntro: enrichmentResult.briefIntro,
          qualificationStatus: prospect.qualificationStatus,
          qualificationScore: prospect.qualificationScore,
          matchedKeywords: prospect.matchedKeywords,
          painPoints: enrichmentResult.painPoints.map((pp: any) => pp.pain),
          finance: enrichmentResult.finance?.displayValue,
          importance: prospect.qualificationScore
            ? Math.min(1, prospect.qualificationScore / 100)
            : 0.65,
        })
        .catch((error: unknown) => {
          console.warn(
            `[Enrichment] ${workspaceLogContext} Workspace summary indexing failed:`,
            error instanceof Error ? error.message : "Unknown error"
          );
        });

      await step
        .runAction(internal.memory.indexProspectSearchListInternal, {
          prospectId: args.prospectId,
        })
        .catch((error: unknown) => {
          console.warn(
            `[Enrichment] ${workspaceLogContext} Prospect list search RAG indexing failed:`,
            error instanceof Error ? error.message : "Unknown error"
          );
        });
    }

    if (
      enrichmentResult.enrichmentStatus !== "failed" &&
      enrichmentUpdate.skipped
    ) {
      await step.runMutation(internal.prospects.clearEnrichmentWorkflowId, {
        prospectId: args.prospectId,
      });
      return {
        success: true,
        enrichmentStatus: enrichmentResult.enrichmentStatus,
        skipped: true,
      };
    }

    await step.runMutation(internal.memory.recordMemoryWorkflowEventInternal, {
      workspaceId: args.workspaceId,
      eventType: "enrichment_completed",
      sourceType: "prospect",
      sourceId: String(args.prospectId),
      workflowName: "enrichmentWorkflow",
      prospectId: args.prospectId,
      payload: {
        enrichmentStatus: enrichmentResult.enrichmentStatus,
        prospectType: enrichmentResult.prospectType,
        painPointCount: enrichmentResult.painPoints.length,
        hasFinance: Boolean(enrichmentResult.finance),
      },
      eventKey: `enrichment:${String(step.workflowId)}:completed`,
    });

    console.info(
      `[Enrichment] ${workspaceLogContext} Prospect ${args.prospectId}: ${enrichmentResult.enrichmentStatus} (type: ${enrichmentResult.prospectType}, painPoints: ${enrichmentResult.painPoints.length})`
    );

    // Step 6: Auto-generate outreach plan for high-match prospects (>= 90 score)
    // Uses Workpool for parallel processing (same pattern as qualification/enrichment)
    const AUTO_PLAN_THRESHOLD = 90;
    if (
      !isSetupPreview &&
      enrichmentResult.enrichmentStatus !== "failed" &&
      prospect.qualificationScore !== undefined &&
      prospect.qualificationScore >= AUTO_PLAN_THRESHOLD
    ) {
      const styleReady =
        workspace?.styleProfileStatus === "ready" &&
        typeof workspace.styleProfileVersion === "number" &&
        workspace.styleProfileVersion > 0;

      if (!styleReady) {
        console.info(
          `[Enrichment] ${workspaceLogContext} Deferring auto plan generation for prospect ${args.prospectId} until writing style is ready`
        );
        await step.runMutation(internal.prospects.updatePlanGenerationStatus, {
          prospectId: args.prospectId,
          status: "idle",
        });
      } else {
        // Check if plan already exists
        const existingPlan = await step.runQuery(
          internal.outreach.getProspectActivePlanInternal,
          { prospectId: args.prospectId }
        );

        if (!existingPlan) {
          // Set status to generating (for UI loading indicator)
          await step.runMutation(
            internal.prospects.updatePlanGenerationStatus,
            {
              prospectId: args.prospectId,
              status: "generating",
            }
          );

          // Enqueue to Workpool for parallel processing
          await step
            .runAction(internal.outreachActions.startAutoPlanGeneration, {
              prospectId: args.prospectId,
              workspaceId: args.workspaceId,
              userId: prospect.userId,
            })
            .catch((error: unknown) => {
              console.warn(
                `[Enrichment] ${workspaceLogContext} Auto plan generation enqueue failed:`,
                error instanceof Error ? error.message : "Unknown error"
              );
              // Don't fail enrichment if plan generation fails to enqueue
            });

          console.info(
            `[Enrichment] ${workspaceLogContext} Triggered auto plan generation for prospect ${args.prospectId} (score: ${prospect.qualificationScore})`
          );
        } else {
          console.info(
            `[Enrichment] ${workspaceLogContext} Plan already exists for prospect ${args.prospectId}, skipping auto-generation`
          );
        }
      }
    }

    await step.runMutation(internal.prospects.clearEnrichmentWorkflowId, {
      prospectId: args.prospectId,
    });

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
  step: WorkflowCtx,
  params: {
    prospectData: Record<string, unknown>;
    qualificationEvidence: EvidencePost[];
    icps: ICP[];
    workspaceName: string;
    includeExtendedBio?: boolean;
    includeFinanceSearch?: boolean;
    forcePartial?: boolean;
  }
) {
  const {
    prospectData,
    qualificationEvidence,
    icps,
    workspaceName,
    includeExtendedBio = true,
    includeFinanceSearch = true,
    forcePartial = false,
  } = params;
  const workspaceLogContext = formatWorkspaceLogContext({ workspaceName });

  // Extract screen_name for API calls (with runtime type guards)
  const user = getNestedRecord(prospectData, "user");
  const author = getNestedRecord(prospectData, "author");
  const screenName =
    getStringProperty(user, "screen_name") ||
    getStringProperty(author, "screen_name") ||
    null;

  if (!screenName) {
    // No screen_name, use existing data only - use step.runAction for Node.js runtime
    const workflowSafeEvidence = toWorkflowSafeEvidencePosts(
      qualificationEvidence
    );
    const enrichmentResult: EnrichmentResult = await step.runAction(
      internal.workflows.enrichment.runTwitterEnrichmentCore,
      {
        profile: (user || author || prospectData) as Record<string, unknown>,
        evidencePosts: workflowSafeEvidence,
        icps,
        workspaceName,
      }
    );
    const finalResult = rehydrateEnrichmentResultEvidence(
      enrichmentResult,
      qualificationEvidence
    );
    if (!forcePartial || finalResult.enrichmentStatus === "failed") {
      return { result: finalResult, evidencePosts: qualificationEvidence };
    }
    const partialResult: EnrichmentResult = {
      ...finalResult,
      enrichmentStatus: "partial",
      finance: undefined,
    };
    return { result: partialResult, evidencePosts: qualificationEvidence };
  }

  // Run profile fetch and finance search in PARALLEL
  const [profileResult, financePostsResult] = await Promise.all([
    // Fetch profile with extended bio
    step
      .runAction(internal.integrations.twitter.getProfile.getProfile, {
        username: screenName,
        includeExtendedBio,
      })
      .catch((error: unknown) => {
        console.warn(
          `[Enrichment] ${workspaceLogContext} Twitter profile fetch failed:`,
          error instanceof Error ? error.message : "Unknown error"
        );
        return { success: false, profile: null, extendedBio: undefined };
      }),

    // Search for finance posts
    includeFinanceSearch
      ? step
          .runAction(api.integrations.twitter.searchUserPosts.searchUserPosts, {
            screenName,
            keywords: FINANCE_KEYWORDS,
            maxPosts: MAX_FINANCE_POSTS,
          })
          .catch((error: unknown) => {
            console.warn(
              `[Enrichment] ${workspaceLogContext} Twitter finance search failed:`,
              error instanceof Error ? error.message : "Unknown error"
            );
            return { success: false, posts: [], matchedKeywords: [] };
          })
      : Promise.resolve({ success: false, posts: [], matchedKeywords: [] }),
  ]);

  // Convert finance posts to EvidencePost format
  const financePosts = convertToEvidencePosts(
    sanitizeProspectEvidencePostsForWorkflow(
      (financePostsResult.posts || []) as unknown as Array<
        Record<string, unknown>
      >,
      "twitter"
    ),
    "twitter"
  );

  // Merge and deduplicate all posts
  const allPosts = deduplicateEvidencePosts([
    ...qualificationEvidence,
    ...financePosts,
  ]);

  console.info(
    `[Enrichment] ${workspaceLogContext} Twitter evidence: ${qualificationEvidence.length} qualification + ${financePosts.length} finance = ${allPosts.length} total`
  );

  // Determine profile to use
  const profile =
    profileResult.success && profileResult.profile
      ? sanitizeTwitterProfileForWorkflow(
          profileResult.profile as unknown as Record<string, unknown>
        )
      : ((user || author || prospectData) as Record<string, unknown>);

  // Call enrichment via step.runAction for Node.js runtime (process.env support)
  const workflowSafeEvidence = toWorkflowSafeEvidencePosts(allPosts);
  const enrichmentResult: EnrichmentResult = await step.runAction(
    internal.workflows.enrichment.runTwitterEnrichmentCore,
    {
      profile,
      extendedBio: profileResult.extendedBio,
      evidencePosts: workflowSafeEvidence,
      icps,
      workspaceName,
    }
  );
  const finalResult = rehydrateEnrichmentResultEvidence(
    enrichmentResult,
    allPosts
  );
  if (!forcePartial || finalResult.enrichmentStatus === "failed") {
    return { result: finalResult, evidencePosts: allPosts };
  }
  const partialResult: EnrichmentResult = {
    ...finalResult,
    enrichmentStatus: "partial",
    finance: undefined,
  };
  return { result: partialResult, evidencePosts: allPosts };
}

/**
 * Enrich a LinkedIn prospect.
 * Fetches the profile first so downstream post queries use a profile URN.
 * LinkedIn enrichment is active, though LinkedIn still has narrower platform
 * coverage than X in other parts of the product.
 */
async function enrichLinkedInProspect(
  step: WorkflowCtx,
  params: {
    prospect: Record<string, unknown>;
    prospectData: Record<string, unknown>;
    qualificationEvidence: EvidencePost[];
    icps: ICP[];
    workspaceName: string;
  }
) {
  const { prospect, prospectData, qualificationEvidence, icps, workspaceName } =
    params;
  const workspaceLogContext = formatWorkspaceLogContext({ workspaceName });

  const { username, profileUrn } =
    resolveLinkedInProspectProfileIdentifiers(prospect);

  if (!username && !profileUrn) {
    // No identifier, use existing data only - use step.runAction for Node.js runtime
    const workflowSafeEvidence = toWorkflowSafeEvidencePosts(
      qualificationEvidence
    );
    const enrichmentResult: EnrichmentResult = await step.runAction(
      internal.workflows.enrichment.runLinkedInEnrichmentCore,
      {
        profile: prospectData,
        evidencePosts: workflowSafeEvidence,
        icps,
        workspaceName,
      }
    );
    return {
      result: rehydrateEnrichmentResultEvidence(
        enrichmentResult,
        qualificationEvidence
      ),
      evidencePosts: qualificationEvidence,
    };
  }

  const profileResult = await step
    .runAction(internal.integrations.linkedin.getProfile.getProfile, {
      username,
      urn: profileUrn,
      includeContactInfo: true,
    })
    .catch((error: unknown) => {
      console.warn(
        `[Enrichment] ${workspaceLogContext} LinkedIn profile fetch failed:`,
        error instanceof Error ? error.message : "Unknown error"
      );
      return { success: false, profile: null, contactInfo: undefined };
    });

  const resolvedProfileUrn =
    normalizeLinkedInProfileQueryUrn(
      getStringProperty(
        profileResult.profile as Record<string, unknown> | undefined,
        "urn"
      )
    ) ?? profileUrn;

  const [financePostsResult, recentPostsResult] = resolvedProfileUrn
    ? await Promise.all([
        step
          .runAction(
            api.integrations.linkedin.searchUserPosts.searchUserPosts,
            {
              urn: resolvedProfileUrn,
              keywords: FINANCE_KEYWORDS,
              maxPosts: MAX_FINANCE_POSTS,
            }
          )
          .catch((error: unknown) => {
            console.warn(
              `[Enrichment] ${workspaceLogContext} LinkedIn finance search failed:`,
              error instanceof Error ? error.message : "Unknown error"
            );
            return { success: false, posts: [], matchedKeywords: [] };
          }),
        step
          .runAction(
            internal.integrations.linkedin.getProfilePosts
              .getProfilePostsInternal,
            {
              urn: resolvedProfileUrn,
              maxPosts: MAX_LINKEDIN_RECENT_POSTS,
            }
          )
          .catch((error: unknown) => {
            console.warn(
              `[Enrichment] ${workspaceLogContext} LinkedIn recent posts fetch failed:`,
              error instanceof Error ? error.message : "Unknown error"
            );
            return { posts: [], nextCursor: null };
          }),
      ])
    : [
        { success: false, posts: [], matchedKeywords: [] },
        { posts: [], nextCursor: null },
      ];

  // Convert finance posts to EvidencePost format
  const financePosts = convertToEvidencePosts(
    sanitizeProspectEvidencePostsForWorkflow(
      (financePostsResult.posts || []) as unknown as Array<
        Record<string, unknown>
      >,
      "linkedin"
    ),
    "linkedin"
  );

  const recentPosts = convertToEvidencePosts(
    sanitizeProspectEvidencePostsForWorkflow(
      (recentPostsResult.posts || []) as unknown as Array<
        Record<string, unknown>
      >,
      "linkedin"
    ),
    "linkedin"
  );

  // Merge and deduplicate all posts
  const allPosts = deduplicateEvidencePosts([
    ...qualificationEvidence,
    ...recentPosts,
    ...financePosts,
  ]);

  console.info(
    `[Enrichment] ${workspaceLogContext} LinkedIn evidence: ${qualificationEvidence.length} qualification + ${recentPosts.length} recent + ${financePosts.length} finance = ${allPosts.length} total`
  );

  // Fetch company data if this is a company profile
  let companyData: Record<string, unknown> | undefined;
  const sanitizedProfile =
    profileResult.success && profileResult.profile
      ? sanitizeLinkedInProfileForWorkflow(
          profileResult.profile as unknown as Record<string, unknown>
        )
      : undefined;
  const linkedinUrl = getStringProperty(sanitizedProfile, "linkedinUrl") || "";

  if (linkedinUrl.includes("/company/")) {
    try {
      const companyResult = await step.runAction(
        internal.integrations.linkedin.getCompany.getCompany,
        { name: username }
      );
      if (companyResult.success && companyResult.company) {
        companyData = sanitizeLinkedInCompanyDataForWorkflow(
          companyResult.company as unknown as Record<string, unknown>
        );
      }
    } catch {
      console.warn(
        `[Enrichment] ${workspaceLogContext} Company fetch failed for ${username}`
      );
    }
  }

  // Determine profile to use
  const profile =
    sanitizedProfile ?? sanitizeLinkedInProfileForWorkflow(prospectData);

  // Call enrichment via step.runAction for Node.js runtime (process.env support)
  const workflowSafeEvidence = toWorkflowSafeEvidencePosts(allPosts);
  const enrichmentResult: EnrichmentResult = await step.runAction(
    internal.workflows.enrichment.runLinkedInEnrichmentCore,
    {
      profile,
      contactInfo: sanitizeLinkedInContactInfoForWorkflow(
        profileResult.contactInfo as Record<string, unknown> | undefined
      ),
      companyData,
      evidencePosts: workflowSafeEvidence,
      icps,
      workspaceName,
    }
  );
  return {
    result: rehydrateEnrichmentResultEvidence(enrichmentResult, allPosts),
    evidencePosts: allPosts,
  };
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
    claimToken: v.optional(v.string()),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ workflowId: string }> => {
    const releaseClaim = async () => {
      if (!args.claimToken) {
        return;
      }

      await ctx.runAction(
        internal.prospects
          .replaceEnrichmentWorkflowIdIfMatchesWithRetryInternal,
        {
          prospectId: args.prospectId,
          expectedWorkflowId: args.claimToken,
        }
      );
    };

    if (args.claimToken) {
      const prospect = await ctx.runQuery(
        internal.prospects.getProspectInternal,
        {
          prospectId: args.prospectId,
        }
      );
      if (
        !prospect ||
        prospect.status === "archived" ||
        (!args.force && prospect.enrichmentStatus === "enriched") ||
        prospect.enrichmentWorkflowId !== args.claimToken
      ) {
        return { workflowId: "" };
      }
    }

    const limitState = await ctx.runQuery(
      internal.workflows.prospecting.checkProspectLimitInternal,
      {
        workspaceId: args.workspaceId,
      }
    );
    if (limitState.limitReached) {
      await ctx.runAction(
        internal.workspaces.reconcileWorkspaceCapacityStateInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
      await releaseClaim();
      return { workflowId: "" };
    }

    let wfId = "";
    try {
      wfId = String(
        await workflow.start(
          ctx,
          internal.workflows.enrichment.enrichmentWorkflow,
          {
            prospectId: args.prospectId,
            workspaceId: args.workspaceId,
            force: args.force,
          }
        )
      );
    } catch (error) {
      await releaseClaim();
      throw error;
    }

    if (args.claimToken) {
      await ctx.runAction(
        internal.prospects
          .replaceEnrichmentWorkflowIdIfMatchesWithRetryInternal,
        {
          prospectId: args.prospectId,
          expectedWorkflowId: args.claimToken,
          nextWorkflowId: wfId,
        }
      );
    }

    console.info(
      `[Enrichment] ${formatWorkspaceLogContext({ workspaceId: String(args.workspaceId) })} Started workflow ${wfId} for prospect ${args.prospectId}`
    );

    return { workflowId: wfId };
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
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ workId: string }> => {
    const limitState = await ctx.runQuery(
      internal.workflows.prospecting.checkProspectLimitInternal,
      {
        workspaceId: args.workspaceId,
      }
    );
    if (limitState.limitReached) {
      await ctx.runAction(
        internal.workspaces.reconcileWorkspaceCapacityStateInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
      return { workId: "" };
    }

    const claimToken = createEnrichmentClaimToken(String(args.prospectId));
    const claimResult = await ctx.runMutation(
      internal.prospects.claimEnrichmentWorkflowIdInternal,
      {
        prospectId: args.prospectId,
        workflowId: claimToken,
        allowPartial: true,
        force: args.force,
      }
    );
    if (!claimResult.claimed) {
      return { workId: "" };
    }

    try {
      const workId = await enrichmentPool.enqueueAction(
        ctx,
        internal.workflows.enrichment.runEnrichmentWorkflow,
        {
          prospectId: args.prospectId,
          workspaceId: args.workspaceId,
          claimToken,
          force: args.force,
        }
      );

      console.info(
        `[Enrichment] ${formatWorkspaceLogContext({ workspaceId: String(args.workspaceId) })} Enqueued workId ${workId} for prospect ${args.prospectId}`
      );

      return { workId: workId.toString() };
    } catch (error) {
      await ctx.runAction(
        internal.prospects
          .replaceEnrichmentWorkflowIdIfMatchesWithRetryInternal,
        {
          prospectId: args.prospectId,
          expectedWorkflowId: claimToken,
        }
      );
      throw error;
    }
  },
});

export const scheduleSetupPreviewEnrichmentInternal = internalAction({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    readyCount: number;
    qualifiedCount: number;
    pendingQualificationCount: number;
    inFlightEnrichmentCount: number;
    enqueuedCount: number;
    consideredCount: number;
  }> => {
    const session = await ctx.runQuery(internal.setupSessions.getByIdInternal, {
      sessionId: args.sessionId,
    });
    if (
      !session ||
      session.status !== "discovering_preview_prospects" ||
      session.targetWorkspaceId !== args.workspaceId
    ) {
      return {
        readyCount: 0,
        qualifiedCount: 0,
        pendingQualificationCount: 0,
        inFlightEnrichmentCount: 0,
        enqueuedCount: 0,
        consideredCount: 0,
      };
    }

    const orchestrationState = await ctx.runQuery(
      internal.setupSessions.getSetupPreviewOrchestrationStateInternal,
      {
        sessionId: args.sessionId,
      }
    );

    const candidateIds = orchestrationState.rankedQualifiedIds.slice(
      0,
      PREVIEW_BATCH_LIMITS.previewEnrichmentWindow
    );
    const remainingSlots = Math.max(
      0,
      PREVIEW_BATCH_LIMITS.readyTargetCount -
        (orchestrationState.readyCount +
          orchestrationState.inFlightEnrichmentCount)
    );

    if (candidateIds.length === 0 || remainingSlots === 0) {
      return {
        readyCount: orchestrationState.readyCount,
        qualifiedCount: orchestrationState.qualifiedCount,
        pendingQualificationCount: orchestrationState.pendingQualificationCount,
        inFlightEnrichmentCount: orchestrationState.inFlightEnrichmentCount,
        enqueuedCount: 0,
        consideredCount: candidateIds.length,
      };
    }

    const prospects = await Promise.all(
      candidateIds.map((prospectId: Id<"prospects">) =>
        ctx.runQuery(internal.prospects.getProspectInternal, {
          prospectId,
        })
      )
    );

    let enqueuedCount = 0;
    for (const prospect of prospects) {
      if (enqueuedCount >= remainingSlots || !prospect) {
        break;
      }

      if (
        prospect.workspaceId !== args.workspaceId ||
        prospect.setupSessionId !== args.sessionId ||
        prospect.status === "archived" ||
        prospect.qualificationStatus !== "qualified" ||
        prospect.enrichmentStatus === "partial" ||
        prospect.enrichmentStatus === "enriched" ||
        typeof prospect.enrichmentWorkflowId === "string"
      ) {
        continue;
      }

      const result = await ctx.runAction(
        internal.workflows.enrichment.startPreviewEnrichment,
        {
          prospectId: prospect._id,
          workspaceId: args.workspaceId,
        }
      );
      if (result.workId) {
        enqueuedCount += 1;
      }
    }

    console.info(
      `[Enrichment][Preview] ${formatWorkspaceLogContext({ workspaceId: String(args.workspaceId) })} scheduled preview enrichment window`,
      {
        sessionId: String(args.sessionId),
        readyCount: orchestrationState.readyCount,
        qualifiedCount: orchestrationState.qualifiedCount,
        pendingQualificationCount: orchestrationState.pendingQualificationCount,
        inFlightEnrichmentCount: orchestrationState.inFlightEnrichmentCount,
        consideredCount: candidateIds.length,
        enqueuedCount,
      }
    );

    return {
      readyCount: orchestrationState.readyCount,
      qualifiedCount: orchestrationState.qualifiedCount,
      pendingQualificationCount: orchestrationState.pendingQualificationCount,
      inFlightEnrichmentCount: orchestrationState.inFlightEnrichmentCount,
      enqueuedCount,
      consideredCount: candidateIds.length,
    };
  },
});

export const startPreviewEnrichment = internalAction({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args): Promise<{ workId: string }> => {
    const limitState = await ctx.runQuery(
      internal.workflows.prospecting.checkProspectLimitInternal,
      {
        workspaceId: args.workspaceId,
      }
    );
    if (limitState.limitReached) {
      await ctx.runAction(
        internal.workspaces.reconcileWorkspaceCapacityStateInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
      return { workId: "" };
    }

    const claimToken = createEnrichmentClaimToken(String(args.prospectId));
    const claimResult = await ctx.runMutation(
      internal.prospects.claimEnrichmentWorkflowIdInternal,
      {
        prospectId: args.prospectId,
        workflowId: claimToken,
        allowPartial: false,
      }
    );
    if (!claimResult.claimed) {
      return { workId: "" };
    }

    try {
      const workId = await previewEnrichmentPool.enqueueAction(
        ctx,
        internal.workflows.enrichment.runEnrichmentWorkflow,
        {
          prospectId: args.prospectId,
          workspaceId: args.workspaceId,
          claimToken,
        }
      );

      console.info(
        `[Enrichment][Preview] ${formatWorkspaceLogContext({ workspaceId: String(args.workspaceId) })} Enqueued workId ${workId} for prospect ${args.prospectId}`
      );

      return { workId: workId.toString() };
    } catch (error) {
      await ctx.runAction(
        internal.prospects
          .replaceEnrichmentWorkflowIdIfMatchesWithRetryInternal,
        {
          prospectId: args.prospectId,
          expectedWorkflowId: claimToken,
        }
      );
      throw error;
    }
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
