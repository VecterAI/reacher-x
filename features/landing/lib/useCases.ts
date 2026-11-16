import type { WorkspaceUseCaseKey } from "@/shared/lib/workspaceUseCases";

export type UseCase = {
  useCaseKey: WorkspaceUseCaseKey;
  slug: string;
  title: string;
  description: string;
};

export const USE_CASES: UseCase[] = [
  {
    useCaseKey: "customer_prospecting",
    slug: "customers",
    title: "Find your first paying customers",
    description: "Find and reach people who are likely to buy what you offer.",
  },
  {
    useCaseKey: "recruiting",
    slug: "candidates",
    title: "Hire your next great teammate",
    description: "Source and engage people who match your open roles.",
  },
  {
    useCaseKey: "investor_outreach",
    slug: "investors",
    title: "Meet investors who would fund you",
    description: "Reach investors whose thesis aligns with your raise.",
  },
  {
    useCaseKey: "partnership_outreach",
    slug: "partners",
    title: "Team up with partners who bring business",
    description: "Connect with companies and operators in your space.",
  },
  {
    useCaseKey: "community_growth",
    slug: "community-members",
    title: "Grow a community that actually cares",
    description: "Find early members who genuinely care about your topic.",
  },
  {
    useCaseKey: "creator_outreach",
    slug: "creators",
    title: "Reach creators who love what you build",
    description: "Reach influencers and creators who align with your brand.",
  },
  {
    useCaseKey: "user_research_recruitment",
    slug: "research-participants",
    title: "Recruit users who tell you the truth",
    description: "Recruit people who match your study criteria.",
  },
  {
    useCaseKey: "podcast_speaker_sourcing",
    slug: "podcast-guests",
    title: "Book guests with something to say",
    description: "Find guests with real expertise and something to say.",
  },
];
