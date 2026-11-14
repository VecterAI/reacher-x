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
    title: "Find customers ready to buy",
    description: "Find and reach people who are likely to buy what you offer.",
  },
  {
    useCaseKey: "recruiting",
    slug: "candidates",
    title: "Find candidates for your open roles",
    description: "Source and engage people who match your open roles.",
  },
  {
    useCaseKey: "investor_outreach",
    slug: "investors",
    title: "Find investors who fit your raise",
    description: "Reach investors whose thesis aligns with your raise.",
  },
  {
    useCaseKey: "partnership_outreach",
    slug: "partners",
    title: "Find partners to grow with",
    description: "Connect with companies and operators in your space.",
  },
  {
    useCaseKey: "community_growth",
    slug: "community-members",
    title: "Find members for your community",
    description: "Find early members who genuinely care about your topic.",
  },
  {
    useCaseKey: "creator_outreach",
    slug: "creators",
    title: "Find creators who fit your brand",
    description: "Reach influencers and creators who align with your brand.",
  },
  {
    useCaseKey: "user_research_recruitment",
    slug: "research-participants",
    title: "Find people to interview or survey",
    description: "Recruit people who match your study criteria.",
  },
  {
    useCaseKey: "podcast_speaker_sourcing",
    slug: "podcast-guests",
    title: "Find your next podcast guests",
    description: "Find guests with real expertise and something to say.",
  },
];
