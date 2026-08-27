import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./lib/functionBuilders";
import { requireOwnedWorkspace, requireUser } from "./lib/accessHelpers";
import { classifyQualificationActivityTitle } from "./lib/prospectAnalyticsCore";
import {
  combineWorkspaceAnalyticsRecords,
  coerceWorkspaceAnalyticsDailyForMerge,
  getWorkspaceAnalyticsContributionFromActivityLog,
  getWorkspaceAnalyticsContributionsFromPlan,
  getWorkspaceAnalyticsContributionsFromProspect,
  getWorkspaceAnalyticsContributionsFromTask,
  isWorkspaceAnalyticsRecordEmpty,
  mergeWorkspaceAnalyticsContributions,
  type TargetedWorkspaceAnalyticsContribution,
  type WorkspaceAnalyticsDailyRecord,
} from "./lib/readModelHelpers";
import { outreachPlanStatusValidator } from "./validators";

export type AnalyticsDb = QueryCtx["db"] | MutationCtx["db"];

export async function listWorkspaceAnalyticsDailyRows(args: {
  db: AnalyticsDb;
  workspaceId: Id<"workspaces">;
  startDayStartUtcMs?: number;
  endDayStartUtcMs?: number;
}) {
  const listBaselineRows = async () => {
    if (
      args.startDayStartUtcMs !== undefined &&
      args.endDayStartUtcMs !== undefined
    ) {
      return await args.db
        .query("workspaceAnalyticsDaily")
        .withIndex("by_workspace_day", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .gte("dayStartUtcMs", args.startDayStartUtcMs!)
            .lte("dayStartUtcMs", args.endDayStartUtcMs!)
        )
        .collect();
    }
    if (args.startDayStartUtcMs !== undefined) {
      return await args.db
        .query("workspaceAnalyticsDaily")
        .withIndex("by_workspace_day", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .gte("dayStartUtcMs", args.startDayStartUtcMs!)
        )
        .collect();
    }
    if (args.endDayStartUtcMs !== undefined) {
      return await args.db
        .query("workspaceAnalyticsDaily")
        .withIndex("by_workspace_day", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .lte("dayStartUtcMs", args.endDayStartUtcMs!)
        )
        .collect();
    }
    return await args.db
      .query("workspaceAnalyticsDaily")
      .withIndex("by_workspace_day", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .collect();
  };

  const listStripeRows = async () => {
    if (
      args.startDayStartUtcMs !== undefined &&
      args.endDayStartUtcMs !== undefined
    ) {
      return await args.db
        .query("workspaceAnalyticsDailyStripes")
        .withIndex("by_workspace_day_and_stripe", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .gte("dayStartUtcMs", args.startDayStartUtcMs!)
            .lte("dayStartUtcMs", args.endDayStartUtcMs!)
        )
        .collect();
    }
    if (args.startDayStartUtcMs !== undefined) {
      return await args.db
        .query("workspaceAnalyticsDailyStripes")
        .withIndex("by_workspace_day_and_stripe", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .gte("dayStartUtcMs", args.startDayStartUtcMs!)
        )
        .collect();
    }
    if (args.endDayStartUtcMs !== undefined) {
      return await args.db
        .query("workspaceAnalyticsDailyStripes")
        .withIndex("by_workspace_day_and_stripe", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .lte("dayStartUtcMs", args.endDayStartUtcMs!)
        )
        .collect();
    }
    return await args.db
      .query("workspaceAnalyticsDailyStripes")
      .withIndex("by_workspace_day_and_stripe", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .collect();
  };

  const [baselineRows, stripeRows] = await Promise.all([
    listBaselineRows(),
    listStripeRows(),
  ]);
  const baselines = new Map(
    baselineRows.map((row) => [
      row.dayStartUtcMs,
      coerceWorkspaceAnalyticsDailyForMerge(row),
    ])
  );
  const stripesByDay = new Map<number, WorkspaceAnalyticsDailyRecord[]>();
  for (const stripe of stripeRows) {
    const rows = stripesByDay.get(stripe.dayStartUtcMs) ?? [];
    rows.push(stripe);
    stripesByDay.set(stripe.dayStartUtcMs, rows);
  }
  const days = new Set([...baselines.keys(), ...stripesByDay.keys()]);

  return Array.from(days)
    .sort((left, right) => left - right)
    .map((dayStartUtcMs) =>
      combineWorkspaceAnalyticsRecords({
        workspaceId: args.workspaceId,
        dayStartUtcMs,
        baseline: baselines.get(dayStartUtcMs) ?? null,
        stripes: stripesByDay.get(dayStartUtcMs) ?? [],
      })
    );
}

export const listWorkspaceAnalyticsDailyInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    startDayStartUtcMs: v.optional(v.number()),
    endDayStartUtcMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await listWorkspaceAnalyticsDailyRows({
      db: ctx.db,
      workspaceId: args.workspaceId,
      startDayStartUtcMs: args.startDayStartUtcMs,
      endDayStartUtcMs: args.endDayStartUtcMs,
    });
  },
});

