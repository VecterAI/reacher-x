import { Triggers } from "convex-helpers/server/triggers";
import type { GenericDatabaseWriter } from "convex/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import {
  buildProspectSummaryRecord,
  getWorkspaceAnalyticsContributionFromActivityLog,
  getWorkspaceAnalyticsContributionsFromProspect,
  getWorkspaceAnalyticsContributionsFromPlan,
  getWorkspaceAnalyticsContributionsFromTask,
  getWorkspaceStatsContributionFromNotification,
  getWorkspaceStatsContributionFromProspect,
  isWorkspaceAnalyticsStripeEmpty,
  isWorkspaceStatsStripeEmpty,
  mergeWorkspaceAnalyticsStripeContributions,
  mergeWorkspaceStatsStripeContributions,
  type TargetedWorkspaceAnalyticsContribution,
  type WorkspaceStatsContribution,
} from "./readModelHelpers";
import {
  getWorkspaceAgentOpsContributionsFromEvaluatorRun,
  getWorkspaceAgentOpsContributionsFromKeyword,
  getWorkspaceAgentOpsContributionsFromMemorySuggestion,
  getWorkspaceAgentOpsContributionsFromQueryCandidate,
  getWorkspaceAgentOpsContributionsFromWorkflowEvent,
  isWorkspaceAgentOpsStripeEmpty,
  mergeWorkspaceAgentOpsStripeContributions,
  type TargetedWorkspaceAgentOpsContribution,
} from "./agentOpsReadModelHelpers";
import { buildOutreachProgressSummary } from "./outreachProgressHelpers";
import { buildChangedPatchWithUpdatedAt } from "./patchHelpers";
import { getReadModelStripe } from "./readModelStripeHelpers";
import { syncProspectFitScoreAggregate } from "./prospectFitScoreAggregate";

export const triggers = new Triggers<DataModel>();

type TriggerDb = GenericDatabaseWriter<DataModel>;

type TargetedWorkspaceStatsContribution = {
  workspaceId: Id<"workspaces">;
  userId: Id<"users">;
  contribution: WorkspaceStatsContribution;
};

const PROSPECT_WORKFLOW_BOOKKEEPING_FIELDS = new Set([
  "qualificationWorkflowId",
  "enrichmentWorkflowId",
  "updatedAt",
]);

function toArray<T>(value: T | null | undefined): T[] {
  return value ? [value] : [];
}

function areJsonValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (left === undefined || right === undefined) {
    return left === right;
  }

  return JSON.stringify(left) === JSON.stringify(right);
}

async function syncProspectOutreachProgress(
  db: TriggerDb,
  prospectId: Id<"prospects">
) {
  const summary = await db
    .query("prospectSummaries")
    .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
    .first();
  if (!summary) {
    return;
  }

  const latestPlan = await db
    .query("outreachPlans")
    .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
    .order("desc")
    .first();
  const tasks = latestPlan
    ? await db
        .query("outreachTasks")
        .withIndex("by_plan_order", (q) => q.eq("planId", latestPlan._id))
        .collect()
    : [];
  const outreachProgress = latestPlan
    ? buildOutreachProgressSummary(
        latestPlan,
        tasks.filter((task) => task.supersededAt === undefined)
      )
    : undefined;

  if (areJsonValuesEqual(summary.outreachProgress, outreachProgress)) {
    return;
  }

  await db.patch("prospectSummaries", summary._id, { outreachProgress });
}

async function syncProspectsOutreachProgress(
  db: TriggerDb,
  prospectIds: Iterable<Id<"prospects">>
) {
  for (const prospectId of new Set(prospectIds)) {
    await syncProspectOutreachProgress(db, prospectId);
  }
}

