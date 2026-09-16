import type { WorkspaceUseCaseKey } from "@/shared/lib/workspaceUseCases";

export type SetupExampleDescription = {
  id: string;
  title: string;
  description: string;
};

const DEFAULT_EXAMPLES: SetupExampleDescription[] = [
  {
    id: "product",
    title: "Product",
    description:
      "We built a tool for software founders who need to find customers and start conversations without hiring a sales team. Look for founders posting about finding their first customers or spending too much time searching.",
  },
  {
    id: "service",
    title: "Service",
    description:
      "I run a paid ads agency for Shopify and DTC brands doing $50k-$500k/month. Ideal customers care about profitable growth, attribution, creative testing, and scaling without burning budget.",
  },
  {
    id: "game",
    title: "Game",
    description:
      "I made a mobile puzzle game for casual gamers who enjoy short sessions, minimalist design, and relaxing gameplay. Look for people who talk about indie games, puzzle apps, or cozy mobile games.",
  },
];

const BY_USE_CASE: Partial<
  Record<WorkspaceUseCaseKey, SetupExampleDescription[]>
> = {
  customer_prospecting: [
    {
      id: "b2b",
      title: "B2B offer",
      description:
        "We sell an AI assistant for software companies making $10k–$200k a year. Look for people who want more conversations with potential customers and do not want to hire a larger sales team.",
    },
    {
      id: "local",
      title: "Local service",
      description:
        "I'm a fractional CFO for US ecommerce brands doing $1M-$10M/year. Look for founders or operators who mention cash flow issues, messy books, inventory planning, margins, or preparing for fundraising.",
    },
    {
      id: "consumer",
      title: "Consumer app",
      description:
        "We built a budgeting app for couples who share finances. Look for people talking about joint accounts, splitting expenses, tracking subscriptions, planning savings goals, or needing clearer monthly budgets.",
    },
  ],
  recruiting: [
    {
      id: "eng",
      title: "Engineering hire",
      description:
        "We're hiring a senior backend engineer with TypeScript and Convex experience. Strong candidates have shipped production systems, care about reliability, write clean APIs, and enjoy early-stage product work.",
    },
    {
      id: "open_source",
      title: "Open source",
      description:
        "Looking for contributors and maintainers for our devtools open-source project. Ideal people already contribute to developer tools, write docs or tests, review PRs, and care about DX.",
    },
    {
      id: "gtm",
      title: "GTM",
      description:
        "Hiring an AE for SMB SaaS. Ideal candidates have 2+ years closing $5k-$50k deals, understand PLG motions, can run discovery well, and have sold to founders or small GTM teams.",
    },
  ],
  partnership_outreach: [
    {
      id: "integration",
      title: "Integration partner",
      description:
        "We want API partners in the CRM, sales automation, or data enrichment space. Ideal partners serve SMB or mid-market GTM teams, publish integration docs, and are open to co-marketing.",
    },
    {
      id: "creator",
      title: "Creator collab",
      description:
        "We run a design tool and want collabs with YouTube educators who teach UI, UX, product design, or Figma workflows to professionals. They should have an engaged audience and sponsor-friendly content.",
    },
    {
      id: "channel",
      title: "Channel",
      description:
        "Seeking agencies who implement analytics, attribution, conversion tracking, or marketing ops for Shopify and DTC brands. They should advise growth teams and be able to refer our attribution product.",
    },
  ],
  investor_outreach: [
    {
      id: "seed",
      title: "Seed raise",
      description:
        "We are a pre-seed B2B infrastructure startup at $2M ARR with 120% NRR, raising $4M to expand GTM in North America and Europe. Look for investors active in infra, devtools, and seed rounds.",
    },
    {
      id: "climate",
      title: "Investment focus",
      description:
        "Climate hardware plus software for grid operators. We have pilots with two utilities and patents filed. Ideal investors back climate infrastructure, grid modernization, hardware, or applied energy software.",
    },
    {
      id: "metrics",
      title: "Traction",
      description:
        "Consumer app with 80k MAU, 6% month-over-month growth, CAC payback under 6 months, and expanding monetization. Look for investors who back consumer subscription or prosumer apps.",
    },
  ],
  user_research_recruitment: [
    {
      id: "pm",
      title: "Product",
      description:
        "Interviewing US-based product managers who evaluated or bought analytics tools in the last year. Good participants can discuss vendor selection, reporting workflows, and product usage metrics.",
    },
    {
      id: "security",
      title: "Security",
      description:
        "Looking for IT admins at 200-2000 person companies who rolled out SSO, SCIM, or access management in the past 18 months. They should understand procurement, rollout, and user adoption pain.",
    },
    {
      id: "parents",
      title: "Consumer",
      description:
        "Parents of kids ages 6-12 who use educational tablets or learning apps at least three times per week. We want 45-minute remote sessions about screen time, trust, and learning outcomes.",
    },
  ],
  creator_outreach: [
    {
      id: "youtube",
      title: "YouTube",
      description:
        "Tech YouTubers with 50k-500k subscribers who review developer tools, AI coding products, SaaS workflows, or productivity software. Ideal creators have done thoughtful sponsored integrations.",
    },
    {
      id: "newsletter",
      title: "Newsletter",
      description:
        "Newsletter writers with 10k+ engaged readers who cover SaaS founders, growth, AI tools, or startup operations. They should be open to affiliate campaigns, deep dives, or product walkthroughs.",
    },
    {
      id: "shortform",
      title: "Short-form",
      description:
        "TikTok or Instagram creators in personal finance with a mostly US audience. Ideal creators post weekly about budgeting, investing, side hustles, or saving money and have strong comment engagement.",
    },
  ],
  community_growth: [
    {
      id: "discord",
      title: "Discord",
      description:
        "Builders and indie hackers who hang out in public Discords, share side projects, and enjoy shipping in groups. Invite people who would join our weekly build club and participate actively.",
    },
    {
      id: "niche",
      title: "Niche",
      description:
        "Design engineers who use Figma and code, share UI experiments, and care about craft. We are looking for potential moderators, power users, and early members for our design engineering community.",
    },
    {
      id: "events",
      title: "Events",
      description:
        "People who attend local product, startup, or operator meetups in London. Ideal members are curious, community-minded, and likely to want early access to our first in-person cohort.",
    },
  ],
  podcast_speaker_sourcing: [
    {
      id: "expert",
      title: "Expert",
      description:
        "Guests who led platform engineering at scale, ideally 1M+ requests per second, and can speak clearly about architecture tradeoffs, reliability, incidents, team structure, and lessons learned.",
    },
    {
      id: "founder",
      title: "Founder story",
      description:
        "Bootstrapped founders who crossed $1M ARR without venture funding. Great guests are willing to share real numbers, hard decisions, growth lessons, and honest founder stories.",
    },
    {
      id: "research",
      title: "Research",
      description:
        "Academics or researchers in HCI who study developer productivity, AI coding tools, or software teams. They should be able to explain study design and practical takeaways on-air.",
    },
  ],
};

export function getSetupExampleDescriptions(
  useCaseKey: WorkspaceUseCaseKey
): SetupExampleDescription[] {
  return BY_USE_CASE[useCaseKey] ?? DEFAULT_EXAMPLES;
}
