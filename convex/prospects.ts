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
  prospectVisibilityModeValidator,
  setupProspectOriginValidator,
  twitterUrlEntityValidator,
} from "./validators";
import { internal } from "./_generated/api";
import { mapInternalIssueCodeToUserVisibleIssueState } from "./lib/onboardingNavigation";
import {
  deriveWorkspaceSystemStatus,
  getWorkspaceDiscoveryState,
} from "./lib/workspaceSystem";
import { listWorkspaceProspectSummariesPage } from "./prospectSummaries";
import { getWorkspaceStatsSnapshot } from "./workspaceStats";
import { getWorkspaceStatsActionableReadyCount } from "./lib/readModelHelpers";
import { listWorkspaceAnalyticsDailyRows } from "./workspaceAnalyticsDaily";
import {
  getOwnedProspect,
  getOwnedWorkspace,
  getUserByIdentity,
  requireOwnedProspect,
  requireOwnedWorkspace,
  requireUser,
} from "./lib/accessHelpers";
import { recordMemoryWorkflowEvent } from "./lib/memoryCore";
import { resumeOutreachPlansAfterUnarchiveCore } from "./lib/resumeOutreachAfterUnarchive";
import {
  AUTO_PLAN_GENERATION_THRESHOLD,
  replaceProspectActivityOfType,
} from "./lib/outreachCore";
import { buildChangedPatchWithUpdatedAt } from "./lib/patchHelpers";
import { getProspectingRecoveryDelayMs } from "./lib/prospectingHelpers";
import {
  buildProspectAnalyticsBackfillPatch,
  buildProspectAnalyticsTransitionPatch,
  classifyQualificationActivityTitle,
} from "./lib/prospectAnalyticsCore";
import {
  getTwitterPostId,
  summarizeTwitterPost,
} from "../shared/lib/twitter/contracts";
import { extractLinkedInUsername } from "../shared/lib/utils/url/socialProfiles";
import { upsertDiscoveryEdgeInDb } from "./lib/discoveryEdgesCore";
import {
  applyQualifiedProspectUsageTransition,
  isProspectEligibleForQualifiedUsage,
} from "./lib/planUsageState";
import {
  getWorkflowEvidencePostId,
  sanitizeProspectDataForWorkflow,
  sanitizeProspectEvidencePostsForWorkflow,
} from "./lib/workflowSafeProspect";
import { logger } from "../shared/lib/logger";
import { hydrateTwitterProfileLinkMetadata } from "./lib/twitterProfileLinkResolver";
import {
  normalizeTwitterUrlEntities,
  type TwitterUrlEntity,
} from "../shared/lib/twitter/profileLinks";

type ViewerCtx = QueryCtx | MutationCtx;
type ProspectDiscoveryContext = NonNullable<
  Doc<"prospects">["discoveryContext"]
>;

const WEBHOOK_SAVE_MAX_RETRIES = 8;
const WEBHOOK_SAVE_RETRY_BASE_MS = 40;
const WEBHOOK_SAVE_RETRY_MAX_MS = 1000;
const prospectsLogger = logger.withScope("Prospects");
const TWITTER_LINK_BACKFILL_BATCH_SIZE = 25;

type TwitterLinkBackfillPatch = {
  prospectId: Id<"prospects">;
  websiteUrl?: string;
  websiteHref?: string;
  websiteDisplayText?: string;
  bioUrlEntities?: TwitterUrlEntity[];
};

type TwitterLinkBackfillPatchInput = Pick<
  TwitterLinkBackfillPatch,
  "prospectId" | "websiteUrl" | "websiteHref" | "websiteDisplayText"
> & {
  bioUrlEntities?: unknown;
};

type TwitterLinkBackfillPage = {
  page: Doc<"prospects">[];
  continueCursor: string;
  isDone: boolean;
};

type TwitterLinkBackfillPreview = {
  prospectId: Id<"prospects">;
  websiteHref?: string;
  websiteDisplayText?: string;
  bioUrlEntitiesCount: number;
};

