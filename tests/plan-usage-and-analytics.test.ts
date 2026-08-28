import assert from "node:assert/strict";
import test from "node:test";
import type { Id } from "../convex/_generated/dataModel";
import {
  buildProspectAnalyticsBackfillPatch,
  buildProspectAnalyticsTransitionPatch,
  type ProspectQualificationActivitySnapshot,
} from "../convex/lib/prospectAnalyticsCore";
import {
  createTrendBucketSet,
  normalizeAnalyticsWindow,
} from "../convex/lib/analyticsCore";
import {
  getDashboardChunkWorstCaseRows,
  splitDashboardDayRange,
} from "../convex/lib/dashboardReadCore";
import {
  getWorkspaceAnalyticsContributionsFromProspect,
  type TargetedWorkspaceAnalyticsContribution,
} from "../convex/lib/readModelHelpers";
import { computeUsageCycleWindow } from "../convex/lib/planCycleUtils";
import { resolveUsagePlanSnapshot } from "../convex/lib/usageDashboardCore";
import {
  computeQualifiedProspectUsageForWindow,
  readQualifiedProspectUsageForWorkspaceWindow,
  shouldCountQualifiedProspectUsageInWindow,
} from "../convex/lib/planQualifiedUsageCore";
import { countCompletedWorkspaces } from "../convex/lib/workspaceSetup";
import {
  getCalendarDaysUntil,
  parseIsoToTimestamp,
} from "../shared/lib/utils/time/timeUtils";

type AnalyticsProspect = Parameters<
  typeof getWorkspaceAnalyticsContributionsFromProspect
>[0];
type TransitionProspect = Parameters<
  typeof buildProspectAnalyticsTransitionPatch
>[0]["prospect"];
type UsageWindow = Parameters<
  typeof shouldCountQualifiedProspectUsageInWindow
>[0];
type UsageEligibility = Parameters<
  typeof shouldCountQualifiedProspectUsageInWindow
>[1];
type TestTableName = "prospects" | "workspaces" | "users";
type ProspectSummaryRow = {
  prospectId: Id<"prospects">;
  origin: UsageEligibility["origin"];
  qualificationStatus: UsageEligibility["qualificationStatus"];
  qualifiedAt?: number;
};
type WorkspaceUsageProspectRow = UsageEligibility & {
  workspaceId: Id<"workspaces">;
};
type RangeEqBuilder = {
  eq: (field: string, value: unknown) => RangeEqBuilder;
};

function asId<TableName extends TestTableName>(value: string) {
  return value as Id<TableName>;
}

function utc(value: string) {
  const timestamp = parseIsoToTimestamp(value);
  if (timestamp === undefined) {
    throw new Error(`Invalid test timestamp: ${value}`);
  }
  return timestamp;
}

function createAnalyticsProspect(
  overrides: Partial<AnalyticsProspect> = {}
): AnalyticsProspect {
  return {
    _id: asId<"prospects">("prospect_default"),
    _creationTime: utc("2026-06-01T12:00:00.000Z"),
    workspaceId: asId<"workspaces">("workspace_default"),
    userId: asId<"users">("user_default"),
    platform: "linkedin",
    origin: "manual",
    setupSessionId: undefined,
    setupRevision: undefined,
    previewSelectedAt: undefined,
    previewRank: undefined,
    status: "new",
    qualificationStatus: "pending",
    qualifiedAt: undefined,
    disqualifiedAt: undefined,
    qualificationScore: 82,
    enrichedAt: undefined,
    enrichmentStatus: "pending",
    readyAt: undefined,
    planGenerationStatus: "idle",
    displayName: "Prospect",
    title: undefined,
    briefIntro: undefined,
    matchedKeywords: undefined,
    discoverySource: undefined,
    discoveryContext: undefined,
    location: undefined,
    finance: undefined,
    prospectType: "individual",
    data: {},
    socialProfiles: undefined,
    stageTimestamps: undefined,
    pipelineStage: "new",
    updatedAt: utc("2026-06-01T12:00:00.000Z"),
    company: undefined,
    websiteUrl: undefined,
    qualificationKeywords: undefined,
    notes: undefined,
    tags: undefined,
    painPoints: undefined,
    evidencePosts: undefined,
    ...overrides,
  } as AnalyticsProspect;
}

