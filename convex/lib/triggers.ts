import { Triggers } from "convex-helpers/server/triggers";
import type { GenericDatabaseWriter } from "convex/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import {
  buildProspectSummaryRecord,
  getWorkspaceAnalyticsContributionFromActivityLog,
  getWorkspaceAnalyticsContributionFromProspect,
  getWorkspaceAnalyticsContributionsFromPlan,
  getWorkspaceAnalyticsContributionsFromTask,
  getWorkspaceStatsContributionFromNotification,
  getWorkspaceStatsContributionFromProspect,
  coerceWorkspaceAnalyticsDailyForMerge,
  isWorkspaceAnalyticsRecordEmpty,
  mergeWorkspaceAnalyticsContributions,
  mergeWorkspaceStatsContributions,
  type TargetedWorkspaceAnalyticsContribution,
  type WorkspaceStatsContribution,
} from "./readModelHelpers";

export const triggers = new Triggers<DataModel>();

type TriggerDb = GenericDatabaseWriter<DataModel>;

type TargetedWorkspaceStatsContribution = {
  workspaceId: Id<"workspaces">;
  userId: Id<"users">;
  contribution: WorkspaceStatsContribution;
};

function toArray<T>(value: T | null | undefined): T[] {
  return value ? [value] : [];
}

async function syncProspectSummary(
  db: TriggerDb,
  args: {
    oldDoc: Doc<"prospects"> | null;
    newDoc: Doc<"prospects"> | null;
  }
) {
  const prospectId = args.newDoc?._id ?? args.oldDoc?._id;
  if (!prospectId) {
    return;
  }

  const existing = await db
    .query("prospectSummaries")
    .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
    .first();

  if (!args.newDoc) {
    if (existing) {
      await db.delete(existing._id);
    }
    return;
  }

  const nextSummary = buildProspectSummaryRecord(args.newDoc);
  if (existing) {
    await db.patch(existing._id, nextSummary);
  } else {
    await db.insert("prospectSummaries", nextSummary);
  }
}

async function applyWorkspaceStatsChanges(
  db: TriggerDb,
  args: {
    remove?: TargetedWorkspaceStatsContribution[];
    add?: TargetedWorkspaceStatsContribution[];
  }
) {
  const groups = new Map<
    string,
    {
      workspaceId: Id<"workspaces">;
      userId: Id<"users">;
      remove: WorkspaceStatsContribution[];
      add: WorkspaceStatsContribution[];
    }
  >();

  for (const entry of args.remove ?? []) {
    const key = String(entry.workspaceId);
    const group = groups.get(key) ?? {
      workspaceId: entry.workspaceId,
      userId: entry.userId,
      remove: [],
      add: [],
    };
    group.remove.push(entry.contribution);
    groups.set(key, group);
  }

  for (const entry of args.add ?? []) {
    const key = String(entry.workspaceId);
    const group = groups.get(key) ?? {
      workspaceId: entry.workspaceId,
      userId: entry.userId,
      remove: [],
      add: [],
    };
    group.userId = entry.userId;
    group.add.push(entry.contribution);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const existing = await db
      .query("workspaceStats")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", group.workspaceId))
      .first();

    const next = mergeWorkspaceStatsContributions(existing ?? null, {
      workspaceId: group.workspaceId,
      userId: group.userId,
      remove: group.remove,
      add: group.add,
    });

    if (existing) {
      await db.patch(existing._id, next);
    } else {
      await db.insert("workspaceStats", next);
    }
  }
}

async function applyWorkspaceAnalyticsChanges(
  db: TriggerDb,
  args: {
    remove?: TargetedWorkspaceAnalyticsContribution[];
    add?: TargetedWorkspaceAnalyticsContribution[];
  }
) {
  const groups = new Map<
    string,
    {
      workspaceId: Id<"workspaces">;
      dayStartUtcMs: number;
      remove: TargetedWorkspaceAnalyticsContribution["contribution"][];
      add: TargetedWorkspaceAnalyticsContribution["contribution"][];
    }
  >();

  for (const entry of args.remove ?? []) {
    const key = `${entry.workspaceId}:${entry.dayStartUtcMs}`;
    const group = groups.get(key) ?? {
      workspaceId: entry.workspaceId,
      dayStartUtcMs: entry.dayStartUtcMs,
      remove: [],
      add: [],
    };
    group.remove.push(entry.contribution);
    groups.set(key, group);
  }

  for (const entry of args.add ?? []) {
    const key = `${entry.workspaceId}:${entry.dayStartUtcMs}`;
    const group = groups.get(key) ?? {
      workspaceId: entry.workspaceId,
      dayStartUtcMs: entry.dayStartUtcMs,
      remove: [],
      add: [],
    };
    group.add.push(entry.contribution);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const existing = await db
      .query("workspaceAnalyticsDaily")
      .withIndex("by_workspace_day", (q) =>
        q
          .eq("workspaceId", group.workspaceId)
          .eq("dayStartUtcMs", group.dayStartUtcMs)
      )
      .first();

    const next = mergeWorkspaceAnalyticsContributions(
      existing ? coerceWorkspaceAnalyticsDailyForMerge(existing) : null,
      {
        workspaceId: group.workspaceId,
        dayStartUtcMs: group.dayStartUtcMs,
        remove: group.remove,
        add: group.add,
      }
    );

    if (isWorkspaceAnalyticsRecordEmpty(next)) {
      if (existing) {
        await db.delete(existing._id);
      }
      continue;
    }

    if (existing) {
      await db.patch(existing._id, next);
    } else {
      await db.insert("workspaceAnalyticsDaily", next);
    }
  }
}

