import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalQuery } from "./lib/functionBuilders";
import { getProspectThreadContextByThreadId } from "./lib/relationshipHelpers";
import { parseSetupThreadState } from "./lib/setupThreadHelpers";
import { resolveAgentThreadSelection } from "./lib/agentThreadContextCore";
import { getWorkspaceThreadContextByThreadId } from "./lib/workspaceThreadHelpers";
import { logger } from "../shared/lib/logger";
import type { MentionEntitySearchResult } from "../shared/lib/mentions/mentionEntities";

const agentThreadContextLogger = logger.withScope("AgentThreadContext");

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

type ResolvedSelectedContextResult = {
  threadId: string;
  routeKind: "prospect" | "workspace" | "setup" | "unknown";
  workspaceId: Id<"workspaces"> | null;
  prospectId: Id<"prospects"> | null;
  planId: Id<"outreachPlans"> | null;
  taskId: Id<"outreachTasks"> | null;
  postId: string | null;
  postPlatform: "twitter" | "linkedin" | null;
  postUrl: string | null;
  source: "thread" | "tagged" | "none";
  ambiguousProspectIds: string[];
};

export const resolveSelectedContextForThread = internalQuery({
  args: {
    threadId: v.string(),
  },
  handler: async (
    ctx,
    { threadId }
  ): Promise<ResolvedSelectedContextResult> => {
    const prospectThreadContext = await getProspectThreadContextByThreadId(
      ctx.db,
      threadId
    );

    let routeKind: "prospect" | "workspace" | "setup" | "unknown" = "unknown";
    let workspaceId: Id<"workspaces"> | null = null;
    let prospectId: Id<"prospects"> | null = null;

    if (prospectThreadContext) {
      routeKind = "prospect";
      workspaceId = prospectThreadContext.prospect.workspaceId;
      prospectId = prospectThreadContext.prospect._id;
    } else {
      const workspaceThreadContext = await getWorkspaceThreadContextByThreadId(
        ctx.db,
        threadId
      );
      if (workspaceThreadContext) {
        routeKind = "workspace";
        workspaceId = workspaceThreadContext.workspace._id;
      } else {
        const setupSession = await ctx.runQuery(
          internal.setupSessions.getByThreadIdInternal,
          {
            threadId,
          }
        );

        if (
          setupSession?.targetWorkspaceId ||
          setupSession?.existingWorkspaceId
        ) {
          routeKind = "setup";
          workspaceId =
            setupSession.targetWorkspaceId ??
            setupSession.existingWorkspaceId ??
            null;
        } else {
          const thread = await ctx.runQuery(
            components.agent.threads.getThread,
            {
              threadId,
            }
          );
          const parsedState = parseSetupThreadState(thread?.title);
          if (parsedState?.kind === "draft") {
            routeKind = "setup";
          } else if (parsedState?.kind === "workspace") {
            routeKind = "workspace";
            workspaceId = parsedState.workspaceId as Id<"workspaces">;
          }
        }
      }
    }

    const [contextRows, targetSelection] = await Promise.all([
      ctx.db
        .query("agentMessageContexts")
        .withIndex("by_thread", (q) => q.eq("threadId", threadId))
        .order("desc")
        .take(8),
      ctx.db
        .query("agentThreadTargetSelections")
        .withIndex("by_thread", (q) => q.eq("threadId", threadId))
        .unique(),
    ]);

    const persistentTargetSelection =
      targetSelection &&
      (!workspaceId || targetSelection.workspaceId === workspaceId)
        ? {
            workspaceId: String(targetSelection.workspaceId),
            prospectIds: targetSelection.targets.map((target) =>
              String(target.prospectId)
            ),
          }
        : null;

    const selection = resolveAgentThreadSelection({
      routeScope: {
        kind: routeKind,
        workspaceId: workspaceId ? String(workspaceId) : null,
        prospectId: prospectId ? String(prospectId) : null,
      },
      contextRows: contextRows.map((row) => ({
        taggedEntities: row.taggedEntities as MentionEntitySearchResult[],
      })),
      persistentTargetSelection,
    });

    let resolvedWorkspaceId = selection.workspaceId;
    let resolvedProspectId = selection.prospectId;
    let resolvedPlanId = selection.planId;
    let resolvedTaskId = selection.taskId;

    if (!resolvedProspectId && isNonEmptyString(resolvedTaskId)) {
      const task: Doc<"outreachTasks"> | null = await ctx.runQuery(
        internal.outreach.getTaskInternal,
        {
          taskId: resolvedTaskId as Id<"outreachTasks">,
        }
      );
      if (task) {
        const planData: {
          plan: Doc<"outreachPlans">;
          tasks: Doc<"outreachTasks">[];
        } | null = await ctx.runQuery(internal.outreach.getPlanInternal, {
          planId: task.planId,
        });
        if (planData?.plan) {
          resolvedTaskId = String(task._id);
          resolvedPlanId = String(planData.plan._id);
          resolvedProspectId = String(planData.plan.prospectId);
          resolvedWorkspaceId =
            resolvedWorkspaceId ?? String(planData.plan.workspaceId);
        }
      }
    }

    if (!resolvedProspectId && isNonEmptyString(resolvedPlanId)) {
      const planData: {
        plan: Doc<"outreachPlans">;
        tasks: Doc<"outreachTasks">[];
      } | null = await ctx.runQuery(internal.outreach.getPlanInternal, {
        planId: resolvedPlanId as Id<"outreachPlans">,
      });
      if (planData?.plan) {
        resolvedPlanId = String(planData.plan._id);
        resolvedProspectId = String(planData.plan.prospectId);
        resolvedWorkspaceId =
          resolvedWorkspaceId ?? String(planData.plan.workspaceId);
      }
    }

    if (isNonEmptyString(resolvedProspectId)) {
      const prospect: Doc<"prospects"> | null = await ctx.runQuery(
        internal.prospects.getProspectInternal,
        {
          prospectId: resolvedProspectId as Id<"prospects">,
        }
      );

      if (!prospect) {
        agentThreadContextLogger.warn("Selected prospect no longer exists", {
          threadId,
          prospectId: resolvedProspectId,
        });
        resolvedProspectId = null;
        resolvedPlanId = null;
        resolvedTaskId = null;
      } else if (
        workspaceId &&
        prospect.workspaceId !== workspaceId &&
        routeKind !== "prospect"
      ) {
        agentThreadContextLogger.warn(
          "Ignoring tagged prospect outside the current workspace scope",
          {
            threadId,
            workspaceId: String(workspaceId),
            prospectId: String(prospect._id),
            prospectWorkspaceId: String(prospect.workspaceId),
          }
        );
        resolvedProspectId = null;
        resolvedPlanId = null;
        resolvedTaskId = null;
      } else {
        resolvedProspectId = String(prospect._id);
        resolvedWorkspaceId =
          resolvedWorkspaceId ?? String(prospect.workspaceId);
      }
    }

    return {
      threadId,
      routeKind,
      workspaceId: resolvedWorkspaceId
        ? (resolvedWorkspaceId as Id<"workspaces">)
        : null,
      prospectId: resolvedProspectId
        ? (resolvedProspectId as Id<"prospects">)
        : null,
      planId: resolvedPlanId ? (resolvedPlanId as Id<"outreachPlans">) : null,
      taskId: resolvedTaskId ? (resolvedTaskId as Id<"outreachTasks">) : null,
      postId: selection.postId ?? null,
      postPlatform: selection.postPlatform ?? null,
      postUrl: selection.postUrl ?? null,
      source: selection.source,
      ambiguousProspectIds: selection.ambiguousProspectIds,
    };
  },
});
