import { DirectAggregate } from "@convex-dev/aggregate";
import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import { components } from "../_generated/api";
import type { DataModel, Doc, Id } from "../_generated/dataModel";

export const FIT_SCORE_BIN_COUNT = 10;
export const FIT_SCORE_AGGREGATE_VERSION = 1;

const PROSPECT_PLATFORMS = ["twitter", "linkedin"] as const;
const PROSPECT_TYPES = ["individual", "organization", "unknown"] as const;
const PROSPECT_STATUSES = [
  "new",
  "contacted",
  "in_progress",
  "converted",
  "archived",
] as const;

type FitScoreNamespace = [
  version: number,
  Id<"workspaces">,
  Doc<"prospects">["platform"],
  NonNullable<Doc<"prospects">["prospectType"]>,
  Doc<"prospects">["status"],
];
type FitScoreKey = [binIndex: number, prospectCreatedAt: number];
type FitScoreAggregate = {
  Namespace: FitScoreNamespace;
  Key: FitScoreKey;
  Id: string;
};

type AggregateSource = {
  id: Id<"prospects">;
  workspaceId: Id<"workspaces">;
  platform: Doc<"prospects">["platform"];
  prospectType?: Doc<"prospects">["prospectType"];
  status: Doc<"prospects">["status"];
  origin: Doc<"prospects">["origin"];
  qualificationScore?: number;
  prospectCreatedAt: number;
};

export type FitScoreHistogramFilters = {
  workspaceId: Id<"workspaces">;
  platform?: Doc<"prospects">["platform"];
  prospectType?: Doc<"prospects">["prospectType"];
  status?: Doc<"prospects">["status"];
  createdAfterMs?: number;
  createdBeforeMs?: number;
};

export type FitScoreAggregateItem = {
  namespace: FitScoreNamespace;
  key: FitScoreKey;
  id: string;
};

const fitScoreHistogramAggregate = new DirectAggregate<FitScoreAggregate>(
  components.fitScoreHistogramAggregate
);

function normalizeQualificationScore(score: number | undefined) {
  return typeof score === "number"
    ? Math.max(0, Math.min(100, Math.round(score)))
    : null;
}

export function getFitScoreBinIndex(score: number | undefined) {
  const normalizedScore = normalizeQualificationScore(score);
  return normalizedScore === null
    ? null
    : Math.min(FIT_SCORE_BIN_COUNT - 1, Math.floor(normalizedScore / 10));
}

export function buildFitScoreAggregateItem(
  source: AggregateSource
): FitScoreAggregateItem | null {
  const binIndex = getFitScoreBinIndex(source.qualificationScore);
  if (source.origin === "setup_preview" || binIndex === null) {
    return null;
  }

  return {
    namespace: [
      FIT_SCORE_AGGREGATE_VERSION,
      source.workspaceId,
      source.platform,
      source.prospectType ?? "unknown",
      source.status,
    ],
    key: [binIndex, source.prospectCreatedAt],
    id: String(source.id),
  };
}

export function buildFitScoreAggregateItemFromProspect(
  prospect: Doc<"prospects">
) {
  return buildFitScoreAggregateItem({
    id: prospect._id,
    workspaceId: prospect.workspaceId,
    platform: prospect.platform,
    prospectType: prospect.prospectType,
    status: prospect.status,
    origin: prospect.origin,
    qualificationScore: prospect.qualificationScore,
    prospectCreatedAt: prospect._creationTime,
  });
}

export function buildFitScoreAggregateItemFromSummary(
  summary: Doc<"prospectSummaries">
) {
  return buildFitScoreAggregateItem({
    id: summary.prospectId,
    workspaceId: summary.workspaceId,
    platform: summary.platform,
    prospectType: summary.prospectType,
    status: summary.status,
    origin: summary.origin,
    qualificationScore: summary.qualificationScore,
    prospectCreatedAt: summary.prospectCreatedAt,
  });
}

function areAggregateItemsEqual(
  left: FitScoreAggregateItem,
  right: FitScoreAggregateItem
) {
  return (
    left.id === right.id &&
    left.namespace.every((value, index) => value === right.namespace[index]) &&
    left.key.every((value, index) => value === right.key[index])
  );
}

