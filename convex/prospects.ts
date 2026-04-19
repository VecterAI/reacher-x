// convex/prospects.ts
// v4: Prospect management queries and mutations

import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./lib/functionBuilders";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { canAddProspects } from "./lib/planHelpers";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import {
  createProspectArgsValidator,
  prospectDiscoveryContextValidator,
  prospectDiscoverySourceValidator,
  updateProspectStatusArgsValidator,
  prospectPlatformValidator,
  prospectStatusValidator,
  qualificationStatusValidator,
  prospectTypeValidator,
  enrichmentStatusValidator,
  planGenerationStatusValidator,
  setupProspectOriginValidator,
} from "./validators";
import { internal } from "./_generated/api";
import { mapInternalIssueCodeToUserVisibleIssueState } from "./lib/onboardingNavigation";
import { deriveWorkspaceSystemStatus } from "./lib/workspaceSystem";
import { listWorkspaceProspectSummariesPage } from "./prospectSummaries";
import { getWorkspaceStatsSnapshot } from "./workspaceStats";
import {
  getOwnedProspect,
  getOwnedWorkspace,
  getUserByIdentity,
  requireOwnedProspect,
  requireOwnedWorkspace,
  requireUser,
} from "./lib/accessHelpers";
import { formatWorkspaceLogContext } from "./lib/logHelpers";
import { recordMemoryWorkflowEvent } from "./lib/memoryCore";
import { resumeOutreachPlansAfterUnarchiveCore } from "./lib/resumeOutreachAfterUnarchive";
import { AUTO_PLAN_GENERATION_THRESHOLD } from "./lib/outreachCore";
import {
  getTwitterPostId,
  summarizeTwitterPost,
} from "../shared/lib/twitter/contracts";
import { extractLinkedInUsername } from "../shared/lib/utils/url/socialProfiles";
import { upsertDiscoveryEdgeInDb } from "./lib/discoveryEdgesCore";

type ViewerCtx = QueryCtx | MutationCtx;
type ProspectDiscoveryContext = NonNullable<
  Doc<"prospects">["discoveryContext"]
>;

const WEBHOOK_SAVE_MAX_RETRIES = 8;
const WEBHOOK_SAVE_RETRY_BASE_MS = 40;
const WEBHOOK_SAVE_RETRY_MAX_MS = 1000;

async function getViewerUser(ctx: ViewerCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  return getUserByIdentity(ctx, identity);
}

async function requireViewerUser(ctx: ViewerCtx) {
  return requireUser(ctx, { notFoundMessage: "User not found" });
}

async function isActiveSetupPreviewProspect(
  ctx: MutationCtx,
  prospect: {
    origin?: "setup_preview" | "workspace_discovery" | "manual";
    setupSessionId?: Id<"workspaceSetupSessions">;
  }
) {
  if (prospect.origin !== "setup_preview") {
    return true;
  }
  if (!prospect.setupSessionId) {
    return false;
  }

  const session = await ctx.db.get(prospect.setupSessionId);
  if (!session || session.status === "discarded") {
    return false;
  }

  return true;
}

function getEmptyPaginatedResult<T>() {
  return {
    page: [] as T[],
    isDone: true,
    continueCursor: "",
  };
}

function isOccRetryableError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /Documents read from or written to .* changed while this mutation was being run/i.test(
      error.message
    )
  );
}

function getWebhookRetryDelayMs(attempt: number): number {
  const backoff = Math.min(
    WEBHOOK_SAVE_RETRY_MAX_MS,
    WEBHOOK_SAVE_RETRY_BASE_MS * 2 ** attempt
  );
  const jitter = Math.floor(Math.random() * WEBHOOK_SAVE_RETRY_BASE_MS);
  return backoff + jitter;
}

