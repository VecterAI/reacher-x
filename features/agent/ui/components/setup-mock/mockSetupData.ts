import type { Doc } from "@/convex/_generated/dataModel";
import { MOCK_PROSPECTS } from "@/features/prospects/lib/mockData";
import {
  getWorkspaceUseCase,
  WORKSPACE_USE_CASE_KEYS,
  type WorkspaceUseCaseKey,
} from "@/shared/lib/workspaceUseCases";

export const MOCK_SETUP_CASES = [
  { id: "empty", label: "Describe" },
  { id: "generating", label: "Generating" },
  { id: "generation_failed", label: "Generation failed" },
  { id: "review", label: "Review" },
  { id: "updated", label: "Updated" },
  { id: "starting", label: "Saving approval" },
  { id: "start_failed", label: "Approval failed" },
  { id: "connections", label: "Connections" },
  { id: "plan", label: "Plan" },
  { id: "checkout", label: "Checkout pending" },
  { id: "checkout_failed", label: "Checkout failed" },
  { id: "done", label: "Running, no results" },
  { id: "results", label: "Results arriving" },
] as const;
export type MockSetupCaseId = (typeof MOCK_SETUP_CASES)[number]["id"];
export type MockUseCaseOptionId = WorkspaceUseCaseKey;
export const MOCK_USE_CASE_OPTIONS = WORKSPACE_USE_CASE_KEYS.map((id) => ({
  id,
  label: getWorkspaceUseCase(id).displayName,
}));
export const getMockUseCaseLabels = getWorkspaceUseCase;

type Example = { name: string; title: string; bio: string; secondBio: string };
const EXAMPLES: Record<WorkspaceUseCaseKey, Example[]> = {
  customer_prospecting: [
    {
      name: "Ava Chen",
      title: "Software founder",
      bio: "Founder of a small B2B SaaS. Building the product, talking to customers, and figuring out outbound.",
      secondBio:
        "Bootstrapping a software business. I handle product and sales. Sharing what I learn about finding customers.",
    },
    {
      name: "Sam Cole",
      title: "Sales development manager",
      bio: "SDR manager. Coaching outbound reps, building account lists, and making prospecting less of a grind.",
      secondBio:
        "Leading sales development at a B2B software company. Outbound strategy, rep coaching, and better conversations.",
    },
  ],
  recruiting: [
    {
      name: "Ava Chen",
      title: "Frontend engineer",
      bio: "Frontend engineer. React, TypeScript, and accessible interfaces. Open to frontend roles.",
      secondBio:
        "React developer building interfaces for the web. Looking for my next frontend role. I share side projects here.",
    },
    {
      name: "Sam Cole",
      title: "Backend engineer",
      bio: "Backend engineer. APIs, PostgreSQL, and distributed systems. Exploring new opportunities.",
      secondBio:
        "I build backend services and write about reliability. Open to backend engineering roles.",
    },
  ],
  general_outreach: [
    {
      name: "Ava Chen",
      title: "Solo product founder",
      bio: "Solo founder. Building a small software product and sharing the wins, bugs, and lessons along the way.",
      secondBio:
        "Bootstrapping my first SaaS. Product updates and build-in-public notes. Just me for now.",
    },
    {
      name: "Sam Cole",
      title: "Developer-tool founder",
      bio: "Building developer tools. Shipping updates and talking to the developers who use them.",
      secondBio:
        "Founder, developer, occasional docs writer. Building tools I wish I had and sharing the process.",
    },
    {
      name: "Priya Nair",
      title: "Technical educator",
      bio: "I teach software development through projects. Tutorials, code, and things I learned the hard way.",
      secondBio:
        "Developer and educator. I make practical coding walkthroughs and share the tools I use.",
    },
  ],
  partnership_outreach: [
    {
      name: "Ava Chen",
      title: "Agency founder",
      bio: "Founder of a software agency. We build products for clients. Always interested in useful product partnerships.",
      secondBio:
        "Running a small development studio. Client work, software delivery, and tools worth recommending.",
    },
    {
      name: "Sam Cole",
      title: "Integration partnerships manager",
      bio: "Product partnerships and integrations. Helping software teams build things that work better together.",
      secondBio:
        "I lead integration partnerships. APIs, partner launches, and connecting useful products.",
    },
  ],
  investor_outreach: [
    {
      name: "Ava Chen",
      title: "Angel investor",
      bio: "Angel investor in early-stage software. Former operator. I like helping founders find their first customers.",
      secondBio:
        "Backing software founders early. Product, distribution, and the first ten customers.",
    },
    {
      name: "Sam Cole",
      title: "Seed fund partner",
      bio: "Partner at a seed fund. Investing in software companies and meeting founders building their first products.",
      secondBio:
        "Seed-stage software investor. I work with founders on early product and go-to-market decisions.",
    },
  ],
  user_research_recruitment: [
    {
      name: "Ava Chen",
      title: "Freelance designer",
      bio: "Freelance product designer. Juggling client projects, Figma files, and a very full calendar.",
      secondBio:
        "Independent designer working with small product teams. Client projects, design systems, and weekly planning.",
    },
    {
      name: "Sam Cole",
      title: "Design team lead",
      bio: "Design lead. Helping a team turn messy briefs into useful products. Planning is half the job.",
      secondBio:
        "Leading a product design team. Design reviews, project planning, and making space for focused work.",
    },
  ],
  creator_outreach: [
    {
      name: "Ava Chen",
      title: "Software tutorial creator",
      bio: "I make tutorials about software tools. Practical demos and honest reviews. Open to relevant sponsorships.",
      secondBio:
        "Software tutorials without the fluff. New walkthroughs every week. Sponsorship enquiries welcome.",
    },
    {
      name: "Sam Cole",
      title: "Technology newsletter writer",
      bio: "Writing a newsletter about software worth trying. Product notes, useful tools, and the occasional sponsored edition.",
      secondBio:
        "Independent tech newsletter writer. Software, workflows, and products I find interesting. Open to sponsors.",
    },
  ],
  community_growth: [
    {
      name: "Ava Chen",
      title: "Indie founder",
      bio: "Indie founder building software. Looking for other builders to swap feedback and keep each other shipping.",
      secondBio:
        "Bootstrapping a product on my own. Here to meet founders and share what is working.",
    },
    {
      name: "Sam Cole",
      title: "Open-source maintainer",
      bio: "Open-source maintainer. Developer tools, issues, pull requests. I like communities where people help each other.",
      secondBio:
        "Maintaining an open-source project and learning in public. Always up for meeting fellow builders.",
    },
  ],
  podcast_speaker_sourcing: [
    {
      name: "Ava Chen",
      title: "Bootstrapped founder",
      bio: "Bootstrapped founder. I write and speak about building software and finding the first customers.",
      secondBio:
        "Growing a software business without funding. Happy to talk about customer acquisition and the mistakes along the way.",
    },
    {
      name: "Sam Cole",
      title: "Engineering leader",
      bio: "Engineering leader. Building teams and software. Sharing lessons about hiring, delivery, and technical decisions.",
      secondBio:
        "I lead an engineering team and talk about the practical side of building products and hiring developers.",
    },
  ],
};