function isProspectWorkflowBookkeepingOnlyChange(
  oldDoc: Doc<"prospects"> | null,
  newDoc: Doc<"prospects"> | null
) {
  if (!oldDoc || !newDoc) {
    return false;
  }

  const changedKeys = new Set<string>();
  for (const key of new Set([...Object.keys(oldDoc), ...Object.keys(newDoc)])) {
    if (
      !areJsonValuesEqual(
        oldDoc[key as keyof Doc<"prospects">],
        newDoc[key as keyof Doc<"prospects">]
      )
    ) {
      changedKeys.add(key);
    }
  }

  return (
    changedKeys.size > 0 &&
    Array.from(changedKeys).every((key) =>
      PROSPECT_WORKFLOW_BOOKKEEPING_FIELDS.has(key)
    )
  );
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

  const nextSummary = args.newDoc
    ? buildProspectSummaryRecord(args.newDoc)
    : null;
  if (args.oldDoc && nextSummary) {
    const previousSummary = buildProspectSummaryRecord(args.oldDoc);
    const sourcePatch = buildChangedPatchWithUpdatedAt(
      previousSummary as unknown as Record<string, unknown>,
      nextSummary as unknown as Record<string, unknown>,
      nextSummary.updatedAt
    );
    if (!sourcePatch) {
      return;
    }
  }

  const existing = await db
    .query("prospectSummaries")
    .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
    .first();

  if (!nextSummary) {
    if (existing) {
      await db.delete(existing._id);
    }
    return;
  }

  if (existing) {
    const patch = buildChangedPatchWithUpdatedAt(
      existing as unknown as Record<string, unknown>,
      nextSummary as unknown as Record<string, unknown>,
      nextSummary.updatedAt
    );
    if (patch) {
      await db.patch(existing._id, patch);
    }
  } else {
    await db.insert("prospectSummaries", nextSummary);
  }
}

async function applyWorkspaceStatsChanges(
  db: TriggerDb,
  args: {
    sourceKey: string;
    remove?: TargetedWorkspaceStatsContribution[];
    add?: TargetedWorkspaceStatsContribution[];
  }
) {
  const groups = new Map<
    string,
    {
      workspaceId: Id<"workspaces">;
      userId: Id<"users">;
      stripe: number;
      remove: WorkspaceStatsContribution[];
      add: WorkspaceStatsContribution[];
    }
  >();
  const stripe = getReadModelStripe(args.sourceKey);

  for (const entry of args.remove ?? []) {
    const key = `${entry.workspaceId}:${stripe}`;
    const group = groups.get(key) ?? {
      workspaceId: entry.workspaceId,
      userId: entry.userId,
      stripe,
      remove: [],
      add: [],
    };
    group.remove.push(entry.contribution);
    groups.set(key, group);
  }

  for (const entry of args.add ?? []) {
    const key = `${entry.workspaceId}:${stripe}`;
    const group = groups.get(key) ?? {
      workspaceId: entry.workspaceId,
      userId: entry.userId,
      stripe,
      remove: [],
      add: [],
    };
    group.userId = entry.userId;
    group.add.push(entry.contribution);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const existing = await db
      .query("workspaceStatsStripes")
      .withIndex("by_workspace_and_stripe", (q) =>
        q.eq("workspaceId", group.workspaceId).eq("stripe", group.stripe)
      )
      .unique();

    const next = mergeWorkspaceStatsStripeContributions(existing, {
      workspaceId: group.workspaceId,
      userId: group.userId,
      remove: group.remove,
      add: group.add,
    });

    if (isWorkspaceStatsStripeEmpty(next)) {
      if (existing) await db.delete(existing._id);
    } else if (existing) {
      await db.patch(existing._id, next);
    } else {
      await db.insert("workspaceStatsStripes", {
        ...next,
        stripe: group.stripe,
      });
    }
  }
}

async function applyWorkspaceAnalyticsChanges(
  db: TriggerDb,
  args: {
    sourceKey: string;
    remove?: TargetedWorkspaceAnalyticsContribution[];
    add?: TargetedWorkspaceAnalyticsContribution[];
  }
) {
  const groups = new Map<
    string,
    {
      workspaceId: Id<"workspaces">;
      dayStartUtcMs: number;
      stripe: number;
      remove: TargetedWorkspaceAnalyticsContribution["contribution"][];
      add: TargetedWorkspaceAnalyticsContribution["contribution"][];
    }
  >();
  const stripe = getReadModelStripe(args.sourceKey);

  for (const entry of args.remove ?? []) {
    const key = `${entry.workspaceId}:${entry.dayStartUtcMs}:${stripe}`;
    const group = groups.get(key) ?? {
      workspaceId: entry.workspaceId,
      dayStartUtcMs: entry.dayStartUtcMs,
      stripe,
      remove: [],
      add: [],
    };
    group.remove.push(entry.contribution);
    groups.set(key, group);
  }

  for (const entry of args.add ?? []) {
    const key = `${entry.workspaceId}:${entry.dayStartUtcMs}:${stripe}`;
    const group = groups.get(key) ?? {
      workspaceId: entry.workspaceId,
      dayStartUtcMs: entry.dayStartUtcMs,
      stripe,
      remove: [],
      add: [],
    };
    group.add.push(entry.contribution);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const existing = await db
      .query("workspaceAnalyticsDailyStripes")
      .withIndex("by_workspace_day_and_stripe", (q) =>
        q
          .eq("workspaceId", group.workspaceId)
          .eq("dayStartUtcMs", group.dayStartUtcMs)
          .eq("stripe", group.stripe)
      )
      .unique();

    const next = mergeWorkspaceAnalyticsStripeContributions(existing, {
      workspaceId: group.workspaceId,
      dayStartUtcMs: group.dayStartUtcMs,
      remove: group.remove,
      add: group.add,
    });

    if (isWorkspaceAnalyticsStripeEmpty(next)) {
      if (existing) {
        await db.delete(existing._id);
      }
      continue;
    }

    if (existing) {
      await db.patch(existing._id, next);
    } else {
      await db.insert("workspaceAnalyticsDailyStripes", {
        ...next,
        stripe: group.stripe,
      });
    }
  }
}