type TwitterLinkBackfillRunResult = {
  scanned: number;
  twitterProspectsScanned: number;
  patched: number;
  isDone: boolean;
  continueCursor: string;
  failedProspectIds?: Id<"prospects">[];
  preview?: TwitterLinkBackfillPreview[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function areTwitterUrlEntitiesEqual(
  left: TwitterUrlEntity[] | undefined,
  right: TwitterUrlEntity[] | undefined
): boolean {
  const normalizedLeft = left ?? [];
  const normalizedRight = right ?? [];
  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((entity, index) => {
    const other = normalizedRight[index];
    return (
      entity.url === other.url &&
      entity.expanded_url === other.expanded_url &&
      entity.display_url === other.display_url &&
      entity.indices[0] === other.indices[0] &&
      entity.indices[1] === other.indices[1]
    );
  });
}

function hasTwitterLinkBackfillValues(
  patch: TwitterLinkBackfillPatch
): boolean {
  return Boolean(
    patch.websiteUrl ||
    patch.websiteHref ||
    patch.websiteDisplayText ||
    (patch.bioUrlEntities && patch.bioUrlEntities.length > 0)
  );
}

function wouldTwitterLinkPatchChangeProspect(
  prospect: Doc<"prospects">,
  patch: TwitterLinkBackfillPatch
): boolean {
  if (
    patch.websiteUrl !== undefined &&
    prospect.websiteUrl !== patch.websiteUrl
  ) {
    return true;
  }
  if (
    patch.websiteHref !== undefined &&
    prospect.websiteHref !== patch.websiteHref
  ) {
    return true;
  }
  if (
    patch.websiteDisplayText !== undefined &&
    prospect.websiteDisplayText !== patch.websiteDisplayText
  ) {
    return true;
  }
  if (
    patch.bioUrlEntities !== undefined &&
    !areTwitterUrlEntitiesEqual(
      normalizeTwitterUrlEntities(prospect.bioUrlEntities),
      patch.bioUrlEntities
    )
  ) {
    return true;
  }

  return false;
}

function getTwitterProfileRecordFromProspect(
  prospect: Doc<"prospects">
): Record<string, unknown> | null {
  const data = isRecord(prospect.data) ? prospect.data : null;
  if (!data) {
    return null;
  }

  const user = isRecord(data.user) ? data.user : null;
  if (user) {
    return user;
  }

  const author = isRecord(data.author) ? data.author : null;
  if (author) {
    return author;
  }

  return data;
}

function normalizeTwitterLinkBackfillPatch(
  patch: TwitterLinkBackfillPatchInput
): TwitterLinkBackfillPatch {
  return {
    prospectId: patch.prospectId,
    websiteUrl: asString(patch.websiteUrl),
    websiteHref: asString(patch.websiteHref),
    websiteDisplayText: asString(patch.websiteDisplayText),
    bioUrlEntities: normalizeTwitterUrlEntities(patch.bioUrlEntities),
  };
}

function deriveWorkspaceNextRunAt(workspace: Doc<"workspaces">): number | null {
  if (typeof workspace.prospectingNextRecoveryAt === "number") {
    return workspace.prospectingNextRecoveryAt;
  }

  if (typeof workspace.prospectingNextRunAt === "number") {
    return workspace.prospectingNextRunAt;
  }

  if (
    workspace.onboardingIssueStatusCode !== "workflow_failed" ||
    typeof workspace.prospectingLastFailureAt !== "number"
  ) {
    return null;
  }

  const failureStreak = Math.max(1, workspace.prospectingFailureStreak ?? 1);
  return (
    workspace.prospectingLastFailureAt +
    getProspectingRecoveryDelayMs({
      workspaceId: String(workspace._id),
      failureStreak,
    })
  );
}

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
    setupRevision?: number;
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

  if (
    prospect.setupRevision !== undefined &&
    session.previewRevision !== undefined &&
    prospect.setupRevision !== session.previewRevision
  ) {
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
    typeof record?.username === "string" && record.username.trim().length > 0
      ? record.username.trim()
      : typeof record?.url === "string"
        ? extractLinkedInUsername(record.url)
        : typeof author?.url === "string"
          ? extractLinkedInUsername(author.url)
          : undefined;
  const profileUrl =
    typeof record?.url === "string" && record.url.trim().length > 0
      ? record.url.trim()
      : typeof author?.url === "string" && author.url.trim().length > 0
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
    const postId =
      getTwitterPostId(post) ??
      (typeof post === "object" && post !== null
        ? getWorkflowEvidencePostId(post as Record<string, unknown>)
        : undefined) ??
      JSON.stringify(post);
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

async function patchProspectIfChanged(
  ctx: MutationCtx,
  prospect: Doc<"prospects">,
  next: Record<string, unknown>,
  updatedAt: number
) {
  const analyticsPatch = buildProspectAnalyticsTransitionPatch({
    prospect,
    patch: next as Parameters<
      typeof buildProspectAnalyticsTransitionPatch
    >[0]["patch"],
    now: updatedAt,
  });
  const patch = buildChangedPatchWithUpdatedAt(
    prospect as unknown as Record<string, unknown>,
    {
      ...next,
      ...analyticsPatch,
    },
    updatedAt
  );

  if (!patch) {
    return false;
  }

  await ctx.db.patch(prospect._id, patch);
  return true;
}

async function getProspectQualificationActivitySnapshot(
  ctx: MutationCtx,
  prospectId: Id<"prospects">
) {
  const activities = await ctx.db
    .query("prospectActivityLog")
    .withIndex("by_prospect_type", (q) =>
      q.eq("prospectId", prospectId).eq("type", "qualified")
    )
    .order("desc")
    .collect();

  let latestQualifiedAt: number | undefined;
  let latestDisqualifiedAt: number | undefined;

  for (const activity of activities) {
    const classification = classifyQualificationActivityTitle(activity.title);
    if (classification === "qualified" && latestQualifiedAt === undefined) {
      latestQualifiedAt = activity._creationTime;
    } else if (
      classification === "disqualified" &&
      latestDisqualifiedAt === undefined
    ) {
      latestDisqualifiedAt = activity._creationTime;
    }

    if (latestQualifiedAt !== undefined && latestDisqualifiedAt !== undefined) {
      break;
    }
  }

  return {
    latestQualifiedAt,
    latestDisqualifiedAt,
  };
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
  discoverySource?: "search_post" | "search_people" | "conversation_reply";
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
      discoverySource: args.discoverySource ?? "search_post",
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

export const recordDirectSearchDiscoveryEdgesInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    externalId: v.string(),
    platform: prospectPlatformValidator,
    twitterUserId: v.optional(v.string()),
    linkedinUserUrn: v.optional(v.string()),
    matchedQueries: v.array(v.string()),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    await recordDirectSearchDiscoveryEdges({
      ctx,
      workspaceId: args.workspaceId,
      userId: args.userId,
      prospectId: args.prospectId,
      externalId: args.externalId,
      platform: args.platform,
      twitterUserId: args.twitterUserId,
      linkedinUserUrn: args.linkedinUserUrn,
      matchedQueries: args.matchedQueries,
      data: args.data,
    });
  },
});

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
    visibilityMode: v.optional(prospectVisibilityModeValidator),
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

export const getProspectWorkflowDataInternal = internalQuery({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, args) => {
    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect) {
      return null;
    }

    return {
      _id: prospect._id,
      _creationTime: prospect._creationTime,
      workspaceId: prospect.workspaceId,
      userId: prospect.userId,
      platform: prospect.platform,
      origin: prospect.origin,
      setupSessionId: prospect.setupSessionId,
      setupRevision: prospect.setupRevision,
      displayName: prospect.displayName,
      title: prospect.title,
      briefIntro: prospect.briefIntro,
      status: prospect.status,
      qualificationStatus: prospect.qualificationStatus,
      qualificationScore: prospect.qualificationScore,
      enrichmentStatus: prospect.enrichmentStatus,
      matchedKeywords: prospect.matchedKeywords,
      finance: prospect.finance
        ? {
            displayValue: prospect.finance.displayValue,
          }
        : undefined,
      data: sanitizeProspectDataForWorkflow(prospect.data, prospect.platform),
      evidencePosts: sanitizeProspectEvidencePostsForWorkflow(
        Array.isArray(prospect.evidencePosts) ? prospect.evidencePosts : [],
        prospect.platform
      ),
    };
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

    const [workspaceStats, discoveryState, analyticsRows] = await Promise.all([
      getWorkspaceStatsSnapshot({
        db: ctx.db,
        workspace,
      }),
      getWorkspaceDiscoveryState(ctx.db, workspace),
      listWorkspaceAnalyticsDailyRows({
        db: ctx.db,
        workspaceId: workspace._id,
      }),
    ]);

    const qualified = workspaceStats.qualifiedProspectsCount;
    const readyQualifiedEnrichedCount =
      workspaceStats.readyQualifiedEnrichedCount;
    const enriched = readyQualifiedEnrichedCount;
    const plansGenerated = workspaceStats.plansGeneratedCount;
    const actionableReadyCount =
      getWorkspaceStatsActionableReadyCount(workspaceStats);
    const found = workspaceStats.totalProspectsCount;
    const avgQualificationScore = workspaceStats.avgQualificationScore;
    const disqualifiedCount = analyticsRows.reduce(
      (total, row) => total + (row.qualificationDisqualifiedCount ?? 0),
      0
    );
    const pendingCount = Math.max(found - qualified - disqualifiedCount, 0);
    const notReadyCount = Math.max(qualified - actionableReadyCount, 0);

    const workflowStatus = workspace.prospectingWorkflowStatus ?? "stopped";
    const userVisibleIssueState = mapInternalIssueCodeToUserVisibleIssueState(
      workspace.onboardingIssueStatusCode
    );
    const systemStatus = deriveWorkspaceSystemStatus(workspace, {
      discoveryState,
    });
    const isDone = actionableReadyCount > 0;

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
      actionableReadyCount,
      disqualifiedCount,
      pendingCount,
      notReadyCount,
      readyQualifiedEnrichedCount,
      workflowStatus,
      pauseReason: systemStatus.pauseReason,
      isResumable: systemStatus.canResume,
      systemMode: systemStatus.mode,
      userVisibleIssueState,
      pipelineStartedAt: workspace.prospectingWorkflowStartedAt ?? null,
      pausedAt: workspace.prospectingWorkflowPausedAt ?? null,
      nextRunAt: deriveWorkspaceNextRunAt(workspace),
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
    const canAdd = await canAddProspects(ctx, args.workspaceId, 1);
    if (!canAdd.allowed) {
      throw new Error(
        canAdd.reason ??
          "Qualified prospect limit reached for this workspace in the current cycle."
      );
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
    processingMode: v.optional(
      v.union(v.literal("normal"), v.literal("preview"))
    ),
    prospects: v.array(
      v.object({
        platform: prospectPlatformValidator,
        origin: v.optional(setupProspectOriginValidator),
        setupSessionId: v.optional(v.id("workspaceSetupSessions")),
        setupRevision: v.optional(v.number()),
        externalId: v.string(),
        data: v.any(),
        evidencePosts: v.optional(v.array(v.any())),
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
    const processingMode = args.processingMode ?? "normal";
    const now = getCurrentUTCTimestamp();
    let created = 0;
    let updated = 0;
    let shouldReconcileWorkspaceCapacity = false;
    const prospectIds: Id<"prospects">[] = [];
    const workspace = await ctx.db.get(args.workspaceId);
    const canCreateNewProspects =
      workspace?.prospectingWorkflowStatus !== "limit_reached" &&
      (await canAddProspects(ctx, args.workspaceId, 1)).allowed;

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
        const providedEvidencePosts = p.evidencePosts;
        const nextEvidencePosts =
          providedEvidencePosts !== undefined
            ? p.platform === "linkedin"
              ? sanitizeProspectEvidencePostsForWorkflow(
                  providedEvidencePosts,
                  "linkedin"
                )
              : providedEvidencePosts
            : p.discoverySource === "search_post"
              ? p.platform === "linkedin"
                ? sanitizeProspectEvidencePostsForWorkflow([p.data], "linkedin")
                : [p.data]
              : undefined;
        const shouldKeepExistingOrigin =
          processingMode === "preview" && existing.origin !== "setup_preview";
        const nextOrigin = shouldKeepExistingOrigin
          ? existing.origin
          : (p.origin ?? existing.origin);
        const nextSetupSessionId = p.setupSessionId ?? existing.setupSessionId;
        const nextSetupRevision = p.setupRevision ?? existing.setupRevision;
        const previousQualified = existing.qualificationStatus === "qualified";
        const previousUsageEligible =
          isProspectEligibleForQualifiedUsage(existing);
        const nextQualificationStatus =
          p.qualificationStatus ?? existing.qualificationStatus;
        const nextQualified = nextQualificationStatus === "qualified";
        const nextUsageEligible = isProspectEligibleForQualifiedUsage({
          origin: nextOrigin,
        });
        const nextQualifiedAt = nextQualified
          ? (existing.qualifiedAt ?? now)
          : p.qualificationStatus !== undefined
            ? undefined
            : existing.qualifiedAt;
        const didPatch = await patchProspectIfChanged(
          ctx,
          existing,
          {
            data: p.data,
            origin: nextOrigin,
            setupSessionId: nextSetupSessionId,
            setupRevision: nextSetupRevision,
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
            qualificationStatus: nextQualificationStatus,
            qualifiedAt: nextQualifiedAt,
            evidencePosts:
              nextEvidencePosts !== undefined
                ? mergeEvidencePosts(existing.evidencePosts, nextEvidencePosts)
                : existing.evidencePosts,
          },
          now
        );
        if (
          didPatch &&
          (previousQualified !== nextQualified ||
            existing.qualifiedAt !== nextQualifiedAt) &&
          (await isActiveSetupPreviewProspect(ctx, {
            origin: nextOrigin,
            setupSessionId: nextSetupSessionId,
            setupRevision: nextSetupRevision,
          }))
        ) {
          const usageTransition = await applyQualifiedProspectUsageTransition(
            ctx,
            {
              userId: existing.userId,
              previousQualified,
              previousQualifiedAt: existing.qualifiedAt,
              previousUsageEligible,
              nextQualified,
              nextQualifiedAt,
              nextUsageEligible,
            }
          );
          shouldReconcileWorkspaceCapacity ||= usageTransition.delta !== 0;
        }
        if (p.platform === "twitter" || p.platform === "linkedin") {
          await recordDirectSearchDiscoveryEdges({
            ctx,
            workspaceId: args.workspaceId,
            userId: args.userId,
            prospectId: existing._id,
            externalId: existing.externalId,
            platform: p.platform,
            discoverySource: p.discoverySource ?? "search_post",
            twitterUserId: twitterActor.twitterUserId ?? existing.twitterUserId,
            linkedinUserUrn:
              linkedinActor.linkedinUserUrn ?? existing.linkedinUserUrn,
            matchedQueries: p.matchedKeywords,
            data: p.data,
          });
        }
        prospectIds.push(existing._id);
        if (didPatch) {
          updated++;
        }
      } else {
        if (!canCreateNewProspects) {
          continue;
        }
        const nextEvidencePosts =
          p.evidencePosts !== undefined
            ? p.platform === "linkedin"
              ? sanitizeProspectEvidencePostsForWorkflow(
                  p.evidencePosts,
                  "linkedin"
                )
              : p.evidencePosts
            : p.discoverySource === "search_post"
              ? p.platform === "linkedin"
                ? sanitizeProspectEvidencePostsForWorkflow([p.data], "linkedin")
                : [p.data]
              : undefined;
        const initialQualificationStatus = p.qualificationStatus ?? "pending";
        const initialQualifiedAt =
          initialQualificationStatus === "qualified" ? now : undefined;
        const initialDisqualifiedAt =
          initialQualificationStatus === "disqualified" ? now : undefined;
        const initialOrigin = p.origin ?? "workspace_discovery";
        const initialUsageEligible = isProspectEligibleForQualifiedUsage({
          origin: initialOrigin,
        });
        const prospectId = await ctx.db.insert("prospects", {
          workspaceId: args.workspaceId,
          userId: args.userId,
          platform: p.platform,
          origin: initialOrigin,
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
          qualificationStatus: initialQualificationStatus,
          qualificationScore: p.qualificationScore,
          qualifiedAt: initialQualifiedAt,
          disqualifiedAt: initialDisqualifiedAt,
          socialProfiles:
            p.platform === "twitter"
              ? buildTwitterSocialProfile(p.data)
              : p.platform === "linkedin"
                ? buildLinkedInSocialProfile(p.data)
                : undefined,
          evidencePosts: nextEvidencePosts,
          updatedAt: now,
        });
        created++;
        if (
          initialQualificationStatus === "qualified" &&
          (await isActiveSetupPreviewProspect(ctx, {
            origin: initialOrigin,
            setupSessionId: p.setupSessionId,
            setupRevision: p.setupRevision,
          }))
        ) {
          const usageTransition = await applyQualifiedProspectUsageTransition(
            ctx,
            {
              userId: args.userId,
              previousQualified: false,
              previousQualifiedAt: undefined,
              previousUsageEligible: false,
              nextQualified: true,
              nextQualifiedAt: initialQualifiedAt,
              nextUsageEligible: initialUsageEligible,
            }
          );
          shouldReconcileWorkspaceCapacity ||= usageTransition.delta !== 0;
        }

        if (p.platform === "twitter" || p.platform === "linkedin") {
          await recordDirectSearchDiscoveryEdges({
            ctx,
            workspaceId: args.workspaceId,
            userId: args.userId,
            prospectId,
            externalId: p.externalId,
            platform: p.platform,
            discoverySource: p.discoverySource ?? "search_post",
            twitterUserId: twitterActor.twitterUserId,
            linkedinUserUrn: linkedinActor.linkedinUserUrn,
            matchedQueries: p.matchedKeywords,
            data: p.data,
          });
        }
        prospectIds.push(prospectId);

        await ctx.db.insert("prospectActivityLog", {
          prospectId,
          workspaceId: args.workspaceId,
          type: "found",
          title: "Prospect discovered",
          description: `Found via ${p.matchedKeywords?.[0] || "search"}`,
        });

        const qualificationStarter =
          processingMode === "preview"
            ? internal.workflows.qualification.startPreviewQualification
            : internal.workflows.qualification.startQualification;

        // Immediately start qualification workflow for this prospect (streaming)
        await ctx.scheduler.runAfter(0, qualificationStarter, {
          prospectId,
          workspaceId: args.workspaceId,
        });
      }
    }

    if (shouldReconcileWorkspaceCapacity) {
      await ctx.scheduler.runAfter(
        0,
        internal.workspaces.reconcileWorkspaceCapacityStateInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
    }

    // Qualification workflows are started immediately for each new prospect

    return { created, updated, prospectIds };
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
  if (platform === "linkedin") {
    return sanitizeProspectEvidencePostsForWorkflow([data], "linkedin");
  }

  const tweetData = data as Record<string, unknown>;
  const id = String(tweetData.id_str || tweetData.id || "");
  const text = ((tweetData.full_text || tweetData.text || "") as string).trim();

  if (!id || !text) {
    prospectsLogger.warn("No tweet text found in webhook data");
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

    let existing: Doc<"prospects"> | null = null;
    if (args.platform === "twitter" && twitterActor?.twitterUserId) {
      existing = await ctx.db
        .query("prospects")
        .withIndex("by_workspace_platform_twitter_user_id", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("platform", "twitter")
            .eq("twitterUserId", twitterActor.twitterUserId)
        )
        .first();
    }

    if (
      !existing &&
      args.platform === "linkedin" &&
      linkedinActor?.linkedinUserUrn
    ) {
      existing = await ctx.db
        .query("prospects")
        .withIndex("by_workspace_platform_linkedin_user_urn", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("platform", "linkedin")
            .eq("linkedinUserUrn", linkedinActor.linkedinUserUrn)
        )
        .first();
    }

    if (!existing) {
      existing = await ctx.db
        .query("prospects")
        .withIndex("by_external_id", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("platform", args.platform)
            .eq("externalId", args.externalId)
        )
        .first();
    }

    if (existing) {
      const evidencePosts = extractEvidencePostFromWebhook(
        args.data,
        args.platform
      );
      // Update existing prospect with new data
      await patchProspectIfChanged(
        ctx,
        existing,
        {
          data: args.data,
          matchedKeywords: mergeUniqueStrings(existing.matchedKeywords, [
            args.matchedQuery,
          ]),
          twitterUserId: twitterActor?.twitterUserId ?? existing.twitterUserId,
          linkedinUserUrn:
            linkedinActor?.linkedinUserUrn ?? existing.linkedinUserUrn,
          discoverySource: existing.discoverySource ?? "search_post",
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
            evidencePosts.length > 0
              ? mergeEvidencePosts(existing.evidencePosts, evidencePosts)
              : existing.evidencePosts,
        },
        now
      );
      return { created: false, prospectId: existing._id };
    }

    const canCreateNewProspect =
      workspace?.prospectingWorkflowStatus !== "limit_reached" &&
      (await canAddProspects(ctx, args.workspaceId, 1)).allowed;

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
        reason:
          "Qualified prospect limit reached for this workspace in the current cycle.",
      };
    }

    // Create new prospect with evidence posts extracted from webhook data
    const evidencePosts = extractEvidencePostFromWebhook(
      args.data,
      args.platform
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
      discoverySource: "search_post",
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
    const twitterActor =
      args.platform === "twitter" ? getTwitterActorFields(args.data) : null;
    const linkedinActor =
      args.platform === "linkedin" ? getLinkedInActorFields(args.data) : null;

    for (let attempt = 0; attempt < WEBHOOK_SAVE_MAX_RETRIES; attempt += 1) {
      try {
        const result = await ctx.runMutation(
          internal.prospects.saveProspectFromWebhook,
          args
        );

        if (args.matchedQuery && result.prospectId) {
          try {
            const prospect = await ctx.runQuery(
              internal.prospects.getProspectInternal,
              {
                prospectId: result.prospectId,
              }
            );

            if (prospect) {
              await ctx.runMutation(
                internal.prospects.recordDirectSearchDiscoveryEdgesInternal,
                {
                  workspaceId: args.workspaceId,
                  userId: args.userId,
                  prospectId: result.prospectId,
                  externalId: prospect.externalId,
                  platform: args.platform,
                  twitterUserId:
                    twitterActor?.twitterUserId ?? prospect.twitterUserId,
                  linkedinUserUrn:
                    linkedinActor?.linkedinUserUrn ?? prospect.linkedinUserUrn,
                  matchedQueries: [args.matchedQuery],
                  data: args.data,
                }
              );
            }
          } catch (error) {
            prospectsLogger.warn(
              "Failed to record search discovery edge",
              { workspaceId: String(args.workspaceId) },
              error instanceof Error ? error : new Error(String(error))
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

        const delayMs = getWebhookRetryDelayMs(attempt);
        prospectsLogger.warn(
          "Retrying webhook prospect save after OCC conflict",
          {
            workspaceId: String(args.workspaceId),
            attempt: attempt + 1,
            maxRetries: WEBHOOK_SAVE_MAX_RETRIES,
            delayMs,
          }
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
      await patchProspectIfChanged(
        ctx,
        existing,
        {
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
          evidencePosts: mergeEvidencePosts(existing.evidencePosts, [
            args.data,
          ]),
        },
        now
      );

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

    const previousQualified = prospect.qualificationStatus === "qualified";
    const nextQualified = args.qualificationStatus === "qualified";
    const usageEligible = isProspectEligibleForQualifiedUsage(prospect);
    const now = getCurrentUTCTimestamp();
    const analyticsPatch = buildProspectAnalyticsTransitionPatch({
      prospect,
      patch: {
        qualificationStatus: args.qualificationStatus,
        qualifiedAt: args.qualifiedAt,
        evidencePosts: args.evidencePosts,
      },
      now,
    });

    await ctx.db.patch(args.prospectId, {
      qualificationStatus: args.qualificationStatus,
      qualificationScore: args.qualificationScore,
      qualifiedAt: args.qualifiedAt,
      ...analyticsPatch,
      evidencePosts: args.evidencePosts,
      qualificationKeywords: args.qualificationKeywords,
      authenticity: args.authenticity,
      updatedAt: now,
    });

    const usageTransition = await applyQualifiedProspectUsageTransition(ctx, {
      userId: prospect.userId,
      previousQualified,
      previousQualifiedAt: prospect.qualifiedAt,
      previousUsageEligible: usageEligible,
      nextQualified,
      nextQualifiedAt: args.qualifiedAt,
      nextUsageEligible: usageEligible,
    });

    if (usageTransition.delta !== 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.workspaces.reconcileWorkspaceCapacityStateInternal,
        {
          workspaceId: prospect.workspaceId,
        }
      );
    }

    await ctx.runMutation(
      internal.setupSessions.syncSetupPreviewCandidatesInternal,
      {
        workspaceId: prospect.workspaceId,
      }
    );

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
    websiteHref: v.optional(v.string()),
    websiteDisplayText: v.optional(v.string()),
    bioUrlEntities: v.optional(v.array(twitterUrlEntityValidator)),
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
    evidencePosts: v.optional(v.array(v.any())),
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
    activityLogDescription: v.optional(v.string()),
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
    const now = getCurrentUTCTimestamp();
    const updateData: Record<string, unknown> = {
      updatedAt: now,
    };

    if (args.prospectType !== undefined)
      updateData.prospectType = args.prospectType;
    if (args.displayName !== undefined)
      updateData.displayName = args.displayName;
    if (args.title !== undefined) updateData.title = args.title;
    if (args.briefIntro !== undefined) updateData.briefIntro = args.briefIntro;
    if (args.company !== undefined) updateData.company = args.company;
    if (args.websiteUrl !== undefined) updateData.websiteUrl = args.websiteUrl;
    if (args.websiteHref !== undefined)
      updateData.websiteHref = args.websiteHref;
    if (args.websiteDisplayText !== undefined) {
      updateData.websiteDisplayText = args.websiteDisplayText;
    }
    if (args.bioUrlEntities !== undefined) {
      updateData.bioUrlEntities = args.bioUrlEntities;
    }
    if (args.email !== undefined) updateData.email = args.email;
    if (args.location !== undefined) updateData.location = args.location;
    if (args.pipelineStage !== undefined)
      updateData.pipelineStage = args.pipelineStage;
    if (args.finance !== undefined) updateData.finance = args.finance;
    if (args.painPoints !== undefined) updateData.painPoints = args.painPoints;
    if (args.evidencePosts !== undefined)
      updateData.evidencePosts = args.evidencePosts;
    if (args.socialProfiles !== undefined)
      updateData.socialProfiles = args.socialProfiles;
    if (args.enrichedAt !== undefined) updateData.enrichedAt = args.enrichedAt;
    if (args.enrichmentStatus !== undefined)
      updateData.enrichmentStatus = args.enrichmentStatus;

    const analyticsPatch = buildProspectAnalyticsTransitionPatch({
      prospect,
      patch: updateData as Parameters<
        typeof buildProspectAnalyticsTransitionPatch
      >[0]["patch"],
      now,
    });

    await ctx.db.patch(args.prospectId, {
      ...updateData,
      ...analyticsPatch,
    });

    if (args.enrichmentStatus && args.enrichmentStatus !== "failed") {
      await replaceProspectActivityOfType(ctx, {
        prospectId: args.prospectId,
        workspaceId: prospect.workspaceId,
        type: "enriched",
        title: "Profile enriched",
        description: args.activityLogDescription,
      });
    }

    await ctx.runMutation(
      internal.setupSessions.syncSetupPreviewCandidatesInternal,
      {
        workspaceId: prospect.workspaceId,
      }
    );

    return { success: true, skipped: false };
  },
});

export const listTwitterLinkBackfillPageInternal = internalQuery({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = Math.max(
      1,
      Math.min(100, args.batchSize ?? TWITTER_LINK_BACKFILL_BATCH_SIZE)
    );
    return await ctx.db.query("prospects").paginate({
      cursor: args.cursor ?? null,
      numItems: batchSize,
    });
  },
});

export const applyTwitterLinkBackfillPageInternal = internalMutation({
  args: {
    patches: v.array(
      v.object({
        prospectId: v.id("prospects"),
        websiteUrl: v.optional(v.string()),
        websiteHref: v.optional(v.string()),
        websiteDisplayText: v.optional(v.string()),
        bioUrlEntities: v.optional(v.array(twitterUrlEntityValidator)),
      })
    ),
  },
  handler: async (ctx, args) => {
    let patched = 0;
    const failedProspectIds: Id<"prospects">[] = [];

    for (const rawPatch of args.patches) {
      const patch = normalizeTwitterLinkBackfillPatch(rawPatch);
      const prospect = await ctx.db.get(patch.prospectId);
      if (!prospect || prospect.platform !== "twitter") {
        continue;
      }

      const nextBioUrlEntities = patch.bioUrlEntities;
      const currentBioUrlEntities = normalizeTwitterUrlEntities(
        prospect.bioUrlEntities
      );
      const nextWebsiteUrl = patch.websiteUrl;
      const nextWebsiteHref = patch.websiteHref;
      const nextWebsiteDisplayText = patch.websiteDisplayText;

      if (
        !hasTwitterLinkBackfillValues(patch) ||
        !wouldTwitterLinkPatchChangeProspect(prospect, {
          prospectId: patch.prospectId,
          websiteUrl: nextWebsiteUrl,
          websiteHref: nextWebsiteHref,
          websiteDisplayText: nextWebsiteDisplayText,
          bioUrlEntities: nextBioUrlEntities ?? currentBioUrlEntities,
        })
      ) {
        continue;
      }

      const updateData: Record<string, unknown> = {
        updatedAt: getCurrentUTCTimestamp(),
      };

      if (nextWebsiteUrl !== undefined) {
        updateData.websiteUrl = nextWebsiteUrl;
      }
      if (nextWebsiteHref !== undefined) {
        updateData.websiteHref = nextWebsiteHref;
      }
      if (nextWebsiteDisplayText !== undefined) {
        updateData.websiteDisplayText = nextWebsiteDisplayText;
      }
      if (nextBioUrlEntities !== undefined) {
        updateData.bioUrlEntities = nextBioUrlEntities;
      }

      try {
        await ctx.db.patch(prospect._id, updateData);
        patched += 1;
      } catch (error) {
        failedProspectIds.push(prospect._id);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.warn(
          `[Prospects] Skipping twitter link backfill for ${prospect._id}: ${errorMessage}`
        );
      }
    }

    return { failedProspectIds, patched };
  },
});

export const backfillTwitterLinkMetadataPageInternal = internalAction({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<TwitterLinkBackfillRunResult> => {
    const batchSize = Math.max(
      1,
      Math.min(100, args.batchSize ?? TWITTER_LINK_BACKFILL_BATCH_SIZE)
    );
    const dryRun = args.dryRun === true;
    const page = (await ctx.runQuery(
      internal.prospects.listTwitterLinkBackfillPageInternal,
      {
        cursor: args.cursor,
        batchSize,
      }
    )) as TwitterLinkBackfillPage;

    const patches: TwitterLinkBackfillPatch[] = [];
    let twitterProspectsScanned = 0;

    for (const prospect of page.page) {
      if (prospect.platform !== "twitter") {
        continue;
      }

      twitterProspectsScanned += 1;
      const profile = getTwitterProfileRecordFromProspect(prospect);
      if (!profile) {
        continue;
      }

      const hydrated = await hydrateTwitterProfileLinkMetadata(profile);
      const patch: TwitterLinkBackfillPatch = {
        prospectId: prospect._id,
        websiteUrl: hydrated.websiteHref,
        websiteHref: hydrated.websiteHref,
        websiteDisplayText: hydrated.websiteDisplayText,
        bioUrlEntities: hydrated.bioUrlEntities,
      };
      const normalizedPatch = normalizeTwitterLinkBackfillPatch(patch);
      if (
        !hasTwitterLinkBackfillValues(normalizedPatch) ||
        !wouldTwitterLinkPatchChangeProspect(prospect, normalizedPatch)
      ) {
        continue;
      }

      patches.push(normalizedPatch);
    }

    let failedProspectIds: Id<"prospects">[] | undefined;
    let appliedPatchedCount = patches.length;

    if (!dryRun && patches.length > 0) {
      const result = await ctx.runMutation(
        internal.prospects.applyTwitterLinkBackfillPageInternal,
        {
          patches,
        }
      );
      appliedPatchedCount = result.patched;
      failedProspectIds = result.failedProspectIds;
    }

    if (!dryRun && !page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.prospects.backfillTwitterLinkMetadataPageInternal,
        {
          cursor: page.continueCursor,
          batchSize,
        }
      );
    }

    return {
      scanned: page.page.length,
      twitterProspectsScanned,
      patched: appliedPatchedCount,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
      failedProspectIds:
        !dryRun && failedProspectIds && failedProspectIds.length > 0
          ? failedProspectIds
          : undefined,
      preview: dryRun
        ? patches.slice(0, 10).map((patch) => ({
            prospectId: patch.prospectId,
            websiteHref: patch.websiteHref,
            websiteDisplayText: patch.websiteDisplayText,
            bioUrlEntitiesCount: patch.bioUrlEntities?.length ?? 0,
          }))
        : undefined,
    };
  },
});

export const backfillProspectAnalyticsMilestonesPageInternal = internalMutation(
  {
    args: {
      workspaceId: v.id("workspaces"),
      cursor: v.optional(v.string()),
      batchSize: v.optional(v.number()),
      scheduleRebuildOnComplete: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
      const batchSize = Math.max(1, Math.min(50, args.batchSize ?? 25));
      const page = await ctx.db
        .query("prospects")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .paginate({
          cursor: args.cursor ?? null,
          numItems: batchSize,
        });

      let patched = 0;
      for (const prospect of page.page) {
        const needsQualificationSnapshot =
          prospect.qualificationStatus === "qualified" ||
          prospect.qualificationStatus === "disqualified";
        const qualificationActivity = needsQualificationSnapshot
          ? await getProspectQualificationActivitySnapshot(ctx, prospect._id)
          : undefined;
        const analyticsPatch = buildProspectAnalyticsBackfillPatch({
          prospect,
          qualificationActivity,
        });

        if (!analyticsPatch) {
          continue;
        }

        await ctx.db.patch(prospect._id, analyticsPatch);
        patched += 1;
      }

      if (!page.isDone) {
        await ctx.scheduler.runAfter(
          0,
          internal.prospects.backfillProspectAnalyticsMilestonesPageInternal,
          {
            workspaceId: args.workspaceId,
            cursor: page.continueCursor,
            batchSize,
            scheduleRebuildOnComplete: args.scheduleRebuildOnComplete,
          }
        );
      } else if (args.scheduleRebuildOnComplete !== false) {
        await ctx.scheduler.runAfter(
          0,
          internal.readModels.rebuildWorkspaceReadModelsInternal,
          {
            workspaceId: args.workspaceId,
          }
        );
      }

      return {
        workspaceId: args.workspaceId,
        patched,
        continueCursor: page.continueCursor,
        isDone: page.isDone,
        rebuildScheduled:
          page.isDone && args.scheduleRebuildOnComplete !== false,
      };
    },
  }
);

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

export const claimEnrichmentWorkflowIdInternal = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    workflowId: v.string(),
    allowPartial: v.boolean(),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect) {
      return { claimed: false as const, reason: "missing" as const };
    }
    if (!(await isActiveSetupPreviewProspect(ctx, prospect))) {
      return {
        claimed: false as const,
        reason: "inactive_preview" as const,
      };
    }
    if (prospect.status === "archived") {
      return { claimed: false as const, reason: "archived" as const };
    }
    if (prospect.qualificationStatus !== "qualified") {
      return { claimed: false as const, reason: "not_qualified" as const };
    }
    if (!args.force && prospect.enrichmentStatus === "enriched") {
      return { claimed: false as const, reason: "enriched" as const };
    }
    if (
      !args.force &&
      !args.allowPartial &&
      prospect.enrichmentStatus === "partial"
    ) {
      return { claimed: false as const, reason: "partial" as const };
    }
    if (typeof prospect.enrichmentWorkflowId === "string") {
      return { claimed: false as const, reason: "locked" as const };
    }

    await ctx.db.patch(args.prospectId, {
      enrichmentWorkflowId: args.workflowId,
      updatedAt: getCurrentUTCTimestamp(),
    });

    return { claimed: true as const, reason: undefined };
  },
});

export const repairLinkedInWorkspaceEvidenceInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    rerunEnrichment: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const now = getCurrentUTCTimestamp();
    const rerunEnrichment = args.rerunEnrichment ?? true;
    const prospects = await ctx.db
      .query("prospects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    let linkedInProspectsScanned = 0;
    let searchPostProspectsPatched = 0;
    let qualifiedProspectsScheduled = 0;

    for (const prospect of prospects) {
      if (prospect.platform !== "linkedin") {
        continue;
      }
      linkedInProspectsScanned += 1;

      if (prospect.discoverySource === "search_post") {
        const sanitizedEvidence = sanitizeProspectEvidencePostsForWorkflow(
          [prospect.data],
          "linkedin"
        );
        if (sanitizedEvidence.length > 0) {
          const didPatch = await patchProspectIfChanged(
            ctx,
            prospect,
            {
              evidencePosts: mergeEvidencePosts(
                prospect.evidencePosts,
                sanitizedEvidence
              ),
            },
            now
          );
          if (didPatch) {
            searchPostProspectsPatched += 1;
          }
        }
      }

      if (
        !rerunEnrichment ||
        prospect.status === "archived" ||
        prospect.qualificationStatus !== "qualified" ||
        !(await isActiveSetupPreviewProspect(ctx, prospect))
      ) {
        continue;
      }

      await ctx.scheduler.runAfter(
        0,
        internal.workflows.enrichment.runEnrichmentWorkflow,
        {
          prospectId: prospect._id,
          workspaceId: args.workspaceId,
          force: true,
        }
      );
      qualifiedProspectsScheduled += 1;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.readModels.rebuildWorkspaceReadModelsInternal,
      {
        workspaceId: args.workspaceId,
      }
    );

    return {
      workspaceId: args.workspaceId,
      linkedInProspectsScanned,
      searchPostProspectsPatched,
      qualifiedProspectsScheduled,
      readModelRebuildScheduled: true,
    };
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

export const replaceEnrichmentWorkflowIdIfMatchesInternal = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    expectedWorkflowId: v.string(),
    nextWorkflowId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const prospect = await ctx.db.get(args.prospectId);
    if (
      !prospect ||
      prospect.enrichmentWorkflowId !== args.expectedWorkflowId
    ) {
      return { updated: false as const };
    }

    await ctx.db.patch(args.prospectId, {
      enrichmentWorkflowId: args.nextWorkflowId,
      updatedAt: getCurrentUTCTimestamp(),
    });

    return { updated: true as const };
  },
});

