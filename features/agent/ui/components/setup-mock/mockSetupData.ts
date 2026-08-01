import type { IdealCustomerProfileCardData } from "@/features/prospects/ui/components/ideal-customer-profile";
import {
  getWorkspaceUseCase,
  type WorkspaceUseCaseKey,
} from "@/shared/lib/workspaceUseCases";

export const MOCK_SETUP_CASES = [
  {
    id: "empty",
    label: "Empty",
    description: "Who should Agent find? + composer",
  },
  {
    id: "generating_icps",
    label: "Generating ICPs",
    description: "Chat only — no panel",
  },
  {
    id: "icp_review",
    label: "ICP review",
    description: "Inline card + Profiles panel",
  },
  {
    id: "preview_running",
    label: "Preview running",
    description: "Progress + waiting panel (no Continue)",
  },
  {
    id: "preview_ready",
    label: "Preview ready",
    description: "Avatar stack + panel cards + sticky Continue",
  },
  {
    id: "connections",
    label: "Connections",
    description: "Connect accounts panel",
  },
  {
    id: "plan",
    label: "Plan",
    description: "Choose a plan panel",
  },
  {
    id: "done",
    label: "Done",
    description: "Workspace ready",
  },
  {
    id: "prospecting",
    label: "Real prospecting",
    description: "Search/qualify progress inline",
  },
] as const;

export type MockSetupCaseId = (typeof MOCK_SETUP_CASES)[number]["id"];

/** Use-case dictionary to preview terminology (incl. planned fallback). */
export const MOCK_USE_CASE_OPTIONS = [
  {
    id: "general_outreach",
    label: "Custom outreach (fallback)",
  },
  {
    id: "customer_prospecting",
    label: "Customer Prospecting",
  },
  {
    id: "recruiting",
    label: "Recruiting",
  },
] as const;

export type MockUseCaseOptionId = (typeof MOCK_USE_CASE_OPTIONS)[number]["id"];

export type MockUseCaseLabels = {
  id: MockUseCaseOptionId;
  displayName: string;
  entitySingular: string;
  entityPlural: string;
  profileLabelPlural: string;
  successLabel: string;
};

const GENERAL_OUTREACH_LABELS: MockUseCaseLabels = {
  id: "general_outreach",
  displayName: "Custom outreach",
  entitySingular: "Person",
  entityPlural: "People",
  profileLabelPlural: "Ideal profiles",
  successLabel: "Connections",
};

export function getMockUseCaseLabels(
  id: MockUseCaseOptionId
): MockUseCaseLabels {
  if (id === "general_outreach") {
    return GENERAL_OUTREACH_LABELS;
  }

  const useCase = getWorkspaceUseCase(id as WorkspaceUseCaseKey);
  return {
    id,
    displayName: useCase.displayName,
    entitySingular: useCase.entitySingular,
    entityPlural: useCase.entityPlural,
    profileLabelPlural: useCase.profileLabelPlural,
    successLabel: useCase.pageLabels.converts,
  };
}

export const MOCK_DESCRIPTION =
  "Find people who post about building in public and shipping indie products.";

export const MOCK_IDEAL_PROFILES: IdealCustomerProfileCardData[] = [
  {
    title: "Indie builders shipping publicly",
    description:
      "Founders who document product progress in public and share shipping updates on X.",
    painPoints: [
      "Hard to find peers who actually ship",
      "Wants tools that fit solo workflows",
      "Ignores generic SaaS outreach",
    ],
    channels: ["twitter", "linkedin"],
  },
  {
    title: "Solo makers with early traction",
    description:
      "Independent makers with a small but engaged audience and a live product.",
    painPoints: [
      "Limited time for research",
      "Needs distribution, not more theory",
    ],
    channels: ["twitter"],
  },
  {
    title: "Technical creators evaluating tools",
    description:
      "Engineers and technical creators who try new tooling and share honest takes.",
    painPoints: ["Skeptical of vague claims", "Wants concrete workflow fit"],
    channels: ["twitter", "linkedin"],
  },
];

export const MOCK_PREVIEW_PROGRESS = {
  discoveredCount: 42,
  qualifiedCount: 11,
  enrichedCount: 7,
  selectedCount: 2,
};

/** Same Unsplash face crops as the /home use-case demo. */
const DEMO_FACE_URLS = {
  ava: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  marcus:
    "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  priya:
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
} as const;

/** Real Unsplash landscapes for profile banner slots. */
const DEMO_BANNER_URLS = {
  ava: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=400&fit=crop&auto=format&q=80",
  marcus:
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=400&fit=crop&auto=format&q=80",
  priya:
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=400&fit=crop&auto=format&q=80",
} as const;

export const MOCK_TWITTER_PROFILES: Array<{
  id: string;
  profileData: Record<string, unknown>;
}> = [
  {
    id: "ava",
    profileData: {
      displayName: "Ava Chen",
      username: "avabuilds",
      bio: "Shipping a local-first notes app in public",
      followersCount: 12400,
      followingCount: 480,
      verified: false,
      profileUrl: "https://x.com/avabuilds",
      avatarUrl: DEMO_FACE_URLS.ava,
      bannerUrl: DEMO_BANNER_URLS.ava,
      location: "San Francisco",
      joinedAt: "2021-03-01T00:00:00.000Z",
    },
  },
  {
    id: "marcus",
    profileData: {
      displayName: "Marcus Cole",
      username: "marcusships",
      bio: "Indie hacker · 2 products, $8k MRR",
      followersCount: 9100,
      followingCount: 312,
      verified: false,
      profileUrl: "https://x.com/marcusships",
      avatarUrl: DEMO_FACE_URLS.marcus,
      bannerUrl: DEMO_BANNER_URLS.marcus,
      location: "Austin",
      joinedAt: "2019-08-01T00:00:00.000Z",
    },
  },
  {
    id: "priya",
    profileData: {
      displayName: "Priya Nair",
      username: "priyanair",
      bio: "Building developer tools · open to partnerships",
      followersCount: 18700,
      followingCount: 640,
      verified: false,
      profileUrl: "https://x.com/priyanair",
      avatarUrl: DEMO_FACE_URLS.priya,
      bannerUrl: DEMO_BANNER_URLS.priya,
      location: "London",
      joinedAt: "2020-01-01T00:00:00.000Z",
    },
  },
];
