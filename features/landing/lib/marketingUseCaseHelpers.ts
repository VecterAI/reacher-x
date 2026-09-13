import { USE_CASES } from "./useCases";
import type { BlogDemoId } from "@/features/blog/lib/blogDemoHelpers";

type UseCaseStory = {
  heading: string;
  explanation: string;
  exampleHeading: string;
  navigationDescription: string;
  goal: string;
  prompt: string;
  checks: readonly string[];
  guide: BlogDemoId;
};

const STORIES: Record<string, UseCaseStory> = {
  customer_prospecting: {
    heading: "Find the people who need what you’re building.",
    navigationDescription: "People discussing the problem you solve.",
    exampleHeading: "From an interesting post to a potential customer.",
    explanation:
      "Research people discussing the problem you solve, then plan a relevant introduction.",
    goal: "Find potential customers",
    prompt:
      "I build an app that keeps client feedback in one place. Find freelance designers who talk about losing feedback across email, chat, and documents.",
    checks: [
      "Discover people talking about the problem you solve.",
      "See the posts and profile details behind each match.",
      "Plan your introduction and keep track of the conversation.",
    ],
    guide: "find-potential-customers",
  },
  recruiting: {
    heading: "Meet your next teammate.",
    navigationDescription: "People with experience your team needs.",
    exampleHeading: "See the work behind the profile.",
    explanation:
      "Find candidates through their work and experience, then prepare a personal introduction.",
    goal: "Find candidates",
    prompt:
      "We are a team of three hiring a frontend engineer. Find people on X/Twitter and LinkedIn who share work on accessibility and complex web apps, and are open to joining a small team.",
    checks: [
      "Search around the skills and experience your team needs.",
      "Review projects and public activity before reaching out.",
      "Keep candidate conversations and hiring stages together.",
    ],
    guide: "find-candidates",
  },
  investor_outreach: {
    heading: "Build relationships with relevant investors.",
    navigationDescription: "Backers focused on your sector and stage.",
    exampleHeading: "Research the fit before making the introduction.",
    explanation:
      "Find investors whose interests match your company, then prepare your approach.",
    goal: "Find investors",
    prompt:
      "We're a two-person team building software for independent clinics. Find early-stage investors who discuss health software on X/Twitter and LinkedIn. Help me understand what they back before I contact them.",
    checks: [
      "Find investors discussing your market and company stage.",
      "Review their public activity and investment interests.",
      "Prepare an introduction specific to your company.",
    ],
    guide: "find-investors",
  },
  partnership_outreach: {
    heading: "Find people you could build something with.",
    navigationDescription: "People serving the same audience.",
    exampleHeading: "Turn a shared audience into a reason to connect.",
    explanation:
      "Find potential partners serving your audience and research where your work overlaps.",
    goal: "Find partners",
    prompt:
      "Find people who teach freelance designers or run communities for them. I would like to run a practical workshop about handling client feedback.",
    checks: [
      "Discover people who serve a relevant audience.",
      "Understand their work before proposing a collaboration.",
      "Develop an approach for each potential partner.",
    ],
    guide: "find-partners",
  },
  community_growth: {
    heading: "Bring the right people into your community.",
    navigationDescription: "People already interested in your topic.",
    exampleHeading: "Find shared interests beyond your existing audience.",
    explanation:
      "Find people who share your community’s interests and plan a personal invitation.",
    goal: "Grow a community",
    prompt:
      "Find solo developers sharing early apps and asking for feedback on X/Twitter and LinkedIn. We run a free weekly session where people try each other’s projects.",
    checks: [
      "Discover people participating in relevant conversations.",
      "Check whether the community would be useful to them.",
      "Prepare personal invitations and follow the replies.",
    ],
    guide: "find-community-members",
  },
  creator_outreach: {
    heading: "Meet creators who fit your project.",
    navigationDescription: "Creators whose work fits your audience.",
    exampleHeading: "Understand the creator before making the pitch.",
    explanation:
      "Find creators whose work fits your audience and prepare a relevant collaboration proposal.",
    goal: "Find creators",
    prompt:
      "Find creators teaching solo developers how to launch web apps. Look for hands-on tutorials and audience questions about finding the first people to try a project.",
    checks: [
      "Discover creators covering subjects relevant to your project.",
      "Read their content and the conversations around it.",
      "Prepare a collaboration proposal with a personal introduction.",
    ],
    guide: "find-creators",
  },
  user_research_recruitment: {
    heading: "Talk to people who have lived the problem.",
    navigationDescription: "People with firsthand experience.",
    exampleHeading: "Find the experience your research needs.",
    explanation:
      "Find people with the experience your research needs and prepare an invitation.",
    goal: "Find research participants",
    prompt:
      "I’m researching how independent tutors manage lessons. Find tutors on X/Twitter and LinkedIn who discuss scheduling, cancellations, or parent confirmations. They must manage their own bookings.",
    checks: [
      "Search around the problem and participant criteria.",
      "Review the evidence before deciding who to invite.",
      "Keep interview invitations and replies in one place.",
    ],
    guide: "find-research-participants",
  },
  podcast_speaker_sourcing: {
    heading: "Find the voices your audience should hear.",
    navigationDescription: "People with a story for your listeners.",
    exampleHeading: "Find a guest and a conversation worth having.",
    explanation:
      "Find guests with relevant experience and plan a personal invitation to your podcast.",
    goal: "Find podcast guests",
    prompt:
      "I host a podcast about small software businesses. Find founders on X/Twitter and LinkedIn who openly share what they've learned while building their first product.",
    checks: [
      "Discover people with experience relevant to your show.",
      "Read their work to develop a possible episode topic.",
      "Prepare invitations and keep track of guest conversations.",
    ],
    guide: "find-podcast-guests",
  },
};

export const MARKETING_USE_CASES = USE_CASES.map((useCase) => ({
  ...useCase,
  ...STORIES[useCase.useCaseKey],
  href: `/use-cases/${useCase.slug}`,
}));

export function getMarketingUseCase(slug: string) {
  return MARKETING_USE_CASES.find((useCase) => useCase.slug === slug);
}

export function isInvalidMarketingPath(pathname: string) {
  if (pathname.startsWith("/use-cases/")) {
    return !getMarketingUseCase(pathname.slice("/use-cases/".length));
  }
  if (pathname.startsWith("/home/preview/")) {
    return pathname !== "/home/preview/network";
  }
  return false;
}
