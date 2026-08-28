import type {
  GenericDatabaseReader,
  GenericDatabaseWriter,
} from "convex/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { listWorkspaceAgentMemoriesByCategory } from "./agentMemoryCore";
import { recordMemoryWorkflowEvent } from "./memoryCore";
import { buildChangedPatch } from "./patchHelpers";
import {
  getStyleMemoryCategory,
  type StyleSourcePlatform,
} from "./styleSourceCore";

export const BATCH_ANALYSIS_THRESHOLD = 5;
export const STYLE_MEMORY_RECOVERY_MAX_ATTEMPTS = 3;
export const STYLE_MEMORY_RECOVERY_WINDOW_MS = 6 * 60 * 60 * 1_000;
const STYLE_MEMORY_RECOVERY_EVENT_SCAN_LIMIT = 100;

type WorkspaceStyleProfileDoc = Doc<"workspaceStyleProfiles">;
type ActiveStyleBootstrapSource = {
  platform: StyleSourcePlatform;
  sourceKey?: string;
  sourceVersion: number;
  sourceExternalUserId: string;
};

export type WorkspaceStyleBootstrapResult = {
  platform: StyleSourcePlatform;
  status: "scheduled" | "skipped";
  reason:
    | "scheduled"
    | "already_initialized"
    | "already_queued"
    | "recovery_exhausted"
    | "insufficient_samples"
    | "no_active_source"
    | "no_workspace";
};

export type WorkspaceWritingStyleContext =
  | {
      status: "ready";
      writingStyle: string;
      profileVersion: number;
      source: "canonical" | "legacy";
    }
  | {
      status: "not_ready";
      reason: "profile_not_ready" | "memory_missing";
      profileVersion?: number;
    };

export async function getWorkspaceStyleProfileRow(
  db: GenericDatabaseReader<DataModel> | GenericDatabaseWriter<DataModel>,
  args: {
    workspaceId: Id<"workspaces">;
    platform: StyleSourcePlatform;
  }
) {
  return await db
    .query("workspaceStyleProfiles")
    .withIndex("by_workspace_platform", (q) =>
      q.eq("workspaceId", args.workspaceId).eq("platform", args.platform)
    )
    .first();
}

/**
 * Resolve one platform's exact writing-style context from the canonical store,
 * with the Agent component retained as a compatibility fallback during rollout.
 */
export async function getWorkspaceWritingStyleContext(
  db: GenericDatabaseReader<DataModel> | GenericDatabaseWriter<DataModel>,
  args: {
    workspaceId: Id<"workspaces">;
    platform: StyleSourcePlatform;
  }
): Promise<WorkspaceWritingStyleContext> {
  const profile = await getWorkspaceStyleProfileRow(db, args);
  if (!profile || profile.status !== "ready" || profile.version <= 0) {
    return {
      status: "not_ready",
      reason: "profile_not_ready",
      profileVersion: profile?.version,
    };
  }

  const category = getStyleMemoryCategory(args.platform);
  const canonical = await db
    .query("workspaceMemories")
    .withIndex("by_workspace_source_category_status", (query) =>
      query
        .eq("workspaceId", args.workspaceId)
        .eq("source", "style_analysis")
        .eq("category", category)
        .eq("status", "active")
    )
    .order("desc")
    .first();
  const canonicalContent = canonical?.canonicalContent.trim();
  if (canonicalContent) {
    return {
      status: "ready",
      writingStyle: canonicalContent,
      profileVersion: profile.version,
      source: "canonical",
    };
  }

  const [legacy] = await listWorkspaceAgentMemoriesByCategory(db, {
    workspaceId: args.workspaceId,
    category,
    limit: 1,
  });
  const legacyContent =
    legacy?.parsed.source === "style_analysis"
      ? legacy.parsed.narrative.trim()
      : "";
  if (legacyContent) {
    return {
      status: "ready",
      writingStyle: legacyContent,
      profileVersion: profile.version,
      source: "legacy",
    };
  }

  return {
    status: "not_ready",
    reason: "memory_missing",
    profileVersion: profile.version,
  };
}