// Local fixtures only. Reuse the existing mock identities; never persist these records.
export function getMockSetupProspects(
  useCaseKey: WorkspaceUseCaseKey
): Array<Doc<"prospects"> & { exampleKey: string }> {
  return EXAMPLES[useCaseKey].flatMap((example, personaIndex) => {
    const { _id, workspaceId, userId } = MOCK_PROSPECTS[personaIndex];
    return [example.bio, example.secondBio].map((bio, variantIndex) => ({
      _id,
      workspaceId,
      userId,
      exampleKey: `${useCaseKey}-${personaIndex}-${variantIndex}`,
      _creationTime: 0,
      updatedAt: 0,
      // Each persona has one LinkedIn example and one X/Twitter example.
      platform:
        variantIndex === 0 ? ("linkedin" as const) : ("twitter" as const),
      externalId: String(_id),
      origin: "setup_preview" as const,
      status: "new" as const,
      data: {},
      displayName:
        variantIndex === 0
          ? example.name
          : ["Marco Diaz", "Nina Patel", "Owen Reed"][personaIndex],
      title: example.title,
      briefIntro: bio,
      prospectType: "individual" as const,
    }));
  });
}

export const MOCK_DESCRIPTIONS: Record<WorkspaceUseCaseKey, string> = {
  customer_prospecting:
    "Find software founders doing outbound themselves and sales development managers who want to spend less time researching prospects.",
  recruiting:
    "Find frontend React engineers and backend engineers who are looking for a new role.",
  general_outreach:
    "Find solo founders shipping indie products, developer-tool founders, and technical educators who share their work publicly.",
  partnership_outreach:
    "Find software agency founders and integration partnerships managers for product partnerships.",
  investor_outreach:
    "Find angel investors and seed fund partners investing in early-stage software companies.",
  user_research_recruitment:
    "Find freelance designers and design team leads for interviews about project planning.",
  creator_outreach:
    "Find software tutorial creators and technology newsletter writers who accept sponsorships.",
  community_growth:
    "Find indie founders and open-source maintainers for a community of software builders.",
  podcast_speaker_sourcing:
    "Find bootstrapped founders and engineering leaders to interview on a software podcast.",
};

export function getMockSetupRefinement(
  useCaseKey: WorkspaceUseCaseKey
): string {
  return `Keep only the ${EXAMPLES[useCaseKey][0].title.toLowerCase()} profile.`;
}
