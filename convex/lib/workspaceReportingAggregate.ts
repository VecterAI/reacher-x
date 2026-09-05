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
import { getReadModelStripe } from "./readModelStripeHelpers";

// Version 1 put all concurrent source writes in one B-tree per dataset.
// Reuse the read model's stable source stripes; the existing versioned rollout
// retains version 1 reads/writes until an explicit per-workspace migration.
export const WORKSPACE_REPORTING_AGGREGATE_VERSION = 3;

export function isSupportedWorkspaceReportingVersion(version: number) {
  return (
    version === 1 ||
    version === 2 ||
    version === WORKSPACE_REPORTING_AGGREGATE_VERSION
  );
}
// Each dashboard metric/window opens an index range per stripe. Two partitions
// reduce writer contention while keeping the largest dashboard below Convex's
// 4096-range limit. Version 3 additionally isolates each metric's tree so a
// chart does not repeatedly read large nodes containing unrelated metrics.
export const WORKSPACE_REPORTING_STRIPE_COUNT = 2;

function reportingStripe(sourceKey: string) {
  return getReadModelStripe(sourceKey) % WORKSPACE_REPORTING_STRIPE_COUNT;
}

export type WorkspaceReportingDataset = "analytics" | "agentOps" | "usage";
export type WorkspaceAnalyticsMetric =
  (typeof WORKSPACE_ANALYTICS_HOURLY_FIELDS)[number];
export type WorkspaceAgentOpsMetric = (typeof AGENT_OPS_HOURLY_FIELDS)[number];
export type WorkspaceReportingMetric =
  | WorkspaceAnalyticsMetric
  | WorkspaceAgentOpsMetric
  | "qualifiedProspectsCount";

