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
    title: "Your first paying customers",
    description: "Find and reach people who are likely to buy what you offer.",
  },
  {
    useCaseKey: "recruiting",
    slug: "candidates",
    title: "Your next great hire",
    description: "Source and engage people who match your open roles.",
  },
  {
    useCaseKey: "investor_outreach",
    slug: "investors",
    title: "Investors who get what you build",
    description: "Reach investors whose thesis aligns with your raise.",
  },
  {
    useCaseKey: "partnership_outreach",
    slug: "partners",
    title: "Partners who open doors",
    description: "Connect with companies and operators in your space.",
  },
  {
    useCaseKey: "community_growth",
    slug: "community-members",
    title: "Members who stick around",
    description: "Find early members who genuinely care about your topic.",
  },
  {
    useCaseKey: "creator_outreach",
    slug: "creators",
    title: "Creators who champion your product",
    description: "Reach influencers and creators who align with your brand.",
  },
  {
    useCaseKey: "user_research_recruitment",
    slug: "research-participants",
    title: "Honest answers from real users",
    description: "Recruit people who match your study criteria.",
  },
  {
    useCaseKey: "podcast_speaker_sourcing",
    slug: "podcast-guests",
    title: "Guests your listeners remember",
    description: "Find guests with real expertise and something to say.",
  },
];