export async function upsertWorkspaceStyleProfileOnDb(
  db: GenericDatabaseWriter<DataModel>,
  args: {
    workspaceId: Id<"workspaces">;
    userId: Id<"users">;
    platform: StyleSourcePlatform;
    status: WorkspaceStyleProfileDoc["status"];
    version: number;
    sourceKey?: string;
    sourceVersion?: number;
    sourceExternalUserId?: string;
    lastAnalyzedAt?: number;
    sampleCount: number;
    editDiffCount: number;
    promotedMemoryId?: string;
    lastError?: string;
    lastErrorAt?: number;
  }
) {
  const existing = await getWorkspaceStyleProfileRow(db, {
    workspaceId: args.workspaceId,
    platform: args.platform,
  });
  const payload = {
    workspaceId: args.workspaceId,
    userId: args.userId,
    platform: args.platform,
    status: args.status,
    version: args.version,
    sourceKey: args.sourceKey,
    sourceVersion: args.sourceVersion,
    sourceExternalUserId: args.sourceExternalUserId,
    lastAnalyzedAt: args.lastAnalyzedAt,
    sampleCount: args.sampleCount,
    editDiffCount: args.editDiffCount,
    promotedMemoryId: args.promotedMemoryId,
    lastError: args.lastError,
    lastErrorAt: args.lastErrorAt,
  };

  if (existing) {
    const patch = buildChangedPatch(
      existing as unknown as Record<string, unknown>,
      payload
    );
    if (patch) {
      await db.patch(existing._id, patch);
    }
    return existing._id;
  }

  return await db.insert("workspaceStyleProfiles", payload);
}

async function getActiveStyleBootstrapSource(
  db: GenericDatabaseWriter<DataModel>,
  args: {
    userId: Id<"users">;
    platform: StyleSourcePlatform;
  }
): Promise<ActiveStyleBootstrapSource | null> {
  if (args.platform === "twitter") {
    const xAccount = await db
      .query("xAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!xAccount || xAccount.status !== "connected") {
      return null;
    }

    return {
      platform: "twitter",
      sourceKey: xAccount.styleSourceKey,
      sourceVersion: xAccount.styleSourceVersion ?? xAccount._creationTime,
      sourceExternalUserId: xAccount.xUserId,
    };
  }

  const linkedInAccount = await db
    .query("linkedinAccounts")
    .withIndex("by_user", (q) => q.eq("userId", args.userId))
    .first();

  if (!linkedInAccount || linkedInAccount.status !== "connected") {
    return null;
  }

  const sourceVersion =
    typeof linkedInAccount.styleSourceVersion === "number"
      ? linkedInAccount.styleSourceVersion
      : null;
  const sourceExternalUserId =
    linkedInAccount.providerId ?? linkedInAccount.accountId ?? null;

  if (!sourceVersion || !sourceExternalUserId) {
    return null;
  }

  return {
    platform: "linkedin",
    sourceKey: linkedInAccount.styleSourceKey,
    sourceVersion,
    sourceExternalUserId,
  };
}

async function getMostRecentReadyStyleProfileForSource(
  db: GenericDatabaseWriter<DataModel>,
  args: {
    workspaceId: Id<"workspaces">;
    userId: Id<"users">;
    platform: StyleSourcePlatform;
    sourceVersion: number;
    sourceExternalUserId: string;
  }
) {
  const readyProfiles = await db
    .query("workspaceStyleProfiles")
    .withIndex("by_user_platform_status", (q) =>
      q
        .eq("userId", args.userId)
        .eq("platform", args.platform)
        .eq("status", "ready")
    )
    .collect();

  return (
    readyProfiles
      .filter(
        (profile) =>
          profile.workspaceId !== args.workspaceId &&
          profile.sourceVersion === args.sourceVersion &&
          profile.sourceExternalUserId === args.sourceExternalUserId
      )
      .sort((left, right) => {
        const analyzedDelta =
          (right.lastAnalyzedAt ?? 0) - (left.lastAnalyzedAt ?? 0);
        if (analyzedDelta !== 0) {
          return analyzedDelta;
        }
        return right.version - left.version;
      })[0] ?? null
  );
}

