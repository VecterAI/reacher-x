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
      "ReacherX is an open-source Agent that helps you reach the right people on X/Twitter and LinkedIn.",
  },
  {
    id: "why-agent",
    question: "Why do you call ReacherX an Agent?",
    answer:
      "Because it does more than search. It keeps running in the background, qualifies people, reads context, drafts outreach, and improves from your feedback.",
  },
  {
    id: "how-does-it-know",
    question: "How does ReacherX know who to reach?",
    answer:
      "You tell Agent who you want to reach in plain English, or give it a URL. It turns that into search strategies, watches for real signals, and qualifies people based on fit and context.",
  },
  {
    id: "platform-support",
    question: "Which platforms does ReacherX support?",
    answer:
      "Today, ReacherX supports X/Twitter and LinkedIn. More platforms are on the roadmap.",
  },
  {
    id: "account-safety",
    question: "Will connecting my social accounts get me banned?",
    answer:
      "No. Connecting your accounts alone will not get them banned. ReacherX is designed for personalized, human-paced outreach, but if you use it to spam people, blast generic messages, or force unnatural volume, your accounts can still be at risk.",
  },
  {
    id: "runs-24-7",
    question: "Does ReacherX really run 24/7?",
    answer:
      "Yes. Agent keeps searching, qualifying, and surfacing new people in the background.",
  },
  {
    id: "approval",
    question: "Does ReacherX send anything without approval?",
    answer:
      "No. Replies, DMs, invites, and other actions stay under your control. Nothing sends without your approval.",
  },
  {
    id: "different-from-other-tools",
    question: "How is ReacherX different from other outreach tools?",
    answer:
      "Most tools help you build lists or automate sequences. ReacherX is an open-source Agent that works from live social context, learns over time, and helps you reach the right people with more relevance.",
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
    answer: "Yes. A paid plan is required to start Agent during launch.",
  },
  {
    id: "plan-limits",
    question: "What do plan limits actually control?",
    answer:
      "Plans mainly control how many qualified people ReacherX can surface each month, plus workspace limits and a few extra features.",
  },
  {
    id: "hit-limit",
    question: "What happens if I hit my plan limit?",
    answer:
      "Agent pauses discovery for that workspace until your limit resets or you upgrade.",
  },
  {
    id: "other-pause-reasons",
    question: "Can Agent pause for other reasons?",
    answer:
      "Yes. It can also pause if the workspace becomes inactive, and you can resume it when you are ready.",
  },
];