function mergeUniqueStrings(
  ...values: Array<Array<string | undefined> | undefined>
): string[] | undefined {
  const merged = Array.from(
    new Set(
      values
        .flatMap((value) => value ?? [])
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );

  return merged.length > 0 ? merged : undefined;
}

function getTwitterActorFields(data: unknown) {
  const record =
    data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const user =
    record?.user && typeof record.user === "object"
      ? (record.user as Record<string, unknown>)
      : null;
  const twitterUserId =
    typeof user?.id_str === "string"
      ? user.id_str
      : typeof user?.id === "number"
        ? String(user.id)
        : undefined;
  const twitterUsername =
    typeof user?.screen_name === "string" ? user.screen_name : undefined;

  return {
    twitterUserId,
    twitterUsername,
    profileUrl: twitterUsername
      ? `https://x.com/${twitterUsername}`
      : undefined,
  };
}

function buildTwitterSocialProfile(data: unknown) {
  const { twitterUserId, twitterUsername, profileUrl } =
    getTwitterActorFields(data);

  if (!twitterUsername || !profileUrl) {
    return undefined;
  }

  return {
    twitter: {
      username: twitterUsername,
      url: profileUrl,
      profileId: twitterUserId,
    },
  };
}

function getLinkedInActorFields(data: unknown) {
  const record =
    data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const author =
    record?.author && typeof record.author === "object"
      ? (record.author as Record<string, unknown>)
      : null;
  const linkedinUserUrn =
    typeof author?.urn === "string" && author.urn.trim().length > 0
      ? author.urn.trim()
      : undefined;
  const linkedinUsername =
    typeof author?.url === "string"
      ? extractLinkedInUsername(author.url)
      : undefined;
  const profileUrl =
    typeof author?.url === "string" && author.url.trim().length > 0
      ? author.url.trim()
      : linkedinUsername
        ? `https://www.linkedin.com/in/${linkedinUsername}`
        : undefined;

  return {
    linkedinUserUrn,
    linkedinUsername,
    profileUrl,
  };
}

function buildLinkedInSocialProfile(data: unknown) {
  const { linkedinUserUrn, linkedinUsername, profileUrl } =
    getLinkedInActorFields(data);

  if (!linkedinUsername || !profileUrl) {
    return undefined;
  }

  return {
    linkedin: {
      username: linkedinUsername,
      url: profileUrl,
      urn: linkedinUserUrn,
    },
  };
}

function mergeEvidencePosts(
  existing: unknown[] | undefined,
  nextPosts: unknown[]
): unknown[] | undefined {
  const merged = new Map<string, unknown>();

  for (const post of [...(existing ?? []), ...nextPosts]) {
    const postId = getTwitterPostId(post) ?? JSON.stringify(post);
    if (!merged.has(postId)) {
      merged.set(postId, post);
    }
  }

  return merged.size > 0 ? Array.from(merged.values()) : undefined;
}

function mergeDiscoveryContext(
  existing: unknown,
  nextContext: unknown
): ProspectDiscoveryContext {
  const current =
    existing && typeof existing === "object"
      ? (existing as Record<string, unknown>)
      : {};
  const incoming =
    nextContext && typeof nextContext === "object"
      ? (nextContext as Record<string, unknown>)
      : {};

  return {
    ...current,
    ...incoming,
    matchedQueries: mergeUniqueStrings(
      Array.isArray(current.matchedQueries)
        ? (current.matchedQueries as Array<string | undefined>)
        : undefined,
      Array.isArray(incoming.matchedQueries)
        ? (incoming.matchedQueries as Array<string | undefined>)
        : undefined
    ),
    matchedReason:
      (incoming.matchedReason as string | undefined) ??
      (current.matchedReason as string | undefined),
    discoverySnippet:
      (incoming.discoverySnippet as string | undefined) ??
      (current.discoverySnippet as string | undefined),
  } as ProspectDiscoveryContext;
}

function buildSearchProspectNode(args: {
  prospectId: Id<"prospects">;
  externalId: string;
  platform: "twitter" | "linkedin";
  twitterUserId?: string;
  linkedinUserUrn?: string;
  data: unknown;
}) {
  const twitterActor = getTwitterActorFields(args.data);
  const linkedinActor = getLinkedInActorFields(args.data);
  const tweetSummary =
    args.platform === "twitter" ? summarizeTwitterPost(args.data) : undefined;
  const label =
    args.platform === "twitter"
      ? twitterActor.twitterUsername
        ? `@${twitterActor.twitterUsername}`
        : undefined
      : linkedinActor.linkedinUsername
        ? `@${linkedinActor.linkedinUsername}`
        : undefined;

  return {
    kind: "prospect" as const,
    platform: args.platform,
    internalId: String(args.prospectId),
    externalId:
      args.platform === "twitter"
        ? (args.twitterUserId ?? args.externalId)
        : (args.linkedinUserUrn ?? args.externalId),
    label,
    summary: tweetSummary?.textPreview,
  };
}

async function recordDirectSearchDiscoveryEdges(args: {
  ctx: MutationCtx;
  workspaceId: Id<"workspaces">;
  userId: Id<"users">;
  prospectId: Id<"prospects">;
  externalId: string;
  platform: "twitter" | "linkedin";
  twitterUserId?: string;
  linkedinUserUrn?: string;
  matchedQueries?: string[];
  data: unknown;
}) {
  const queries = (args.matchedQueries ?? []).slice(0, 5);
  if (queries.length === 0) {
    return;
  }

  for (const matchedQuery of queries) {
    await upsertDiscoveryEdgeInDb(args.ctx.db, {
      workspaceId: args.workspaceId,
      userId: args.userId,
      edgeType: "search_query_to_prospect",
      discoverySource: "search_post",
      sourceNode: {
        kind: "search_query",
        platform: args.platform,
        externalId: matchedQuery,
        label: matchedQuery,
        summary: matchedQuery,
      },
      targetNode: buildSearchProspectNode({
        prospectId: args.prospectId,
        externalId: args.externalId,
        platform: args.platform,
        twitterUserId: args.twitterUserId,
        linkedinUserUrn: args.linkedinUserUrn,
        data: args.data,
      }),
      context: {
        matchedQueries: [matchedQuery],
        matchedReason: `Matched search query: "${matchedQuery}"`,
        searchQuery: matchedQuery,
        rootTweetId:
          args.platform === "twitter" ? getTwitterPostId(args.data) : undefined,
        twitterUserId:
          args.platform === "twitter" ? args.twitterUserId : undefined,
      },
    });
  }
}

/**
 * Get prospect list-card summaries for a workspace.
 * Kept under the legacy function name for API compatibility.
 */
export const getWorkspaceProspects = query({
  args: {
    workspaceId: v.id("workspaces"),
    platform: v.optional(prospectPlatformValidator),
    status: v.optional(prospectStatusValidator),
    qualifiedOnly: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await getViewerUser(ctx);
    if (!user) return getEmptyPaginatedResult();

    const workspace = await getOwnedWorkspace(ctx, args.workspaceId, user._id);
    if (!workspace) {
      return getEmptyPaginatedResult();
    }

    return await listWorkspaceProspectSummariesPage(ctx.db, args);
  },
});

/**
 * Get a single prospect by ID
 */
export const getProspect = query({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, args) => {
    const user = await getViewerUser(ctx);
    if (!user) return null;

    return await getOwnedProspect(ctx, args.prospectId, user._id);
  },
});

/**
 * Get a single prospect by ID (internal, no auth check)
 * Used by qualifyProspectInternal and other internal actions that run without user context
 */
export const getProspectInternal = internalQuery({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.prospectId);
  },
});

export const getProspectByLinkedInUserUrnInternal = internalQuery({
  args: {
    userId: v.id("users"),
    linkedinUserUrn: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("prospects")
      .withIndex("by_user_platform_linkedin_user_urn", (q) =>
        q
          .eq("userId", args.userId)
          .eq("platform", "linkedin")
          .eq("linkedinUserUrn", args.linkedinUserUrn)
      )
      .first();
  },
});

export const getProspectByTwitterUserIdInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    twitterUserId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("prospects")
      .withIndex("by_workspace_platform_twitter_user_id", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("platform", "twitter")
          .eq("twitterUserId", args.twitterUserId)
      )
      .first();
  },
});

/**
 * Get prospect counts by status for a workspace
 */