async function applyWorkspaceAgentOpsChanges(
  db: TriggerDb,
  args: {
    sourceKey: string;
    remove?: TargetedWorkspaceAgentOpsContribution[];
    add?: TargetedWorkspaceAgentOpsContribution[];
  }
) {
  const groups = new Map<
    string,
    {
      workspaceId: Id<"workspaces">;
      dayStartUtcMs: number;
      stripe: number;
      remove: TargetedWorkspaceAgentOpsContribution["contribution"][];
      add: TargetedWorkspaceAgentOpsContribution["contribution"][];
    }
  >();
  const stripe = getReadModelStripe(args.sourceKey);

  for (const entry of args.remove ?? []) {
    const key = `${entry.workspaceId}:${entry.dayStartUtcMs}:${stripe}`;
    const group = groups.get(key) ?? {
      workspaceId: entry.workspaceId,
      dayStartUtcMs: entry.dayStartUtcMs,
      stripe,
      remove: [],
      add: [],
    };
    group.remove.push(entry.contribution);
    groups.set(key, group);
  }

  for (const entry of args.add ?? []) {
    const key = `${entry.workspaceId}:${entry.dayStartUtcMs}:${stripe}`;
    const group = groups.get(key) ?? {
      workspaceId: entry.workspaceId,
      dayStartUtcMs: entry.dayStartUtcMs,
      stripe,
      remove: [],
      add: [],
    };
    group.add.push(entry.contribution);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const existing = await db
      .query("workspaceAgentOpsDailyStripes")
      .withIndex("by_workspace_day_and_stripe", (q) =>
        q
          .eq("workspaceId", group.workspaceId)
          .eq("dayStartUtcMs", group.dayStartUtcMs)
          .eq("stripe", group.stripe)
      )
      .unique();

    const next = mergeWorkspaceAgentOpsStripeContributions(existing, {
      workspaceId: group.workspaceId,
      dayStartUtcMs: group.dayStartUtcMs,
      remove: group.remove,
      add: group.add,
    });

    if (isWorkspaceAgentOpsStripeEmpty(next)) {
      if (existing) {
        await db.delete(existing._id);
      }
      continue;
    }

    if (existing) {
      await db.patch(existing._id, next);
    } else {
      await db.insert("workspaceAgentOpsDailyStripes", {
        ...next,
        stripe: group.stripe,
      });
    }
  }
}

triggers.register("prospects", async (ctx, change) => {
  if (isProspectWorkflowBookkeepingOnlyChange(change.oldDoc, change.newDoc)) {
    return;
  }

  const oldStatsContribution = change.oldDoc
    ? getWorkspaceStatsContributionFromProspect(change.oldDoc)
    : null;
  const newStatsContribution = change.newDoc
    ? getWorkspaceStatsContributionFromProspect(change.newDoc)
    : null;
  const oldAnalyticsContributions = change.oldDoc
    ? getWorkspaceAnalyticsContributionsFromProspect(change.oldDoc)
    : [];
  const newAnalyticsContributions = change.newDoc
    ? getWorkspaceAnalyticsContributionsFromProspect(change.newDoc)
    : [];

  await syncProspectSummary(ctx.innerDb, {
    oldDoc: change.oldDoc,
    newDoc: change.newDoc,
  });

  await syncProspectFitScoreAggregate(ctx, {
    oldDoc: change.oldDoc,
    newDoc: change.newDoc,
  });

  if (!areJsonValuesEqual(oldStatsContribution, newStatsContribution)) {
    await applyWorkspaceStatsChanges(ctx.innerDb, {
      sourceKey: String(change.id),
      remove:
        change.oldDoc && oldStatsContribution
          ? [
              {
                workspaceId: change.oldDoc.workspaceId,
                userId: change.oldDoc.userId,
                contribution: oldStatsContribution,
              },
            ]
          : [],
      add:
        change.newDoc && newStatsContribution
          ? [
              {
                workspaceId: change.newDoc.workspaceId,
                userId: change.newDoc.userId,
                contribution: newStatsContribution,
              },
            ]
          : [],
    });
  }

  if (
    !areJsonValuesEqual(oldAnalyticsContributions, newAnalyticsContributions)
  ) {
    await applyWorkspaceAnalyticsChanges(ctx.innerDb, {
      sourceKey: String(change.id),
      remove: oldAnalyticsContributions,
      add: newAnalyticsContributions,
    });
  }
});

