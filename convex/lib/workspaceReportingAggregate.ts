import { DirectAggregate } from "@convex-dev/aggregate";
import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import { components } from "../_generated/api";
import type { DataModel, Id } from "../_generated/dataModel";
import {
  AGENT_OPS_HOURLY_FIELDS,
  createEmptyWorkspaceAgentOpsDailyRecord,
  type TargetedWorkspaceAgentOpsContribution,
  type WorkspaceAgentOpsDailyRecord,
} from "./agentOpsReadModelHelpers";
import {
  WORKSPACE_ANALYTICS_HOURLY_FIELDS,
  createEmptyWorkspaceAnalyticsDailyRecord,
  type TargetedWorkspaceAnalyticsContribution,
  type WorkspaceAnalyticsDailyRecord,
} from "./readModelHelpers";
import type { TimeWindow, TrendBucketSet } from "./analyticsCore";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";

export const WORKSPACE_REPORTING_AGGREGATE_VERSION = 1;

export type WorkspaceReportingDataset = "analytics" | "agentOps" | "usage";
export type WorkspaceAnalyticsMetric =
  (typeof WORKSPACE_ANALYTICS_HOURLY_FIELDS)[number];
export type WorkspaceAgentOpsMetric = (typeof AGENT_OPS_HOURLY_FIELDS)[number];
export type WorkspaceReportingMetric =
  | WorkspaceAnalyticsMetric
  | WorkspaceAgentOpsMetric
  | "qualifiedProspectsCount";

type WorkspaceReportingNamespace = [
  version: number,
  workspaceId: Id<"workspaces">,
  dataset: WorkspaceReportingDataset,
];
type WorkspaceReportingKey = [
  metric: WorkspaceReportingMetric,
  hourStartUtcMs: number,
];
type WorkspaceReportingAggregate = {
  Namespace: WorkspaceReportingNamespace;
  Key: WorkspaceReportingKey;
  Id: string;
};

type AggregateItem = {
  namespace: WorkspaceReportingNamespace;
  key: WorkspaceReportingKey;
  id: string;
  sumValue: number;
};

type AnalyticsTarget = TargetedWorkspaceAnalyticsContribution;
type AgentOpsTarget = TargetedWorkspaceAgentOpsContribution;

const HOUR_MS = 60 * 60 * 1000;

const workspaceReportingAggregate =
  new DirectAggregate<WorkspaceReportingAggregate>(
    components.workspaceReportingAggregate
  );

function buildAggregateItems(args: {
  dataset: WorkspaceReportingDataset;
  sourceKey: string;
  targets: AnalyticsTarget[] | AgentOpsTarget[];
}) {
  const fields =
    args.dataset === "analytics"
      ? WORKSPACE_ANALYTICS_HOURLY_FIELDS
      : AGENT_OPS_HOURLY_FIELDS;
  const items = new Map<string, AggregateItem>();

  for (const target of args.targets) {
    for (const metric of fields) {
      const hourlyValues = target.contribution[metric as never] as number[];
      for (let hour = 0; hour < hourlyValues.length; hour += 1) {
        const value = hourlyValues[hour] ?? 0;
        if (value === 0) continue;

        const hourStartUtcMs = target.dayStartUtcMs + hour * HOUR_MS;
        const namespace: WorkspaceReportingNamespace = [
          WORKSPACE_REPORTING_AGGREGATE_VERSION,
          target.workspaceId,
          args.dataset,
        ];
        const key: WorkspaceReportingKey = [metric, hourStartUtcMs];
        const id = `${args.sourceKey}:${metric}:${hourStartUtcMs}`;
        const mapKey = `${String(target.workspaceId)}:${args.dataset}:${id}`;
        const existing = items.get(mapKey);
        if (existing) {
          existing.sumValue += value;
        } else {
          items.set(mapKey, { namespace, key, id, sumValue: value });
        }
      }
    }
  }

  return items;
}

function aggregateItemsEqual(left: AggregateItem, right: AggregateItem) {
  return (
    left.sumValue === right.sumValue &&
    left.key[0] === right.key[0] &&
    left.key[1] === right.key[1] &&
    left.namespace[0] === right.namespace[0] &&
    left.namespace[1] === right.namespace[1] &&
    left.namespace[2] === right.namespace[2]
  );
}

