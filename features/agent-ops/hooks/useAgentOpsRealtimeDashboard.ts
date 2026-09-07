"use client";

import { useMemo } from "react";
import { useQueries } from "convex/react";
import { useQueryWithStatus } from "@/shared/hooks/useQueryWithStatus";
import type { FunctionArgs } from "convex/server";
import { api } from "@/convex/_generated/api";
import {
  buildAgentOpsDashboardFromSlices,
  getAgentOpsDashboardWindow,
  getAgentOpsTrendSliceOffsets,
  type AgentOpsMetricSlice,
} from "@/convex/lib/agentOpsDashboardCore";
import type { AgentOpsActivityItem } from "../ui/types";

type DashboardArgs = FunctionArgs<
  typeof api.agentOps.getAgentOpsDashboardSummary
>;

const EMPTY_QUERIES: Parameters<typeof useQueries>[0] = {};

/** Every slice is a real subscription with its own transaction budget. */
export function useAgentOpsRealtimeDashboard(input: DashboardArgs | "skip") {
  // Query arguments contain only JSON primitives. Stabilize by value, as Convex's
  // own single-query hook does; useQueries requires a stable request object.
  const serializedArgs = JSON.stringify(input);
  const args = useMemo(
    () => JSON.parse(serializedArgs) as DashboardArgs | "skip",
    [serializedArgs]
  );
  const summaryQuery = useQueryWithStatus(
    api.agentOps.getAgentOpsDashboardSummary,
    args
  );
  const plan = useMemo(() => {
    if (args === "skip" || !summaryQuery.data) return null;
    const { normalizedWindow, bucketSet } = getAgentOpsDashboardWindow({
      ...args,
      timeZone: summaryQuery.data.timeZone,
    });
    const offsets = getAgentOpsTrendSliceOffsets(
      bucketSet.buckets.length,
      args.tab
    );
    const queries: Parameters<typeof useQueries>[0] = {};
    for (const offset of offsets) {
      queries[`trend-${offset}`] = {
        query: api.agentOps.getAgentOpsDashboardTrendSlice,
        args: { ...args, offset },
      };
    }
    if (args.tab === "activity") {
      queries.activity = {
        query: api.agentOps.getAgentOpsDashboardActivity,
        args,
      };
    }
    return { args, normalizedWindow, offsets, queries };
  }, [args, summaryQuery.data]);
  // useQueries returns errors as values, allowing the existing Retry UI to work.
  const results: Record<
    string,
    AgentOpsMetricSlice | AgentOpsActivityItem[] | Error | undefined
  > = useQueries(plan?.queries ?? EMPTY_QUERIES);
  return useMemo(() => {
    if (summaryQuery.error)
      return { data: undefined, error: summaryQuery.error, isPending: false };
    if (!plan)
      return { data: undefined, error: undefined, isPending: args !== "skip" };
    const values = Object.keys(plan.queries).map((key) => results[key]);
    const error = values.find((value) => value instanceof Error);
    if (error instanceof Error)
      return { data: undefined, error, isPending: false };
    if (values.some((value) => value === undefined))
      return { data: undefined, error: undefined, isPending: true };
    const summary = summaryQuery.data;
    const trends = plan.offsets.map((offset) => results[`trend-${offset}`]);
    if (
      !summary ||
      summary instanceof Error ||
      Array.isArray(summary) ||
      trends.some(
        (slice) => !slice || slice instanceof Error || Array.isArray(slice)
      )
    ) {
      return {
        data: undefined,
        error: new Error("Invalid Agent Ops reporting response"),
        isPending: false,
      };
    }
    return {
      data: buildAgentOpsDashboardFromSlices({
        ...plan.args,
        normalizedWindow: plan.normalizedWindow,
        summary,
        trends: trends as AgentOpsMetricSlice[],
        activity: Array.isArray(results.activity) ? results.activity : [],
      }),
      error: undefined,
      isPending: false,
    };
  }, [args, plan, results, summaryQuery.data, summaryQuery.error]);
}
