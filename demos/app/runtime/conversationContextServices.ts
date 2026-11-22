import { api } from "@/convex/_generated/api";
import type { LocalClient } from "./LocalClient";
import {
  ARTICLE_STORY_STATUS_OVERRIDES,
  type createAppFixtures,
} from "./appFixtures";
import { normalizeProspectProfileData } from "@/features/prospects/lib/normalizeProspectProfileData";
import { createConversation } from "./conversationFixtures";
import type { XDmPanelContext } from "@/shared/lib/twitter/dm";
import type { Doc } from "@/convex/_generated/dataModel";
import { parseIsoToTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { recordDemoMessage } from "./lifecycleHelpers";

const CONVERSATION_SCENARIOS = [
  "send-voice-notes",
  "manage-dm-conversations",
  "write-with-autocomplete",
  "outreach-with-images-and-video",
] as const;

export function registerConversationContextServices(
  client: LocalClient,
  state: ReturnType<typeof createAppFixtures>
) {
  const conversationFor = (prospectId: string) => {
    const prospect = state.prospects.find((item) => item._id === prospectId);
    if (!prospect?.displayName) throw new Error("Prospect not found");
    const conversation = createConversation();
    const profile = normalizeProspectProfileData(prospect);
    return {
      ...conversation,
      conversationId: `demo-conversation-${prospectId}`,
      messages: state.lifecycle.replies.get(prospectId) ?? [],
      prospect: {
        ...conversation.prospect,
        prospectId,
        displayName: prospect.displayName,
        title: prospect.title,
        profileUrl: profile?.profileUrl,
        avatarUrl: profile?.avatarUrl,
      },
    };
  };
  /** The introduction and reply the article's walkthrough resumes mid-conversation. */
  const scriptedMessages = (prospect: Doc<"prospects">) => {
    const conversationId = `demo-conversation-${prospect._id}`;
    const workspace = state.workspaces.find(
      (item) => item._id === prospect.workspaceId
    );
    const invitation =
      workspace?.useCaseKey === "customer_prospecting"
        ? "I am building a client-feedback app for freelance designers. You mentioned losing approvals across email and chat. Would you like to see how a client can leave feedback in one place?"
        : `We're a small product team looking for a ${prospect.title?.toLowerCase() ?? "new teammate"}. Would you be open to a conversation about the role?`;
    const reply =
      workspace?.useCaseKey === "customer_prospecting"
        ? "Thanks for reaching out. Client approvals are scattered across email and chat. Does my client need an account to leave feedback?"
        : "Thanks for reaching out. This sounds like a good fit—I'm available for a conversation on Thursday.";
    return [
      {
        id: `${prospect._id}-introduction`,
        conversationId,
        direction: "sent" as const,
        text: `Hi ${prospect.displayName?.split(" ")[0] ?? "there"}, your work caught my attention. ${invitation}`,
        createdAt: new Date(prospect._creationTime + 60000).toISOString(),
      },
      {
        id: `${prospect._id}-reply`,
        conversationId,
        direction: "received" as const,
        text:
          state.scenario === "send-voice-notes"
            ? "Does my client need an account to leave feedback? A quick voice note is fine."
            : state.scenario === "write-with-autocomplete"
              ? "Would your feedback app work for a two-person design studio? Our clients send comments in email and chat, and we lose track of them."
              : reply,
        createdAt: new Date(prospect._creationTime + 120000).toISOString(),
      },
    ];
  };
  if ((CONVERSATION_SCENARIOS as readonly string[]).includes(state.scenario)) {
    const overrides = ARTICLE_STORY_STATUS_OVERRIDES[state.scenario] ?? {};
    for (const person of state.prospects.filter(
      (person) =>
        person.workspaceId === state.selectedWorkspaceId &&
        overrides[person._id] !== undefined
    )) {
      const messages = scriptedMessages(person);
      state.lifecycle.replies.set(person._id, messages);
      messages.forEach((message, index) =>
        recordDemoMessage(
          state.lifecycle,
          person,
          message,
          person._creationTime + (index + 1) * 60000
        )
      );
    }
  }
  for (const person of state.prospects.filter(
    (person) =>
      (person.status === "converted" ||
        person.status === "contacted" ||
        person.status === "in_progress" ||
        (person.status === "archived" &&
          person.qualificationStatus === "qualified")) &&
      !state.lifecycle.interactions.some(
        (entry) => entry.threadId === `demo-conversation-${person._id}`
      )
  )) {
    const workspace = state.workspaces.find(
      (item) => item._id === person.workspaceId
    );
    const customerOutreach = workspace?.useCaseKey === "customer_prospecting";
    const messages = [
      {
        id: `${person._id}-earlier-introduction`,
        conversationId: `demo-conversation-${person._id}`,
        direction: "sent" as const,
        text: customerOutreach
          ? `Hi ${person.displayName?.split(" ")[0]}, I saw your post about client feedback spread across email and chat. Would you like to see a way to keep it in one place?`
          : `Hi ${person.displayName?.split(" ")[0]}, your professional experience looks relevant to our workspace. Would you like the details?`,
        createdAt: new Date(person._creationTime + 60000).toISOString(),
      },
      ...(person.status === "contacted"
        ? []
        : [
            {
              id: `${person._id}-earlier-reply`,
              conversationId: `demo-conversation-${person._id}`,
              direction: "received" as const,
              text:
                person.status === "converted" || person.status === "archived"
                  ? (person.briefIntro ?? "Thank you for the details.")
                  : customerOutreach
                    ? "Thanks for reaching out. Could a client leave feedback without creating an account? That is the part I keep checking."
                    : "Thanks for the introduction. Please send the role details so I can review the responsibilities and timing.",
              createdAt: new Date(person._creationTime + 120000).toISOString(),
            },
          ]),
    ];
    state.lifecycle.replies.set(person._id, messages);
    messages.forEach((message, index) =>
      recordDemoMessage(
        state.lifecycle,
        person,
        message,
        person._creationTime + (index + 1) * 60000
      )
    );
  }
  client.register(
    api.linkedin.getLinkedInConversationPanelContext,
    ({ prospectId }) => conversationFor(prospectId)
  );
  const twitterConversationFor = (prospectId: string): XDmPanelContext => {
    const conversation = conversationFor(prospectId);
    return {
      platform: "twitter",
      viewerUserId: "demo_viewer",
      participantUserId: `demo_x_${prospectId}`,
      prospect: conversation.prospect,
      conversationId: conversation.conversationId,
      messages: conversation.messages,
      history: conversation.history,
      eligibility: {
        enabled: true,
        reasonCode: "eligible",
        reasonLabel: "Connected",
      },
    };
  };
  client.register(api.x.getDmPanelContext, ({ prospectId }) =>
    twitterConversationFor(prospectId)
  );
  client.register(api.x.getProspectDmState, ({ prospectId }) => {
    const conversation = twitterConversationFor(prospectId);
    return {
      prospect: conversation.prospect,
      participantUserId: conversation.participantUserId,
      conversationId: conversation.conversationId,
      eligibility: conversation.eligibility,
      messageCount: conversation.messages.length,
      latestMessageAt: conversation.messages.at(-1)?.createdAt,
    };
  });
  client.register(
    api.platformConversations.getTwitterConversationRevision,
    () => null
  );
  const revision = ({ prospectId }: { prospectId: string }) => {
    const latest = state.lifecycle.interactions
      .filter((entry) => entry.threadId === `demo-conversation-${prospectId}`)
      .at(-1);
    return latest
      ? {
          updatedAt: latest.repliedAt,
          latestMessageId: latest.replyPostId,
          latestMessageAt: latest.repliedAt,
        }
      : null;
  };
  client.register(
    api.platformConversations.getLinkedInConversationRevision,
    revision
  );
  client.register(
    api.platformConversations.getTwitterConversationRevision,
    revision
  );
  client.register(api.xChatRealtimeEvents.getForProspect, () => null);
  const bundleFor = (prospectId: string) => {
    const conversation = twitterConversationFor(prospectId);
    return {
      availability: "available" as const,
      viewerUserId: "demo_viewer",
      participantUserId: `demo_x_${prospectId}`,
      conversationId: conversation.conversationId!,
      signingKeyVersion: "demo",
      juiceboxConfig: "{}",
      signingKeys: [],
      events: conversation.messages.map((message) => ({
        id: message.id,
        conversationId: conversation.conversationId!,
        senderId:
          message.direction === "sent" ? "demo_viewer" : `demo_x_${prospectId}`,
        createdAtMs:
          parseIsoToTimestamp(message.createdAt ?? "") ?? state.startedAt,
        encodedEvent: message.text ?? "",
      })),
      eventPagesFetched: 1,
      hasMore: false,
    };
  };
  client.register(api.x.getXChatDecryptBundle, ({ prospectId }) =>
    bundleFor(prospectId)
  );
  client.register(api.x.getXChatEventPage, ({ prospectId }) =>
    bundleFor(prospectId)
  );
  client.register(api.x.markXChatConversationRead, () => ({
    success: true as const,
  }));
  client.register(
    api.conversationTypingPresence.getTwitterForProspect,
    () => null
  );
  client.register(
    api.linkedin.getProspectLinkedInMessageState,
    ({ prospectId }) => {
      const conversation = conversationFor(prospectId);
      return {
        prospect: conversation.prospect,
        conversationId: conversation.conversationId,
        eligibility: conversation.eligibility,
        messageCount: conversation.messages.length,
        latestMessageAt: conversation.messages.at(-1)?.createdAt,
      };
    }
  );
}