export const getProspectCounts = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await getViewerUser(ctx);
    if (!user) return null;

    const workspace = await getOwnedWorkspace(ctx, args.workspaceId, user._id);
    if (!workspace) return null;

    const workspaceStats = await getWorkspaceStatsSnapshot({
      db: ctx.db,
      workspace,
    });

    return {
      total: workspaceStats.totalProspectsCount,
      new: workspaceStats.newProspectsCount,
      contacted: workspaceStats.contactedProspectsCount,
      in_progress: workspaceStats.inProgressProspectsCount,
      converted: workspaceStats.convertedProspectsCount,
      archived: workspaceStats.archivedProspectsCount,
      twitter: workspaceStats.twitterProspectsCount,
      linkedin: workspaceStats.linkedInProspectsCount,
    };
  },
});

/**
 * Check if workspace has any prospects (lightweight query for redirect logic)
 */
export const hasProspects = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await getViewerUser(ctx);
    if (!user) return false;

    const workspace = await getOwnedWorkspace(ctx, args.workspaceId, user._id);
    if (!workspace) return false;

    // Just check if at least one prospect exists (efficient single-row query)
    const prospect = await ctx.db
      .query("prospects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    return prospect !== null;
  },
});

/**
 * Real-time onboarding progress for a workspace pipeline.
 * Returns prospect counts by processing stage, current phase, and timer anchor.
 */
export const getOnboardingProgress = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await getViewerUser(ctx);
    if (!user) return null;

    const workspace = await getOwnedWorkspace(ctx, args.workspaceId, user._id);
    if (!workspace) return null;

    const workspaceStats = await getWorkspaceStatsSnapshot({
      db: ctx.db,
      workspace,
    });

    const qualified = workspaceStats.qualifiedProspectsCount;
    const enriched = workspaceStats.enrichedProspectsCount;
    const plansGenerated = workspaceStats.plansGeneratedCount;
    const readyQualifiedEnrichedCount =
      workspaceStats.readyQualifiedEnrichedCount;
    const found = workspaceStats.totalProspectsCount;
    const avgQualificationScore = workspaceStats.avgQualificationScore;

    const workflowStatus = workspace.prospectingWorkflowStatus ?? "stopped";
    const userVisibleIssueState = mapInternalIssueCodeToUserVisibleIssueState(
      workspace.onboardingIssueStatusCode
    );
    const systemStatus = deriveWorkspaceSystemStatus(workspace);
    const isDone = readyQualifiedEnrichedCount > 0;

    let phase: "searching" | "qualifying" | "enriching" | "planning" | "done";
    if (isDone) {
      phase = "done";
    } else if (plansGenerated > 0) {
      phase = "planning";
    } else if (enriched > 0) {
      phase = "enriching";
    } else if (qualified > 0) {
      phase = "qualifying";
    } else {
      phase = "searching";
    }

    return {
      found,
      qualified,
      enriched,
      plansGenerated,
      avgQualificationScore,
      readyQualifiedEnrichedCount,
      workflowStatus,
      pauseReason: systemStatus.pauseReason,
      isResumable: systemStatus.canResume,
      systemMode: systemStatus.mode,
      userVisibleIssueState,
      pipelineStartedAt: workspace.prospectingWorkflowStartedAt ?? null,
      phase,
      isDone,
    };
  },
});

/**
 * Create a new prospect (with plan limit check)
 */
export const createProspect = mutation({
  args: createProspectArgsValidator,
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Workspace not found",
    });

    // Check plan limits
    const canAdd = await canAddProspects(ctx, user._id, 1);
    if (!canAdd.allowed) {
      throw new Error(canAdd.reason ?? "Prospect limit reached");
    }

    // Check for duplicate
    const existing = await ctx.db
      .query("prospects")
      .withIndex("by_external_id", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("platform", args.platform)
          .eq("externalId", args.externalId)
      )
      .first();

    if (existing) {
      // Update existing prospect with new data
      await ctx.db.patch(existing._id, {
        data: args.data,
        matchReason: args.matchReason ?? existing.matchReason,
        matchedKeywords: args.matchedKeywords ?? existing.matchedKeywords,
        updatedAt: getCurrentUTCTimestamp(),
      });
      return existing._id;
    }

    const prospectId = await ctx.db.insert("prospects", {
      workspaceId: args.workspaceId,
      userId: user._id,
      platform: args.platform,
      origin: "manual",
      externalId: args.externalId,
      data: args.data,
      matchReason: args.matchReason,
      matchedKeywords: args.matchedKeywords,
      status: "new",
      updatedAt: getCurrentUTCTimestamp(),
    });

    return prospectId;
  },
});

/**
 * Create multiple prospects in batch (internal, for agent use)
 */