function createTransitionProspect(
  overrides: Partial<TransitionProspect> = {}
): TransitionProspect {
  return {
    platform: "linkedin",
    qualificationStatus: "pending",
    qualifiedAt: undefined,
    disqualifiedAt: undefined,
    enrichedAt: undefined,
    enrichmentStatus: "pending",
    readyAt: undefined,
    evidencePosts: undefined,
    painPoints: undefined,
    finance: undefined,
    ...overrides,
  };
}

function sumContributionField(
  contributions: TargetedWorkspaceAnalyticsContribution[],
  field: keyof TargetedWorkspaceAnalyticsContribution["contribution"]
) {
  return contributions.reduce(
    (total, item) =>
      total +
      (typeof item.contribution[field] === "number"
        ? (item.contribution[field] as number)
        : 0),
    0
  );
}

function sumContributionFieldOnDay(
  contributions: TargetedWorkspaceAnalyticsContribution[],
  dayStartUtcMs: number,
  field: keyof TargetedWorkspaceAnalyticsContribution["contribution"]
) {
  return contributions
    .filter((item) => item.dayStartUtcMs === dayStartUtcMs)
    .reduce(
      (total, item) =>
        total +
        (typeof item.contribution[field] === "number"
          ? (item.contribution[field] as number)
          : 0),
      0
    );
}

function sumContributionHourlyFieldOnDay(
  contributions: TargetedWorkspaceAnalyticsContribution[],
  dayStartUtcMs: number,
  field: keyof TargetedWorkspaceAnalyticsContribution["contribution"]
) {
  return contributions
    .filter((item) => item.dayStartUtcMs === dayStartUtcMs)
    .reduce((total, item) => {
      const value = item.contribution[field];
      if (!Array.isArray(value)) {
        return total;
      }
      return (
        total + value.reduce((runningTotal, count) => runningTotal + count, 0)
      );
    }, 0);
}

function createPlanUsageCtx(args: {
  summaries: ProspectSummaryRow[];
  prospectsById?: Map<Id<"prospects">, { qualifiedAt?: number }>;
}) {
  let fallbackGetCount = 0;
  const eq: RangeEqBuilder["eq"] = () => ({ eq });

  return {
    ctx: {
      db: {
        query: (table: string) => {
          assert.equal(table, "prospectSummaries");
          return {
            withIndex: (
              _index: string,
              rangeBuilder: (query: RangeEqBuilder) => unknown
            ) => {
              rangeBuilder({ eq });
              return {
                collect: async () => args.summaries,
              };
            },
          };
        },
        get: async (prospectId: Id<"prospects">) => {
          fallbackGetCount += 1;
          return args.prospectsById?.get(prospectId) ?? null;
        },
      },
    } as unknown as Parameters<
      typeof computeQualifiedProspectUsageForWindow
    >[0],
    getFallbackGetCount: () => fallbackGetCount,
  };
}

function createWorkspaceUsageCtx(args: {
  prospects: WorkspaceUsageProspectRow[];
}) {
  return {
    db: {
      query: (table: string) => {
        assert.equal(table, "prospects");

        return {
          withIndex: (
            _index: string,
            rangeBuilder: (query: RangeEqBuilder) => unknown
          ) => {
            let requestedWorkspaceId: Id<"workspaces"> | null = null;

            const eq: RangeEqBuilder["eq"] = (
              field: string,
              value: unknown
            ) => {
              if (field === "workspaceId") {
                requestedWorkspaceId = value as Id<"workspaces">;
              }

              return { eq };
            };

            rangeBuilder({ eq });

            return {
              collect: async () =>
                args.prospects.filter(
                  (prospect) => prospect.workspaceId === requestedWorkspaceId
                ),
            };
          },
        };
      },
    },
  } as unknown as Parameters<
    typeof readQualifiedProspectUsageForWorkspaceWindow
  >[0];
}

