import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";

export type DemoActivity = FunctionReturnType<
  typeof api.outreach.getActivityLog
>["page"][number];
export type DemoInteraction = FunctionReturnType<
  typeof api.interactions.getProspectInteractionsPage
>["page"][number] & { prospectId: string };
export type DemoMessage = NonNullable<
  FunctionReturnType<typeof api.linkedin.getLinkedInConversationPanelContext>
>["messages"][number];
export type DemoLifecycle = {
  activity: DemoActivity[];
  interactions: DemoInteraction[];
  replies: Map<string, DemoMessage[]>;
};

export function recordDemoActivity(
  lifecycle: DemoLifecycle,
  person: Doc<"prospects">,
  type: Doc<"prospectActivityLog">["type"],
  title: string,
  description: string,
  timestamp = getCurrentUTCTimestamp()
) {
  lifecycle.activity.push({
    _id: `demo_activity_${lifecycle.activity.length + 1}` as Id<"prospectActivityLog">,
    _creationTime: timestamp,
    prospectId: person._id,
    workspaceId: person.workspaceId,
    type,
    title,
    description,
    plan: null,
  });
}

export function recordDemoMessage(
  lifecycle: DemoLifecycle,
  person: Doc<"prospects">,
  message: DemoMessage,
  timestamp: number
) {
  if (lifecycle.interactions.some((entry) => entry.replyPostId === message.id))
    return;
  const received = message.direction === "received";
  lifecycle.interactions.push({
    id: `demo_interaction_${lifecycle.interactions.length + 1}` as Id<"prospectInteractions">,
    prospectId: person._id,
    platform: person.platform,
    interactionType: "dm",
    threadId: message.conversationId,
    sourcePostId: message.id,
    replyPostId: message.id,
    repliedAt: timestamp,
    originalPost: null,
    sourcePostData: null,
    sourcePostSummary: null,
    replyPostSummary: null,
    replyText: message.text,
    sourceUrl: undefined,
    sourcePostRef: undefined,
    replyPostRef: undefined,
    lastReplyPreview: message.text,
    discoveredVia: "live_reconcile",
    discoveredAt: timestamp,
    lastSeenAt: timestamp,
    lastHydratedAt: timestamp,
    lastHydrationErrorMessage: undefined,
    origin: "manual_reacherx",
    status: "active",
    direction: received ? "incoming" : "outgoing",
    participants: [
      { name: person.displayName ?? "", username: "", avatarUrl: undefined },
    ],
  });
  recordDemoActivity(
    lifecycle,
    person,
    received ? "responded" : "contacted",
    received ? "Reply received" : "Message sent",
    message.text ?? "Voice note sent",
    timestamp
  );
  const status = received ? "in_progress" : "contacted";
  person.stageTimestamps = {
    ...person.stageTimestamps,
    [status]: person.stageTimestamps?.[status] ?? timestamp,
  };
  if (person.status === "new" || (received && person.status === "contacted")) {
    person.status = status;
    person.pipelineStage = status;
    person.updatedAt = timestamp;
  }
}

/** Public comments stay separate from private message history. */
export function recordDemoComment(
  lifecycle: DemoLifecycle,
  person: Doc<"prospects">,
  post: Record<string, unknown>,
  postId: string,
  text: string,
  replyId: string,
  timestamp = getCurrentUTCTimestamp()
) {
  if (lifecycle.interactions.some((entry) => entry.replyPostId === replyId))
    return;
  lifecycle.interactions.push({
    id: `demo_public_${replyId}` as Id<"prospectInteractions">,
    prospectId: person._id,
    platform: person.platform,
    interactionType: "comment_posted",
    threadId: postId,
    sourcePostId: postId,
    replyPostId: replyId,
    repliedAt: timestamp,
    originalPost: null,
    sourcePostData: post,
    sourcePostSummary: null,
    replyPostSummary: null,
    sourceUrl: undefined,
    sourcePostRef: undefined,
    replyPostRef: undefined,
    lastHydrationErrorMessage: undefined,
    replyText: text,
    lastReplyPreview: text,
    origin: "manual_reacherx",
    status: "active",
    direction: "outgoing",
    discoveredVia: "live_reconcile",
    discoveredAt: timestamp,
    lastSeenAt: timestamp,
    lastHydratedAt: timestamp,
    participants: [
      {
        name: person.displayName ?? "",
        avatarUrl: undefined,
        username:
          person.socialProfiles?.linkedin?.username ??
          person.socialProfiles?.twitter?.username ??
          "",
      },
    ],
  });
  recordDemoActivity(
    lifecycle,
    person,
    "posted",
    "Comment posted",
    text,
    timestamp
  );
}