const OUTREACH_PLAN_STATUSES = [
  "draft",
  "approved",
  "executing",
  "paused",
  "blocked_auth",
  "completed",
  "abandoned",
] as const;

const ANALYTICS_REBUILD_PROSPECT_PAGE_SIZE = 100;
const ANALYTICS_REBUILD_ACTIVITY_PAGE_SIZE = 200;
const ANALYTICS_REBUILD_PLAN_PAGE_SIZE = 50;
const ANALYTICS_REBUILD_TASK_PAGE_SIZE = 100;
const ANALYTICS_REBUILD_INSERT_CHUNK_SIZE = 50;

function applyAnalyticsContributionToMap(
  analyticsByDay: Map<string, WorkspaceAnalyticsDailyRecord>,
  targeted: TargetedWorkspaceAnalyticsContribution
) {
  const key = `${targeted.workspaceId}:${targeted.dayStartUtcMs}`;
  const current = analyticsByDay.get(key) ?? null;
  const next = mergeWorkspaceAnalyticsContributions(current, {
    workspaceId: targeted.workspaceId,
    dayStartUtcMs: targeted.dayStartUtcMs,
    add: [targeted.contribution],
  });

  if (isWorkspaceAnalyticsRecordEmpty(next)) {
    analyticsByDay.delete(key);
    return;
  }

  analyticsByDay.set(key, next);
}

function updateQualificationActivitySnapshot(
  snapshots: Map<
    Id<"prospects">,
    {
      latestQualifiedAt?: number;
      latestDisqualifiedAt?: number;
    }
  >,
  activity: Pick<
    Doc<"prospectActivityLog">,
    "prospectId" | "type" | "title" | "_creationTime"
  >
) {
  if (activity.type !== "qualified") {
    return;
  }

  const classification = classifyQualificationActivityTitle(activity.title);
  if (!classification) {
    return;
  }

  const snapshot = snapshots.get(activity.prospectId) ?? {};
  if (classification === "qualified") {
    snapshot.latestQualifiedAt = Math.max(
      snapshot.latestQualifiedAt ?? 0,
      activity._creationTime
    );
  } else {
    snapshot.latestDisqualifiedAt = Math.max(
      snapshot.latestDisqualifiedAt ?? 0,
      activity._creationTime
    );
  }
  snapshots.set(activity.prospectId, snapshot);
}

export const listWorkspaceProspectsPageForAnalyticsRebuildInternal =
  internalQuery({
    args: {
      workspaceId: v.id("workspaces"),
      paginationOpts: paginationOptsValidator,
    },
    handler: async (ctx, { workspaceId, paginationOpts }) => {
      return await ctx.db
        .query("prospects")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .paginate(paginationOpts);
    },
  });

export const listWorkspaceActivityLogPageForAnalyticsRebuildInternal =
  internalQuery({
    args: {
      workspaceId: v.id("workspaces"),
      paginationOpts: paginationOptsValidator,
    },
    handler: async (ctx, { workspaceId, paginationOpts }) => {
      return await ctx.db
        .query("prospectActivityLog")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .paginate(paginationOpts);
    },
  });

export const listWorkspacePlansPageForAnalyticsRebuildInternal = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    status: outreachPlanStatusValidator,
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { workspaceId, status, paginationOpts }) => {
    return await ctx.db
      .query("outreachPlans")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", workspaceId).eq("status", status)
      )
      .paginate(paginationOpts);
  },
});