test("calendar days until returns a non-inclusive countdown", () => {
  assert.equal(
    getCalendarDaysUntil(
      utc("2026-06-22T10:00:00.000Z"),
      utc("2026-06-30T23:59:59.999Z")
    ),
    8
  );
  assert.equal(
    getCalendarDaysUntil(
      utc("2026-06-30T00:00:00.000Z"),
      utc("2026-06-30T23:59:59.999Z")
    ),
    0
  );
});

test("analytics presets respect workspace timezone calendar semantics", () => {
  const nowMs = utc("2026-06-24T18:00:00.000Z");
  const timeZone = "Asia/Karachi";

  const today = normalizeAnalyticsWindow({
    range: "today",
    timeZone,
    nowMs,
  });
  assert.deepEqual(today.current, {
    startMs: utc("2026-06-23T19:00:00.000Z"),
    endMs: nowMs,
  });

  const yesterday = normalizeAnalyticsWindow({
    range: "1d",
    timeZone,
    nowMs,
  });
  assert.deepEqual(yesterday.current, {
    startMs: utc("2026-06-22T19:00:00.000Z"),
    endMs: utc("2026-06-23T19:00:00.000Z"),
  });

  const last7Days = normalizeAnalyticsWindow({
    range: "7d",
    timeZone,
    nowMs,
  });
  assert.deepEqual(last7Days.current, {
    startMs: utc("2026-06-17T19:00:00.000Z"),
    endMs: nowMs,
  });

  const last30Days = normalizeAnalyticsWindow({
    range: "30d",
    timeZone,
    nowMs,
  });
  assert.deepEqual(last30Days.current, {
    startMs: utc("2026-05-25T19:00:00.000Z"),
    endMs: nowMs,
  });
});

test("custom analytics date ranges expand to full local days", () => {
  const window = normalizeAnalyticsWindow({
    range: "custom",
    timeZone: "Asia/Karachi",
    fromDate: "2026-06-10",
    toDate: "2026-06-12",
    nowMs: utc("2026-06-24T18:00:00.000Z"),
  });

  assert.deepEqual(window.current, {
    startMs: utc("2026-06-09T19:00:00.000Z"),
    endMs: utc("2026-06-12T19:00:00.000Z"),
  });
});

test("large analytics ranges compact chart points without changing the exact window", () => {
  const nowMs = utc("2027-01-15T00:00:00.000Z");
  const cases = [
    { fromDate: "2026-01-01", toDate: "2026-01-31", expected: "daily" },
    { fromDate: "2026-01-01", toDate: "2026-02-01", expected: "weekly" },
    { fromDate: "2026-01-01", toDate: "2026-06-29", expected: "weekly" },
    { fromDate: "2026-01-01", toDate: "2026-06-30", expected: "monthly" },
  ] as const;

  for (const item of cases) {
    const normalized = normalizeAnalyticsWindow({
      range: "custom",
      timeZone: "UTC",
      fromDate: item.fromDate,
      toDate: item.toDate,
      nowMs,
    });
    assert.equal(normalized.granularity, item.expected);
  }

  const oneYear = normalizeAnalyticsWindow({
    range: "custom",
    timeZone: "UTC",
    fromDate: "2026-01-01",
    toDate: "2026-12-31",
    nowMs,
  });
  const buckets = createTrendBucketSet(oneYear);
  assert.equal(oneYear.granularity, "monthly");
  assert.equal(buckets.buckets.length, 13);
  assert.equal(buckets.buckets[0]?.startMs, oneYear.current.startMs);
  assert.equal(
    buckets.buckets.at(-1)?.endMs,
    oneYear.current.endMs,
    "compaction must preserve the complete selected window"
  );
});

test("dashboard reads stay below the measured 32-stripe transaction bound", () => {
  const startDayStartUtcMs = utc("2025-01-01T00:00:00.000Z");
  const endDayStartUtcMs = utc("2026-12-31T00:00:00.000Z");
  const chunks = splitDashboardDayRange({
    startDayStartUtcMs,
    endDayStartUtcMs,
  });

  assert.equal(chunks.length, 24);
  assert.equal(getDashboardChunkWorstCaseRows({ stripesPerDay: 32 }), 1_023);
  for (const chunk of chunks) {
    const inclusiveDays =
      (chunk.endDayStartUtcMs - chunk.startDayStartUtcMs) /
        (24 * 60 * 60 * 1000) +
      1;
    assert.ok(inclusiveDays <= 31);
  }
});

