import { calculateQueryPerformanceScore } from "./memoryCore";

export type QueryPriority = "new" | "proven" | "learning" | "cold";

export type QueryPerformanceSnapshot = {
  impressions: number;
  prospectsFound: number;
  qualifiedCount: number;
  convertedCount: number;
  replyCount: number;
  replyRate: number;
  qualificationRate: number;
};

export type QueryPrioritizationCandidate<TId> = {
  id: TId;
  value: string;
  createdAt: number;
  lastSearchedAt?: number;
  performance?: QueryPerformanceSnapshot;
};

export type PrioritizedQuery<TId> = QueryPrioritizationCandidate<TId> & {
  priority: QueryPriority;
  performanceScore: number;
};

const DEFAULT_COLD_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const MINIMUM_PROSPECTS_FOR_QUALITY_DECISION = 20;
const MINIMUM_SEARCHES_FOR_LEARNING = 3;

function classifyCandidate<TId>(
  candidate: QueryPrioritizationCandidate<TId>
): PrioritizedQuery<TId> {
  const performance = candidate.performance ?? {
    impressions: 0,
    prospectsFound: 0,
    qualifiedCount: 0,
    convertedCount: 0,
    replyCount: 0,
    replyRate: 0,
    qualificationRate: 0,
  };
  const performanceScore = calculateQueryPerformanceScore(performance);

  let priority: QueryPriority;
  if (typeof candidate.lastSearchedAt !== "number") {
    priority = "new";
  } else if (
    performance.prospectsFound >= MINIMUM_PROSPECTS_FOR_QUALITY_DECISION &&
    performance.qualifiedCount === 0 &&
    performance.convertedCount === 0 &&
    performance.replyCount === 0
  ) {
    priority = "cold";
  } else if (performance.prospectsFound > 0) {
    priority = "proven";
  } else if (performance.impressions < MINIMUM_SEARCHES_FOR_LEARNING) {
    priority = "learning";
  } else {
    priority = "cold";
  }

  return {
    ...candidate,
    priority,
    performanceScore,
  };
}

function byOldestUse<TId>(
  left: PrioritizedQuery<TId>,
  right: PrioritizedQuery<TId>
): number {
  return (
    (left.lastSearchedAt ?? left.createdAt) -
      (right.lastSearchedAt ?? right.createdAt) ||
    left.createdAt - right.createdAt
  );
}

/**
 * Selects a fixed-size search batch instead of creating one paid monitor per
 * query. Roughly 70% of capacity goes to proven queries, 20% to new/learning
 * queries, and 10% to cooled-down experiments. Empty slots are filled by the
 * best remaining candidates so small workspaces still use their full budget.
 */
export function prioritizeQueries<TId>(args: {
  candidates: Array<QueryPrioritizationCandidate<TId>>;
  limit: number;
  now: number;
  coldCooldownMs?: number;
}): Array<PrioritizedQuery<TId>> {
  const limit = Math.max(0, Math.floor(args.limit));
  if (limit === 0 || args.candidates.length === 0) {
    return [];
  }

  const coldCooldownMs = args.coldCooldownMs ?? DEFAULT_COLD_COOLDOWN_MS;
  const classified = args.candidates.map(classifyCandidate);
  const proven = classified
    .filter((candidate) => candidate.priority === "proven")
    .sort(
      (left, right) =>
        right.performanceScore - left.performanceScore ||
        byOldestUse(left, right)
    );
  const exploration = classified
    .filter(
      (candidate) =>
        candidate.priority === "new" || candidate.priority === "learning"
    )
    .sort(byOldestUse);
  const experiments = classified
    .filter(
      (candidate) =>
        candidate.priority === "cold" &&
        typeof candidate.lastSearchedAt === "number" &&
        args.now - candidate.lastSearchedAt >= coldCooldownMs
    )
    .sort(byOldestUse);

  const provenSlots = Math.floor(limit * 0.7);
  const explorationSlots = Math.max(1, Math.floor(limit * 0.2));
  const experimentSlots = Math.max(0, limit - provenSlots - explorationSlots);
  const selected = [
    ...proven.slice(0, provenSlots),
    ...exploration.slice(0, explorationSlots),
    ...experiments.slice(0, experimentSlots),
  ];
  const selectedIds = new Set(selected.map((candidate) => candidate.id));
  const remaining = [...proven, ...exploration, ...experiments].filter(
    (candidate) => !selectedIds.has(candidate.id)
  );

  return [...selected, ...remaining].slice(0, limit);
}
