import { Migrations } from "@convex-dev/migrations";
import { getDocumentSize } from "convex/values";
import { components, internal } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import schema from "./schema";
import { upsertAgentThreadTargetSelection } from "./lib/agentThreadTargetSelectionHelpers";
import { createPlanBatchReferenceKey } from "./lib/planBatchCore";
import { buildAutoPlanFailureNotificationTitle } from "./lib/autoPlanCore";
import {
  getProspectDisplayLabel,
  getProspectIdentitySnapshot,
} from "./lib/prospectIdentityCore";
import { ensureCurrentOutreachPlanRevision } from "./lib/outreachPlanRevisionCore";
import {
  categoryToNamespace,
  getWorkspaceAgentMemoryById,
} from "./lib/agentMemoryCore";
import { upsertCanonicalWorkspaceMemory } from "./lib/workspaceMemoryCore";
import {
  buildWorkspaceAttachmentSearchText,
  getWorkspaceAttachmentKind,
  updateWorkspaceAttachmentStats,
} from "./lib/workspaceAttachmentCore";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { polar } from "./polar";
import { reconcilePlanUsageForUser } from "./lib/planUsageCore";

export const migrations = new Migrations<DataModel, typeof schema>(
  components.migrations,
  { schema }
);

const IDENTITY_REPAIR_OWNER_EMAIL = "creativecoder.crco@gmail.com";
const MAX_SAFE_PROSPECT_DOCUMENT_BYTES = 1_000_000;
const AGENTMAIL_WORKSPACE_ID =
  "ks76np202xg61bj94838cpszyn8arxc6" as Id<"workspaces">;
const REACHERX_WORKSPACE_ID =
  "ks76wdkah15gxj05hatyk5hxjx88y6dj" as Id<"workspaces">;
const IDENTITY_REPAIR_ACTIVE_WORKSPACES: Readonly<Record<string, string>> = {
  [AGENTMAIL_WORKSPACE_ID]: "AgentMail (lead gen)",
  [REACHERX_WORKSPACE_ID]: "ReacherX (lead gen)",
};

/**
 * Production repair guard: only the explicitly approved, currently running
 * workspaces may be changed. Pausing either workspace stops subsequent writes.
 */
async function isScopedActiveIdentityRepairWorkspace(
  ctx: Pick<MutationCtx, "db">,
  workspaceId: Id<"workspaces">
): Promise<boolean> {
  const expectedName = IDENTITY_REPAIR_ACTIVE_WORKSPACES[String(workspaceId)];
  if (!expectedName) {
    return false;
  }

  const workspace = await ctx.db.get("workspaces", workspaceId);
  if (
    !workspace ||
    workspace.name !== expectedName ||
    workspace.prospectingWorkflowStatus !== "running"
  ) {
    return false;
  }

  const owner = await ctx.db.get("users", workspace.userId);
  return owner?.email.toLowerCase() === IDENTITY_REPAIR_OWNER_EMAIL;
}

export const backfillAgentThreadTargetSelections = migrations.define({
  table: "agentMessageContexts",
  batchSize: 25,
  migrateOne: async (ctx, context) => {
    if (!context.workspaceId || context.taggedEntities.length === 0) {
      return;
    }

    await upsertAgentThreadTargetSelection(ctx, {
      threadId: context.threadId,
      userId: context.userId,
      workspaceId: context.workspaceId,
      sourceMessageId: context.messageId,
      sourceContextCreatedAt: context.createdAt,
      taggedEntities: context.taggedEntities,
    });
  },
});

export const backfillPlanBatchReferenceKeys = migrations.define({
  table: "planBatchRuns",
  batchSize: 25,
  migrateOne: async (ctx, run) => {
    if (run.referenceKey) {
      return;
    }
    await ctx.db.patch("planBatchRuns", run._id, {
      referenceKey: createPlanBatchReferenceKey(),
    });
  },
});

/**
 * Rerunnable repair for current usage snapshots that drifted from canonical
 * qualified prospects. One user is reconciled per transaction to keep each
 * user's prospect recount within an isolated Convex transaction budget.
 */
export const reconcileCurrentPlanUsage = migrations.define({
  table: "userPlans",
  batchSize: 1,
  migrateOne: async (ctx, plan) => {
    const subscription = await polar.getCurrentSubscription(ctx, {
      userId: plan.userId,
    });
    await reconcilePlanUsageForUser(ctx, {
      userId: plan.userId,
      subscription,
    });
  },
});

/**
 * Phase one of removing the unused currentWorkspacesCount snapshot. Current
 * workspace capacity and usage are derived from canonical workspace records,
 * so clearing this duplicate field cannot affect enforcement or reporting.
 */