triggers.register("prospects", async (ctx, change) => {
  await syncProspectSummary(ctx.innerDb, {
    oldDoc: change.oldDoc,
    newDoc: change.newDoc,
  });

  await applyWorkspaceStatsChanges(ctx.innerDb, {
    remove: change.oldDoc
      ? [
          {
            workspaceId: change.oldDoc.workspaceId,
            userId: change.oldDoc.userId,
            contribution: getWorkspaceStatsContributionFromProspect(
              change.oldDoc
            ),
          },
        ]
      : [],
    add: change.newDoc
      ? [
          {
            workspaceId: change.newDoc.workspaceId,
            userId: change.newDoc.userId,
            contribution: getWorkspaceStatsContributionFromProspect(
              change.newDoc
            ),
          },
        ]
      : [],
  });

  await applyWorkspaceAnalyticsChanges(ctx.innerDb, {
    remove: change.oldDoc
      ? [getWorkspaceAnalyticsContributionFromProspect(change.oldDoc)]
      : [],
    add: change.newDoc
      ? [getWorkspaceAnalyticsContributionFromProspect(change.newDoc)]
      : [],
  });
});

triggers.register("prospectActivityLog", async (ctx, change) => {
  await applyWorkspaceAnalyticsChanges(ctx.innerDb, {
    remove: toArray(
      change.oldDoc
        ? getWorkspaceAnalyticsContributionFromActivityLog(change.oldDoc)
        : null
    ),
    add: toArray(
      change.newDoc
        ? getWorkspaceAnalyticsContributionFromActivityLog(change.newDoc)
        : null
    ),
  });
});

triggers.register("outreachPlans", async (ctx, change) => {
  await applyWorkspaceAnalyticsChanges(ctx.innerDb, {
    remove: change.oldDoc
      ? getWorkspaceAnalyticsContributionsFromPlan(change.oldDoc)
      : [],
    add: change.newDoc
      ? getWorkspaceAnalyticsContributionsFromPlan(change.newDoc)
      : [],
  });
});

triggers.register("outreachTasks", async (ctx, change) => {
  const oldPlan = change.oldDoc
    ? ((await ctx.innerDb.get(
        change.oldDoc.planId
      )) as Doc<"outreachPlans"> | null)
    : null;
  const newPlan = change.newDoc
    ? ((await ctx.innerDb.get(
        change.newDoc.planId
      )) as Doc<"outreachPlans"> | null)
    : null;

  await applyWorkspaceAnalyticsChanges(ctx.innerDb, {
    remove:
      change.oldDoc && oldPlan
        ? getWorkspaceAnalyticsContributionsFromTask({
            task: change.oldDoc,
            workspaceId: oldPlan.workspaceId,
          })
        : [],
    add:
      change.newDoc && newPlan
        ? getWorkspaceAnalyticsContributionsFromTask({
            task: change.newDoc,
            workspaceId: newPlan.workspaceId,
          })
        : [],
  });
});

triggers.register("outreachNotifications", async (ctx, change) => {
  await applyWorkspaceStatsChanges(ctx.innerDb, {
    remove: change.oldDoc
      ? [
          {
            workspaceId: change.oldDoc.workspaceId,
            userId: change.oldDoc.userId,
            contribution: getWorkspaceStatsContributionFromNotification(
              change.oldDoc
            ),
          },
        ]
      : [],
    add: change.newDoc
      ? [
          {
            workspaceId: change.newDoc.workspaceId,
            userId: change.newDoc.userId,
            contribution: getWorkspaceStatsContributionFromNotification(
              change.newDoc
            ),
          },
        ]
      : [],
  });
});
