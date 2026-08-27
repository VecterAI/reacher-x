import { describe, expect, test, vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import {
  combineWorkspaceAgentOpsRecords,
  createEmptyWorkspaceAgentOpsDailyRecord,
  mergeWorkspaceAgentOpsStripeContributions,
} from "./agentOpsReadModelHelpers";
import {
  combineWorkspaceAnalyticsRecords,
  combineWorkspaceStatsRecords,
  createEmptyWorkspaceAnalyticsDailyRecord,
  createEmptyWorkspaceStatsRecord,
  mergeWorkspaceAnalyticsStripeContributions,
  mergeWorkspaceStatsStripeContributions,
} from "./readModelHelpers";
import {
  getReadModelStripe,
  READ_MODEL_STRIPE_COUNT,
} from "./readModelStripeHelpers";

const workspaceId = "workspace" as Id<"workspaces">;
const userId = "user" as Id<"users">;
const dayStartUtcMs = Date.UTC(2026, 7, 28);

describe("striped read models", () => {
  test("deterministically spreads a 100-document burst across every stripe", () => {
    const assignments = Array.from({ length: 100 }, (_, index) =>
      getReadModelStripe(`prospect-${index}`)
    );

    expect(assignments.every((stripe) => stripe >= 0)).toBe(true);
    expect(
      assignments.every((stripe) => stripe < READ_MODEL_STRIPE_COUNT)
    ).toBe(true);
    expect(new Set(assignments).size).toBe(READ_MODEL_STRIPE_COUNT);
    expect(getReadModelStripe("prospect-42")).toBe(
      getReadModelStripe("prospect-42")
    );
  });

  test("keeps workspace stats exact across a baseline cutover update", () => {
    vi.setSystemTime(dayStartUtcMs + 1_000);
    const baseline = createEmptyWorkspaceStatsRecord({ workspaceId, userId });
    Object.assign(baseline, {
      totalProspectsCount: 1,
      newProspectsCount: 1,
      qualifiedProspectsCount: 1,
      qualificationScoreSum: 80,
      qualificationScoreCount: 1,
      avgQualificationScore: 80,
    });
    const oldContribution = { ...baseline };
    const newContribution = {
      ...oldContribution,
      newProspectsCount: 0,
      contactedProspectsCount: 1,
      qualificationScoreSum: 95,
    };

    const stripe = mergeWorkspaceStatsStripeContributions(null, {
      workspaceId,
      userId,
      remove: [oldContribution],
      add: [newContribution],
    });
    const combined = combineWorkspaceStatsRecords({
      workspaceId,
      userId,
      baseline,
      stripes: [stripe],
    });

    expect(stripe.newProspectsCount).toBe(-1);
    expect(combined).toMatchObject({
      totalProspectsCount: 1,
      newProspectsCount: 0,
      contactedProspectsCount: 1,
      qualifiedProspectsCount: 1,
      qualificationScoreSum: 95,
      qualificationScoreCount: 1,
      avgQualificationScore: 95,
    });

    const deletedStripe = mergeWorkspaceStatsStripeContributions(stripe, {
      workspaceId,
      userId,
      remove: [newContribution],
    });
    expect(
      combineWorkspaceStatsRecords({
        workspaceId,
        userId,
        baseline,
        stripes: [deletedStripe],
      })
    ).toMatchObject({
      totalProspectsCount: 0,
      newProspectsCount: 0,
      contactedProspectsCount: 0,
      qualifiedProspectsCount: 0,
      qualificationScoreSum: 0,
      qualificationScoreCount: 0,
      avgQualificationScore: 0,
    });
  });

  test("keeps daily and hourly analytics exact with signed deltas", () => {
    const baseline = createEmptyWorkspaceAnalyticsDailyRecord({
      workspaceId,
      dayStartUtcMs,
    });
    baseline.newProspectsCount = 1;
    baseline.hourlyNewProspectsCounts[3] = 1;

    const oldContribution = { ...baseline };
    const newContribution = {
      ...oldContribution,
      reachedContactedProspectsCount: 1,
      hourlyReachedContactedProspectsCounts:
        baseline.hourlyNewProspectsCounts.map((_, index) =>
          index === 7 ? 1 : 0
        ),
    };
    const stripe = mergeWorkspaceAnalyticsStripeContributions(null, {
      workspaceId,
      dayStartUtcMs,
      remove: [oldContribution],
      add: [newContribution],
    });
    const combined = combineWorkspaceAnalyticsRecords({
      workspaceId,
      dayStartUtcMs,
      baseline,
      stripes: [stripe],
    });

    expect(combined.newProspectsCount).toBe(1);
    expect(combined.reachedContactedProspectsCount).toBe(1);
    expect(combined.hourlyNewProspectsCounts[3]).toBe(1);
    expect(combined.hourlyReachedContactedProspectsCounts[7]).toBe(1);
  });

  test("keeps agent-ops totals exact when an old event changes state", () => {
    const baseline = createEmptyWorkspaceAgentOpsDailyRecord({
      workspaceId,
      dayStartUtcMs,
    });
    baseline.eventsReceivedCount = 1;
    baseline.hourlyEventsReceivedCounts[4] = 1;
    baseline.failedEventsCount = 1;
    baseline.hourlyFailedEventsCounts[4] = 1;

    const oldContribution = { ...baseline };
    const newContribution = {
      ...oldContribution,
      failedEventsCount: 0,
      hourlyFailedEventsCounts: baseline.hourlyFailedEventsCounts.map(() => 0),
    };
    const stripe = mergeWorkspaceAgentOpsStripeContributions(null, {
      workspaceId,
      dayStartUtcMs,
      remove: [oldContribution],
      add: [newContribution],
    });
    const combined = combineWorkspaceAgentOpsRecords({
      workspaceId,
      dayStartUtcMs,
      baseline,
      stripes: [stripe],
    });

    expect(stripe.failedEventsCount).toBe(-1);
    expect(combined.eventsReceivedCount).toBe(1);
    expect(combined.failedEventsCount).toBe(0);
    expect(combined.hourlyEventsReceivedCounts[4]).toBe(1);
    expect(combined.hourlyFailedEventsCounts[4]).toBe(0);
  });
});