export const createProspectsBatch = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    prospects: v.array(
      v.object({
        platform: prospectPlatformValidator,
        origin: v.optional(setupProspectOriginValidator),
        setupSessionId: v.optional(v.id("workspaceSetupSessions")),
        setupRevision: v.optional(v.number()),
        externalId: v.string(),
        data: v.any(),
        matchReason: v.optional(v.string()),
        matchedKeywords: v.optional(v.array(v.string())),
        discoverySource: v.optional(prospectDiscoverySourceValidator),
        discoveryContext: v.optional(prospectDiscoveryContextValidator),
        qualificationScore: v.optional(v.number()),
        qualificationStatus: v.optional(qualificationStatusValidator),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = getCurrentUTCTimestamp();
    let created = 0;
    let updated = 0;
    const workspace = await ctx.db.get(args.workspaceId);
    const canCreateNewProspects =
      workspace?.prospectingWorkflowStatus !== "limit_reached" &&
      (await canAddProspects(ctx, args.userId, 1)).allowed;

    if (!canCreateNewProspects) {
      await ctx.scheduler.runAfter(
        0,
        internal.workspaces.reconcileWorkspaceCapacityStateInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
    }

    for (const p of args.prospects) {
      const twitterActor =
        p.platform === "twitter"
          ? getTwitterActorFields(p.data)
          : { twitterUserId: undefined };
      const linkedinActor =
        p.platform === "linkedin"
          ? getLinkedInActorFields(p.data)
          : { linkedinUserUrn: undefined };
      const existingByTwitterUserId =
        p.platform === "twitter" && twitterActor.twitterUserId
          ? await ctx.db
              .query("prospects")
              .withIndex("by_workspace_platform_twitter_user_id", (q) =>
                q
                  .eq("workspaceId", args.workspaceId)
                  .eq("platform", "twitter")
                  .eq("twitterUserId", twitterActor.twitterUserId)
              )
              .first()
          : null;
      const existingByLinkedInUrn =
        p.platform === "linkedin" && linkedinActor.linkedinUserUrn
          ? await ctx.db
              .query("prospects")
              .withIndex("by_workspace_platform_linkedin_user_urn", (q) =>
                q
                  .eq("workspaceId", args.workspaceId)
                  .eq("platform", "linkedin")
                  .eq("linkedinUserUrn", linkedinActor.linkedinUserUrn)
              )
              .first()
          : null;
      const existingByExternalId = await ctx.db
        .query("prospects")
        .withIndex("by_external_id", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("platform", p.platform)
            .eq("externalId", p.externalId)
        )
        .first();
      const existing =
        existingByTwitterUserId ??
        existingByLinkedInUrn ??
        existingByExternalId;

      if (existing) {
        await ctx.db.patch(existing._id, {
          data: p.data,
          origin: p.origin ?? existing.origin,
          setupSessionId: p.setupSessionId ?? existing.setupSessionId,
          setupRevision: p.setupRevision ?? existing.setupRevision,
          matchReason: p.matchReason ?? existing.matchReason,
          matchedKeywords: mergeUniqueStrings(
            existing.matchedKeywords,
            p.matchedKeywords
          ),
          twitterUserId: twitterActor.twitterUserId ?? existing.twitterUserId,
          linkedinUserUrn:
            linkedinActor.linkedinUserUrn ?? existing.linkedinUserUrn,
          discoverySource:
            p.discoverySource ??
            existing.discoverySource ??
            (p.platform === "twitter" ? "search_post" : undefined),
          discoveryContext:
            p.discoveryContext !== undefined
              ? mergeDiscoveryContext(
                  existing.discoveryContext,
                  p.discoveryContext
                )
              : existing.discoveryContext,
          socialProfiles:
            p.platform === "twitter"
              ? {
                  ...existing.socialProfiles,
                  ...buildTwitterSocialProfile(p.data),
                }
              : p.platform === "linkedin"
                ? {
                    ...existing.socialProfiles,
                    ...buildLinkedInSocialProfile(p.data),
                  }
                : existing.socialProfiles,
          qualificationScore:
            p.qualificationScore ?? existing.qualificationScore,
          qualificationStatus:
            p.qualificationStatus ?? existing.qualificationStatus,
          evidencePosts:
            p.platform === "twitter"
              ? mergeEvidencePosts(existing.evidencePosts, [p.data])
              : existing.evidencePosts,
          updatedAt: now,
        });
        if (p.platform === "twitter" || p.platform === "linkedin") {
          await recordDirectSearchDiscoveryEdges({
            ctx,
            workspaceId: args.workspaceId,
            userId: args.userId,
            prospectId: existing._id,
            externalId: existing.externalId,
            platform: p.platform,
            twitterUserId: twitterActor.twitterUserId ?? existing.twitterUserId,
            linkedinUserUrn:
              linkedinActor.linkedinUserUrn ?? existing.linkedinUserUrn,
            matchedQueries: p.matchedKeywords,
            data: p.data,
          });
        }
        updated++;
      } else {
        if (!canCreateNewProspects) {
          continue;
        }
        const prospectId = await ctx.db.insert("prospects", {
          workspaceId: args.workspaceId,
          userId: args.userId,
          platform: p.platform,
          origin: p.origin ?? "workspace_discovery",
          setupSessionId: p.setupSessionId,
          setupRevision: p.setupRevision,
          externalId: p.externalId,
          data: p.data,
          matchReason: p.matchReason,
          matchedKeywords: p.matchedKeywords,
          twitterUserId: twitterActor.twitterUserId,
          linkedinUserUrn: linkedinActor.linkedinUserUrn,
          discoverySource:
            p.discoverySource ??
            (p.platform === "twitter" ? "search_post" : undefined),
          discoveryContext: p.discoveryContext,
          status: "new",
          qualificationStatus: p.qualificationStatus ?? "pending",
          qualificationScore: p.qualificationScore,
          socialProfiles:
            p.platform === "twitter"
              ? buildTwitterSocialProfile(p.data)
              : p.platform === "linkedin"
                ? buildLinkedInSocialProfile(p.data)
                : undefined,
          evidencePosts: p.platform === "twitter" ? [p.data] : undefined,
          updatedAt: now,
        });
        created++;

        if (p.platform === "twitter" || p.platform === "linkedin") {
          await recordDirectSearchDiscoveryEdges({
            ctx,
            workspaceId: args.workspaceId,
            userId: args.userId,
            prospectId,
            externalId: p.externalId,
            platform: p.platform,
            twitterUserId: twitterActor.twitterUserId,
            linkedinUserUrn: linkedinActor.linkedinUserUrn,
            matchedQueries: p.matchedKeywords,
            data: p.data,
          });
        }

        await ctx.db.insert("prospectActivityLog", {
          prospectId,
          workspaceId: args.workspaceId,
          type: "found",
          title: "Prospect discovered",
          description: `Found via ${p.matchedKeywords?.[0] || "search"}`,
        });

        // Immediately start qualification workflow for this prospect (streaming)
        await ctx.scheduler.runAfter(
          0,
          internal.workflows.qualification.startQualification,
          {
            prospectId,
            workspaceId: args.workspaceId,
          }
        );
      }
    }

    // Note: Prospect counts are calculated on-demand from the prospects table
    // Qualification workflows are started immediately for each new prospect

    return { created, updated };
  },
});

/**
 * Update prospect status
 */
export const updateProspectStatus = mutation({
  args: updateProspectStatusArgsValidator,
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const prospect = await requireOwnedProspect(ctx, args.prospectId, {
      user,
      notFoundMessage: "Prospect not found",
      notAuthorizedMessage: "Prospect not found",
    });

    if (
      prospect.status === "archived" &&
      args.status !== "archived" &&
      args.status !== "new"
    ) {
      throw new Error(
        "Unarchive this prospect before changing pipeline stage."
      );
    }

    const now = getCurrentUTCTimestamp();

    // Update stageTimestamps with the new status timestamp
    const newStageTimestamps = {
      ...prospect.stageTimestamps,
      [args.status]: now,
    };

    const updateData: {
      status: typeof args.status;
      pipelineStage: typeof args.status;
      stageTimestamps: typeof newStageTimestamps;
      updatedAt: number;
      notes?: string;
      tags?: string[];
    } = {
      status: args.status,
      pipelineStage: args.status,
      stageTimestamps: newStageTimestamps,
      updatedAt: now,
    };

    if (args.notes !== undefined) {
      updateData.notes = args.notes;
    }
    if (args.tags !== undefined) {
      updateData.tags = args.tags;
    }

    await ctx.db.patch(args.prospectId, updateData);

    if (prospect.status === "archived" && args.status !== "archived") {
      await resumeOutreachPlansAfterUnarchiveCore(ctx, args.prospectId);
    }

    if (args.status === "archived" && prospect.status !== "archived") {
      await ctx.db.insert("prospectActivityLog", {
        prospectId: args.prospectId,
        workspaceId: prospect.workspaceId,
        type: "archived",
        title: "Prospect archived",
        description: "This prospect was archived.",
      });
      await recordMemoryWorkflowEvent(ctx, {
        workspaceId: prospect.workspaceId,
        eventType: "prospect_archived",
        sourceType: "prospect",
        sourceId: String(args.prospectId),
        prospectId: args.prospectId,
        payload: {
          previousStatus: prospect.status,
          nextStatus: "archived",
        },
      });
      await ctx.scheduler.runAfter(
        0,
        internal.archivedProspectPause.pauseAutomationsForArchivedProspect,
        { prospectId: args.prospectId }
      );
    }

    if (args.status === "converted" && prospect.status !== "converted") {
      await recordMemoryWorkflowEvent(ctx, {
        workspaceId: prospect.workspaceId,
        eventType: "prospect_converted",
        sourceType: "prospect",
        sourceId: String(args.prospectId),
        prospectId: args.prospectId,
        payload: {
          previousStatus: prospect.status,
          nextStatus: "converted",
        },
      });
    }

    return { success: true };
  },
});

