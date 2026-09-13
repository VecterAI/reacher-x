import { api } from "@/convex/_generated/api";
import type { LocalClient } from "./LocalClient";
import type { createAppFixtures } from "./appFixtures";
import { normalizeProspectProfileData } from "@/features/prospects/lib/normalizeProspectProfileData";
import { createConversation } from "./conversationFixtures";
import type { XDmPanelContext } from "@/shared/lib/twitter/dm";
import { isAudienceDemoId } from "@/features/blog/lib/blogDemoCatalog";

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
        ? "We're testing an app that helps small product teams collect user feedback. Would you like to try it and share what you think?"
        : `We're a small product team looking for a ${prospect.title?.toLowerCase() ?? "new teammate"}. Would you be open to a conversation about the role?`;
    const reply =
      workspace?.useCaseKey === "customer_prospecting"
        ? "Thanks for reaching out. We're looking for something simpler for feedback. I can try it on Thursday."
        : "Thanks for reaching out. This sounds like a good fit—I'm available for a conversation on Thursday.";
    return {
      ...conversation,
      conversationId,
      messages: isAudienceDemoId(state.scenario)
        ? []
        : [
            {
              id: `${prospectId}-introduction`,
              conversationId,
              direction: "sent" as const,
              text: `Hi ${prospect.displayName.split(" ")[0]}, your work caught my attention. ${invitation}`,
              createdAt: "2026-09-11T08:55:00.000Z",
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
              createdAt: "2026-09-11T09:00:00.000Z",
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
  client.register(
    api.linkedin.getLinkedInConversationPanelContext,
    ({ prospectId }) => conversationFor(prospectId)
  );
  const twitterConversationFor = (prospectId: string): XDmPanelContext => {
    const conversation = conversationFor(prospectId);
    return {
      platform: "twitter",
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
  client.register(api.xChatRealtimeEvents.getForProspect, () => null);
  client.register(api.x.getXChatDecryptBundle, () => ({
    availability: "unavailable" as const,
    reason: "viewer_not_configured" as const,
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
