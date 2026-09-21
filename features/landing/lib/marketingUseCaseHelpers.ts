import { USE_CASES } from "./useCases";
import type { BlogDemoId } from "@/features/blog/lib/blogDemoHelpers";

type UseCaseStory = {
  /** Short tab label for the homepage use-case section. */
  tabLabel: string;
  heading: string;
  explanation: string;
  navigationDescription: string;
  goal: string;
  prompt: string;
  checks: readonly string[];
  guide: BlogDemoId;
};

const STORIES: Record<string, UseCaseStory> = {
  customer_prospecting: {
    tabLabel: "Getting customers",
    heading: "Find the people who need what you’re building.",
    navigationDescription: "People discussing the problem you solve.",
    explanation:
      "The people who should be in your network are already out there discussing the problem you solve. It finds them and helps you build the relationship.",
    goal: "Find your first customers",
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
    tabLabel: "Hiring",
    heading: "Meet your next teammate.",
    navigationDescription: "People with experience your team needs.",
    explanation:
      "Your next teammate is probably already posting about the work you need. It finds them and helps you build the relationship before you ever post the job.",
    goal: "Find your next teammate",
    prompt:
      "We are a team of three hiring a frontend engineer. Find people on X/Twitter and LinkedIn who share work on accessibility and complex web apps, and are open to joining a small team.",
    checks: [
      "Search around the skills and experience your team needs.",
      "Review their work and public activity before reaching out.",
      "Keep candidate conversations and hiring stages together.",
    ],
    guide: "find-candidates",
  },
  investor_outreach: {
    tabLabel: "Fundraising",
    heading: "Build relationships with relevant investors.",
    navigationDescription: "Backers focused on your sector and stage.",
    explanation:
      "It finds investors focused on your sector and stage and helps you get on their radar before the raise.",
    goal: "Find investors who fit your raise",
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
    tabLabel: "Partnerships",
    heading: "Find people you could build something with.",
    navigationDescription: "People serving the same audience.",
    explanation:
      "It finds partners already serving your audience and helps you turn shared work into a real partnership.",
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
    tabLabel: "Community building",
    heading: "Bring the right people into your community.",
    navigationDescription: "People already interested in your topic.",
    explanation:
      "It finds people who already care about your topic and helps you turn them into your first members.",
    goal: "Grow a community",
    prompt:
      "Find solo developers sharing early apps and asking for feedback on X/Twitter and LinkedIn. We run a free weekly session where people try each other’s work.",
    checks: [
      "Discover people participating in relevant conversations.",
      "Check whether the community would be useful to them.",
      "Prepare personal invitations and follow the replies.",
    ],
    guide: "find-community-members",
  },
  creator_outreach: {
    tabLabel: "Creator outreach",
    heading: "Meet creators who fit your audience.",
    navigationDescription: "Creators whose work fits your audience.",
    explanation:
      "It finds creators whose work fits your audience and helps you build the relationship behind the collaboration.",
    goal: "Find creators",
    prompt:
      "Find creators teaching solo developers how to launch web apps. Look for hands-on tutorials and audience questions about finding the first people to try what you build.",
    checks: [
      "Discover creators covering subjects relevant to what you do.",
      "Read their content and the conversations around it.",
      "Prepare a collaboration proposal with a personal introduction.",
    ],
    guide: "find-creators",
  },
  user_research_recruitment: {
    tabLabel: "User research",
    heading: "Talk to people who have lived the problem.",
    navigationDescription: "People with firsthand experience.",
    explanation:
      "It finds people with firsthand experience of your problem and helps you bring them into your research.",
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
    tabLabel: "Podcast guests",
    heading: "Find the voices your audience should hear.",
    navigationDescription: "People with a story for your listeners.",
    explanation:
      "It finds guests with a story your listeners need and helps you build the relationship behind the invite.",
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
  /** Published guide for the same audience; marketing surfaces link here. */
  blogHref: `/blog/${STORIES[useCase.useCaseKey].guide}`,
}));

export function isInvalidMarketingPath(pathname: string) {
  if (pathname === "/about") {
    return true;
  }
  // Retired marketing routes must return 404 before the shell streams.
  if (
    pathname === "/product" ||
    pathname === "/use-cases" ||
    pathname.startsWith("/use-cases/")
  ) {
    return true;
  }
  // Retired homepage variants must return 404 before the shell streams.
  if (
    pathname === "/home/preview" ||
    pathname.startsWith("/home/preview/") ||
    /^\/home\/v\d+(?:\/|$)/.test(pathname)
  ) {
    return true;
  }
  return false;
}