export const replaceEnrichmentWorkflowIdIfMatchesWithRetryInternal =
  internalAction({
    args: {
      prospectId: v.id("prospects"),
      expectedWorkflowId: v.string(),
      nextWorkflowId: v.optional(v.string()),
    },
    handler: async (
      ctx,
      args
    ): Promise<{
      updated: boolean;
    }> => {
      let lastError: unknown = null;

      for (let attempt = 0; attempt < WEBHOOK_SAVE_MAX_RETRIES; attempt += 1) {
        try {
          return await ctx.runMutation(
            internal.prospects.replaceEnrichmentWorkflowIdIfMatchesInternal,
            args
          );
        } catch (error) {
          lastError = error;
          if (
            !isOccRetryableError(error) ||
            attempt === WEBHOOK_SAVE_MAX_RETRIES - 1
          ) {
            break;
          }

          await new Promise((resolve) =>
            setTimeout(resolve, getWebhookRetryDelayMs(attempt))
          );
        }
      }

      const prospect = await ctx.runQuery(
        internal.prospects.getProspectInternal,
        {
          prospectId: args.prospectId,
        }
      );
      if (
        !prospect ||
        prospect.enrichmentWorkflowId !== args.expectedWorkflowId
      ) {
        return { updated: false as const };
      }

      throw lastError instanceof Error
        ? lastError
        : new Error(
            "Failed to replace enrichment workflow id after repeated OCC conflicts"
          );
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

export const promoteSetupPreviewProspectsInternal = internalMutation({
  args: {
    sessionId: v.id("workspaceSetupSessions"),
    workspaceId: v.id("workspaces"),
    previewRevision: v.number(),
    approvedProspectIds: v.array(v.id("prospects")),
  },
  handler: async (ctx, args) => {
    const prospects = await ctx.db
      .query("prospects")
      .withIndex("by_setup_session_revision", (q) =>
        q
          .eq("setupSessionId", args.sessionId)
          .eq("setupRevision", args.previewRevision)
      )
      .collect();

    const approvedSet = new Set(args.approvedProspectIds);
    const now = getCurrentUTCTimestamp();
    let promoted = 0;
    let deleted = 0;
    let shouldReconcileWorkspaceCapacity = false;

    for (const prospect of prospects) {
      if (prospect.workspaceId !== args.workspaceId) {
        continue;
      }

      if (approvedSet.has(prospect._id)) {
        const rank = args.approvedProspectIds.indexOf(prospect._id);
        const usageTransition = await applyQualifiedProspectUsageTransition(
          ctx,
          {
            userId: prospect.userId,
            previousQualified: prospect.qualificationStatus === "qualified",
            previousQualifiedAt: prospect.qualifiedAt,
            previousUsageEligible:
              isProspectEligibleForQualifiedUsage(prospect),
            nextQualified: prospect.qualificationStatus === "qualified",
            nextQualifiedAt: prospect.qualifiedAt,
            nextUsageEligible: isProspectEligibleForQualifiedUsage({
              origin: "workspace_discovery",
            }),
          }
        );
        await ctx.db.patch(prospect._id, {
          origin: "workspace_discovery",
          setupSessionId: undefined,
          setupRevision: undefined,
          previewSelectedAt: prospect.previewSelectedAt ?? now,
          previewRank:
            prospect.previewRank ??
            (rank >= 0 ? rank + 1 : prospect.previewRank),
          updatedAt: now,
        });
        promoted += 1;
        shouldReconcileWorkspaceCapacity ||= usageTransition.delta !== 0;
        continue;
      }

      if (prospect.origin === "setup_preview") {
        await ctx.db.delete(prospect._id);
        deleted += 1;
      } else {
        await ctx.db.patch(prospect._id, {
          setupSessionId: undefined,
          setupRevision: undefined,
          updatedAt: now,
        });
      }
    }

    if (shouldReconcileWorkspaceCapacity) {
      await ctx.scheduler.runAfter(
        0,
        internal.workspaces.reconcileWorkspaceCapacityStateInternal,
        {
          workspaceId: args.workspaceId,
        }
      );
    }

    return { promoted, deleted };
  },
});

export const deletePreviewProspectsForSessionRevisionInternal =
  internalMutation({
    args: {
      sessionId: v.id("workspaceSetupSessions"),
      previewRevision: v.optional(v.number()),
      deleteOlderRevisions: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
      const prospects =
        args.previewRevision === undefined
          ? await ctx.db
              .query("prospects")
              .withIndex("by_setup_session", (q) =>
                q.eq("setupSessionId", args.sessionId)
              )
              .collect()
          : await ctx.db
              .query("prospects")
              .withIndex("by_setup_session", (q) =>
                q.eq("setupSessionId", args.sessionId)
              )
              .collect();

      let deleted = 0;
      for (const prospect of prospects) {
        if (prospect.origin !== "setup_preview") {
          continue;
        }

        const matchesExplicitRevision =
          args.previewRevision !== undefined &&
          prospect.setupRevision === args.previewRevision;
        const matchesOlderRevision =
          args.deleteOlderRevisions === true &&
          args.previewRevision !== undefined &&
          typeof prospect.setupRevision === "number" &&
          prospect.setupRevision < args.previewRevision;

        if (
          args.previewRevision === undefined ||
          matchesExplicitRevision ||
          matchesOlderRevision
        ) {
          if (prospect.origin === "setup_preview") {
            await ctx.db.delete(prospect._id);
            deleted += 1;
          } else {
            await ctx.db.patch(prospect._id, {
              setupSessionId: undefined,
              setupRevision: undefined,
              updatedAt: getCurrentUTCTimestamp(),
            });
          }
        }
      }

      return { deleted };
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
      .query("prospectSummaries")
      .withIndex("by_workspace_score", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .gte("sortQualificationScore", AUTO_PLAN_GENERATION_THRESHOLD)
      )
      .order("desc")
      .collect();

    const eligibleProspects = prospects
      .filter(
        (prospect) =>
          prospect.origin !== "setup_preview" &&
          prospect.status !== "archived" &&
          typeof prospect.qualificationScore === "number" &&
          prospect.qualificationScore >= AUTO_PLAN_GENERATION_THRESHOLD
      )
      .map((prospect) => ({
        _id: prospect.prospectId,
        userId: prospect.userId,
        planGenerationStatus: prospect.planGenerationStatus,
      }));

    return eligibleProspects;
  },
});

export const listWorkspaceCapacityCandidatesInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const summaries = await ctx.db
      .query("prospectSummaries")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const candidateIds = summaries
      .filter(
        (prospect) =>
          prospect.origin !== "setup_preview" &&
          (prospect.planGenerationStatus === "generating" ||
            prospect.qualificationStatus !== "qualified" ||
            prospect.enrichmentStatus !== "enriched")
      )
      .map((prospect) => prospect.prospectId);

    const prospects = await Promise.all(
      candidateIds.map((prospectId) => ctx.db.get(prospectId))
    );

    return prospects.filter(
      (prospect): prospect is NonNullable<typeof prospect> => prospect !== null
    );
  },
});

export const listWorkspaceCapacityRestartCandidatesInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const prospects = await ctx.db
      .query("prospectSummaries")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return prospects
      .filter(
        (prospect) =>
          prospect.origin !== "setup_preview" &&
          prospect.status !== "archived" &&
          (prospect.qualificationStatus !== "qualified" &&
          prospect.qualificationStatus !== "disqualified"
            ? true
            : prospect.qualificationStatus === "qualified" &&
              prospect.enrichmentStatus !== "enriched")
      )
      .map((prospect) => ({
        _id: prospect.prospectId,
        status: prospect.status,
        qualificationStatus: prospect.qualificationStatus,
        enrichmentStatus: prospect.enrichmentStatus,
      }));
  },
});

// Note: getPendingQualificationProspects REMOVED
// Qualification now happens automatically per-prospect via streaming workflows
// triggered immediately when prospects are saved (see workflows/qualification.ts)

// Note: qualifyProspectInternal REMOVED (dead code)
// All qualification logic is now in lib/qualificationCore.ts
// Used by: workflows/qualification.ts, agents/tools/qualifyProspect.ts
