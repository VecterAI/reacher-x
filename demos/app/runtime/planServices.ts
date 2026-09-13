import { api } from "@/convex/_generated/api";
import { getComposerLimitFromEffectiveLimit } from "@/shared/lib/twitter/xPostTextLimit";
import type { LocalClient } from "./LocalClient";
import type { createAppFixtures } from "./appFixtures";

/** Local persistence behind the production plan and draft panels. */
export function registerPlanServices(
  client: LocalClient,
  state: ReturnType<typeof createAppFixtures>
) {
  client.register(api.xPostLimits.getViewerPostComposerLimits, () => {
    const effectiveLimit = { mode: "short" as const, maxWeighted: 280 };
    return {
      ...getComposerLimitFromEffectiveLimit(effectiveLimit),
      effectiveLimit,
    };
  });
  client.register(
    api.outreach.getPlanById,
    ({ planId }) =>
      [...state.plans.values()].find((data) => data.plan._id === planId) ?? null
  );
  client.register(
    api.outreach.getPlanTasks,
    ({ planId }) =>
      [...state.plans.values()].find((data) => data.plan._id === planId)
        ?.tasks ?? []
  );
  client.register(
    api.outreach.getAgentPanelContext,
    ({ prospectId, taskId }) => {
      const data = state.plans.get(prospectId);
      const task = taskId
        ? data?.tasks.find((item) => item._id === taskId)
        : data?.tasks.find((item) => item.type === "dm");
      if (!data || !task) return null;
      return {
        kind: task.type === "dm" ? "dm" : "post",
        platform: task.approvalContext?.platform ?? "linkedin",
        mode: "approval" as const,
        planId: data.plan._id,
        planStatus: data.plan.status,
        taskStatus: task.status,
        approvalReady: task.approvalReady,
        resolvedTaskId: task._id,
        targetTweetId: task.targetTweetId,
        draft: {
          content: task.content ?? "",
          mediaUrls: task.mediaUrls ?? [],
          mediaDescriptions: task.mediaDescriptions ?? [],
          mediaKinds: task.mediaKinds ?? [],
        },
        originalPost: null,
        posted: null,
      };
    }
  );
  client.register(
    api.outreach.updatePendingTaskDraft,
    ({
      taskId,
      expectedType,
      content,
      mediaUrls,
      mediaDescriptions,
      mediaKinds,
    }) => {
      const task = [...state.plans.values()]
        .flatMap((data) => data.tasks)
        .find((item) => item._id === taskId);
      if (
        !task ||
        task.type !== expectedType ||
        !["pending", "executing"].includes(task.status)
      )
        throw new Error("Task draft is no longer editable");
      Object.assign(task, {
        content,
        ...(mediaUrls ? { mediaUrls, mediaDescriptions, mediaKinds } : {}),
      });
      return { success: true };
    }
  );
}
