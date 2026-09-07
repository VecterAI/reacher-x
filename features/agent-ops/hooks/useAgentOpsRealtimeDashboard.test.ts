import { beforeEach, describe, expect, test, vi } from "vitest";
import type { FunctionArgs } from "convex/server";
import { api } from "@/convex/_generated/api";
import { getAgentOpsDashboardFields } from "@/convex/lib/agentOpsDashboardCore";
import { useAgentOpsRealtimeDashboard } from "./useAgentOpsRealtimeDashboard";

const mocks = vi.hoisted(() => ({ summary: vi.fn(), slices: vi.fn() }));
vi.mock("react", () => ({ useMemo: (fn: () => unknown) => fn() }));
vi.mock("convex/react", () => ({ useQueries: mocks.slices }));
vi.mock("@/shared/hooks/useQueryWithStatus", () => ({
  useQueryWithStatus: mocks.summary,
}));
const args = {
  workspaceId: "workspace-test",
  range: "30d",
  tab: "overview",
  timeZone: "UTC",
  nowMs: Date.UTC(2026, 8, 7, 12),
} as FunctionArgs<typeof api.agentOps.getAgentOpsDashboardSummary>;
function summary() {
  const fields = getAgentOpsDashboardFields("overview", "summary");
  return {
    timeZone: "UTC",
    analytics: [fields.analytics.map(() => 5), fields.analytics.map(() => 2)],
    agentOps: [fields.agentOps.map(() => 5), fields.agentOps.map(() => 2)],
  };
}
function respond(queries: Record<string, { args: { offset?: number } }>) {
  const fields = getAgentOpsDashboardFields("overview", "trend");
  return Object.fromEntries(
    Object.entries(queries).map(([key, { args }]) => [
      key,
      {
        analytics: Array.from(
          { length: Math.min(4, 30 - (args.offset ?? 0)) },
          () => fields.analytics.map(() => 1)
        ),
        agentOps: Array.from(
          { length: Math.min(4, 30 - (args.offset ?? 0)) },
          () => fields.agentOps.map(() => 1)
        ),
      },
    ])
  );
}
describe("Agent Ops independent subscriptions", () => {
  beforeEach(() => {
    mocks.summary.mockReset();
    mocks.slices.mockReset();
    mocks.summary.mockReturnValue({ data: summary() });
    mocks.slices.mockImplementation(respond);
  });
  test("loads eight bounded chart subscriptions and composes the exact period summary", () => {
    const result = useAgentOpsRealtimeDashboard(args);
    expect(Object.keys(mocks.slices.mock.calls[0][0])).toHaveLength(8);
    expect(result.data?.overview.qualityTrend).toHaveLength(30);
    expect(result.data?.overview.metrics.memoriesLearned.value).toBe(5);
    expect(result.data?.overview.metrics.memoriesLearned.change).toBe(3);
  });
  test("keeps loading until all slices arrive, without showing incomplete totals", () => {
    mocks.slices.mockImplementation((queries) => ({
      ...respond(queries),
      "trend-28": undefined,
    }));
    expect(useAgentOpsRealtimeDashboard(args)).toEqual({
      data: undefined,
      error: undefined,
      isPending: true,
    });
  });
  test("surfaces summary and slice errors to Retry instead of zero-success data", () => {
    const error = new Error("Read limit");
    mocks.summary.mockReturnValue({ error });
    expect(useAgentOpsRealtimeDashboard(args).error).toBe(error);
    mocks.summary.mockReturnValue({ data: summary() });
    mocks.slices.mockImplementation((queries) => ({
      ...respond(queries),
      "trend-4": error,
    }));
    expect(useAgentOpsRealtimeDashboard(args)).toEqual({
      data: undefined,
      error,
      isPending: false,
    });
  });
  test("removes subscriptions for skipped/migrating workspaces and waits for a new summary", () => {
    expect(useAgentOpsRealtimeDashboard("skip").isPending).toBe(false);
    expect(mocks.slices).toHaveBeenLastCalledWith({});
    mocks.summary.mockReturnValue({ data: undefined });
    expect(useAgentOpsRealtimeDashboard(args).isPending).toBe(true);
    expect(mocks.slices).toHaveBeenLastCalledWith({});
  });
  test("uses the server's workspace timezone even when the browser sends a different one", () => {
    mocks.summary.mockReturnValue({
      data: { ...summary(), timeZone: "America/New_York" },
    });
    const result = useAgentOpsRealtimeDashboard({
      ...args,
      range: "today",
      timeZone: "Asia/Karachi",
      nowMs: Date.UTC(2026, 8, 7, 5),
    });
    expect(Object.keys(mocks.slices.mock.calls[0][0])).toHaveLength(1);
    expect(result.data?.overview.qualityTrend).toHaveLength(1);
  });
  test("activity uses a feed subscription and no chart subscriptions", () => {
    mocks.slices.mockReturnValue({ activity: [] });
    useAgentOpsRealtimeDashboard({ ...args, tab: "activity" });
    expect(Object.keys(mocks.slices.mock.calls[0][0])).toEqual(["activity"]);
  });
});