test("resume under limit counts only current-cycle qualified prospects", () => {
  const window: UsageWindow = {
    cycleStart: utc("2026-06-01T00:00:00.000Z"),
    cycleEnd: utc("2026-06-30T23:59:59.999Z"),
  };
  const limit = 3;
  const prospects: UsageEligibility[] = [
    {
      origin: "manual",
      qualificationStatus: "qualified",
      qualifiedAt: utc("2026-06-03T08:00:00.000Z"),
    },
    {
      origin: "manual",
      qualificationStatus: "qualified",
      qualifiedAt: utc("2026-06-18T08:00:00.000Z"),
    },
    {
      origin: "manual",
      qualificationStatus: "qualified",
      qualifiedAt: utc("2026-05-29T08:00:00.000Z"),
    },
    {
      origin: "setup_preview",
      qualificationStatus: "qualified",
      qualifiedAt: utc("2026-06-19T08:00:00.000Z"),
    },
  ];
  const used = prospects.filter((prospect) =>
    shouldCountQualifiedProspectUsageInWindow(window, prospect)
  ).length;

  assert.equal(used, 2);
  assert.ok(used < limit);
});

test("resume at limit blocks when current-cycle qualified usage reaches the cap", () => {
  const window: UsageWindow = {
    cycleStart: utc("2026-06-01T00:00:00.000Z"),
    cycleEnd: utc("2026-06-30T23:59:59.999Z"),
  };
  const limit = 2;
  const prospects: UsageEligibility[] = [
    {
      origin: "manual",
      qualificationStatus: "qualified",
      qualifiedAt: utc("2026-06-02T08:00:00.000Z"),
    },
    {
      origin: "manual",
      qualificationStatus: "qualified",
      qualifiedAt: utc("2026-06-14T08:00:00.000Z"),
    },
  ];
  const used = prospects.filter((prospect) =>
    shouldCountQualifiedProspectUsageInWindow(window, prospect)
  ).length;

  assert.equal(used, limit);
});

test("plans usage load falls back to prospect.qualifiedAt when older summaries are missing it", async () => {
  const prospectNeedingFallback = asId<"prospects">("prospect_fallback");
  const { ctx, getFallbackGetCount } = createPlanUsageCtx({
    summaries: [
      {
        prospectId: asId<"prospects">("prospect_direct"),
        origin: "manual",
        qualificationStatus: "qualified",
        qualifiedAt: utc("2026-06-05T00:00:00.000Z"),
      },
      {
        prospectId: prospectNeedingFallback,
        origin: "manual",
        qualificationStatus: "qualified",
      },
      {
        prospectId: asId<"prospects">("prospect_outside"),
        origin: "manual",
        qualificationStatus: "qualified",
        qualifiedAt: utc("2026-05-28T00:00:00.000Z"),
      },
    ],
    prospectsById: new Map([
      [
        prospectNeedingFallback,
        { qualifiedAt: utc("2026-06-21T00:00:00.000Z") },
      ],
    ]),
  });

  const used = await computeQualifiedProspectUsageForWindow(
    ctx,
    asId<"users">("user_plans"),
    {
      cycleStart: utc("2026-06-01T00:00:00.000Z"),
      cycleEnd: utc("2026-06-30T23:59:59.999Z"),
    }
  );

  assert.equal(used, 2);
  assert.equal(getFallbackGetCount(), 1);
});