async function syncAggregateItems(
  ctx: GenericMutationCtx<DataModel>,
  oldItems: Map<string, AggregateItem>,
  newItems: Map<string, AggregateItem>
) {
  const workspaceIds = new Set<Id<"workspaces">>();
  for (const item of oldItems.values()) workspaceIds.add(item.namespace[1]);
  for (const item of newItems.values()) workspaceIds.add(item.namespace[1]);

  const enabledWorkspaceIds = new Set<Id<"workspaces">>();
  for (const workspaceId of workspaceIds) {
    const rollout = await ctx.db
      .query("workspaceReportingRollouts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .unique();
    if (
      rollout?.aggregateVersion === WORKSPACE_REPORTING_AGGREGATE_VERSION &&
      (rollout.status === "preparing" ||
        rollout.status === "backfilling" ||
        rollout.status === "verifying" ||
        rollout.status === "verified")
    ) {
      enabledWorkspaceIds.add(workspaceId);
      if (rollout.status === "preparing") {
        await ctx.db.patch("workspaceReportingRollouts", rollout._id, {
          preparationVersion: (rollout.preparationVersion ?? 0) + 1,
          updatedAt: getCurrentUTCTimestamp(),
        });
      }
    }
  }

  // Existing workspaces stay snapshot-only until their rollout starts. This
  // also prevents preparation repairs from paying Aggregate B-tree costs for
  // every repaired row before the resumable backfill checkpoint exists.
  for (const [mapKey, oldItem] of oldItems) {
    if (!enabledWorkspaceIds.has(oldItem.namespace[1])) continue;
    const newItem = newItems.get(mapKey);
    if (!newItem) {
      await workspaceReportingAggregate.deleteIfExists(ctx, oldItem);
      continue;
    }
    if (!aggregateItemsEqual(oldItem, newItem)) {
      await workspaceReportingAggregate.replaceOrInsert(ctx, oldItem, newItem);
    }
  }

  for (const [mapKey, newItem] of newItems) {
    if (!enabledWorkspaceIds.has(newItem.namespace[1])) continue;
    if (!oldItems.has(mapKey)) {
      await workspaceReportingAggregate.insertIfDoesNotExist(ctx, newItem);
    }
  }
}

export async function syncWorkspaceAnalyticsReportingAggregate(
  ctx: GenericMutationCtx<DataModel>,
  args: {
    sourceKey: string;
    remove?: AnalyticsTarget[];
    add?: AnalyticsTarget[];
  }
) {
  await syncAggregateItems(
    ctx,
    buildAggregateItems({
      dataset: "analytics",
      sourceKey: args.sourceKey,
      targets: args.remove ?? [],
    }),
    buildAggregateItems({
      dataset: "analytics",
      sourceKey: args.sourceKey,
      targets: args.add ?? [],
    })
  );
}

export async function syncWorkspaceAgentOpsReportingAggregate(
  ctx: GenericMutationCtx<DataModel>,
  args: {
    sourceKey: string;
    remove?: AgentOpsTarget[];
    add?: AgentOpsTarget[];
  }
) {
  await syncAggregateItems(
    ctx,
    buildAggregateItems({
      dataset: "agentOps",
      sourceKey: args.sourceKey,
      targets: args.remove ?? [],
    }),
    buildAggregateItems({
      dataset: "agentOps",
      sourceKey: args.sourceKey,
      targets: args.add ?? [],
    })
  );
}

function buildQualifiedUsageItem(
  sourceKey: string,
  prospect: {
    workspaceId: Id<"workspaces">;
    origin: string;
    qualificationStatus?: string;
    qualifiedAt?: number;
  } | null
): AggregateItem | null {
  if (
    !prospect ||
    prospect.origin === "setup_preview" ||
    prospect.qualificationStatus !== "qualified" ||
    typeof prospect.qualifiedAt !== "number"
  ) {
    return null;
  }
  return {
    namespace: [
      WORKSPACE_REPORTING_AGGREGATE_VERSION,
      prospect.workspaceId,
      "usage",
    ],
    key: ["qualifiedProspectsCount", prospect.qualifiedAt],
    id: sourceKey,
    sumValue: 1,
  };
}

export async function syncWorkspaceQualifiedUsageAggregate(
  ctx: GenericMutationCtx<DataModel>,
  args: {
    sourceKey: string;
    oldProspect: Parameters<typeof buildQualifiedUsageItem>[1];
    newProspect: Parameters<typeof buildQualifiedUsageItem>[1];
  }
) {
  const oldItem = buildQualifiedUsageItem(args.sourceKey, args.oldProspect);
  const newItem = buildQualifiedUsageItem(args.sourceKey, args.newProspect);
  const oldItems = new Map<string, AggregateItem>();
  const newItems = new Map<string, AggregateItem>();
  if (oldItem) oldItems.set(oldItem.id, oldItem);
  if (newItem) newItems.set(newItem.id, newItem);
  await syncAggregateItems(ctx, oldItems, newItems);
}

export async function getWorkspaceReportingMetricSums<
  Metric extends WorkspaceReportingMetric,
>(
  ctx: GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>,
  args: {
    workspaceId: Id<"workspaces">;
    dataset: WorkspaceReportingDataset;
    queries: Array<{
      metric: Metric;
      startMs: number;
      endMs: number;
    }>;
  }
) {
  if (args.queries.length === 0) return [];

  return await workspaceReportingAggregate.sumBatch(
    ctx,
    args.queries.map((query) => ({
      namespace: [
        WORKSPACE_REPORTING_AGGREGATE_VERSION,
        args.workspaceId,
        args.dataset,
      ] satisfies WorkspaceReportingNamespace,
      bounds: {
        lower: {
          key: [query.metric, query.startMs] satisfies WorkspaceReportingKey,
          inclusive: true,
        },
        upper: {
          key: [query.metric, query.endMs] satisfies WorkspaceReportingKey,
          inclusive: false,
        },
      },
    }))
  );
}

async function getSyntheticReportingRows(args: {
  ctx: GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;
  workspaceId: Id<"workspaces">;
  dataset: WorkspaceReportingDataset;
  fields: readonly WorkspaceReportingMetric[];
  bucketSet: TrendBucketSet;
  previousWindow: TimeWindow;
}) {
  const windows = [...args.bucketSet.buckets, args.previousWindow];
  const sums = await getWorkspaceReportingMetricSums(args.ctx, {
    workspaceId: args.workspaceId,
    dataset: args.dataset,
    queries: windows.flatMap((window) =>
      args.fields.map((metric) => ({
        metric,
        startMs: window.startMs,
        endMs: window.endMs,
      }))
    ),
  });

  return windows.map((window, windowIndex) => ({
    window,
    values: Object.fromEntries(
      args.fields.map((field, fieldIndex) => [
        field,
        sums[windowIndex * args.fields.length + fieldIndex] ?? 0,
      ])
    ) as Record<WorkspaceReportingMetric, number>,
  }));
}

export async function getWorkspaceAnalyticsAggregateRows(args: {
  ctx: GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;
  workspaceId: Id<"workspaces">;
  bucketSet: TrendBucketSet;
  previousWindow: TimeWindow;
}) {
  const snapshots = await getSyntheticReportingRows({
    ...args,
    dataset: "analytics",
    fields: WORKSPACE_ANALYTICS_HOURLY_FIELDS,
  });

  return snapshots.map(({ window, values }) => {
    const row = createEmptyWorkspaceAnalyticsDailyRecord({
      workspaceId: args.workspaceId,
      dayStartUtcMs: window.startMs,
    });
    for (const field of WORKSPACE_ANALYTICS_HOURLY_FIELDS) {
      row[field][0] = values[field];
    }
    return row;
  }) satisfies WorkspaceAnalyticsDailyRecord[];
}

export async function getWorkspaceAgentOpsAggregateRows(args: {
  ctx: GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;
  workspaceId: Id<"workspaces">;
  bucketSet: TrendBucketSet;
  previousWindow: TimeWindow;
}) {
  const snapshots = await getSyntheticReportingRows({
    ...args,
    dataset: "agentOps",
    fields: AGENT_OPS_HOURLY_FIELDS,
  });

  return snapshots.map(({ window, values }) => {
    const row = createEmptyWorkspaceAgentOpsDailyRecord({
      workspaceId: args.workspaceId,
      dayStartUtcMs: window.startMs,
    });
    for (const field of AGENT_OPS_HOURLY_FIELDS) {
      row[field][0] = values[field];
    }
    return row;
  }) satisfies WorkspaceAgentOpsDailyRecord[];
}

export async function clearWorkspaceReportingAggregate(
  ctx: GenericMutationCtx<DataModel>,
  workspaceId: Id<"workspaces">
) {
  for (const dataset of ["analytics", "agentOps", "usage"] as const) {
    await workspaceReportingAggregate.clear(ctx, {
      namespace: [WORKSPACE_REPORTING_AGGREGATE_VERSION, workspaceId, dataset],
      rootLazy: true,
    });
  }
}
