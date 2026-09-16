import { isRecord } from "@/convex/lib/typeGuards";
import { recordDemoComment } from "./lifecycleHelpers";
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
  type PlanData =
    ReturnType<typeof createAppFixtures>["plans"] extends Map<string, infer T>
      ? T
      : never;
  const inFlight = new Set<string>();
  const scheduled = new Set<string>();
  const findPlan = (id: string) => {
    const data = [...state.plans.values()].find(({ plan }) => plan._id === id);
    if (!data) throw new Error("Plan not found");
    return data;
  };
  const personFor = (data: PlanData) => {
    const person = state.prospects.find(
      (person) => person._id === data.plan.prospectId
    );
    if (!person) throw new Error("Prospect not found");
    if (
      person.status === "archived" ||
      person.qualificationStatus !== "qualified"
    )
      throw new Error("This prospect is not eligible for outreach");
    return person;
  };
  const advance = (data: PlanData, now = getCurrentUTCTimestamp()) => {
    if (!["approved", "executing"].includes(data.plan.status)) return;
    data.tasks.forEach((task) => {
      task.approvalReady = false;
    });
    const task = [...data.tasks]
      .sort((a, b) => a.order - b.order)
      .find((task) => !["completed", "skipped"].includes(task.status));
    data.plan.updatedAt = now;
    if (!task) {
      data.plan.status = "completed";
      return;
    }
    data.plan.status = "executing";
    if (task.type === "wait" || task.timing.type === "delay") {
      if (task.scheduledAt === undefined) {
        const match = /^(\d+)(m|h|d)?$/i.exec(task.timing.value ?? "1h");
        const duration = match
          ? Number(match[1]) *
            ({ m: 60000, h: 3600000, d: 86400000 }[
              match[2]?.toLowerCase() ?? "h"
            ] ?? 3600000)
          : 3600000;
        task.scheduledAt = now + duration;
        task.status = "scheduled";
      }
      if (task.scheduledAt > now) {
        if (!scheduled.has(task._id)) {
          scheduled.add(task._id);
          client.schedule(
            () => {
              scheduled.delete(task._id);
              advance(data);
            },
            Math.min(task.scheduledAt - now, 2147483647)
          );
        }
        return;
      }
      if (task.type === "wait") {
        task.status = "completed";
        task.executedAt = now;
        advance(data, now);
        return;
      }
      task.status = "pending";
    }
    if (task.status === "pending" || task.status === "failed")
      task.approvalReady = true;
  };
  const approve = async (data: PlanData) => {
    const person = personFor(data);
    const account = await client.query(
      api.connectedAccounts.getConnectionSnapshot,
      { platform: person.platform }
    );
    if (!account.isConnected)
      throw new Error(
        "Connect the required account before approving this plan"
      );
    if (data.plan.status !== "draft") return;
    data.plan.status = "approved";
    advance(data);
  };
  client.register(api.outreach.approvePlan, async ({ planId }) => {
    await approve(findPlan(planId));
    return null;
  });
  client.register(api.outreach.pausePlan, ({ planId }) => {
    const data = findPlan(planId);
    if (data.plan.status !== "executing")
      throw new Error("Can only pause executing plans");
    if (data.tasks.some((task) => inFlight.has(task._id)))
      throw new Error("Wait for the current send to finish before pausing");
    data.plan.status = "paused";
    data.plan.updatedAt = getCurrentUTCTimestamp();
    data.tasks.forEach((task) => {
      task.approvalReady = false;
    });
    return null;
  });
  client.register(api.outreach.resumePlan, async ({ planId }) => {
    const data = findPlan(planId);
    personFor(data);
    if (!["paused", "blocked_auth"].includes(data.plan.status))
      throw new Error("Only paused or blocked plans can resume");
    data.plan.status = "approved";
    advance(data);
    return null;
  });
  const cancel = ({ planId }: { planId: string }) => {
    const data = findPlan(planId);
    if (
      !["draft", "approved", "executing", "paused", "blocked_auth"].includes(
        data.plan.status
      )
    )
      throw new Error("This plan cannot be cancelled");
    if (data.tasks.some((task) => inFlight.has(task._id)))
      throw new Error("Wait for the current send to finish before cancelling");
    data.plan.status = "abandoned";
    data.plan.updatedAt = getCurrentUTCTimestamp();
    data.tasks.forEach((task) => {
      task.approvalReady = false;
    });
    return null;
  };
  client.register(api.outreach.cancelPlan, cancel);
  client.register(api.outreach.abandonPlan, cancel);
  client.register(api.outreach.deletePlan, ({ planId }) => {
    const data = findPlan(planId);
    if (data.tasks.some((task) => inFlight.has(task._id)))
      throw new Error("Wait for the current send to finish before deleting");
    state.plans.delete(data.plan.prospectId);
    const person = state.prospects.find(
      (person) => person._id === data.plan.prospectId
    );
    if (person) person.planGenerationStatus = undefined;
    return { success: true };
  });
  client.register(api.outreach.approveTaskWithEdits, async (args) => {
    const data = [...state.plans.values()].find(({ tasks }) =>
      tasks.some((task) => task._id === args.taskId)
    );
    const task = data?.tasks.find((task) => task._id === args.taskId);
    if (!data || !task || task.type !== args.expectedType)
      throw new Error("Task not found");
    if (["completed"].includes(task.status))
      return { success: true, duplicate: true };
    if (inFlight.has(task._id)) throw new Error("This task is already sending");
    const person = personFor(data);
    if (data.plan.status !== "executing" || !task.approvalReady)
      throw new Error("Approve the plan and finish preceding tasks first");
    if (!args.content.trim() && !args.mediaUrls?.length)
      throw new Error("Add a message or attachment before sending");
    inFlight.add(task._id);
    try {
      const account = await client.query(
        api.connectedAccounts.getConnectionSnapshot,
        { platform: person.platform }
      );
      if (data.plan.status !== "executing")
        throw new Error("This plan is not executing");
      if (!account.isConnected) {
        data.plan.status = "blocked_auth";
        task.approvalReady = false;
        throw new Error("Reconnect the account to continue this plan");
      }
      task.status = "executing";
      task.approvalReady = false;
      client.notify();
      if (task.type === "dm")
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
      if (task.type === "comment") {
        const post = task.originalPost?.postData;
        if (!isRecord(post) || !task.targetTweetId)
          throw new Error("Original post is unavailable");
        recordDemoComment(
          state.lifecycle,
          person,
          post,
          task.targetTweetId,
          args.content,
          `demo-reply-${task._id}`
        );
      }
      Object.assign(task, {
        content: args.content,
        mediaUrls: args.mediaUrls,
        mediaDescriptions: args.mediaDescriptions,
        mediaKinds: args.mediaKinds,
        status: "completed",
        executedAt: getCurrentUTCTimestamp(),
        approvalReady: false,
      });
      advance(data);
      return { success: true, duplicate: false };
    } catch (error) {
      if (task.status === "executing") {
        task.status = "failed";
        task.approvalReady = true;
      }
      throw error;
    } finally {
      inFlight.delete(task._id);
      client.notify();
    }
  });
  client.register(
    api.outreach.approveTask,
    async ({ taskId, expectedType }) => {
      const task = [...state.plans.values()]
        .flatMap((data) => data.tasks)
        .find((task) => task._id === taskId);
      if (!task || (expectedType && task.type !== expectedType))
        throw new Error("Task not found");
      if (task.type !== "dm" && task.type !== "comment")
        throw new Error("This task does not have a message to approve");
      await client.mutation(api.outreach.approveTaskWithEdits, {
        taskId,
        expectedType: task.type,
        content: task.content ?? "",
        mediaUrls: task.mediaUrls,
        mediaDescriptions: task.mediaDescriptions,
        mediaKinds: task.mediaKinds,
      });
      return null;
    }
  );
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
    ({ prospectId, taskId, targetTweetId }) => {
      const data = state.plans.get(prospectId);
      const task = taskId
        ? data?.tasks.find((item) => item._id === taskId)
        : targetTweetId
          ? data?.tasks.find(
              (item) =>
                item.type === "comment" && item.targetTweetId === targetTweetId
            )
          : (data?.tasks.find(
              (item) =>
                item.type === "comment" &&
                ["pending", "executing"].includes(item.status)
            ) ??
            data?.tasks.find((item) => item.type === "comment") ??
            data?.tasks.find((item) => item.type === "dm"));
      if (
        !data ||
        !task ||
        (targetTweetId && task.targetTweetId !== targetTweetId)
      )
        return null;
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
        originalPost: task.originalPost
          ? {
              ...task.originalPost,
              postId: task.targetTweetId,
              context: undefined,
            }
          : null,
        posted:
          task.status === "completed"
            ? {
                text: task.content ?? "",
                conversationId: undefined,
                messageId: undefined,
                mediaUrls: task.mediaUrls ?? [],
                mediaDescriptions: task.mediaDescriptions ?? [],
                mediaKinds: task.mediaKinds ?? [],
                tweetId: `demo-reply-${task._id}`,
                postedAt: task.executedAt,
                author: {
                  name: "Maya Chen",
                  screenName: "maya_demo",
                  profileImageUrl: undefined,
                },
              }
            : null,
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
      const data = [...state.plans.values()].find((data) =>
        data.tasks.some((item) => item._id === taskId)
      );
      const task = data?.tasks.find((item) => item._id === taskId);
      if (
        !task ||
        !data ||
        !["draft", "approved", "executing", "paused"].includes(
          data.plan.status
        ) ||
        inFlight.has(task._id) ||
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
  return {
    advanceDueTasks: (now = getCurrentUTCTimestamp()) => {
      state.plans.forEach((data) => advance(data, now));
      client.notify();
    },
    startAutonomous: async (workspaceId: string) => {
      for (const data of state.plans.values()) {
        if (
          data.plan.workspaceId !== workspaceId ||
          data.plan.status !== "draft"
        )
          continue;
        try {
          await approve(data);
          const task = data.tasks.find((task) => task.approvalReady);
          if (task?.type === "dm")
            await client.mutation(api.outreach.approveTaskWithEdits, {
              taskId: task._id,
              expectedType: "dm",
              content: task.content ?? "",
              mediaUrls: task.mediaUrls,
              mediaDescriptions: task.mediaDescriptions,
              mediaKinds: task.mediaKinds,
            });
        } catch (error) {
          console.warn(
            "[DemoPlans] Could not start autonomous plan",
            data.plan._id,
            error
          );
        }
      }
    },
  };
}