export const listPlanTasksPageForAnalyticsRebuildInternal = internalQuery({
  args: {
    planId: v.id("outreachPlans"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { planId, paginationOpts }) => {
    return await ctx.db
      .query("outreachTasks")
      .withIndex("by_plan_order", (q) => q.eq("planId", planId))
      .paginate(paginationOpts);
  },
});

export const clearWorkspaceAnalyticsDailyRowsInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const [existingRows, existingStripes] = await Promise.all([
      ctx.db
        .query("workspaceAnalyticsDaily")
        .withIndex("by_workspace_day", (q) => q.eq("workspaceId", workspaceId))
        .collect(),
      ctx.db
        .query("workspaceAnalyticsDailyStripes")
        .withIndex("by_workspace_day_and_stripe", (q) =>
          q.eq("workspaceId", workspaceId)
        )
        .collect(),
    ]);

    for (const row of [...existingRows, ...existingStripes]) {
      await ctx.db.delete(row._id);
    }

    return {
      workspaceId,
      deletedCount: existingRows.length + existingStripes.length,
    };
  },
});

export const insertWorkspaceAnalyticsDailyRowsChunkInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    rows: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows as WorkspaceAnalyticsDailyRecord[]) {
      await ctx.db.insert("workspaceAnalyticsDaily", row);
    }

    return {
      workspaceId: args.workspaceId,
      insertedCount: args.rows.length,
    };
  },
});

export const rebuildWorkspaceAnalyticsDailyInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (
    ctx,
    { workspaceId }
  ): Promise<{
    workspaceId: Id<"workspaces">;
    analyticsRowsRebuilt: number;
    prospectsProcessed: number;
    activityLogsProcessed: number;
    plansProcessed: number;
    tasksProcessed: number;
  }> => {
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId,
    });
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const analyticsByDay = new Map<string, WorkspaceAnalyticsDailyRecord>();
    const qualificationSnapshots = new Map<
      Id<"prospects">,
      {
        latestQualifiedAt?: number;
        latestDisqualifiedAt?: number;
      }
    >();

    let prospectsProcessed = 0;
    let activityLogsProcessed = 0;
    let plansProcessed = 0;
    let tasksProcessed = 0;

    let activityCursor: string | null = null;
    while (true) {
      const activityPage = (await ctx.runQuery(
        internal.workspaceAnalyticsDaily
          .listWorkspaceActivityLogPageForAnalyticsRebuildInternal,
        {
          workspaceId,
          paginationOpts: {
            cursor: activityCursor,
            numItems: ANALYTICS_REBUILD_ACTIVITY_PAGE_SIZE,
          },
        }
      )) as {
        page: Doc<"prospectActivityLog">[];
        continueCursor: string;
        isDone: boolean;
      };

      activityLogsProcessed += activityPage.page.length;
      for (const activity of activityPage.page) {
        updateQualificationActivitySnapshot(qualificationSnapshots, activity);
      }

      if (activityPage.isDone) {
        break;
      }
      activityCursor = activityPage.continueCursor;
    }

    let prospectCursor: string | null = null;
    while (true) {
      const prospectPage = (await ctx.runQuery(
        internal.workspaceAnalyticsDaily
          .listWorkspaceProspectsPageForAnalyticsRebuildInternal,
        {
          workspaceId,
          paginationOpts: {
            cursor: prospectCursor,
            numItems: ANALYTICS_REBUILD_PROSPECT_PAGE_SIZE,
          },
        }
      )) as {
        page: Doc<"prospects">[];
        continueCursor: string;
        isDone: boolean;
      };

      prospectsProcessed += prospectPage.page.length;
      for (const prospect of prospectPage.page) {
        const snapshot = qualificationSnapshots.get(prospect._id);
        const qualificationSnapshot = snapshot
          ? {
              qualifiedAt: snapshot.latestQualifiedAt,
              disqualifiedAt: snapshot.latestDisqualifiedAt,
            }
          : undefined;

        for (const targeted of getWorkspaceAnalyticsContributionsFromProspect(
          prospect,
          qualificationSnapshot
        )) {
          applyAnalyticsContributionToMap(analyticsByDay, targeted);
        }
      }

      if (prospectPage.isDone) {
        break;
      }
      prospectCursor = prospectPage.continueCursor;
    }

    activityCursor = null;
    while (true) {
      const activityPage = (await ctx.runQuery(
        internal.workspaceAnalyticsDaily
          .listWorkspaceActivityLogPageForAnalyticsRebuildInternal,
        {
          workspaceId,
          paginationOpts: {
            cursor: activityCursor,
            numItems: ANALYTICS_REBUILD_ACTIVITY_PAGE_SIZE,
          },
        }
      )) as {
        page: Doc<"prospectActivityLog">[];
        continueCursor: string;
        isDone: boolean;
      };

      for (const activity of activityPage.page) {
        const targeted =
          getWorkspaceAnalyticsContributionFromActivityLog(activity);
        if (!targeted) {
          continue;
        }
        applyAnalyticsContributionToMap(analyticsByDay, targeted);
      }

      if (activityPage.isDone) {
        break;
      }
      activityCursor = activityPage.continueCursor;
    }

    for (const status of OUTREACH_PLAN_STATUSES) {
      let planCursor: string | null = null;
      while (true) {
        const planPage = (await ctx.runQuery(
          internal.workspaceAnalyticsDaily
            .listWorkspacePlansPageForAnalyticsRebuildInternal,
          {
            workspaceId,
            status,
            paginationOpts: {
              cursor: planCursor,
              numItems: ANALYTICS_REBUILD_PLAN_PAGE_SIZE,
            },
          }
        )) as {
          page: Doc<"outreachPlans">[];
          continueCursor: string;
          isDone: boolean;
        };

        plansProcessed += planPage.page.length;
        for (const plan of planPage.page) {
          for (const targeted of getWorkspaceAnalyticsContributionsFromPlan(
            plan
          )) {
            applyAnalyticsContributionToMap(analyticsByDay, targeted);
          }

          let taskCursor: string | null = null;
          while (true) {
            const taskPage = (await ctx.runQuery(
              internal.workspaceAnalyticsDaily
                .listPlanTasksPageForAnalyticsRebuildInternal,
              {
                planId: plan._id,
                paginationOpts: {
                  cursor: taskCursor,
                  numItems: ANALYTICS_REBUILD_TASK_PAGE_SIZE,
                },
              }
            )) as {
              page: Doc<"outreachTasks">[];
              continueCursor: string;
              isDone: boolean;
            };

            tasksProcessed += taskPage.page.length;
            for (const task of taskPage.page) {
              for (const targeted of getWorkspaceAnalyticsContributionsFromTask(
                {
                  task,
                  workspaceId,
                }
              )) {
                applyAnalyticsContributionToMap(analyticsByDay, targeted);
              }
            }

            if (taskPage.isDone) {
              break;
            }
            taskCursor = taskPage.continueCursor;
          }
        }

        if (planPage.isDone) {
          break;
        }
        planCursor = planPage.continueCursor;
      }
    }

    const rows = [...analyticsByDay.values()].sort(
      (left, right) => left.dayStartUtcMs - right.dayStartUtcMs
    );

    await ctx.runMutation(
      internal.workspaceAnalyticsDaily.clearWorkspaceAnalyticsDailyRowsInternal,
      {
        workspaceId,
      }
    );

    for (
      let index = 0;
      index < rows.length;
      index += ANALYTICS_REBUILD_INSERT_CHUNK_SIZE
    ) {
      await ctx.runMutation(
        internal.workspaceAnalyticsDaily
          .insertWorkspaceAnalyticsDailyRowsChunkInternal,
        {
          workspaceId,
          rows: rows.slice(index, index + ANALYTICS_REBUILD_INSERT_CHUNK_SIZE),
        }
      );
    }

    return {
      workspaceId,
      analyticsRowsRebuilt: rows.length,
      prospectsProcessed,
      activityLogsProcessed,
      plansProcessed,
      tasksProcessed,
    };
  },
});

export const listWorkspaceAnalyticsDaily = query({
  args: {
    workspaceId: v.id("workspaces"),
    startDayStartUtcMs: v.optional(v.number()),
    endDayStartUtcMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, { notFoundMessage: "User not found" });
    await requireOwnedWorkspace(ctx, args.workspaceId, {
      user,
      notFoundMessage: "Workspace not found",
      notAuthorizedMessage: "Not authorized to view this workspace",
    });

    return await listWorkspaceAnalyticsDailyRows({
      db: ctx.db,
      workspaceId: args.workspaceId,
      startDayStartUtcMs: args.startDayStartUtcMs,
      endDayStartUtcMs: args.endDayStartUtcMs,
    });
  },
});