export async function bootstrapWorkspaceStyleProfileForPlatformOnDb(
  ctx: Pick<MutationCtx, "db" | "scheduler">,
  args: {
    workspaceId: Id<"workspaces">;
    userId: Id<"users">;
    platform: StyleSourcePlatform;
  }
): Promise<WorkspaceStyleBootstrapResult> {
  const activeSource = await getActiveStyleBootstrapSource(ctx.db, args);
  if (!activeSource) {
    return {
      platform: args.platform,
      status: "skipped",
      reason: "no_active_source",
    };
  }

  const existingProfile = await getWorkspaceStyleProfileRow(ctx.db, {
    workspaceId: args.workspaceId,
    platform: args.platform,
  });
  const matchesCurrentSource =
    existingProfile?.sourceVersion === activeSource.sourceVersion &&
    existingProfile?.sourceExternalUserId === activeSource.sourceExternalUserId;

  let requiresMemoryRepair = false;
  if (matchesCurrentSource && existingProfile?.status === "ready") {
    const styleContext = await getWorkspaceWritingStyleContext(ctx.db, {
      workspaceId: args.workspaceId,
      platform: args.platform,
    });
    requiresMemoryRepair =
      styleContext.status === "not_ready" &&
      styleContext.reason === "memory_missing";
    if (!requiresMemoryRepair) {
      return {
        platform: args.platform,
        status: "skipped",
        reason: "already_initialized",
      };
    }
  }

  if (matchesCurrentSource && existingProfile?.status === "analyzing") {
    return {
      platform: args.platform,
      status: "skipped",
      reason: "already_initialized",
    };
  }

  const readyProfile = await getMostRecentReadyStyleProfileForSource(ctx.db, {
    workspaceId: args.workspaceId,
    userId: args.userId,
    platform: args.platform,
    sourceVersion: activeSource.sourceVersion,
    sourceExternalUserId: activeSource.sourceExternalUserId,
  });

  const sampleWindow = await ctx.db
    .query("styleContentSamples")
    .withIndex("by_user_platform_source_version", (q) =>
      q
        .eq("userId", args.userId)
        .eq("platform", args.platform)
        .eq("sourceVersion", activeSource.sourceVersion)
    )
    .take(BATCH_ANALYSIS_THRESHOLD);

  const sampleCountHint =
    readyProfile?.sampleCount ??
    Math.max(
      matchesCurrentSource ? (existingProfile?.sampleCount ?? 0) : 0,
      sampleWindow.length
    );

  const canReplayExistingSamples =
    readyProfile !== null || sampleWindow.length >= BATCH_ANALYSIS_THRESHOLD;
  if (!canReplayExistingSamples) {
    if (existingProfile?.status === "collecting" && matchesCurrentSource) {
      await upsertWorkspaceStyleProfileOnDb(ctx.db, {
        workspaceId: args.workspaceId,
        userId: args.userId,
        platform: args.platform,
        status: "none",
        version: existingProfile.version,
        sourceKey: activeSource.sourceKey,
        sourceVersion: activeSource.sourceVersion,
        sourceExternalUserId: activeSource.sourceExternalUserId,
        lastAnalyzedAt: existingProfile.lastAnalyzedAt,
        sampleCount: sampleCountHint,
        editDiffCount: existingProfile.editDiffCount ?? 0,
        promotedMemoryId: existingProfile.promotedMemoryId,
        lastError: existingProfile.lastError,
        lastErrorAt: existingProfile.lastErrorAt,
      });
    }
    return {
      platform: args.platform,
      status: "skipped",
      reason: "insufficient_samples",
    };
  }

  const isRepairAttempt =
    requiresMemoryRepair ||
    (matchesCurrentSource &&
      (existingProfile?.version ?? 0) > 0 &&
      Boolean(existingProfile?.promotedMemoryId));
  const recoveryState = existingProfile?.lastErrorAt ?? 0;
  const eventKey = isRepairAttempt
    ? `style-repair:${String(args.workspaceId)}:${args.platform}:${activeSource.sourceVersion}:v${existingProfile?.version ?? 0}:${recoveryState}`
    : `style-bootstrap:${String(args.workspaceId)}:${args.platform}:${activeSource.sourceVersion}`;
  const existingEvent = await ctx.db
    .query("memoryWorkflowEvents")
    .withIndex("by_event_key", (q) => q.eq("eventKey", eventKey))
    .first();

  if (existingEvent) {
    return {
      platform: args.platform,
      status: "skipped",
      reason: "already_queued",
    };
  }

  if (isRepairAttempt) {
    const recoveryWindowStartedAt =
      getCurrentUTCTimestamp() - STYLE_MEMORY_RECOVERY_WINDOW_MS;
    const recentStyleEvents = await ctx.db
      .query("memoryWorkflowEvents")
      .withIndex("by_workspace_event_type_occurred_at", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("eventType", "style_content_backfill_completed")
      )
      .order("desc")
      .take(STYLE_MEMORY_RECOVERY_EVENT_SCAN_LIMIT);
    const recentRepairCount = recentStyleEvents.filter(
      (event) =>
        event.occurredAt >= recoveryWindowStartedAt &&
        event.sourceId.startsWith(
          `style-repair:${String(args.userId)}:${args.platform}:`
        )
    ).length;
    if (recentRepairCount >= STYLE_MEMORY_RECOVERY_MAX_ATTEMPTS) {
      console.error("[WorkspaceStyleProfile] Memory recovery exhausted", {
        workspaceId: String(args.workspaceId),
        platform: args.platform,
        recentRepairCount,
      });
      await upsertWorkspaceStyleProfileOnDb(ctx.db, {
        workspaceId: args.workspaceId,
        userId: args.userId,
        platform: args.platform,
        status: "failed",
        version: existingProfile?.version ?? 0,
        sourceKey: activeSource.sourceKey,
        sourceVersion: activeSource.sourceVersion,
        sourceExternalUserId: activeSource.sourceExternalUserId,
        lastAnalyzedAt: existingProfile?.lastAnalyzedAt,
        sampleCount: sampleCountHint,
        editDiffCount: existingProfile?.editDiffCount ?? 0,
        promotedMemoryId: existingProfile?.promotedMemoryId,
        lastError: "Writing style memory recovery attempts were exhausted",
        lastErrorAt: getCurrentUTCTimestamp(),
      });
      return {
        platform: args.platform,
        status: "skipped",
        reason: "recovery_exhausted",
      };
    }
  }

  await upsertWorkspaceStyleProfileOnDb(ctx.db, {
    workspaceId: args.workspaceId,
    userId: args.userId,
    platform: args.platform,
    status: "collecting",
    version: existingProfile?.version ?? 0,
    sourceKey: activeSource.sourceKey,
    sourceVersion: activeSource.sourceVersion,
    sourceExternalUserId: activeSource.sourceExternalUserId,
    lastAnalyzedAt: existingProfile?.lastAnalyzedAt,
    sampleCount: sampleCountHint,
    editDiffCount: existingProfile?.editDiffCount ?? 0,
    promotedMemoryId: existingProfile?.promotedMemoryId,
    lastError: undefined,
    lastErrorAt: isRepairAttempt ? existingProfile?.lastErrorAt : undefined,
  });

  await recordMemoryWorkflowEvent(ctx, {
    workspaceId: args.workspaceId,
    eventType: "style_content_backfill_completed",
    sourceType: "style_content",
    sourceId: isRepairAttempt
      ? `style-repair:${String(args.userId)}:${args.platform}:${activeSource.sourceVersion}`
      : `bootstrap:${String(args.userId)}:${args.platform}:${activeSource.sourceVersion}`,
    payload: {
      sampleCount: sampleCountHint,
      platform: args.platform,
      sourceVersion: activeSource.sourceVersion,
      sourceExternalUserId: activeSource.sourceExternalUserId,
    },
    eventKey,
    occurredAt: getCurrentUTCTimestamp(),
  });

  if (isRepairAttempt) {
    console.warn("[WorkspaceStyleProfile] Queued memory recovery", {
      workspaceId: String(args.workspaceId),
      platform: args.platform,
      sourceVersion: activeSource.sourceVersion,
      eventKey,
    });
  }

  return {
    platform: args.platform,
    status: "scheduled",
    reason: "scheduled",
  };
}

export async function bootstrapWorkspaceStyleProfilesForWorkspaceOnDb(
  ctx: Pick<MutationCtx, "db" | "scheduler">,
  args: {
    workspaceId: Id<"workspaces">;
    userId: Id<"users">;
  }
): Promise<WorkspaceStyleBootstrapResult[]> {
  const workspace = await ctx.db.get(args.workspaceId);
  if (!workspace || workspace.userId !== args.userId) {
    return (["twitter", "linkedin"] as const).map((platform) => ({
      platform,
      status: "skipped" as const,
      reason: "no_workspace" as const,
    }));
  }

  const results: WorkspaceStyleBootstrapResult[] = [];
  for (const platform of ["twitter", "linkedin"] as const) {
    results.push(
      await bootstrapWorkspaceStyleProfileForPlatformOnDb(ctx, {
        workspaceId: args.workspaceId,
        userId: args.userId,
        platform,
      })
    );
  }
  return results;
}