async function hasAggregateRollout(
  ctx: Pick<GenericMutationCtx<DataModel>, "db">,
  workspaceId: Id<"workspaces">
) {
  return (
    (await ctx.db
      .query("fitScoreAggregateRollouts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .unique()) !== null
  );
}

export async function syncProspectFitScoreAggregate(
  ctx: GenericMutationCtx<DataModel>,
  change: {
    oldDoc: Doc<"prospects"> | null;
    newDoc: Doc<"prospects"> | null;
  }
) {
  const workspaceIds = new Set(
    [change.oldDoc?.workspaceId, change.newDoc?.workspaceId].filter(
      (workspaceId): workspaceId is Id<"workspaces"> =>
        workspaceId !== undefined
    )
  );
  const enabledWorkspaceIds = new Set<Id<"workspaces">>();
  for (const workspaceId of workspaceIds) {
    if (await hasAggregateRollout(ctx, workspaceId)) {
      enabledWorkspaceIds.add(workspaceId);
    }
  }

  const oldItem =
    change.oldDoc && enabledWorkspaceIds.has(change.oldDoc.workspaceId)
      ? buildFitScoreAggregateItemFromProspect(change.oldDoc)
      : null;
  const newItem =
    change.newDoc && enabledWorkspaceIds.has(change.newDoc.workspaceId)
      ? buildFitScoreAggregateItemFromProspect(change.newDoc)
      : null;

  if (oldItem && newItem) {
    if (areAggregateItemsEqual(oldItem, newItem)) {
      return;
    }
    await fitScoreHistogramAggregate.replaceOrInsert(ctx, oldItem, newItem);
    return;
  }
  if (oldItem) {
    await fitScoreHistogramAggregate.deleteIfExists(ctx, oldItem);
    return;
  }
  if (newItem) {
    await fitScoreHistogramAggregate.insertIfDoesNotExist(ctx, newItem);
  }
}

export async function backfillFitScoreAggregateItem(
  ctx: GenericMutationCtx<DataModel>,
  summary: Doc<"prospectSummaries">
) {
  const item = buildFitScoreAggregateItemFromSummary(summary);
  if (item) {
    await fitScoreHistogramAggregate.insertIfDoesNotExist(ctx, item);
  }
  return item;
}

function createHistogramCountQueries(filters: FitScoreHistogramFilters) {
  const platforms = filters.platform
    ? [filters.platform]
    : [...PROSPECT_PLATFORMS];
  const prospectTypes = filters.prospectType
    ? [filters.prospectType]
    : [...PROSPECT_TYPES];
  const statuses = filters.status ? [filters.status] : [...PROSPECT_STATUSES];
  const lowerCreatedAt = Math.round(
    filters.createdAfterMs ?? Number.MIN_SAFE_INTEGER
  );
  const upperCreatedAt = Math.round(
    filters.createdBeforeMs ?? Number.MAX_SAFE_INTEGER
  );

  if (
    lowerCreatedAt >= upperCreatedAt &&
    filters.createdBeforeMs !== undefined
  ) {
    return [];
  }

  return platforms.flatMap((platform) =>
    prospectTypes.flatMap((prospectType) =>
      statuses.flatMap((status) =>
        Array.from({ length: FIT_SCORE_BIN_COUNT }, (_, binIndex) => ({
          namespace: [
            FIT_SCORE_AGGREGATE_VERSION,
            filters.workspaceId,
            platform,
            prospectType,
            status,
          ] satisfies FitScoreNamespace,
          bounds: {
            lower: {
              key: [binIndex, lowerCreatedAt] satisfies FitScoreKey,
              inclusive: true,
            },
            upper: {
              key: [binIndex, upperCreatedAt] satisfies FitScoreKey,
              inclusive: filters.createdBeforeMs === undefined,
            },
          },
        }))
      )
    )
  );
}

export async function getFitScoreHistogramFromAggregate(
  ctx: GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>,
  filters: FitScoreHistogramFilters
) {
  const queries = createHistogramCountQueries(filters);
  if (queries.length === 0) {
    return Array.from({ length: FIT_SCORE_BIN_COUNT }, () => 0);
  }

  const counts = await fitScoreHistogramAggregate.countBatch(ctx, queries);
  const binCounts = Array.from({ length: FIT_SCORE_BIN_COUNT }, () => 0);
  counts.forEach((count, index) => {
    binCounts[index % FIT_SCORE_BIN_COUNT] += count;
  });
  return binCounts;
}

export function addFitScoreToHistogram(
  binCounts: number[],
  score: number | undefined
) {
  const binIndex = getFitScoreBinIndex(score);
  if (binIndex !== null) {
    binCounts[binIndex] += 1;
  }
}