/**
 * Delete a prospect
 */
export const deleteProspect = mutation({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    await requireOwnedProspect(ctx, args.prospectId, {
      user,
      notFoundMessage: "Prospect not found",
      notAuthorizedMessage: "Prospect not found",
    });

    await ctx.db.delete(args.prospectId);

    return { success: true };
  },
});

/**
 * Archive multiple prospects
 */
export const archiveProspects = mutation({
  args: { prospectIds: v.array(v.id("prospects")) },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const now = getCurrentUTCTimestamp();
    let archived = 0;

    for (const id of args.prospectIds) {
      const prospect = await ctx.db.get(id);
      if (prospect && prospect.userId === user._id) {
        const wasArchived = prospect.status === "archived";
        await ctx.db.patch(id, { status: "archived", updatedAt: now });
        if (!wasArchived) {
          await ctx.db.insert("prospectActivityLog", {
            prospectId: id,
            workspaceId: prospect.workspaceId,
            type: "archived",
            title: "Prospect archived",
            description: "This prospect was archived.",
          });
          await recordMemoryWorkflowEvent(ctx, {
            workspaceId: prospect.workspaceId,
            eventType: "prospect_archived",
            sourceType: "prospect",
            sourceId: String(id),
            prospectId: id,
            payload: {
              previousStatus: prospect.status,
              nextStatus: "archived",
            },
          });
          await ctx.scheduler.runAfter(
            0,
            internal.archivedProspectPause.pauseAutomationsForArchivedProspect,
            { prospectId: id }
          );
        }
        archived++;
      }
    }

    return { archived };
  },
});

/**
 * Extract evidence post from webhook tweet data.
 * Preserves the FULL tweet object so UI components have access to user data.
 * This is critical for rendering Tweet headers and footers correctly.
 */
function extractEvidencePostFromWebhook(
  data: unknown,
  platform: "twitter" | "linkedin"
): unknown[] {
  const tweetData = data as Record<string, unknown>;
  const id = String(tweetData.id_str || tweetData.id || "");
  const text = ((tweetData.full_text || tweetData.text || "") as string).trim();

  if (!id || !text) {
    console.warn("[saveProspectFromWebhook] No tweet text found in data");
    return [];
  }

  // Return the FULL tweet data with platform tag for UI rendering
  return [{ ...tweetData, platform }];
}

/**
 * Save a prospect from SocialAPI webhook (internal, no auth context)
 * Called by HTTP handler when webhook receives a new tweet
 */
