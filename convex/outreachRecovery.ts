import { v } from "convex/values";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./lib/functionBuilders";
import { fetchSocialApi } from "./lib/socialApiFetch";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import {
  buildTwitterPostUrl,
  getTwitterPostId,
  summarizeTwitterPost,
} from "../shared/lib/twitter/contracts";
import { resolveProspectTwitterIdentity } from "../shared/lib/twitter/prospectTwitterIdentity";
import { normalizeLinkedInReadUrn } from "../shared/lib/linkedin/comments";
import { getNestedRecord, getStringProperty } from "./lib/typeGuards";
import {
  getProspectDisplayFields,
  upsertNotificationByKey,
} from "./lib/notificationHelpers";
import {
  getNewRecoveryArtifactIds,
  getRecoveryNextCheckDelayMs,
  serializeRecoveryArtifactIds,
  TWITTER_MANUAL_REPLY_POLL_INTERVAL_MS,
} from "./lib/outreachRecoveryCore";

const SOCIALAPI_BASE_URL = "https://api.socialapi.me";
const TWITTER_MANUAL_DETECTION_WINDOW_MS = 48 * 60 * 60 * 1000;
const RESPONSE_MONITOR_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const LINKEDIN_CONNECTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const internalRecovery = (internal as any).outreachRecovery;

type RecoveryMonitor = Doc<"outreachRecoveryMonitors">;

type SocialApiCommentedResponse = {
  comment_ids?: string[];
  is_commented?: boolean;
  status?: string;
};

type SocialApiSearchResponse = {
  tweets?: unknown[];
  message?: string;
};

async function resumeDmAfterLinkedInConnection(
  ctx: MutationCtx,
  monitor: RecoveryMonitor
) {
  if (!monitor.taskId || !monitor.planId) return;
  const task = await ctx.db.get("outreachTasks", monitor.taskId);
  const plan = await ctx.db.get("outreachPlans", monitor.planId);
  if (!task || !plan || task.planId !== plan._id) return;

  const now = getCurrentUTCTimestamp();
  await ctx.db.patch("outreachRecoveryMonitors", monitor._id, {
    status: "completed",
    detectedAt: now,
    completedAt: now,
    lastCheckedAt: now,
    nextCheckAt: undefined,
  });
  await ctx.db.patch("outreachTasks", task._id, {
    status: "pending",
    errorMessage: undefined,
    statusBridgeState: undefined,
    statusBridgeSentAt: undefined,
  });
  await ctx.db.patch("outreachPlans", plan._id, {
    status: "approved",
    workflowId: undefined,
    updatedAt: now,
  });
  await ctx.scheduler.runAfter(
    1_000,
    internal.workflows.outreach.startOutreachWorkflow,
    { planId: plan._id }
  );

  const prospect = await ctx.db.get("prospects", plan.prospectId);
  await upsertNotificationByKey(ctx, {
    userId: plan.userId,
    workspaceId: plan.workspaceId,
    type: "outreach_sent",
    notificationKey: `linkedin-connection-resumed:${task._id}`,
    title: "LinkedIn connection accepted",
    message: "ReacherX is sending the approved DM automatically.",
    prospectId: plan.prospectId,
    planId: plan._id,
    taskId: task._id,
    threadId: plan.threadId,
    contextPlatform: "linkedin",
    ...getProspectDisplayFields(prospect),
  });
}

