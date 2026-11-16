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
    title: "First paying customers",
    description: "Find and reach people who are likely to buy what you offer.",
  },
  {
    useCaseKey: "recruiting",
    slug: "candidates",
    title: "The next great hire",
    description: "Source and engage people who match your open roles.",
  },
  {
    useCaseKey: "investor_outreach",
    slug: "investors",
    title: "Investors who would fund you",
    description: "Reach investors whose thesis aligns with your raise.",
  },
  {
    useCaseKey: "partnership_outreach",
    slug: "partners",
    title: "Partners who bring business",
    description: "Connect with companies and operators in your space.",
  },
  {
    useCaseKey: "community_growth",
    slug: "community-members",
    title: "Members who actually care",
    description: "Find early members who genuinely care about your topic.",
  },
  {
    useCaseKey: "creator_outreach",
    slug: "creators",
    title: "Creators who love what you build",
    description: "Reach influencers and creators who align with your brand.",
  },
  {
    useCaseKey: "user_research_recruitment",
    slug: "research-participants",
    title: "Users who tell you the truth",
    description: "Recruit people who match your study criteria.",
  },
  {
    useCaseKey: "podcast_speaker_sourcing",
    slug: "podcast-guests",
    title: "Guests with something to say",
    description: "Find guests with real expertise and something to say.",
  },
];
