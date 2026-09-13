import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { api } from "@/convex/_generated/api";
import { getComposerLimitFromEffectiveLimit } from "@/shared/lib/twitter/xPostTextLimit";
import type { LocalClient } from "./LocalClient";
import type { createAppFixtures } from "./appFixtures";

/** Local persistence behind the production plan and draft panels. */
export function registerPlanServices(
  client: LocalClient,
  state: ReturnType<typeof createAppFixtures>
) {
  client.register(api.outreach.approvePlan, ({ planId }) => {
    const data = [...state.plans.values()].find(
      ({ plan }) => plan._id === planId
    );
    if (!data) throw new Error("Plan not found");
    if (data.plan.status !== "draft") return null;
    data.plan.status = "approved";
    data.plan.updatedAt = getCurrentUTCTimestamp();
    for (const task of data.tasks) {
      if (task.status === "pending") task.approvalReady = true;
    }
    return null;
  });
  client.register(api.outreach.approveTaskWithEdits, async (args) => {
    const data = [...state.plans.values()].find(({ tasks }) =>
      tasks.some((task) => task._id === args.taskId)
    );
    const task = data?.tasks.find((task) => task._id === args.taskId);
    if (!data || !task || task.type !== args.expectedType)
      throw new Error("Task not found");
    if (task.status === "completed") return { success: true, duplicate: true };
    if (!task.approvalReady)
      throw new Error("Approve the plan before the task");
    if (task.type === "dm") {
      const person = state.prospects.find(
        (person) => person._id === data.plan.prospectId
      );
      if (!person) throw new Error("Prospect not found");
      // Reuse the demo's local queue so the edited message appears in the
      // shared conversation UI. This never contacts a social provider.
      await client.mutation(api.outboundMessageOperations.queueMessage, {
        prospectId: person._id,
        platform: person.platform,
        clientRequestId: `demo-task-${task._id}`,
        conversationId: `demo-conversation-${person._id}`,
        text: args.content,
        mediaUrls: args.mediaUrls,
        mediaDescriptions: args.mediaDescriptions,
        mediaKinds: args.mediaKinds,
      });
    }
    Object.assign(task, {
      content: args.content,
      mediaUrls: args.mediaUrls,
      mediaDescriptions: args.mediaDescriptions,
      mediaKinds: args.mediaKinds,
      status: "completed",
      approvalReady: false,
    });
    if (data.tasks.every((item) => item.status === "completed"))
      data.plan.status = "completed";
    data.plan.updatedAt = getCurrentUTCTimestamp();
    return { success: true, duplicate: false };
  });
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
        mode:
          task.status === "completed"
            ? ("posted" as const)
            : ("approval" as const),
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
