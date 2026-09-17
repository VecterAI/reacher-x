export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export const homepageFaqItems: FaqItem[] = [
  {
    id: "what-is-reacherx",
    question: "What is ReacherX?",
    answer:
      "ReacherX is an open-source △ Agent that finds relevant people on X/Twitter and LinkedIn, researches their background, and helps you plan outreach.",
  },
  {
    id: "why-agent",
    question: "Do I need sales experience to use it?",
    answer:
      "Because it does more than search. It keeps running in the background, checks matches, reads recent posts, drafts messages, and improves from your feedback.",
  },
  {
    id: "how-does-it-know",
    question: "How does ReacherX know who to reach?",
    answer:
      "You tell Agent who you want to reach in plain English, or give it a URL. It turns that into search strategies, watches for real signals, and checks how closely people match what you described.",
  },
  {
    id: "platform-support",
    question: "Which platforms does ReacherX support?",
    answer:
      "Today, ReacherX supports X/Twitter and LinkedIn. More platforms are on the roadmap.",
  },
  {
    id: "account-safety",
    question: "How should I use my connected accounts?",
    answer:
      "Use relevant, personal outreach and follow each platform's rules. Review messages and sending activity, and avoid bulk or repetitive outreach. ReacherX cannot guarantee that a platform will never restrict an account.",
  },
  {
    id: "runs-24-7",
    question: "Does it keep working when I close the browser?",
    answer:
      "Yes. Agent keeps searching for people and checking matches in the background.",
  },
  {
    id: "approval",
    question: "Does ReacherX send anything without approval?",
    answer:
      "Sending approvals are on by default. If you turn them off in workspace settings, supported replies and DMs can send without another approval. You can review the settings and pause △ Agent at any time.",
  },
  {
    id: "different-from-other-tools",
    question: "How is ReacherX different from other outreach tools?",
    answer:
      "You work with △ Agent in a conversation. It uses profiles and posts to research people, prepares outreach plans, and uses your saved feedback to guide later work. You can inspect the research and edit the plans.",
  },
  {
    id: "open-source",
    question: "Is ReacherX open source?",
    answer:
      "Yes. The code is public, and you can inspect it, self-host it, and contribute to it.",
  },
];

export const pricingFaqItems: FaqItem[] = [
  {
    id: "hobby-plan",
    question: "Is there a free plan?",
    answer:
      "No. Hobby is the entry plan during launch and includes the original starter limits. A Free plan may be added in the future.",
  },
  {
    id: "credit-card",
    question: "Do I need a credit card to get started?",
    answer: "Yes. A paid plan is required to start △ Agent during launch.",
  },
  {
    id: "plan-limits",
    question: "What do plan limits actually control?",
    answer:
      "Plans mainly control how many people who match your criteria ReacherX can surface each month, plus workspace limits and a few extra features.",
  },
  {
    id: "hit-limit",
    question: "What happens if I hit my plan limit?",
    answer:
      "△ Agent pauses discovery for that workspace until your limit resets or you upgrade.",
  },
  {
    id: "other-pause-reasons",
    question: "Can △ Agent pause for other reasons?",
    answer:
      "Yes. It can also pause if the workspace becomes inactive, and you can resume it when you are ready.",
  },
];