export const saveProspectFromWebhook = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    monitorId: v.string(),
    platform: prospectPlatformValidator,
    externalId: v.string(),
    data: v.any(),
    matchedQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = getCurrentUTCTimestamp();
    const workspace = await ctx.db.get(args.workspaceId);
    const twitterActor =
      args.platform === "twitter" ? getTwitterActorFields(args.data) : null;
    const linkedinActor =
      args.platform === "linkedin" ? getLinkedInActorFields(args.data) : null;

    const existingByTwitterUserId =
      args.platform === "twitter" && twitterActor?.twitterUserId
        ? await ctx.db
            .query("prospects")
            .withIndex("by_workspace_platform_twitter_user_id", (q) =>
              q
                .eq("workspaceId", args.workspaceId)
                .eq("platform", "twitter")
                .eq("twitterUserId", twitterActor.twitterUserId)
            )
            .first()
        : null;
    const existingByLinkedInUrn =
      args.platform === "linkedin" && linkedinActor?.linkedinUserUrn
        ? await ctx.db
            .query("prospects")
            .withIndex("by_workspace_platform_linkedin_user_urn", (q) =>
              q
                .eq("workspaceId", args.workspaceId)
                .eq("platform", "linkedin")
                .eq("linkedinUserUrn", linkedinActor.linkedinUserUrn!)
            )
            .first()
        : null;
    const existingByExternalId = await ctx.db
      .query("prospects")
      .withIndex("by_external_id", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("platform", args.platform)
          .eq("externalId", args.externalId)
      )
      .first();
    const existing =
      existingByTwitterUserId ?? existingByLinkedInUrn ?? existingByExternalId;

    if (existing) {
      // Update existing prospect with new data
      await ctx.db.patch(existing._id, {
        data: args.data,
        matchedKeywords: mergeUniqueStrings(existing.matchedKeywords, [
          args.matchedQuery,
        ]),
        twitterUserId: twitterActor?.twitterUserId ?? existing.twitterUserId,
        linkedinUserUrn:
          linkedinActor?.linkedinUserUrn ?? existing.linkedinUserUrn,
        discoverySource:
          existing.discoverySource ??
          (args.platform === "twitter" ? "search_post" : undefined),
        discoveryContext:
          args.platform === "twitter"
            ? mergeDiscoveryContext(existing.discoveryContext, {
                matchedQueries: args.matchedQuery
                  ? [args.matchedQuery]
                  : undefined,
                matchedReason: args.matchedQuery
                  ? `Matched search query: "${args.matchedQuery}"`
                  : undefined,
                discoverySnippet:
                  summarizeTwitterPost(args.data)?.textPreview ?? undefined,
                replyPostRef: undefined,
                replyPostSummary: undefined,
              })
            : existing.discoveryContext,
        socialProfiles:
          args.platform === "twitter"
            ? {
                ...existing.socialProfiles,
                ...buildTwitterSocialProfile(args.data),
              }
            : args.platform === "linkedin"
              ? {
                  ...existing.socialProfiles,
                  ...buildLinkedInSocialProfile(args.data),
                }
              : existing.socialProfiles,
        evidencePosts:
          args.platform === "twitter"
            ? mergeEvidencePosts(existing.evidencePosts, [args.data])
            : existing.evidencePosts,
        updatedAt: now,
      });
      if (args.matchedQuery) {
        await recordDirectSearchDiscoveryEdges({
          ctx,
          workspaceId: args.workspaceId,
          userId: args.userId,
          prospectId: existing._id,
          externalId: existing.externalId,
          platform: args.platform,
          twitterUserId: twitterActor?.twitterUserId ?? existing.twitterUserId,
          linkedinUserUrn:
            linkedinActor?.linkedinUserUrn ?? existing.linkedinUserUrn,
          matchedQueries: [args.matchedQuery],
          data: args.data,
        });
      }
      return { created: false, prospectId: existing._id };
    }

    const canCreateNewProspect =
      workspace?.prospectingWorkflowStatus !== "limit_reached" &&
      (await canAddProspects(ctx, args.userId, 1)).allowed;

    if (!canCreateNewProspect) {
      await ctx.scheduler.runAfter(
        0,
        internal.workspaces.reconcileWorkspaceCapacityStateInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
      return {
        created: false,
        skipped: true,
        reason: "Prospect limit reached",
      };
    }

    // Create new prospect with evidence posts extracted from webhook data
    const evidencePosts = extractEvidencePostFromWebhook(
      args.data,
      args.platform
    );
    console.info(
      `[saveProspectFromWebhook] ${formatWorkspaceLogContext({ workspaceId: String(args.workspaceId) })} Evidence posts extracted:`,
      evidencePosts.length
    );

    const prospectId = await ctx.db.insert("prospects", {
      workspaceId: args.workspaceId,
      userId: args.userId,
      platform: args.platform,
      origin: "workspace_discovery",
      externalId: args.externalId,
      data: args.data,
      evidencePosts: evidencePosts.length > 0 ? evidencePosts : undefined,
      matchedKeywords: args.matchedQuery ? [args.matchedQuery] : undefined,
      twitterUserId: twitterActor?.twitterUserId,
      linkedinUserUrn: linkedinActor?.linkedinUserUrn,
      discoverySource: args.platform === "twitter" ? "search_post" : undefined,
      discoveryContext:
        args.platform === "twitter"
          ? {
              matchedQueries: args.matchedQuery
                ? [args.matchedQuery]
                : undefined,
              matchedReason: args.matchedQuery
                ? `Matched search query: "${args.matchedQuery}"`
                : undefined,
              discoverySnippet:
                summarizeTwitterPost(args.data)?.textPreview ?? undefined,
            }
          : undefined,
      socialProfiles:
        args.platform === "twitter"
          ? buildTwitterSocialProfile(args.data)
          : args.platform === "linkedin"
            ? buildLinkedInSocialProfile(args.data)
            : undefined,
      matchReason: args.matchedQuery
        ? `Matched search query: "${args.matchedQuery}"`
        : undefined,
      status: "new",
      qualificationStatus: "pending",
      updatedAt: now,
    });

    if (args.matchedQuery) {
      await recordDirectSearchDiscoveryEdges({
        ctx,
        workspaceId: args.workspaceId,
        userId: args.userId,
        prospectId,
        externalId: args.externalId,
        platform: args.platform,
        twitterUserId: twitterActor?.twitterUserId,
        linkedinUserUrn: linkedinActor?.linkedinUserUrn,
        matchedQueries: [args.matchedQuery],
        data: args.data,
      });
    }

    // Note: Prospect counts are calculated on-demand
    // Monitor stats removed to avoid OCC race conditions

    await ctx.db.insert("prospectActivityLog", {
      prospectId,
      workspaceId: args.workspaceId,
      type: "found",
      title: "Prospect discovered",
      description: `Found via ${args.matchedQuery || "monitor"}`,
    });

    // Immediately start qualification workflow for this prospect (streaming)
    await ctx.scheduler.runAfter(
      0,
      internal.workflows.qualification.startQualification,
      {
        prospectId,
        workspaceId: args.workspaceId,
      }
    );

    return { created: true, prospectId };
  },
});

