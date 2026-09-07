import type { Infer } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { agentOpsTabValidator } from "../validators";
import type { TimeWindow } from "./analyticsCore";
import {
  getAgentOpsDashboardFields,
  type AgentOpsMetricSlice,
} from "./agentOpsDashboardCore";
import { getWorkspaceReportingMetricSums } from "./workspaceReportingAggregate";

/** Caller must invoke this from an independently subscribed, bounded query. */
export async function readAgentOpsDashboardMetrics(
  ctx: QueryCtx,
  args: {
    workspaceId: Id<"workspaces">;
    tab: Infer<typeof agentOpsTabValidator>;
    kind: "summary" | "trend";
    windows: TimeWindow[];
  }
): Promise<AgentOpsMetricSlice> {
  const fields = getAgentOpsDashboardFields(args.tab, args.kind);
  const readDataset = async (dataset: "analytics" | "agentOps") => {
    const metrics = fields[dataset];
    const sums = await getWorkspaceReportingMetricSums(ctx, {
      workspaceId: args.workspaceId,
      dataset,
      queries: args.windows.flatMap((window) =>
        metrics.map((metric) => ({ metric, ...window }))
      ),
    });
    return args.windows.map((_, index) =>
      sums.slice(index * metrics.length, (index + 1) * metrics.length)
    );
  };
  const [analytics, agentOps] = await Promise.all([
    readDataset("analytics"),
    readDataset("agentOps"),
  ]);
  return { analytics, agentOps };
}