type WorkspaceReportingNamespace =
  | [
      version: number,
      workspaceId: Id<"workspaces">,
      dataset: WorkspaceReportingDataset,
    ]
  | [
      version: number,
      workspaceId: Id<"workspaces">,
      dataset: WorkspaceReportingDataset,
      stripe: number,
    ]
  | [
      version: number,
      workspaceId: Id<"workspaces">,
      dataset: WorkspaceReportingDataset,
      stripe: number,
      metric: WorkspaceReportingMetric,
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
          reportingStripe(args.sourceKey),
          metric,
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
    left.namespace[2] === right.namespace[2] &&
    left.namespace[3] === right.namespace[3] &&
    left.namespace[4] === right.namespace[4]
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

  const enabledWorkspaceVersions = new Map<Id<"workspaces">, number>();
  for (const workspaceId of workspaceIds) {
    const rollout = await ctx.db
      .query("workspaceReportingRollouts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .unique();
    if (
      rollout &&
      isSupportedWorkspaceReportingVersion(rollout.aggregateVersion) &&
      (rollout.status === "preparing" ||
        rollout.status === "backfilling" ||
        rollout.status === "verifying" ||
        rollout.status === "verified")
    ) {
      enabledWorkspaceVersions.set(workspaceId, rollout.aggregateVersion);
      if (rollout.status === "preparing") {
        await ctx.db.patch("workspaceReportingRollouts", rollout._id, {
          preparationVersion: (rollout.preparationVersion ?? 0) + 1,
          updatedAt: getCurrentUTCTimestamp(),
        });
      }
    }
  }

  // Existing verified v1 workspaces continue to read AND maintain their
  // original three-part namespaces. Deploying this code alone does not break
  // their dashboards or require pausing every workspace for a global cutover.
  for (const item of [...oldItems.values(), ...newItems.values()]) {
    if (enabledWorkspaceVersions.get(item.namespace[1]) === 1) {
      item.namespace = [1, item.namespace[1], item.namespace[2]];
    } else if (enabledWorkspaceVersions.get(item.namespace[1]) === 2) {
      const stripe = item.namespace[3];
      if (stripe === undefined)
        throw new Error("Reporting item is missing its source stripe");
      item.namespace = [2, item.namespace[1], item.namespace[2], stripe];
    }
  }

  // Existing workspaces stay snapshot-only until their rollout starts. This
  // also prevents preparation repairs from paying Aggregate B-tree costs for
  // every repaired row before the resumable backfill checkpoint exists.
  for (const [mapKey, oldItem] of oldItems) {
    if (!enabledWorkspaceVersions.has(oldItem.namespace[1])) continue;
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
    if (!enabledWorkspaceVersions.has(newItem.namespace[1])) continue;
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
      reportingStripe(sourceKey),
      "qualifiedProspectsCount",
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

  const rollout = await ctx.db
    .query("workspaceReportingRollouts")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
    .unique();
  const version =
    rollout && isSupportedWorkspaceReportingVersion(rollout.aggregateVersion)
      ? rollout.aggregateVersion
      : WORKSPACE_REPORTING_AGGREGATE_VERSION;
  const stripeCount = version === 1 ? 1 : WORKSPACE_REPORTING_STRIPE_COUNT;

  // Keep each component call bounded rather than multiplying the query array
  // beyond Convex's array limit. Sum disjoint stripes in the same read snapshot.
  const totals = args.queries.map(() => 0);
  for (let stripe = 0; stripe < stripeCount; stripe++) {
    const sums = await workspaceReportingAggregate.sumBatch(
      ctx,
      args.queries.map((query) => ({
        namespace: (version === 1
          ? [1, args.workspaceId, args.dataset]
          : version === 2
            ? [version, args.workspaceId, args.dataset, stripe]
            : [
                version,
                args.workspaceId,
                args.dataset,
                stripe,
                query.metric,
              ]) satisfies WorkspaceReportingNamespace,
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
    sums.forEach((sum, index) => {
      totals[index] += sum;
    });
  }
  return totals;
}

async function getSyntheticReportingRows(args: {
  ctx: GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;
  workspaceId: Id<"workspaces">;
  dataset: WorkspaceReportingDataset;
  fields: readonly WorkspaceReportingMetric[];
  trendFields?: readonly WorkspaceReportingMetric[];
  bucketSet: TrendBucketSet;
  previousWindow: TimeWindow;
}) {
  const windows = [...args.bucketSet.buckets, args.previousWindow];
  // Only charted metrics need one query per bucket. Other metrics are totals:
  // place their current-window value in the first synthetic row. This preserves
  // window sums without multiplying index reads by every unused chart bucket.
  const queries = windows.flatMap((window, windowIndex) =>
    args.fields.flatMap((metric) => {
      const charted = !args.trendFields || args.trendFields.includes(metric);
      if (!charted && windowIndex > 0 && windowIndex < windows.length - 1)
        return [];
      const range =
        !charted && windowIndex === 0 ? args.bucketSet.window : window;
      return [
        { metric, startMs: range.startMs, endMs: range.endMs, windowIndex },
      ];
    })
  );
  const sums = await getWorkspaceReportingMetricSums(args.ctx, {
    workspaceId: args.workspaceId,
    dataset: args.dataset,
    queries,
  });
  const values = new Map(
    queries.map((query, index) => [
      `${query.windowIndex}:${query.metric}`,
      sums[index] ?? 0,
    ])
  );

  return windows.map((window, windowIndex) => ({
    window,
    values: Object.fromEntries(
      args.fields.map((field) => [
        field,
        values.get(`${windowIndex}:${field}`) ?? 0,
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
    // Analytics charts new/contacted; Agent Ops additionally charts response rate.
    trendFields: [
      "hourlyNewProspectsCounts",
      "hourlyContactedEventsCounts",
      "hourlyRespondedEventsCounts",
    ],
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
    // These are the fields consumed by the per-bucket charts in agentOpsCore.
    // Suggestions, event totals and approvals only need current/previous sums.
    trendFields: [
      "hourlyKeywordsCreatedCounts",
      "hourlyQueriesGeneratedCounts",
      "hourlyQueriesReviewedCounts",
      "hourlyQueriesActivatedCounts",
      "hourlyQueriesRejectedExactDuplicateCounts",
      "hourlyQueriesRejectedSemanticDuplicateCounts",
      "hourlyMemoriesWrittenCounts",
      "hourlyHighImpactMemoriesCounts",
      "hourlyMemoryImpactScoreSums",
      "hourlyMemoryConfidenceSums",
      "hourlyRunsStartedCounts",
      "hourlyFailedRunsCounts",
      "hourlyQualificationCompletedCounts",
      "hourlyQualificationQualifiedCounts",
      "hourlyEnrichmentCompletedCounts",
      "hourlyEnrichmentPainPointCountSums",
    ],
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
  workspaceId: Id<"workspaces">,
  options?: { includeLegacyVersions?: boolean }
) {
  // Migration clears the destination version before changing the rollout row.
  // Deletion additionally removes retained legacy namespaces; never infer the
  // migration destination from the currently enabled (possibly old) version.
  for (const dataset of ["analytics", "agentOps", "usage"] as const) {
    if (options?.includeLegacyVersions) {
      const legacyNamespaces: WorkspaceReportingNamespace[] = [
        [1, workspaceId, dataset],
      ];
      for (let stripe = 0; stripe < WORKSPACE_REPORTING_STRIPE_COUNT; stripe++)
        legacyNamespaces.push([2, workspaceId, dataset, stripe]);
      for (const namespace of legacyNamespaces)
        await workspaceReportingAggregate.clear(ctx, {
          namespace,
          rootLazy: true,
          maxNodeSize: 32,
        });
    }
    const metrics: readonly WorkspaceReportingMetric[] =
      dataset === "analytics"
        ? WORKSPACE_ANALYTICS_HOURLY_FIELDS
        : dataset === "agentOps"
          ? AGENT_OPS_HOURLY_FIELDS
          : ["qualifiedProspectsCount"];
    for (const metric of metrics) {
      for (
        let stripe = 0;
        stripe < WORKSPACE_REPORTING_STRIPE_COUNT;
        stripe++
      ) {
        await workspaceReportingAggregate.clear(ctx, {
          namespace: [
            WORKSPACE_REPORTING_AGGREGATE_VERSION,
            workspaceId,
            dataset,
            stripe,
            metric,
          ],
          rootLazy: true,
          // Wider lazy roots keep more writes on independent child nodes.
          maxNodeSize: 32,
        });
      }
    }
  }
}