export const saveProspectFromWebhookWithRetry = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    monitorId: v.string(),
    platform: prospectPlatformValidator,
    externalId: v.string(),
    data: v.any(),
    matchedQuery: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    created: boolean;
    prospectId?: Id<"prospects">;
    skipped?: boolean;
    reason?: string;
  }> => {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < WEBHOOK_SAVE_MAX_RETRIES; attempt += 1) {
      try {
        return await ctx.runMutation(
          internal.prospects.saveProspectFromWebhook,
          args
        );
      } catch (error) {
        lastError = error;
        if (
          !isOccRetryableError(error) ||
          attempt === WEBHOOK_SAVE_MAX_RETRIES - 1
        ) {
          throw error;
        }

        const delayMs = getWebhookRetryDelayMs(attempt);
        console.warn(
          `[saveProspectFromWebhookWithRetry] OCC retry ${attempt + 1}/${WEBHOOK_SAVE_MAX_RETRIES} for workspace ${args.workspaceId}; retrying in ${delayMs}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Failed to save webhook prospect after retries");
  },
});

export const saveReplyDerivedProspect = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    replyTweetId: v.string(),
    twitterUserId: v.string(),
    data: v.any(),
    matchReason: v.string(),
    matchedKeywords: v.optional(v.array(v.string())),
    discoveryContext: prospectDiscoveryContextValidator,
  },
  handler: async (ctx, args) => {
    const now = getCurrentUTCTimestamp();
    const existingByTwitterUserId = await ctx.db
      .query("prospects")
      .withIndex("by_workspace_platform_twitter_user_id", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("platform", "twitter")
          .eq("twitterUserId", args.twitterUserId)
      )
      .first();
    const existingByLegacyExternalId = await ctx.db
      .query("prospects")
      .withIndex("by_external_id", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("platform", "twitter")
          .eq("externalId", args.twitterUserId)
      )
      .first();
    const existing = existingByTwitterUserId ?? existingByLegacyExternalId;

    if (existing) {
      await ctx.db.patch(existing._id, {
        data: args.data,
        externalId: existing.externalId || args.replyTweetId,
        twitterUserId: args.twitterUserId,
        matchReason: args.matchReason,
        matchedKeywords: mergeUniqueStrings(
          existing.matchedKeywords,
          args.matchedKeywords
        ),
        discoverySource: "conversation_reply",
        discoveryContext: mergeDiscoveryContext(
          existing.discoveryContext,
          args.discoveryContext
        ),
        socialProfiles: {
          ...existing.socialProfiles,
          ...buildTwitterSocialProfile(args.data),
        },
        evidencePosts: mergeEvidencePosts(existing.evidencePosts, [args.data]),
        updatedAt: now,
      });

      return {
        created: false,
        mergedIntoExisting: true,
        prospectId: existing._id,
      };
    }

    const prospectId = await ctx.db.insert("prospects", {
      workspaceId: args.workspaceId,
      userId: args.userId,
      platform: "twitter",
      origin: "workspace_discovery",
      externalId: args.replyTweetId,
      data: args.data,
      evidencePosts: [args.data],
      matchedKeywords: args.matchedKeywords,
      matchReason: args.matchReason,
      status: "new",
      qualificationStatus: "pending",
      twitterUserId: args.twitterUserId,
      discoverySource: "conversation_reply",
      discoveryContext: args.discoveryContext,
      socialProfiles: buildTwitterSocialProfile(args.data),
      updatedAt: now,
    });

    await ctx.db.insert("prospectActivityLog", {
      prospectId,
      workspaceId: args.workspaceId,
      type: "found",
      title: "Prospect discovered from X reply",
      description: args.matchReason,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.workflows.qualification.startQualification,
      {
        prospectId,
        workspaceId: args.workspaceId,
      }
    );

    return {
      created: true,
      mergedIntoExisting: false,
      prospectId,
    };
  },
});

export const saveReplyDerivedProspectWithRetry = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    replyTweetId: v.string(),
    twitterUserId: v.string(),
    data: v.any(),
    matchReason: v.string(),
    matchedKeywords: v.optional(v.array(v.string())),
    discoveryContext: prospectDiscoveryContextValidator,
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    created: boolean;
    mergedIntoExisting: boolean;
    prospectId: Id<"prospects">;
  }> => {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < WEBHOOK_SAVE_MAX_RETRIES; attempt += 1) {
      try {
        const result: {
          created: boolean;
          mergedIntoExisting: boolean;
          prospectId: Id<"prospects">;
        } = await ctx.runMutation(
          internal.prospects.saveReplyDerivedProspect,
          args
        );

        if (!result.created) {
          const prospect = await ctx.runQuery(
            internal.prospects.getProspectInternal,
            {
              prospectId: result.prospectId,
            }
          );
          if (
            prospect &&
            prospect.status !== "archived" &&
            prospect.qualificationStatus !== "qualified"
          ) {
            await ctx.scheduler.runAfter(
              0,
              internal.workflows.qualification.startQualification,
              {
                prospectId: result.prospectId,
                workspaceId: args.workspaceId,
              }
            );
          }
        }

        return result;
      } catch (error) {
        lastError = error;
        if (
          !isOccRetryableError(error) ||
          attempt === WEBHOOK_SAVE_MAX_RETRIES - 1
        ) {
          throw error;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, getWebhookRetryDelayMs(attempt))
        );
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Failed to save reply-derived prospect after retries");
  },
});

/**
 * Update prospect qualification status and data (internal, for qualifyProspect tool)
 */
export const updateProspectQualification = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    qualificationStatus: qualificationStatusValidator,
    qualificationScore: v.number(),
    qualifiedAt: v.optional(v.number()),
    evidencePosts: v.optional(v.array(v.any())),
    qualificationKeywords: v.optional(v.array(v.string())),
    authenticity: v.optional(
      v.object({
        isLikelyBot: v.boolean(),
        accountAge: v.optional(v.number()),
        followersCount: v.optional(v.number()),
        followingCount: v.optional(v.number()),
        engagementRate: v.optional(v.number()),
        flags: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, args) => {
    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect) {
      return { success: true, skipped: true };
    }
    if (!(await isActiveSetupPreviewProspect(ctx, prospect))) {
      return { success: true, skipped: true };
    }

    await ctx.db.patch(args.prospectId, {
      qualificationStatus: args.qualificationStatus,
      qualificationScore: args.qualificationScore,
      qualifiedAt: args.qualifiedAt,
      evidencePosts: args.evidencePosts,
      qualificationKeywords: args.qualificationKeywords,
      authenticity: args.authenticity,
      updatedAt: getCurrentUTCTimestamp(),
    });

    if (args.qualificationStatus === "qualified") {
      await ctx.scheduler.runAfter(
        0,
        internal.workspaces.reconcileWorkspaceCapacityStateInternal,
        {
          workspaceId: prospect.workspaceId,
        }
      );
    }

    return { success: true, skipped: false };
  },
});

/**
 * Update prospect enrichment data (internal, for enrichment workflow)
 */
export const updateProspectEnrichment = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    prospectType: v.optional(prospectTypeValidator),
    displayName: v.optional(v.string()),
    title: v.optional(v.string()),
    briefIntro: v.optional(v.string()),
    company: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    location: v.optional(v.string()),
    pipelineStage: v.optional(prospectStatusValidator),
    finance: v.optional(
      v.object({
        displayValue: v.string(),
        type: v.optional(v.string()),
        amount: v.optional(v.number()),
        currency: v.optional(v.string()),
        evidencePosts: v.array(v.any()),
      })
    ),
    painPoints: v.optional(
      v.array(
        v.object({
          pain: v.string(),
          solution: v.optional(v.string()),
          evidencePosts: v.array(v.any()),
        })
      )
    ),
    socialProfiles: v.optional(
      v.object({
        twitter: v.optional(
          v.object({
            username: v.string(),
            url: v.string(),
            profileId: v.optional(v.string()),
          })
        ),
        linkedin: v.optional(
          v.object({
            username: v.string(),
            url: v.string(),
            urn: v.optional(v.string()),
          })
        ),
      })
    ),
    enrichedAt: v.optional(v.number()),
    enrichmentStatus: v.optional(enrichmentStatusValidator),
  },
  handler: async (ctx, args) => {
    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect) {
      return { success: true, skipped: true };
    }
    if (!(await isActiveSetupPreviewProspect(ctx, prospect))) {
      return { success: true, skipped: true };
    }

    // Build update object, only including defined fields
    const updateData: Record<string, unknown> = {
      updatedAt: getCurrentUTCTimestamp(),
    };

    if (args.prospectType !== undefined)
      updateData.prospectType = args.prospectType;
    if (args.displayName !== undefined)
      updateData.displayName = args.displayName;
    if (args.title !== undefined) updateData.title = args.title;
    if (args.briefIntro !== undefined) updateData.briefIntro = args.briefIntro;
    if (args.company !== undefined) updateData.company = args.company;
    if (args.websiteUrl !== undefined) updateData.websiteUrl = args.websiteUrl;
    if (args.email !== undefined) updateData.email = args.email;
    if (args.location !== undefined) updateData.location = args.location;
    if (args.pipelineStage !== undefined)
      updateData.pipelineStage = args.pipelineStage;
    if (args.finance !== undefined) updateData.finance = args.finance;
    if (args.painPoints !== undefined) updateData.painPoints = args.painPoints;
    if (args.socialProfiles !== undefined)
      updateData.socialProfiles = args.socialProfiles;
    if (args.enrichedAt !== undefined) updateData.enrichedAt = args.enrichedAt;
    if (args.enrichmentStatus !== undefined)
      updateData.enrichmentStatus = args.enrichmentStatus;

    await ctx.db.patch(args.prospectId, updateData);
    await ctx.runMutation(
      internal.setupSessions.syncSetupPreviewCandidatesInternal,
      {
        workspaceId: prospect.workspaceId,
      }
    );

    return { success: true, skipped: false };
  },
});

/** Persist active qualification durable workflow id for cancel-on-archive. */
export const setQualificationWorkflowId = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    workflowId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.prospectId, {
      qualificationWorkflowId: args.workflowId,
      updatedAt: getCurrentUTCTimestamp(),
    });
  },
});

export const clearQualificationWorkflowId = internalMutation({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.prospectId, {
      qualificationWorkflowId: undefined,
      updatedAt: getCurrentUTCTimestamp(),
    });
  },
});

export const setEnrichmentWorkflowId = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    workflowId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.prospectId, {
      enrichmentWorkflowId: args.workflowId,
      updatedAt: getCurrentUTCTimestamp(),
    });
  },
});

export const clearEnrichmentWorkflowId = internalMutation({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.prospectId, {
      enrichmentWorkflowId: undefined,
      updatedAt: getCurrentUTCTimestamp(),
    });
  },
});

/**
 * Update prospect plan generation status (internal, for auto outreach plan generation)
 * Called by enrichment workflow and outreach plan generation actions.
 */
export const updatePlanGenerationStatus = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    status: planGenerationStatusValidator,
  },
  handler: async (ctx, args) => {
    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect) {
      throw new Error("Prospect not found");
    }

    await ctx.db.patch(args.prospectId, {
      planGenerationStatus: args.status,
      updatedAt: getCurrentUTCTimestamp(),
    });

    console.info(
      `[Prospects] Updated planGenerationStatus for ${args.prospectId}: ${args.status}`
    );

    return { success: true };
  },
});

/**
 * List prospects in a workspace that qualify for automatic outreach plans.
 * Active plan existence is checked by the caller.
 */
export const listAutoPlanEligibleProspectsForWorkspace = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const prospects = await ctx.db
      .query("prospects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return prospects.filter(
      (prospect) =>
        prospect.status !== "archived" &&
        typeof prospect.qualificationScore === "number" &&
        prospect.qualificationScore >= AUTO_PLAN_GENERATION_THRESHOLD
    );
  },
});

export const listWorkspaceCapacityCandidatesInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("prospects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

// Note: getPendingQualificationProspects REMOVED
// Qualification now happens automatically per-prospect via streaming workflows
// triggered immediately when prospects are saved (see workflows/qualification.ts)

// Note: qualifyProspectInternal REMOVED (dead code)
// All qualification logic is now in lib/qualificationCore.ts
// Used by: workflows/qualification.ts, agents/tools/qualifyProspect.ts
