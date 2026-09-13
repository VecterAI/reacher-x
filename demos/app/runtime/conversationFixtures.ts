import type { LinkedInConversationPanelContext } from "@/shared/lib/linkedin/conversation";

export function createConversation(): LinkedInConversationPanelContext {
  return {
    platform: "linkedin",
    conversationId: "experiment-conversation",
    prospect: {
      prospectId: "experiment-prospect",
      displayName: "Maya Chen",
      title: "Product designer",
      profileUrl: "https://www.linkedin.com/in/fictional-maya-chen/",
    },
    eligibility: {
      enabled: true,
      reasonCode: "eligible",
      reasonLabel: "Connected",
    },
    history: { hasMore: false },
    messages: [
      {
        id: "experiment-message-1",
        conversationId: "experiment-conversation",
        text: "Thanks for reaching out. Could you tell me more about the design role?",
        direction: "received",
        createdAt: "2026-09-11T09:00:00.000Z",
      },
    ],
  };
}