test("workspace usage counts only qualified prospects from the selected workspace", async () => {
  const workspaceA = asId<"workspaces">("workspace_a");
  const workspaceB = asId<"workspaces">("workspace_b");
  const window: UsageWindow = {
    cycleStart: utc("2026-06-01T00:00:00.000Z"),
    cycleEnd: utc("2026-06-30T23:59:59.999Z"),
  };
  const ctx = createWorkspaceUsageCtx({
    prospects: [
      {
        workspaceId: workspaceA,
        origin: "manual",
        qualificationStatus: "qualified",
        qualifiedAt: utc("2026-06-03T08:00:00.000Z"),
      },
      {
        workspaceId: workspaceA,
        origin: "manual",
        qualificationStatus: "qualified",
        qualifiedAt: utc("2026-06-12T08:00:00.000Z"),
      },
      {
        workspaceId: workspaceA,
        origin: "manual",
        qualificationStatus: "qualified",
        qualifiedAt: utc("2026-05-28T08:00:00.000Z"),
      },
      {
        workspaceId: workspaceA,
        origin: "setup_preview",
        qualificationStatus: "qualified",
        qualifiedAt: utc("2026-06-19T08:00:00.000Z"),
      },
      {
        workspaceId: workspaceB,
        origin: "manual",
        qualificationStatus: "qualified",
        qualifiedAt: utc("2026-06-18T08:00:00.000Z"),
      },
    ],
  });

  const usage = await readQualifiedProspectUsageForWorkspaceWindow(
    ctx,
    workspaceA,
    window
  );

  assert.equal(usage.used, 2);
  assert.deepEqual(usage.timestamps, [
    utc("2026-06-03T08:00:00.000Z"),
    utc("2026-06-12T08:00:00.000Z"),
  ]);
});

test("completed workspace count excludes draft workspaces", () => {
  const completedAt = utc("2026-06-18T08:00:00.000Z");

  assert.equal(
    countCompletedWorkspaces([
      { setupCompletedAt: completedAt },
      {},
      { setupCompletedAt: undefined },
      { setupCompletedAt: utc("2026-06-20T08:00:00.000Z") },
    ]),
    2
  );
});

test("cycle rollover uses active subscription bounds and falls back to UTC month when expired", () => {
  const now = utc("2026-06-21T10:30:00.000Z");

  assert.deepEqual(
    computeUsageCycleWindow({
      now,
      tier: "base",
      subscription: {
        currentPeriodStart: "2026-06-10T00:00:00.000Z",
        currentPeriodEnd: "2026-07-10T00:00:00.000Z",
      },
    }),
    {
      cycleStart: utc("2026-06-10T00:00:00.000Z"),
      cycleEnd: utc("2026-07-10T00:00:00.000Z"),
    }
  );

  assert.deepEqual(
    computeUsageCycleWindow({
      now,
      tier: "base",
      subscription: {
        currentPeriodStart: "2026-05-10T00:00:00.000Z",
        currentPeriodEnd: "2026-06-10T00:00:00.000Z",
      },
    }),
    {
      cycleStart: utc("2026-06-01T00:00:00.000Z"),
      cycleEnd: utc("2026-06-30T23:59:59.999Z"),
    }
  );
});

test("current usage uses live plan limits while historical usage keeps its snapshot", () => {
  const livePlan = {
    tier: "pro" as const,
    prospectsLimit: -1,
    workspacesLimit: 5,
  };
  const storedCycle = {
    tier: "base" as const,
    prospectsLimit: 1000,
    workspacesLimit: 2,
  };

  assert.deepEqual(
    resolveUsagePlanSnapshot({
      isCurrent: true,
      livePlan,
      storedCycle,
    }),
    livePlan
  );
  assert.deepEqual(
    resolveUsagePlanSnapshot({
      isCurrent: false,
      livePlan,
      storedCycle,
    }),
    storedCycle
  );
});

test("large user dataset recount stays correct across thousands of summaries", async () => {
  const summaries: ProspectSummaryRow[] = [];

  for (let index = 0; index < 5000; index += 1) {
    summaries.push({
      prospectId: asId<"prospects">(`prospect_${index}`),
      origin: index % 10 === 0 ? "setup_preview" : "manual",
      qualificationStatus: "qualified",
      qualifiedAt:
        index % 7 === 0
          ? utc("2026-05-30T00:00:00.000Z")
          : utc("2026-06-15T00:00:00.000Z"),
    });
  }

  const { ctx } = createPlanUsageCtx({ summaries });
  const used = await computeQualifiedProspectUsageForWindow(
    ctx,
    asId<"users">("user_large"),
    {
      cycleStart: utc("2026-06-01T00:00:00.000Z"),
      cycleEnd: utc("2026-06-30T23:59:59.999Z"),
    }
  );

  const expected = summaries.filter(
    (summary) =>
      summary.origin !== "setup_preview" &&
      typeof summary.qualifiedAt === "number" &&
      summary.qualifiedAt >= utc("2026-06-01T00:00:00.000Z") &&
      summary.qualifiedAt <= utc("2026-06-30T23:59:59.999Z")
  ).length;

  assert.equal(used, expected);
});

