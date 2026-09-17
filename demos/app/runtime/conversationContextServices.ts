import { api } from "@/convex/_generated/api";
import type { LocalClient } from "./LocalClient";
import type { createAppFixtures } from "./appFixtures";
import { normalizeProspectProfileData } from "@/features/prospects/lib/normalizeProspectProfileData";
import { createConversation } from "./conversationFixtures";
import type { XDmPanelContext } from "@/shared/lib/twitter/dm";
import { isUseCaseWalkthrough } from "@/features/blog/lib/useCaseWalkthroughCopy";
import { parseIsoToTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { recordDemoMessage } from "./lifecycleHelpers";

export function registerConversationContextServices(
  client: LocalClient,
  state: ReturnType<typeof createAppFixtures>
) {
  const conversationFor = (prospectId: string) => {
    const prospect = state.prospects.find((item) => item._id === prospectId);
    if (!prospect?.displayName) throw new Error("Prospect not found");
    const conversation = createConversation();
    const conversationId = `demo-conversation-${prospectId}`;
    const profile = normalizeProspectProfileData(prospect);
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
    return {
      ...conversation,
      conversationId,
      messages:
        isUseCaseWalkthrough(state.scenario) ||
        ![
          "send-voice-notes",
          "manage-dm-conversations",
          "write-with-autocomplete",
          "outreach-with-images-and-video",
        ].includes(state.scenario)
          ? (state.lifecycle.replies.get(prospectId) ?? [])
          : [
              {
                id: `${prospectId}-introduction`,
                conversationId,
                direction: "sent" as const,
                text: `Hi ${prospect.displayName.split(" ")[0]}, your work caught my attention. ${invitation}`,
                createdAt: new Date(
                  prospect._creationTime + 60000
                ).toISOString(),
              },
              {
                id: `${prospectId}-reply`,
                conversationId,
                direction: "received" as const,
                text:
                  state.scenario === "send-voice-notes"
                    ? "Does my client need an account to leave feedback? A quick voice note is fine."
                    : state.scenario === "write-with-autocomplete"
                      ? "Would your feedback app work for a two-person design studio? Our clients send comments in email and chat, and we lose track of them."
                      : reply,
                createdAt: new Date(
                  prospect._creationTime + 120000
                ).toISOString(),
              },
            ],
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
  if (
    [
      "send-voice-notes",
      "manage-dm-conversations",
      "write-with-autocomplete",
      "outreach-with-images-and-video",
    ].includes(state.scenario)
  ) {
    for (const person of state.prospects.filter(
      (person) =>
        person.workspaceId === state.selectedWorkspaceId &&
        person.status === "new"
    )) {
      for (const message of conversationFor(person._id).messages)
        recordDemoMessage(
          state.lifecycle,
          person,
          message,
          person._creationTime + (message.direction === "sent" ? 60000 : 120000)
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
    const messages = [
      {
        id: `${person._id}-earlier-introduction`,
        conversationId: `demo-conversation-${person._id}`,
        direction: "sent" as const,
        text: `Hi ${person.displayName?.split(" ")[0]}, your professional experience looks relevant to our workspace. Would you like the details?`,
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