async function fetchSocialApiJson<T>(
  ctx: ActionCtx,
  consumer: string,
  path: string,
  params?: URLSearchParams
): Promise<T> {
  const apiKey = process.env.SOCIALAPI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("SOCIALAPI_API_KEY is not set");
  }

  const response = await fetchSocialApi(
    ctx,
    consumer,
    `${SOCIALAPI_BASE_URL}${path}${params ? `?${params.toString()}` : ""}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    }
  );
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `SocialAPI request failed (${response.status}): ${body.slice(0, 500)}`
    );
  }
  return JSON.parse(body) as T;
}

async function fetchTwitterCommentIds(
  ctx: ActionCtx,
  tweetId: string,
  xUserId: string
): Promise<string[]> {
  const payload = await fetchSocialApiJson<SocialApiCommentedResponse>(
    ctx,
    "outreachRecovery.verifyUserCommented",
    `/twitter/tweets/${encodeURIComponent(tweetId)}/commented_by/${encodeURIComponent(xUserId)}`
  );
  return Array.isArray(payload.comment_ids)
    ? payload.comment_ids.filter(
        (commentId): commentId is string => typeof commentId === "string"
      )
    : [];
}

function getTweetReplyTargetId(tweet: unknown): string | undefined {
  const record = getNestedRecord({ tweet }, "tweet");
  return (
    getStringProperty(record, "in_reply_to_status_id_str") ??
    getStringProperty(record, "inReplyToTweetId")
  );
}

function getTweetAuthorId(tweet: unknown): string | undefined {
  const record = getNestedRecord({ tweet }, "tweet");
  const user = getNestedRecord(record, "user");
  const author = getNestedRecord(record, "author");
  return (
    getStringProperty(user, "id_str") ??
    getStringProperty(user, "id") ??
    getStringProperty(author, "id") ??
    getStringProperty(record, "author_id")
  );
}

async function hydrateTwitterPost(
  ctx: ActionCtx,
  userId: Id<"users">,
  tweetId: string
): Promise<unknown | null> {
  const result = await ctx.runAction(
    internal.x.getHydratedTwitterPostInternal,
    {
      userId,
      tweetId,
    }
  );
  return result?.tweet ?? null;
}

export const beginTwitterManualReplyRecovery = internalAction({
  args: {
    taskId: v.id("outreachTasks"),
    planId: v.id("outreachPlans"),
    errorMessage: v.string(),
  },
  returns: v.object({
    started: v.boolean(),
    monitorId: v.optional(v.id("outreachRecoveryMonitors")),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    started: boolean;
    monitorId?: Id<"outreachRecoveryMonitors">;
  }> => {
    const planData = await ctx.runQuery(internal.outreach.getPlanInternal, {
      planId: args.planId,
    });
    const task = planData?.tasks.find(
      (candidate: Doc<"outreachTasks">) => candidate._id === args.taskId
    );
    if (!planData?.plan || !task?.targetTweetId) {
      return { started: false };
    }

    const connection = await ctx.runAction(
      internal.x.getTwitterConnectionIdentityInternal,
      { userId: planData.plan.userId }
    );
    if (!connection.isConnected || !connection.xUserId) {
      return { started: false };
    }

    let baselineIds: string[] = [];
    try {
      baselineIds = await fetchTwitterCommentIds(
        ctx,
        task.targetTweetId,
        connection.xUserId
      );
    } catch (error) {
      console.warn(
        "[OutreachRecovery] Could not snapshot existing X replies before manual handoff",
        {
          taskId: String(args.taskId),
          targetTweetId: task.targetTweetId,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }

    const monitorId = await ctx.runMutation(
      internalRecovery.startTwitterManualReplyRecovery,
      {
        taskId: args.taskId,
        planId: args.planId,
        baselineArtifactIdsJson: serializeRecoveryArtifactIds(baselineIds),
        errorMessage: args.errorMessage,
      }
    );
    return { started: true, monitorId };
  },
});

export const beginLinkedInConnectionThenDmRecovery = internalAction({
  args: {
    taskId: v.id("outreachTasks"),
    planId: v.id("outreachPlans"),
    errorMessage: v.string(),
  },
  returns: v.object({ started: v.boolean() }),
  handler: async (ctx, args) => {
    const planData = await ctx.runQuery(internal.outreach.getPlanInternal, {
      planId: args.planId,
    });
    const task = planData?.tasks.find(
      (candidate: Doc<"outreachTasks">) => candidate._id === args.taskId
    );
    if (
      !planData?.plan ||
      !task ||
      task.type !== "dm" ||
      task.approvalContext?.platform !== "linkedin"
    ) {
      return { started: false };
    }

    const invitation = await ctx.runAction(
      internal.linkedin.sendLinkedInRecoveryInvitationInternal,
      {
        userId: planData.plan.userId,
        prospectId: planData.plan.prospectId,
      }
    );
    if (invitation.outcome === "failed") {
      console.warn(
        "[OutreachRecovery] LinkedIn connect-first recovery failed",
        {
          taskId: String(task._id),
          classification: invitation.errorClass,
          message: invitation.errorMessage,
        }
      );
      return { started: false };
    }

    if (invitation.outcome === "already_connected") {
      return { started: false };
    }

    await ctx.runMutation(
      internalRecovery.startLinkedInConnectionThenDmRecovery,
      {
        taskId: task._id,
        planId: planData.plan._id,
        sourcePostId:
          invitation.targetUserId ?? String(planData.plan.prospectId),
        errorMessage: args.errorMessage,
      }
    );
    return { started: true };
  },
});

export const startLinkedInConnectionThenDmRecovery = internalMutation({
  args: {
    taskId: v.id("outreachTasks"),
    planId: v.id("outreachPlans"),
    sourcePostId: v.string(),
    errorMessage: v.string(),
  },
  returns: v.id("outreachRecoveryMonitors"),
  handler: async (ctx, args) => {
    const task = await ctx.db.get("outreachTasks", args.taskId);
    const plan = await ctx.db.get("outreachPlans", args.planId);
    if (!task || !plan || task.planId !== plan._id || task.type !== "dm") {
      throw new Error("LinkedIn DM task is unavailable for recovery");
    }

    const existing = (
      await ctx.db
        .query("outreachRecoveryMonitors")
        .withIndex("by_task_and_kind", (q) =>
          q.eq("taskId", task._id).eq("kind", "linkedin_connection_then_dm")
        )
        .order("desc")
        .take(5)
    ).find((monitor) => monitor.status === "active");
    if (existing) return existing._id;

    const now = getCurrentUTCTimestamp();
    const monitorId = await ctx.db.insert("outreachRecoveryMonitors", {
      userId: plan.userId,
      workspaceId: plan.workspaceId,
      prospectId: plan.prospectId,
      planId: plan._id,
      taskId: task._id,
      kind: "linkedin_connection_then_dm",
      stage: "awaiting_connection",
      status: "active",
      sourcePostId: args.sourcePostId,
      expectedText: task.content,
      startedAt: now,
      expiresAt: now + LINKEDIN_CONNECTION_WINDOW_MS,
      attemptCount: 0,
      nextCheckAt: now + getRecoveryNextCheckDelayMs("awaiting_connection", 0),
    });
    await ctx.db.patch("outreachTasks", task._id, {
      status: "waiting_connection",
      errorMessage: args.errorMessage,
      executedAt: now,
      statusBridgeState: undefined,
      statusBridgeSentAt: undefined,
    });
    await ctx.db.patch("outreachPlans", plan._id, {
      status: "paused",
      updatedAt: now,
    });

    const prospect = await ctx.db.get("prospects", plan.prospectId);
    await upsertNotificationByKey(ctx, {
      userId: plan.userId,
      workspaceId: plan.workspaceId,
      type: "outreach_sent",
      notificationKey: `linkedin-connect-first:${task._id}`,
      title: "Connection request sent on LinkedIn",
      message:
        "The DM required a connection. ReacherX sent the request and will send the approved DM automatically after acceptance.",
      prospectId: plan.prospectId,
      planId: plan._id,
      taskId: task._id,
      threadId: plan.threadId,
      contextPlatform: "linkedin",
      ...getProspectDisplayFields(prospect),
    });
    await ctx.scheduler.runAfter(
      getRecoveryNextCheckDelayMs("awaiting_connection", 0),
      internalRecovery.checkRecoveryMonitor,
      { monitorId }
    );
    return monitorId;
  },
});

export const onLinkedInConnectionAccepted = internalMutation({
  args: { prospectId: v.id("prospects") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const monitors = await ctx.db
      .query("outreachRecoveryMonitors")
      .withIndex("by_prospect_and_status", (q) =>
        q.eq("prospectId", args.prospectId).eq("status", "active")
      )
      .take(20);
    const connectionMonitors = monitors.filter(
      (monitor) => monitor.kind === "linkedin_connection_then_dm"
    );
    for (const monitor of connectionMonitors) {
      await resumeDmAfterLinkedInConnection(ctx, monitor);
    }
    return connectionMonitors.length;
  },
});

export const startTwitterManualReplyRecovery = internalMutation({
  args: {
    taskId: v.id("outreachTasks"),
    planId: v.id("outreachPlans"),
    baselineArtifactIdsJson: v.string(),
    errorMessage: v.string(),
  },
  returns: v.id("outreachRecoveryMonitors"),
  handler: async (ctx, args) => {
    const task = await ctx.db.get("outreachTasks", args.taskId);
    const plan = await ctx.db.get("outreachPlans", args.planId);
    if (!task || !plan || task.planId !== plan._id || !task.targetTweetId) {
      throw new Error("Outreach task is unavailable for manual recovery");
    }

    const existing = (
      await ctx.db
        .query("outreachRecoveryMonitors")
        .withIndex("by_task_and_kind", (q) =>
          q.eq("taskId", task._id).eq("kind", "twitter_manual_reply")
        )
        .order("desc")
        .take(5)
    ).find((monitor) => monitor.status === "active");
    if (existing) return existing._id;

    const now = getCurrentUTCTimestamp();
    const monitorId = await ctx.db.insert("outreachRecoveryMonitors", {
      userId: plan.userId,
      workspaceId: plan.workspaceId,
      prospectId: plan.prospectId,
      planId: plan._id,
      taskId: task._id,
      kind: "twitter_manual_reply",
      stage: "detecting_outbound",
      status: "active",
      sourcePostId: task.targetTweetId,
      baselineArtifactIdsJson: args.baselineArtifactIdsJson,
      startedAt: now,
      expiresAt: now + TWITTER_MANUAL_DETECTION_WINDOW_MS,
      attemptCount: 0,
      nextCheckAt: now + TWITTER_MANUAL_REPLY_POLL_INTERVAL_MS,
    });

    await ctx.db.patch("outreachTasks", task._id, {
      status: "waiting_manual",
      errorMessage: args.errorMessage,
      executedAt: now,
      statusBridgeState: undefined,
      statusBridgeSentAt: undefined,
    });
    await ctx.db.patch("outreachPlans", plan._id, {
      status: "paused",
      updatedAt: now,
    });

    const prospect = await ctx.db.get("prospects", plan.prospectId);
    const display = getProspectDisplayFields(prospect);
    const postUrl = buildTwitterPostUrl({ postId: task.targetTweetId });
    await upsertNotificationByKey(ctx, {
      userId: plan.userId,
      workspaceId: plan.workspaceId,
      type: "ask_human",
      notificationKey: `manual-x-reply:${task._id}`,
      title: "Post this reply manually on X",
      message: `X blocked automatic posting. Open the post and publish the prepared reply: ${postUrl}\n\nReacherX is watching automatically and will continue the plan when your reply appears.`,
      prospectId: plan.prospectId,
      planId: plan._id,
      taskId: task._id,
      threadId: plan.threadId,
      contextPlatform: "twitter",
      ...display,
    });

    await ctx.scheduler.runAfter(
      TWITTER_MANUAL_REPLY_POLL_INTERVAL_MS,
      internalRecovery.checkRecoveryMonitor,
      { monitorId }
    );
    return monitorId;
  },
});

export const startLinkedInCommentReplyMonitor = internalMutation({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    sourcePostId: v.string(),
    commentId: v.optional(v.string()),
    parentCommentId: v.optional(v.string()),
    expectedText: v.string(),
    planId: v.optional(v.id("outreachPlans")),
  },
  returns: v.id("outreachRecoveryMonitors"),
  handler: async (ctx, args) => {
    const prospect = await ctx.db.get("prospects", args.prospectId);
    if (!prospect || prospect.userId !== args.userId) {
      throw new Error("Prospect not found for LinkedIn comment monitoring");
    }

    const plan = args.planId
      ? await ctx.db.get("outreachPlans", args.planId)
      : (
          await ctx.db
            .query("outreachPlans")
            .withIndex("by_prospect", (q) =>
              q.eq("prospectId", args.prospectId)
            )
            .order("desc")
            .take(10)
        ).find(
          (candidate) =>
            candidate.status !== "completed" && candidate.status !== "abandoned"
        );
    const active = (
      await ctx.db
        .query("outreachRecoveryMonitors")
        .withIndex("by_prospect_and_status", (q) =>
          q.eq("prospectId", args.prospectId).eq("status", "active")
        )
        .order("desc")
        .take(20)
    ).find(
      (monitor) =>
        monitor.kind === "linkedin_comment_reply" &&
        monitor.sourcePostId === args.sourcePostId &&
        (monitor.outboundArtifactId === args.commentId ||
          (!args.commentId && monitor.expectedText === args.expectedText))
    );
    if (active) return active._id;

    const now = getCurrentUTCTimestamp();
    const monitorId = await ctx.db.insert("outreachRecoveryMonitors", {
      userId: args.userId,
      workspaceId: prospect.workspaceId,
      prospectId: prospect._id,
      planId: plan?._id,
      kind: "linkedin_comment_reply",
      stage: args.commentId ? "awaiting_response" : "detecting_outbound",
      status: "active",
      sourcePostId: args.sourcePostId,
      outboundArtifactId: args.commentId,
      outboundParentArtifactId: args.parentCommentId,
      expectedText: args.expectedText,
      startedAt: now,
      expiresAt:
        now +
        (args.commentId
          ? RESPONSE_MONITOR_WINDOW_MS
          : TWITTER_MANUAL_DETECTION_WINDOW_MS),
      attemptCount: 0,
      nextCheckAt: now + (args.commentId ? 5 * 60 * 1000 : 30_000),
    });
    await ctx.scheduler.runAfter(
      args.commentId ? 5 * 60 * 1000 : 30_000,
      internalRecovery.checkRecoveryMonitor,
      { monitorId }
    );
    return monitorId;
  },
});

export const getRecoveryMonitorInternal = internalQuery({
  args: { monitorId: v.id("outreachRecoveryMonitors") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) =>
    await ctx.db.get("outreachRecoveryMonitors", args.monitorId),
});

export const recordRecoveryCheck = internalMutation({
  args: {
    monitorId: v.id("outreachRecoveryMonitors"),
    errorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const monitor = await ctx.db.get(
      "outreachRecoveryMonitors",
      args.monitorId
    );
    if (!monitor || monitor.status !== "active") return null;

    const now = getCurrentUTCTimestamp();
    if (now >= monitor.expiresAt) {
      await ctx.db.patch("outreachRecoveryMonitors", monitor._id, {
        status: "expired",
        lastCheckedAt: now,
        lastErrorMessage: args.errorMessage,
        nextCheckAt: undefined,
        completedAt: now,
      });

      if (monitor.stage === "detecting_outbound" && monitor.taskId) {
        const prospect = await ctx.db.get("prospects", monitor.prospectId);
        const display = getProspectDisplayFields(prospect);
        await upsertNotificationByKey(ctx, {
          userId: monitor.userId,
          workspaceId: monitor.workspaceId,
          type: "error",
          notificationKey: `manual-x-reply-expired:${monitor.taskId}`,
          title: "Manual X reply was not detected",
          message:
            "ReacherX could not verify a new direct reply on the selected X post. The outreach plan remains paused so it will not send a duplicate.",
          prospectId: monitor.prospectId,
          planId: monitor.planId,
          taskId: monitor.taskId,
          contextPlatform: "twitter",
          ...display,
        });
      } else if (
        monitor.stage === "detecting_outbound" &&
        monitor.kind === "linkedin_comment_reply"
      ) {
        const prospect = await ctx.db.get("prospects", monitor.prospectId);
        const display = getProspectDisplayFields(prospect);
        await upsertNotificationByKey(ctx, {
          userId: monitor.userId,
          workspaceId: monitor.workspaceId,
          type: "error",
          notificationKey: `linkedin-comment-monitor-expired:${monitor._id}`,
          title: "LinkedIn comment monitoring could not start",
          message:
            "The comment was posted, but ReacherX could not resolve its LinkedIn comment ID, so replies to it cannot be monitored automatically.",
          prospectId: monitor.prospectId,
          planId: monitor.planId,
          contextPlatform: "linkedin",
          ...display,
        });
      } else if (monitor.stage === "awaiting_connection" && monitor.taskId) {
        const task = await ctx.db.get("outreachTasks", monitor.taskId);
        if (task?.status === "waiting_connection") {
          await ctx.db.patch("outreachTasks", task._id, {
            status: "failed",
            errorMessage:
              "The LinkedIn connection request was not accepted within 30 days, so the DM could not be sent.",
            statusBridgeState: undefined,
            statusBridgeSentAt: undefined,
          });
          await ctx.scheduler.runAfter(
            0,
            internal.chat.bridgeOutreachTaskStatusToThread,
            { taskId: task._id }
          );
        }
        const prospect = await ctx.db.get("prospects", monitor.prospectId);
        await upsertNotificationByKey(ctx, {
          userId: monitor.userId,
          workspaceId: monitor.workspaceId,
          type: "error",
          notificationKey: `linkedin-connection-expired:${monitor.taskId}`,
          title: "LinkedIn connection was not accepted",
          message:
            "The approved DM was not sent. ReacherX stopped waiting after 30 days so this outreach will not remain stuck silently.",
          prospectId: monitor.prospectId,
          planId: monitor.planId,
          taskId: monitor.taskId,
          contextPlatform: "linkedin",
          ...getProspectDisplayFields(prospect),
        });
      }
      return null;
    }

    const nextAttemptCount = monitor.attemptCount + 1;
    const delayMs = getRecoveryNextCheckDelayMs(
      monitor.stage,
      nextAttemptCount,
      monitor.kind
    );
    await ctx.db.patch("outreachRecoveryMonitors", monitor._id, {
      attemptCount: nextAttemptCount,
      lastCheckedAt: now,
      lastErrorMessage: args.errorMessage,
      nextCheckAt: now + delayMs,
    });
    await ctx.scheduler.runAfter(
      delayMs,
      internalRecovery.checkRecoveryMonitor,
      { monitorId: monitor._id }
    );
    return null;
  },
});

export const confirmTwitterManualReply = internalMutation({
  args: {
    monitorId: v.id("outreachRecoveryMonitors"),
    replyPostId: v.string(),
    replyText: v.optional(v.string()),
    repliedAt: v.number(),
  },
  returns: v.union(v.null(), v.id("outreachTasks")),
  handler: async (ctx, args) => {
    const monitor = await ctx.db.get(
      "outreachRecoveryMonitors",
      args.monitorId
    );
    if (
      !monitor ||
      monitor.status !== "active" ||
      monitor.stage !== "detecting_outbound" ||
      !monitor.taskId ||
      !monitor.planId
    ) {
      return null;
    }
    const task = await ctx.db.get("outreachTasks", monitor.taskId);
    const plan = await ctx.db.get("outreachPlans", monitor.planId);
    if (!task || !plan) return null;

    const now = getCurrentUTCTimestamp();
    await ctx.db.patch("outreachTasks", task._id, {
      status: "waiting_response",
      resultData: {
        postedTweetId: args.replyPostId,
        postedAt: args.repliedAt,
        postedText: args.replyText ?? task.content ?? "",
        postedBy: { name: "You" },
        manuallyPosted: true,
        sentVia: "external_x",
      },
      errorMessage: undefined,
      executedAt: now,
      statusBridgeState: undefined,
      statusBridgeSentAt: undefined,
    });
    await ctx.db.patch("outreachRecoveryMonitors", monitor._id, {
      stage: "awaiting_response",
      outboundArtifactId: args.replyPostId,
      detectedAt: now,
      expiresAt: now + RESPONSE_MONITOR_WINDOW_MS,
      attemptCount: 0,
      lastCheckedAt: now,
      lastErrorMessage: undefined,
      nextCheckAt: now + 5 * 60 * 1000,
    });
    await ctx.db.patch("outreachPlans", plan._id, {
      status: "approved",
      workflowId: undefined,
      updatedAt: now,
    });

    const prospect = await ctx.db.get("prospects", monitor.prospectId);
    const display = getProspectDisplayFields(prospect);
    await upsertNotificationByKey(ctx, {
      userId: monitor.userId,
      workspaceId: monitor.workspaceId,
      type: "outreach_sent",
      notificationKey: `manual-x-reply-detected:${task._id}`,
      title: "Manual X reply detected",
      message:
        "Your reply was linked to this outreach plan. ReacherX is now monitoring the conversation for a response.",
      prospectId: monitor.prospectId,
      planId: plan._id,
      taskId: task._id,
      threadId: plan.threadId,
      contextPlatform: "twitter",
      ...display,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.outreach.markProspectContactedFromSuccessfulComment,
      {
        prospectId: monitor.prospectId,
        workspaceId: monitor.workspaceId,
        description: "Posted a reply manually on X after an API policy block.",
      }
    );
    await ctx.scheduler.runAfter(
      0,
      internal.workflows.outreach.startOutreachWorkflow,
      { planId: plan._id }
    );
    await ctx.scheduler.runAfter(
      5 * 60 * 1000,
      internalRecovery.checkRecoveryMonitor,
      { monitorId: monitor._id }
    );
    return task._id;
  },
});

export const completeRecoveryMonitor = internalMutation({
  args: { monitorId: v.id("outreachRecoveryMonitors") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const monitor = await ctx.db.get(
      "outreachRecoveryMonitors",
      args.monitorId
    );
    if (!monitor || monitor.status !== "active") return null;
    const now = getCurrentUTCTimestamp();
    await ctx.db.patch("outreachRecoveryMonitors", monitor._id, {
      status: "completed",
      completedAt: now,
      lastCheckedAt: now,
      nextCheckAt: undefined,
      lastErrorMessage: undefined,
    });
    return null;
  },
});

export const confirmLinkedInOutboundComment = internalMutation({
  args: {
    monitorId: v.id("outreachRecoveryMonitors"),
    commentId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const monitor = await ctx.db.get(
      "outreachRecoveryMonitors",
      args.monitorId
    );
    if (
      !monitor ||
      monitor.status !== "active" ||
      monitor.kind !== "linkedin_comment_reply" ||
      monitor.stage !== "detecting_outbound"
    ) {
      return false;
    }
    const now = getCurrentUTCTimestamp();
    await ctx.db.patch("outreachRecoveryMonitors", monitor._id, {
      stage: "awaiting_response",
      outboundArtifactId: args.commentId,
      detectedAt: now,
      expiresAt: now + RESPONSE_MONITOR_WINDOW_MS,
      attemptCount: 0,
      lastCheckedAt: now,
      lastErrorMessage: undefined,
      nextCheckAt: now + 5 * 60 * 1000,
    });
    await ctx.scheduler.runAfter(
      5 * 60 * 1000,
      internalRecovery.checkRecoveryMonitor,
      { monitorId: monitor._id }
    );
    return true;
  },
});

async function checkTwitterManualOutbound(
  ctx: ActionCtx,
  monitor: RecoveryMonitor
): Promise<boolean> {
  const connection = await ctx.runAction(
    internal.x.getTwitterConnectionIdentityInternal,
    { userId: monitor.userId }
  );
  if (!connection.isConnected || !connection.xUserId) {
    throw new Error("Connected X identity is unavailable");
  }

  const commentIds = await fetchTwitterCommentIds(
    ctx,
    monitor.sourcePostId,
    connection.xUserId
  );
  const candidates = getNewRecoveryArtifactIds(
    commentIds,
    monitor.baselineArtifactIdsJson
  );

  for (const commentId of candidates) {
    const tweet = await hydrateTwitterPost(ctx, monitor.userId, commentId);
    if (!tweet) continue;
    const replyTargetId = getTweetReplyTargetId(tweet);
    if (replyTargetId && replyTargetId !== monitor.sourcePostId) continue;
    const authorId = getTweetAuthorId(tweet);
    if (authorId && authorId !== connection.xUserId) continue;

    const summary = summarizeTwitterPost(tweet);
    if (summary?.createdAt && summary.createdAt < monitor.startedAt) continue;
    const confirmedTaskId = await ctx.runMutation(
      internalRecovery.confirmTwitterManualReply,
      {
        monitorId: monitor._id,
        replyPostId: commentId,
        replyText: summary?.textPreview,
        repliedAt: summary?.createdAt ?? getCurrentUTCTimestamp(),
      }
    );
    if (!confirmedTaskId) return false;

    await ctx.runMutation(internal.outreach.upsertTwitterInteraction, {
      userId: monitor.userId,
      prospectId: monitor.prospectId,
      sourcePostRef: {
        platform: "twitter",
        postId: monitor.sourcePostId,
        conversationId: monitor.sourcePostId,
      },
      replyPostRef: {
        platform: "twitter",
        postId: commentId,
        conversationId: monitor.sourcePostId,
        authorHandle: connection.screenName,
        url: buildTwitterPostUrl({
          postId: commentId,
          authorHandle: connection.screenName,
        }),
      },
      replyPostSummary: summary ?? undefined,
      threadId: monitor.sourcePostId,
      repliedAt: summary?.createdAt ?? getCurrentUTCTimestamp(),
      origin: "external_x",
      discoveredVia: "socialapi_incremental",
      status: "active",
      direction: "outgoing",
      discoveredAt: summary?.createdAt ?? getCurrentUTCTimestamp(),
      lastSeenAt: getCurrentUTCTimestamp(),
    });
    return true;
  }
  return false;
}

async function checkTwitterProspectResponse(
  ctx: ActionCtx,
  monitor: RecoveryMonitor
): Promise<boolean> {
  const prospect = await ctx.runQuery(internal.prospects.getProspectInternal, {
    prospectId: monitor.prospectId,
  });
  if (!prospect) throw new Error("Prospect not found");
  const prospectIdentity = resolveProspectTwitterIdentity(prospect);
  if (!prospectIdentity.username) {
    throw new Error("Prospect X handle is unavailable");
  }

  const params = new URLSearchParams({
    query: `conversation_id:${monitor.sourcePostId} from:${prospectIdentity.username.replace(/^@/, "")}`,
    type: "Latest",
  });
  const payload = await fetchSocialApiJson<SocialApiSearchResponse>(
    ctx,
    "outreachRecovery.findProspectReply",
    "/twitter/search",
    params
  );
  const tweets = Array.isArray(payload.tweets) ? payload.tweets : [];
  const response = tweets.find(
    (tweet) =>
      getTweetReplyTargetId(tweet) === monitor.outboundArtifactId &&
      getTwitterPostId(tweet)
  );
  const responsePostId = response ? getTwitterPostId(response) : undefined;
  if (!response || !responsePostId) return false;

  const summary = summarizeTwitterPost(response);
  await ctx.runMutation(internal.outreach.onProspectResponse, {
    prospectId: monitor.prospectId,
    planId: monitor.planId,
    responseTweetId: responsePostId,
    responseText: summary?.textPreview,
    responseData: response,
  });
  await ctx.runMutation(internalRecovery.completeRecoveryMonitor, {
    monitorId: monitor._id,
  });
  return true;
}

async function checkLinkedInCommentResponse(
  ctx: ActionCtx,
  monitor: RecoveryMonitor
): Promise<boolean> {
  if (!monitor.outboundArtifactId) return false;
  const [account, prospect] = await Promise.all([
    ctx.runQuery(internal.linkedinStore.getLinkedInAccountForUserInternal, {
      userId: monitor.userId,
    }),
    ctx.runQuery(internal.prospects.getProspectInternal, {
      prospectId: monitor.prospectId,
    }),
  ]);
  if (!account?.accountId || account.status !== "connected") {
    throw new Error("Connected LinkedIn account is unavailable");
  }
  if (!prospect) throw new Error("Prospect not found");

  const response = await ctx.runAction(
    internal.linkedin.listLinkedInCommentRepliesInternal,
    {
      userId: monitor.userId,
      postId: monitor.sourcePostId,
      commentId: monitor.outboundArtifactId ?? monitor.outboundParentArtifactId,
    }
  );
  if (!monitor.outboundArtifactId) {
    const outbound = (response.items ?? []).find(
      (comment) =>
        comment.isViewer &&
        comment.text?.trim() === monitor.expectedText?.trim()
    );
    if (!outbound) return false;
    return await ctx.runMutation(
      internalRecovery.confirmLinkedInOutboundComment,
      {
        monitorId: monitor._id,
        commentId: outbound.id,
      }
    );
  }
  const prospectProviderIds = new Set(
    [
      prospect.linkedinUserUrn,
      prospect.socialProfiles?.linkedin?.urn,
      normalizeLinkedInReadUrn(prospect.linkedinUserUrn),
      normalizeLinkedInReadUrn(prospect.socialProfiles?.linkedin?.urn),
    ].filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0
    )
  );
  const reply = (response.items ?? []).find((comment) => {
    const authorId = comment.authorId?.trim();
    const normalizedAuthorId = normalizeLinkedInReadUrn(authorId);
    return Boolean(
      (authorId && prospectProviderIds.has(authorId)) ||
      (normalizedAuthorId && prospectProviderIds.has(normalizedAuthorId))
    );
  });
  if (!reply) return false;

  await ctx.runMutation(internal.outreach.onProspectLinkedInResponse, {
    prospectId: monitor.prospectId,
    planId: monitor.planId,
    responseType: "comment",
    responseMessageId: reply.id,
    responseText: reply.text,
    responseData: reply,
    conversationId: monitor.sourcePostId,
  });
  await ctx.runMutation(internalRecovery.completeRecoveryMonitor, {
    monitorId: monitor._id,
  });
  return true;
}

async function checkLinkedInConnection(
  ctx: ActionCtx,
  monitor: RecoveryMonitor
): Promise<boolean> {
  const relationship = await ctx.runAction(
    internal.linkedin.getLinkedInProspectRelationshipInternal,
    {
      userId: monitor.userId,
      prospectId: monitor.prospectId,
    }
  );
  if (relationship.status !== "connected") return false;

  await ctx.runMutation(internalRecovery.onLinkedInConnectionAccepted, {
    prospectId: monitor.prospectId,
  });
  return true;
}

export const checkRecoveryMonitor = internalAction({
  args: { monitorId: v.id("outreachRecoveryMonitors") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const monitor = (await ctx.runQuery(
      internalRecovery.getRecoveryMonitorInternal,
      { monitorId: args.monitorId }
    )) as RecoveryMonitor | null;
    if (!monitor || monitor.status !== "active") return null;

    try {
      const detected =
        monitor.kind === "twitter_manual_reply"
          ? monitor.stage === "detecting_outbound"
            ? await checkTwitterManualOutbound(ctx, monitor)
            : await checkTwitterProspectResponse(ctx, monitor)
          : monitor.kind === "linkedin_connection_then_dm"
            ? await checkLinkedInConnection(ctx, monitor)
            : await checkLinkedInCommentResponse(ctx, monitor);
      if (!detected) {
        await ctx.runMutation(internalRecovery.recordRecoveryCheck, {
          monitorId: monitor._id,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown reconciliation error";
      console.warn("[OutreachRecovery] Recovery monitor check failed", {
        monitorId: String(monitor._id),
        kind: monitor.kind,
        message,
      });
      await ctx.runMutation(internalRecovery.recordRecoveryCheck, {
        monitorId: monitor._id,
        errorMessage: message,
      });
    }
    return null;
  },
});