export const removeLegacyCurrentWorkspacesCount = migrations.define({
  table: "userPlans",
  batchSize: 25,
  migrateOne: async (ctx, plan) => {
    if (plan.currentWorkspacesCount === undefined) {
      return;
    }
    await ctx.db.patch(plan._id, {
      currentWorkspacesCount: undefined,
    });
  },
});

function defineQualifiedProspectDisplayNameBackfill(
  workspaceId: Id<"workspaces">
) {
  return migrations.define({
    table: "prospects",
    batchSize: 25,
    customRange: (query) =>
      query.withIndex("by_workspace_qualification", (q) =>
        q.eq("workspaceId", workspaceId).eq("qualificationStatus", "qualified")
      ),
    migrateOne: async (ctx, prospect) => {
      if (
        prospect.qualificationStatus !== "qualified" ||
        !(await isScopedActiveIdentityRepairWorkspace(
          ctx,
          prospect.workspaceId
        ))
      ) {
        return;
      }
      if (prospect.displayName?.trim()) {
        return;
      }
      const displayName = getProspectIdentitySnapshot(prospect).displayName;
      if (!displayName) {
        return;
      }
      if (
        getDocumentSize({ ...prospect, displayName }) >
        MAX_SAFE_PROSPECT_DOCUMENT_BYTES
      ) {
        // The canonical resolver already reads the name from raw provider data.
        // Avoid making near-limit legacy documents invalid for an optional cache.
        return;
      }
      await ctx.db.patch("prospects", prospect._id, { displayName });
    },
  });
}

export const backfillAgentMailQualifiedProspectDisplayNames =
  defineQualifiedProspectDisplayNameBackfill(AGENTMAIL_WORKSPACE_ID);

export const backfillReacherXQualifiedProspectDisplayNames =
  defineQualifiedProspectDisplayNameBackfill(REACHERX_WORKSPACE_ID);

export const repairOutreachNotificationProspectIdentity = migrations.define({
  table: "outreachNotifications",
  batchSize: 25,
  migrateOne: async (ctx, notification) => {
    if (
      !notification.prospectId ||
      !(await isScopedActiveIdentityRepairWorkspace(
        ctx,
        notification.workspaceId
      ))
    ) {
      return;
    }
    const prospect = await ctx.db.get("prospects", notification.prospectId);
    if (!prospect) {
      return;
    }
    if (
      prospect.workspaceId !== notification.workspaceId ||
      prospect.qualificationStatus !== "qualified"
    ) {
      return;
    }

    const identity = getProspectIdentitySnapshot(prospect);
    const patch: {
      prospectAvatarUrl?: string;
      prospectDisplayName?: string;
      prospectPlatform?: typeof prospect.platform;
      prospectScreenName?: string;
      prospectType?: typeof prospect.prospectType;
      title?: string;
    } = {};

    if (
      identity.avatarUrl &&
      notification.prospectAvatarUrl !== identity.avatarUrl
    ) {
      patch.prospectAvatarUrl = identity.avatarUrl;
    }
    if (
      identity.preferredLabel &&
      notification.prospectDisplayName !== identity.preferredLabel
    ) {
      patch.prospectDisplayName = identity.preferredLabel;
    }
    if (notification.prospectPlatform !== prospect.platform) {
      patch.prospectPlatform = prospect.platform;
    }
    if (
      identity.screenName &&
      notification.prospectScreenName !== identity.screenName
    ) {
      patch.prospectScreenName = identity.screenName;
    }
    if (notification.prospectType !== prospect.prospectType) {
      patch.prospectType = prospect.prospectType;
    }
    if (notification.notificationKey?.startsWith("auto-plan-failed:")) {
      const title = buildAutoPlanFailureNotificationTitle(
        getProspectDisplayLabel(prospect)
      );
      if (notification.title !== title) {
        patch.title = title;
      }
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch("outreachNotifications", notification._id, patch);
    }
  },
});

export const repairPlanBatchProspectNames = migrations.define({
  table: "planBatchItems",
  batchSize: 25,
  migrateOne: async (ctx, item) => {
    const prospect = await ctx.db.get("prospects", item.prospectId);
    if (
      !prospect ||
      prospect.qualificationStatus !== "qualified" ||
      !(await isScopedActiveIdentityRepairWorkspace(ctx, prospect.workspaceId))
    ) {
      return;
    }
    const prospectName = getProspectDisplayLabel(prospect);
    if (item.prospectName === prospectName) {
      return;
    }
    await ctx.db.patch("planBatchItems", item._id, { prospectName });
  },
});

/**
 * Additive backfill for plans created before immutable revision history.
 * New writes create revisions synchronously, so this migration is optional for
 * correctness and only needs to be run once when the feature is deployed.
 */