triggers.register("prospectActivityLog", async (ctx, change) => {
  await applyWorkspaceAnalyticsChanges(ctx.innerDb, {
    sourceKey: String(change.id),
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
    sourceKey: String(change.id),
    remove: change.oldDoc
      ? getWorkspaceAnalyticsContributionsFromPlan(change.oldDoc)
      : [],
    add: change.newDoc
      ? getWorkspaceAnalyticsContributionsFromPlan(change.newDoc)
      : [],
  });

  await syncProspectsOutreachProgress(
    ctx.innerDb,
    [change.oldDoc?.prospectId, change.newDoc?.prospectId].filter(
      (prospectId): prospectId is Id<"prospects"> => prospectId !== undefined
    )
  );
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
    sourceKey: String(change.id),
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

  await syncProspectsOutreachProgress(
    ctx.innerDb,
    [oldPlan?.prospectId, newPlan?.prospectId].filter(
      (prospectId): prospectId is Id<"prospects"> => prospectId !== undefined
    )
  );
});

triggers.register("outreachNotifications", async (ctx, change) => {
  await applyWorkspaceStatsChanges(ctx.innerDb, {
    sourceKey: String(change.id),
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

triggers.register("keywords", async (ctx, change) => {
  await applyWorkspaceAgentOpsChanges(ctx.innerDb, {
    sourceKey: String(change.id),
    remove: change.oldDoc
      ? getWorkspaceAgentOpsContributionsFromKeyword(change.oldDoc)
      : [],
    add: change.newDoc
      ? getWorkspaceAgentOpsContributionsFromKeyword(change.newDoc)
      : [],
  });
});

triggers.register("queryCandidates", async (ctx, change) => {
  await applyWorkspaceAgentOpsChanges(ctx.innerDb, {
    sourceKey: String(change.id),
    remove: change.oldDoc
      ? getWorkspaceAgentOpsContributionsFromQueryCandidate(change.oldDoc)
      : [],
    add: change.newDoc
      ? getWorkspaceAgentOpsContributionsFromQueryCandidate(change.newDoc)
      : [],
  });
});

triggers.register("memorySuggestions", async (ctx, change) => {
  await applyWorkspaceAgentOpsChanges(ctx.innerDb, {
    sourceKey: String(change.id),
    remove: change.oldDoc
      ? getWorkspaceAgentOpsContributionsFromMemorySuggestion(change.oldDoc)
      : [],
    add: change.newDoc
      ? getWorkspaceAgentOpsContributionsFromMemorySuggestion(change.newDoc)
      : [],
  });
});

triggers.register("memoryWorkflowEvents", async (ctx, change) => {
  await applyWorkspaceAgentOpsChanges(ctx.innerDb, {
    sourceKey: String(change.id),
    remove: change.oldDoc
      ? getWorkspaceAgentOpsContributionsFromWorkflowEvent(change.oldDoc)
      : [],
    add: change.newDoc
      ? getWorkspaceAgentOpsContributionsFromWorkflowEvent(change.newDoc)
      : [],
  });
});

triggers.register("memoryEvaluatorRuns", async (ctx, change) => {
  await applyWorkspaceAgentOpsChanges(ctx.innerDb, {
    sourceKey: String(change.id),
    remove: change.oldDoc
      ? getWorkspaceAgentOpsContributionsFromEvaluatorRun(change.oldDoc)
      : [],
    add: change.newDoc
      ? getWorkspaceAgentOpsContributionsFromEvaluatorRun(change.newDoc)
      : [],
  });
});
