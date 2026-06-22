import assert from "node:assert/strict";
import test from "node:test";
import type { Id } from "../convex/_generated/dataModel";
import {
  buildProspectAnalyticsBackfillPatch,
  buildProspectAnalyticsTransitionPatch,
  type ProspectQualificationActivitySnapshot,
} from "../convex/lib/prospectAnalyticsCore";
import {
  getWorkspaceAnalyticsContributionsFromProspect,
  type TargetedWorkspaceAnalyticsContribution,
} from "../convex/lib/readModelHelpers";
import { computeUsageCycleWindow } from "../convex/lib/planCycleUtils";
import {
  computeQualifiedProspectUsageForWindow,
  readQualifiedProspectUsageForWorkspaceWindow,
  shouldCountQualifiedProspectUsageInWindow,
} from "../convex/lib/planQualifiedUsageCore";
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