test("analytics contributions keep cohort counts on creation day and event counts on milestone days", () => {
  const createdAt = utc("2026-06-01T10:00:00.000Z");
  const qualifiedAt = utc("2026-06-18T15:00:00.000Z");
  const readyAt = utc("2026-06-20T11:30:00.000Z");
  const prospect = createAnalyticsProspect({
    _id: asId<"prospects">("prospect_analytics"),
    _creationTime: createdAt,
    qualificationStatus: "qualified",
    qualifiedAt,
    enrichmentStatus: "enriched",
    enrichedAt: readyAt,
    readyAt,
    evidencePosts: [{ id: "evidence_1" }],
  });

  const contributions =
    getWorkspaceAnalyticsContributionsFromProspect(prospect);
  const creationDay = utc("2026-06-01T00:00:00.000Z");
  const qualifiedDay = utc("2026-06-18T00:00:00.000Z");
  const readyDay = utc("2026-06-20T00:00:00.000Z");

  assert.equal(sumContributionField(contributions, "newProspectsCount"), 1);
  assert.equal(
    sumContributionField(contributions, "qualificationQualifiedCount"),
    1
  );
  assert.equal(sumContributionField(contributions, "qualifiedEventsCount"), 1);
  assert.equal(sumContributionField(contributions, "readyEventsCount"), 1);
  assert.equal(
    sumContributionFieldOnDay(
      contributions,
      creationDay,
      "qualificationQualifiedCount"
    ),
    1
  );
  assert.equal(
    sumContributionFieldOnDay(
      contributions,
      creationDay,
      "qualifiedEventsCount"
    ),
    0
  );
  assert.equal(
    sumContributionFieldOnDay(
      contributions,
      qualifiedDay,
      "qualifiedEventsCount"
    ),
    1
  );
  assert.equal(
    sumContributionFieldOnDay(contributions, readyDay, "readyEventsCount"),
    1
  );
  assert.equal(
    sumContributionHourlyFieldOnDay(
      contributions,
      creationDay,
      "hourlyQualificationQualifiedCounts"
    ),
    1
  );
  assert.equal(
    sumContributionHourlyFieldOnDay(
      contributions,
      creationDay,
      "hourlyActionableReadyCounts"
    ),
    1
  );
  assert.equal(
    sumContributionHourlyFieldOnDay(
      contributions,
      creationDay,
      "hourlyLinkedInProspectsCounts"
    ),
    1
  );
});

test("analytics transition patch stamps readyAt when a qualified LinkedIn prospect first becomes actionable", () => {
  const qualifiedAt = utc("2026-06-08T09:00:00.000Z");
  const enrichedAt = utc("2026-06-09T14:30:00.000Z");
  const patch = buildProspectAnalyticsTransitionPatch({
    prospect: createTransitionProspect({
      qualificationStatus: "qualified",
      qualifiedAt,
      enrichmentStatus: "pending",
    }),
    patch: {
      enrichmentStatus: "enriched",
      enrichedAt,
      evidencePosts: [{ id: "evidence_1" }],
    },
    now: utc("2026-06-21T12:00:00.000Z"),
  });

  assert.equal(patch.readyAt, enrichedAt);
});

test("analytics backfill restores missing qualification and readiness milestones", () => {
  const activity: ProspectQualificationActivitySnapshot = {
    latestQualifiedAt: utc("2026-06-04T11:00:00.000Z"),
  };
  const enrichedAt = utc("2026-06-07T11:30:00.000Z");
  const patch = buildProspectAnalyticsBackfillPatch({
    prospect: createTransitionProspect({
      platform: "twitter",
      qualificationStatus: "qualified",
      enrichmentStatus: "enriched",
      enrichedAt,
    }),
    qualificationActivity: activity,
  });

  assert.deepEqual(patch, {
    qualifiedAt: utc("2026-06-04T11:00:00.000Z"),
    readyAt: enrichedAt,
  });
});
