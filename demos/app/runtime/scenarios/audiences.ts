import portraits from "../portraitAssets.json";
import type { AudienceDemoId } from "@/features/blog/lib/blogDemoCatalog";
import type { WorkspaceUseCaseKey } from "@/shared/lib/workspaceUseCases";
import { applyDemoPortrait } from "../portraitHelpers";
import { makeProspect } from "@/features/landing/ui/components/use-case-demo/useCaseDemoData";

type Person = Pick<
  Parameters<typeof makeProspect>[0],
  "title" | "briefIntro" | "signal" | "qualificationScore"
> & { displayName: keyof typeof portraits };
export interface AudienceStory {
  useCaseKey: WorkspaceUseCaseKey;
  workspace: string;
  brief: string;
  people: [Person, Person, Person];
}

/** Fictional people, source posts and outreach; each story follows its article's premise. */
export const audienceStories: Record<AudienceDemoId, AudienceStory> = {
  "find-potential-customers": {
    useCaseKey: "customer_prospecting",
    workspace: "Simpler client feedback",
    brief:
      "Find freelance designers who have talked about clients sending feedback through email, chat, and shared documents. I'm building an app that puts that feedback in one place.",
    people: [
      {
        displayName: "Nora Ellis",
        title: "Independent brand designer",
        qualificationScore: 94,
        briefIntro:
          "Designs brands for small businesses. Recently described losing client approvals across email, chat, and documents.",
        signal:
          "Three clients, three feedback channels. I spent this morning comparing Slack comments with a PDF and an email to work out which logo changes were actually approved. How do other freelancers keep one clear version?",
      },
      {
        displayName: "Alex Rivera",
        title: "Design course creator",
        qualificationScore: 78,
        briefIntro:
          "Teaches designers how to manage feedback. A closer read shows they no longer take client projects.",
        signal:
          "New lesson: keeping client feedback organised. These days I teach full-time and don't take design clients, but I still use examples from my old freelance practice.",
      },
      {
        displayName: "Samir Patel",
        title: "Freelance web designer",
        qualificationScore: 87,
        briefIntro:
          "Builds websites for independent shops and wants an easier way to track client revisions.",
        signal:
          "Does anyone have a lightweight way to track website revisions? My client keeps adding requests to an old shared document after approving the page.",
      },
    ],
  },
  "find-investors": {
    useCaseKey: "investor_outreach",
    workspace: "Clinic software · pre-seed",
    brief:
      "We're a two-person UK team building scheduling software for independent clinics. Find investors discussing pre-seed health software in the UK. Check current sector and stage before proposing an introduction.",
    people: [
      {
        displayName: "Amelia Grant",
        title: "Early-stage health software investor",
        qualificationScore: 93,
        briefIntro:
          "Recently wrote about pre-seed UK health software and reducing administrative work in independent clinics.",
        signal:
          "Our current focus is UK pre-seed health software. I'm especially interested in the hours small clinics lose to scheduling and follow-up admin. We meet teams before they have a repeatable sales process.",
      },
      {
        displayName: "Daniel Park",
        title: "Growth-stage technology investor",
        qualificationScore: 74,
        briefIntro:
          "Covers healthcare technology, but now invests at Series B and later rather than pre-seed.",
        signal:
          "A focus update: our healthcare software investments are now Series B and later. We look for established sales teams and repeatable enterprise revenue.",
      },
      {
        displayName: "Priya Sen",
        title: "Angel investor · health operations",
        qualificationScore: 86,
        briefIntro:
          "Former clinic operator discussing early investments in tools for independent care providers.",
        signal:
          "After running a clinic for eight years, I now make a few angel investments in UK teams fixing everyday admin for care providers. Small practices deserve better scheduling tools.",
      },
    ],
  },
  "find-research-participants": {
    useCaseKey: "user_research_recruitment",
    workspace: "Tutor scheduling study",
    brief:
      "Find independent tutors who have recently discussed arranging lessons, cancellations, or chasing confirmations from parents. Participants must manage their own schedule. This is a research study, not a sales campaign.",
    people: [
      {
        displayName: "Lena Brooks",
        title: "Independent maths tutor",
        qualificationScore: 95,
        briefIntro:
          "Manages her own lessons and recently described last-minute cancellations and parent confirmations.",
        signal:
          "I teach maths independently. Half of Sunday goes into confirming next week's lessons with parents, then two families move their slots on Monday. Curious how other solo tutors handle this.",
      },
      {
        displayName: "Owen Clarke",
        title: "Maths tutor at a learning centre",
        qualificationScore: 77,
        briefIntro:
          "Discusses tutoring schedules, but the centre's administrator handles all bookings and parent communication.",
        signal:
          "Our centre changed the lesson timetable again. Luckily our administrator handles all parent bookings and cancellations; I just teach the sessions assigned to me.",
      },
      {
        displayName: "Mei Foster",
        title: "Independent language tutor",
        qualificationScore: 88,
        briefIntro:
          "Arranges weekly language lessons directly with parents and has tried several confirmation systems.",
        signal:
          "I moved parent confirmations from email to messages, but now I lose track of which lesson time we agreed. I run my own tutoring practice—what works for other independent tutors?",
      },
    ],
  },
  "find-partners": {
    useCaseKey: "partnership_outreach",
    workspace: "Client feedback workshop",
    brief:
      "Find people who teach freelance designers or run communities for them. We'd like to run a practical workshop about handling client feedback. Look for recent lessons on client communication and expectations.",
    people: [
      {
        displayName: "Maya Lawson",
        title: "Freelance design educator",
        qualificationScore: 94,
        briefIntro:
          "Teaches independent designers how to set client expectations and runs practical member workshops.",
        signal:
          "This week's lesson for our freelance design community: agree what approval means before the first revision. Members asked for more practical examples of handling conflicting client feedback.",
      },
      {
        displayName: "Tom Mercer",
        title: "Design community organiser",
        qualificationScore: 89,
        briefIntro:
          "Runs small teaching sessions for freelance designers with a focus on sustainable client relationships.",
        signal:
          "Planning next month's member sessions. Our freelance designers keep asking about scope creep and client revision rounds. Looking for practical teaching, not another product pitch.",
      },
      {
        displayName: "Lee Morgan",
        title: "Independent design coach",
        qualificationScore: 83,
        briefIntro:
          "Coaches designers on client projects and shares examples of useful feedback processes.",
        signal:
          "A clear feedback checklist helped a coaching client cut revision rounds in half. I'd love to compare notes with other people teaching this to freelance designers.",
      },
    ],
  },
  "find-creators": {
    useCaseKey: "creator_outreach",
    workspace: "Developer tutorial collaborators",
    brief:
      "Find creators who teach solo developers how to launch web apps. Look for hands-on tutorials and audience questions about finding the first people to try a project, rather than general startup advice.",
    people: [
      {
        displayName: "Evan Brooks",
        title: "Developer educator and video creator",
        qualificationScore: 94,
        briefIntro:
          "Publishes hands-on app launch tutorials. Viewers recently asked how to find the first people to try their projects.",
        signal:
          "New walkthrough: build and launch a tiny web app in a weekend. The most common question under the tutorial isn't about deployment—it's how to find the first five people willing to try it.",
      },
      {
        displayName: "Aisha Khan",
        title: "Indie developer educator",
        qualificationScore: 88,
        briefIntro:
          "Shares practical lessons on launching small products and talking to early users.",
        signal:
          "I am recording a series on the work after launch: talking to users, reading feedback, and deciding what to build next. Small practical tools welcome.",
      },
      {
        displayName: "Noah Reed",
        title: "Web development teacher",
        qualificationScore: 84,
        briefIntro:
          "Makes screen-recorded tutorials about shipping side projects and interviewing early users.",
        signal:
          "Next week's side-project tutorial will cover inviting real people to test a deployed app. Planning to show the entire workflow rather than another list of marketing tips.",
      },
    ],
  },
  "find-community-members": {
    useCaseKey: "community_growth",
    workspace: "Friday app feedback circle",
    brief:
      "Find solo developers sharing early versions of their apps and asking for feedback. We run a free weekly session where people try each other's projects. Invite people to the activity, not just a server.",
    people: [
      {
        displayName: "Alex Kim",
        title: "Solo developer",
        qualificationScore: 95,
        briefIntro:
          "Shared an early app and asked people to try the onboarding before the next release.",
        signal:
          "Shipped the first version of my little habit app. Could someone try the onboarding and tell me where they get stuck? Happy to test your project in return.",
      },
      {
        displayName: "Zara Ahmed",
        title: "Independent app maker",
        qualificationScore: 89,
        briefIntro:
          "Looking for other makers to exchange hands-on feedback about early projects.",
        signal:
          "Building alone is great until you need someone to spot the confusing bits. Anyone interested in trying each other's small apps for twenty minutes this week?",
      },
      {
        displayName: "Jamie Cole",
        title: "Solo web developer",
        qualificationScore: 85,
        briefIntro:
          "Recently launched a budgeting prototype and invited feedback on the first-run experience.",
        signal:
          "My budgeting prototype finally works end to end. Looking for a few makers to try the first-run flow. I can give detailed feedback on your app too.",
      },
    ],
  },
  "find-podcast-guests": {
    useCaseKey: "podcast_speaker_sourcing",
    workspace: "Freelance to first hire",
    brief:
      "Find people who recently shared their experience hiring their first teammate after freelancing. We want a podcast guest who can discuss handing over client work, what changed, and what went wrong.",
    people: [
      {
        displayName: "Sofia Bennett",
        title: "Designer and small agency founder",
        qualificationScore: 95,
        briefIntro:
          "Recently hired her first designer after freelancing and wrote about learning to delegate client work.",
        signal:
          "Six months after hiring my first designer, the hardest change wasn't payroll. It was handing over client work without reviewing every small decision. My first attempt at delegation just made me a bottleneck.",
      },
      {
        displayName: "Marcus Lee",
        title: "Independent studio founder",
        qualificationScore: 89,
        briefIntro:
          "Shared lessons from turning a freelance practice into a two-person studio.",
        signal:
          "Our first year as a two-person studio is done. What I wish I'd known before my first hire: agreeing who owns client communication matters more than a perfect task board.",
      },
      {
        displayName: "Elena Cruz",
        title: "Freelance developer and founder",
        qualificationScore: 86,
        briefIntro:
          "Hired her first contractor and recently discussed the mistakes she made briefing client projects.",
        signal:
          "I hired help for the first time this spring and wrote terrible briefs. Three projects later, here's what changed: clear outcomes, fewer handovers, and room for someone else's judgment.",
      },
    ],
  },
};

export function createAudienceProspect(
  person: Person,
  index: number,
  platform: "twitter" | "linkedin" = "linkedin"
) {
  const prospect = makeProspect({
    ...person,
    key: `audience_${index + 1}`,
    platform,
    handle: `fictional-${person.displayName.toLowerCase().replaceAll(" ", "-")}`,
    hoursAgo: index + 1,
    matchedKeywords: [],
  });
  return applyDemoPortrait(prospect);
}
