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
      "I'm building Reacher, an AI outreach tool for B2B SaaS founders who struggle to find and reach their ideal customers.",
  },
  {
    id: "service",
    title: "Service",
    description:
      "I run a paid ads agency for e-commerce brands doing $50k-$500k/month who want to scale without burning budget.",
  },
  {
    id: "game",
    title: "Game",
    description:
      "I made a mobile puzzle game for casual gamers who enjoy short sessions and minimalist design.",
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
        "We sell an AI SDR for outbound teams at mid-market SaaS ($10–200 ARR) who need more qualified meetings without hiring headcount.",
    },
    {
      id: "local",
      title: "Local service",
      description:
        "I'm a fractional CFO for US ecommerce brands doing $1–10M/year who want clean books and better cash flow.",
    },
    {
      id: "consumer",
      title: "Consumer app",
      description:
        "A budgeting app for couples who share finances and want automatic categorization across banks.",
    },
  ],
  recruiting: [
    {
      id: "eng",
      title: "Engineering hire",
      description:
        "We're hiring a senior backend engineer (TypeScript/Convex) who has shipped production systems and cares about reliability.",
    },
    {
      id: "open_source",
      title: "Open source",
      description:
        "Looking for contributors and maintainers for our devtools OSS project—people who write docs, tests, and review PRs.",
    },
    {
      id: "gtm",
      title: "GTM",
      description:
        "Hiring an AE for SMB SaaS: 2+ years closing $5–50k deals, comfortable with PLG and product-led sales motions.",
    },
  ],
  partnership_outreach: [
    {
      id: "integration",
      title: "Integration partner",
      description:
        "We want API partners in the CRM space who serve SMB teams and co-market integrations with us.",
    },
    {
      id: "creator",
      title: "Creator collab",
      description:
        "We run a design tool and want collabs with YouTube educators who teach UI/UX to professionals.",
    },
    {
      id: "channel",
      title: "Channel",
      description:
        "Seeking agencies who implement analytics for ecommerce brands and can refer our attribution product.",
    },
  ],
  investor_outreach: [
    {
      id: "seed",
      title: "Seed raise",
      description:
        "Pre-seed B2B infra: $2M ARR, 120% NRR, raising $4M to expand GTM in NA and EU.",
    },
    {
      id: "climate",
      title: "Thesis fit",
      description:
        "Climate hardware + software for grid operators; pilots with two utilities, patents filed.",
    },
    {
      id: "metrics",
      title: "Traction",
      description:
        "Consumer app: 80k MAU, 6% MoM growth, CAC payback under 6 months, expanding monetization.",
    },
  ],
  user_research_recruitment: [
    {
      id: "pm",
      title: "Product",
      description:
        "Interviewing US-based PMs who bought analytics tools in the last year for 30-minute paid research.",
    },
    {
      id: "security",
      title: "Security",
      description:
        "Looking for IT admins at 200–2000 person companies who rolled out SSO in the past 18 months.",
    },
    {
      id: "parents",
      title: "Consumer",
      description:
        "Parents of kids 6–12 who use educational tablets at least 3x/week—45 min remote sessions.",
    },
  ],
  creator_outreach: [
    {
      id: "youtube",
      title: "YouTube",
      description:
        "Tech reviewers (50k–500k subs) who cover dev tools and have sponsored integration experience.",
    },
    {
      id: "newsletter",
      title: "Newsletter",
      description:
        "Newsletters for founders with 10k+ engaged readers in SaaS—open to affiliate + deep dives.",
    },
    {
      id: "shortform",
      title: "Short-form",
      description:
        "TikTok/IG creators in personal finance niche, US audience, consistent weekly posts.",
    },
  ],
  community_growth: [
    {
      id: "discord",
      title: "Discord",
      description:
        "Builders and indie hackers who hang in public Discords and ship side projects—invite to our weekly build club.",
    },
    {
      id: "niche",
      title: "Niche",
      description:
        "Design engineers who use Figma + code—looking for moderators and power users for our community.",
    },
    {
      id: "events",
      title: "Events",
      description:
        "People who attend local product meetups in London and want early access to our community cohort.",
    },
  ],
  podcast_speaker_sourcing: [
    {
      id: "expert",
      title: "Expert",
      description:
        "Guests who led platform engineering at scale (1M+ RPS) and can speak clearly about tradeoffs.",
    },
    {
      id: "founder",
      title: "Founder story",
      description:
        "Bootstrapped founders who crossed $1M ARR without VC—willing to share real numbers.",
    },
    {
      id: "research",
      title: "Research",
      description:
        "Academics in HCI who study developer productivity and can discuss study design on-air.",
    },
  ],
};

export function getSetupExampleDescriptions(
  useCaseKey: WorkspaceUseCaseKey
): SetupExampleDescription[] {
  return BY_USE_CASE[useCaseKey] ?? DEFAULT_EXAMPLES;
}