export const backfillOutreachPlanRevisions = migrations.define({
  table: "outreachPlans",
  batchSize: 25,
  migrateOne: async (ctx, plan) => {
    if (plan.currentRevisionId) {
      return;
    }
    const tasks = await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan_order", (q) => q.eq("planId", plan._id))
      .collect();
    await ensureCurrentOutreachPlanRevision(ctx, plan, tasks);
    if (plan.executionGeneration === undefined) {
      await ctx.db.patch("outreachPlans", plan._id, {
        executionGeneration: 0,
      });
    }
  },
});

/**
 * Additive, restart-safe backfill from the legacy Agent component memory read
 * model into canonical workspace memories. Legacy operator rows predate
 * verbatim capture, so provenance metadata records that exact text could not
 * be recovered. New writes dual-write both stores before this migration runs.
 */
export const backfillCanonicalWorkspaceMemories = migrations.define({
  table: "workspaceAgentMemoryInventory",
  batchSize: 20,
  migrateOne: async (ctx, inventory) => {
    const existing = await ctx.db
      .query("workspaceMemories")
      .withIndex("by_legacy_memory_id", (q) =>
        q.eq("legacyMemoryId", inventory.memoryId)
      )
      .first();
    if (existing) {
      return;
    }

    const workspace = await ctx.db.get("workspaces", inventory.workspaceId);
    if (!workspace) {
      return;
    }
    const legacy = await getWorkspaceAgentMemoryById(ctx.db, {
      userId: String(workspace.userId),
      workspaceId: String(workspace._id),
      memoryId: inventory.memoryId,
    });
    if (!legacy) {
      return;
    }

    const parsed = legacy.parsed;
    const requestedProspectId = parsed.prospectId
      ? (ctx.db.normalizeId("prospects", parsed.prospectId) ?? undefined)
      : undefined;
    const prospect = requestedProspectId
      ? await ctx.db.get("prospects", requestedProspectId)
      : null;
    const prospectId =
      prospect?.workspaceId === workspace._id ? prospect._id : undefined;
    const operatorText = parsed.narrative || parsed.summary;
    const canonical = await upsertCanonicalWorkspaceMemory(ctx.db, {
      userId: workspace.userId,
      workspaceId: workspace._id,
      legacyMemoryId: inventory.memoryId,
      source: parsed.source,
      category: parsed.category,
      namespace: categoryToNamespace(parsed.category),
      kind: parsed.category,
      title: parsed.title,
      summary: parsed.summary,
      canonicalContent:
        parsed.source === "operator" ? operatorText : legacy.memoryText,
      instruction: parsed.source === "operator" ? operatorText : undefined,
      metadata: {
        legacyPayload: parsed,
        verbatimRecovered: parsed.source !== "operator",
      },
      confidence: parsed.confidence,
      impactScore: parsed.impactScore,
      prospectId,
      provenanceKind: "legacy_backfill",
    });
    if (canonical.shouldIndex) {
      await ctx.scheduler.runAfter(
        0,
        internal.memory.indexCanonicalWorkspaceMemoryInternal,
        { memoryId: canonical.memory.memoryId as Id<"workspaceMemories"> }
      );
    }
  },
});

/**
 * Additive attachment-library backfill. Unscoped legacy rows intentionally
 * remain quarantined; scoped rows become searchable and enter exact counters.
 */
export const backfillWorkspaceAttachmentSearchAndStats = migrations.define({
  table: "mediaUploads",
  batchSize: 25,
  migrateOne: async (ctx, upload) => {
    const searchText = buildWorkspaceAttachmentSearchText({
      fileName: upload.fileName,
      displayName: upload.displayName,
      mimeType: upload.mimeType,
      tags: upload.tags,
    });
    const workspace = upload.workspaceId
      ? await ctx.db.get("workspaces", upload.workspaceId)
      : null;
    const isOwnedScopedUpload = Boolean(
      workspace && upload.userId && workspace.userId === upload.userId
    );
    const patch: {
      searchText?: string;
      statsRecordedAt?: number;
    } = {};
    if (upload.searchText !== searchText) {
      patch.searchText = searchText;
    }
    if (
      isOwnedScopedUpload &&
      upload.workspaceId &&
      upload.statsRecordedAt === undefined
    ) {
      const statsRecordedAt = getCurrentUTCTimestamp();
      await updateWorkspaceAttachmentStats(ctx, {
        workspaceId: upload.workspaceId,
        kind: getWorkspaceAttachmentKind(upload),
        delta: 1,
      });
      patch.statsRecordedAt = statsRecordedAt;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch("mediaUploads", upload._id, patch);
    }
  },
});

/**
 * Deliberately scoped runner for the attachment rollout. Keeping this runner
 * explicit avoids exposing the component's generic "run any migration" API.
 */
export const runWorkspaceAttachmentBackfill = migrations.runner([
  internal.migrations.backfillWorkspaceAttachmentSearchAndStats,
]);
