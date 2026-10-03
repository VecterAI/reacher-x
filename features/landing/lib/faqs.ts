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
      "ReacherX is an open-source △ Agent that combines real-time prospecting, a light CRM, and outreach in one product. It finds relevant people on X/Twitter and LinkedIn, researches their background, and helps you plan outreach.",
  },
  {
    id: "why-not-diy",
    question: "Why not just use X/Twitter search and ChatGPT for free?",
    answer:
      "For a one-off search, you can. ReacherX is for the ongoing part: it keeps watching X/Twitter and LinkedIn around the clock, checks every person it finds against your criteria, and prepares a researched outreach plan for each match. The screening work you'd redo every week happens on its own, and you only see the people who fit.",
  },
  {
    id: "not-a-database",
    question: "Is ReacherX a contact database like Apollo?",
    answer:
      "No. Contact databases sell records pulled from a static list, and those lists go stale. ReacherX has no contact database: it searches X/Twitter and LinkedIn in real time, checks every person against your criteria, and shows the research behind each match. You reach people as they are today, not as they were last year.",
  },
  {
    id: "hosted-vs-self-host",
    question: "What does a hosted plan buy me over self-hosting?",
    answer:
      "The code is open source under AGPL-3.0, so self-hosting is free. The social data is what costs money: X/Twitter and third-party APIs bill per use, and the pipeline needs upkeep. A hosted plan puts both on us.",
  },
  {
    id: "refund",
    question: "Can I get a refund?",
    answer:
      "Yes. Treat it as a 30-day trial. If ReacherX isn't for you, email support within 30 days of your payment and you get a full refund.",
  },
  {
    id: "why-agent",
    question: "Do I need sales experience to use it?",
    answer:
      "No. ReacherX is built for founders, recruiters, creators, and community builders — anyone who needs the right people. You describe who you are looking for in plain words. There are no tables or sales jargon.",
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
      "Connected accounts run within safe, human-like limits: actions are paced and capped, and every message waits for your approval by default. Use relevant, personal outreach, follow each platform's rules, and review what sends. ReacherX cannot guarantee that a platform will never restrict an account.",
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
      "Nothing sends without your approval by default. If you turn approvals off in workspace settings, supported replies and DMs can send on their own. You can review the settings and pause △ Agent at any time.",
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
      "Yes. The code is public under AGPL-3.0, and ReacherX is part of the Convex Open Source program. You can inspect it, self-host it, modify it, and contribute to it. If you modify ReacherX and offer it to users over a network, the license asks you to share those changes under the same terms.",
  },
];

export const pricingFaqItems: FaqItem[] = [
  {
    id: "free-plan",
    question: "Is there a free plan?",
    answer:
      "No. A paid plan is required to run △ Agent. If you're technical, you can self-host the open-source code under AGPL-3.0 instead, but you'd take on the social-data API costs and maintenance yourself.",
  },
  {
    id: "credit-card",
    question: "Do I need a credit card to get started?",
    answer:
      "Yes. A paid plan is required to start △ Agent during launch. Every plan comes with a 30-day money-back guarantee.",
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
