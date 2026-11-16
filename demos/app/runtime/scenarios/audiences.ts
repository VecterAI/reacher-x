import { demoHandle } from "../researchFixtureHelpers";
import portraits from "../portraitAssets.json";
import type { AudienceDemoId } from "@/features/blog/lib/blogDemoCatalog";
import type { WorkspaceUseCaseKey } from "@/shared/lib/workspaceUseCases";
import { applyDemoPortrait } from "../portraitHelpers";
import { makeProspect } from "@/features/landing/ui/components/use-case-demo/useCaseDemoData";

type Person = Pick<
  Parameters<typeof makeProspect>[0],
  "title" | "briefIntro" | "signal" | "qualificationScore"
> & {
  displayName: keyof typeof portraits;
  status?: "new" | "contacted" | "in_progress";
  platform?: "twitter" | "linkedin";
  location?: string;
  matchedKeywords?: string[];
  gender?: "woman" | "man";
};
export interface AudienceStory {
  useCaseKey: WorkspaceUseCaseKey;
  workspace: string;
  brief: string;
  people: Person[];
}

/** Fictional people, source posts and outreach; each story follows its article's premise. */
export const audienceStories: Record<AudienceDemoId, AudienceStory> = {
  "find-potential-customers": {
    useCaseKey: "customer_prospecting",
    workspace: "Customers — freelance designers",
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
      {
        displayName: "Erin Walsh",
        title: "Freelance web designer",
        qualificationScore: 91,
        status: "contacted",
        platform: "twitter",
        location: "Dublin, Ireland",
        briefIntro:
          "Builds websites for small businesses and chases client feedback across WhatsApp, email, and shared documents.",
        signal:
          "Three clients this month, three feedback loops: WhatsApp voice notes, long email threads, and a shared sheet I gave up on. How do other freelance web designers keep revisions in one place?",
        matchedKeywords: ["client feedback", "website revisions"],
      },
      {
        displayName: "Helena Costa",
        title: "Independent brand designer",
        qualificationScore: 88,
        status: "in_progress",
        location: "Lisbon, Portugal",
        briefIntro:
          "Runs a solo brand studio and is comparing tools after a client approved an outdated logo version from an old email thread.",
        signal:
          "A client approved a logo direction from a two-week-old email while the current round lived in chat. I need one place where feedback and approvals stay in order. What works for your studio?",
        matchedKeywords: ["client feedback", "brand approvals"],
      },
      {
        displayName: "Ibrahim Saleh",
        title: "Independent web designer",
        qualificationScore: 83,
        status: "contacted",
        platform: "twitter",
        location: "Amman, Jordan",
        briefIntro:
          "Designs and maintains websites for local restaurants and describes chasing sign-off across chat and shared documents.",
        signal:
          "Sign-off for a restaurant menu page happened in a chat message, but the change requests keep arriving in a shared document. Two sources of truth, one launch date.",
        matchedKeywords: ["client feedback", "approvals"],
      },
      {
        displayName: "Hannah Schmidt",
        title: "Freelance product designer",
        qualificationScore: 84,
        location: "Hamburg, Germany",
        briefIntro:
          "Designs dashboards for small SaaS teams and recently described piecing client feedback together from Figma comments, email, and a shared drive.",
        signal:
          "This week's client review: comments in Figma, decisions in email, the final brief on a shared drive. Assembling the timeline took longer than the redesign itself.",
        matchedKeywords: ["client feedback", "design reviews"],
      },
      {
        displayName: "Chloe Dupont",
        title: "Freelance brand and web designer",
        qualificationScore: 76,
        location: "Bordeaux, France",
        briefIntro:
          "Works with boutique clients on brand and web projects and wants a clearer approval trail after a revision round was lost between two inboxes.",
        signal:
          "Lost track of which homepage revision the client actually approved: one email said version two, a chat message mentioned version three. Client work needs a single approval trail.",
        matchedKeywords: ["client feedback", "approval history"],
      },
      {
        displayName: "Freya Lindholm",
        status: "in_progress",
        title: "Independent brand designer",
        gender: "woman",
        qualificationScore: 89,
        location: "Stockholm, Sweden",
        briefIntro:
          "Designs identities for small food and retail brands and describes reconciling approval emails with chat decisions.",
        signal:
          "Client approved the packaging direction in a chat thread, then replied to a two-week-old email with different changes. I spent the evening working out which version is real. How do other brand designers keep one source of truth?",
        matchedKeywords: ["client feedback", "brand approvals"],
      },
      {
        displayName: "Rafael Ortiz",
        status: "contacted",
        title: "Freelance web designer",
        gender: "man",
        qualificationScore: 84,
        platform: "twitter",
        location: "Valencia, Spain",
        briefIntro:
          "Builds marketing sites for small studios and chases revision requests across WhatsApp, email, and shared folders.",
        signal:
          "Three clients, three revision flows: WhatsApp messages, long email threads, and a shared folder nobody organises. Yesterday I shipped the wrong header because a chat change never made it to my list.",
        matchedKeywords: ["website revisions", "client feedback"],
      },
      {
        displayName: "Aoife Byrne",
        status: "in_progress",
        title: "Freelance product designer",
        gender: "woman",
        qualificationScore: 87,
        location: "Dublin, Ireland",
        briefIntro:
          "Designs dashboards for early-stage teams and wants a clearer record of who approved which screen.",
        signal:
          "The product team signs off in Slack, the founder emails changes, and the brief lives in a doc. Rebuilding the decision trail before every handoff takes longer than the redesign itself.",
        matchedKeywords: ["design reviews", "client feedback"],
      },
      {
        displayName: "Karim Mansour",
        status: "in_progress",
        title: "Independent web designer",
        gender: "man",
        qualificationScore: 81,
        platform: "twitter",
        location: "Cairo, Egypt",
        briefIntro:
          "Designs and maintains sites for local restaurants and clinics, with sign-off scattered across chat and documents.",
        signal:
          "Sign-off for a clinic booking page happened in a chat message, but change requests keep arriving in a shared document. Two sources of truth, one launch date next week.",
        matchedKeywords: ["approvals", "client feedback"],
      },
      {
        displayName: "Ginevra Moretti",
        status: "in_progress",
        title: "Freelance brand designer",
        gender: "woman",
        qualificationScore: 90,
        location: "Milan, Italy",
        briefIntro:
          "Runs a solo brand studio and describes comparing approval emails with chat messages before every client delivery.",
        signal:
          "Before every delivery I audit three places: the approval email, the chat thread, and the comments in the shared deck. Last week two of them disagreed. Freelancers, how do you record the final decision?",
        matchedKeywords: ["brand approvals", "approval history"],
      },
      {
        displayName: "Petr Novotny",
        status: "in_progress",
        title: "Freelance UI designer",
        gender: "man",
        qualificationScore: 76,
        platform: "twitter",
        location: "Prague, Czechia",
        briefIntro:
          "Designs interfaces for agency partners and tracks feedback across email threads and shared design files.",
        signal:
          "My agency partner sends feedback in email, their client comments in the design file, and sometimes both change the same screen. I need one ordered trail of what was actually decided.",
        matchedKeywords: ["design reviews", "website revisions"],
      },
      {
        displayName: "Ines Cardoso",
        status: "contacted",
        title: "Independent product designer",
        gender: "woman",
        qualificationScore: 88,
        location: "Porto, Portugal",
        briefIntro:
          "Designs web products for small clients and wants client decisions kept beside the screens they changed.",
        signal:
          "A client approved last Tuesday's flow in email, then requested the old version in chat on Friday. I keep a spreadsheet of decisions now, which tells me the tooling is wrong.",
        matchedKeywords: ["client feedback", "approval history"],
      },
      {
        displayName: "Amélie Roussel",
        title: "Freelance brand and web designer",
        gender: "woman",
        qualificationScore: 86,
        status: "contacted",
        platform: "twitter",
        location: "Lyon, France",
        briefIntro:
          "Works with boutique clients and describes losing revision rounds between two inboxes and a chat app.",
        signal:
          "One client, two inboxes, and a chat app: the homepage revision nobody can find. I now write approvals down by hand. What do other freelance designers send clients so decisions stay clear?",
        matchedKeywords: ["approval history", "client feedback"],
      },
      {
        displayName: "Andrés Ramos",
        status: "contacted",
        title: "Independent web designer",
        gender: "man",
        qualificationScore: 83,
        location: "Bogotá, Colombia",
        briefIntro:
          "Designs sites for independent shops and reconciles chat approvals with email change requests every week.",
        signal:
          "The shop owner approved the checkout design in chat, then emailed a change list that contradicted it. Reconciling the two took my whole Monday. How do solo designers keep one approval trail?",
        matchedKeywords: ["client feedback", "approvals"],
      },
      {
        displayName: "Zainab Haddad",
        status: "in_progress",
        title: "Independent brand designer",
        gender: "woman",
        qualificationScore: 90,
        location: "Amman, Jordan",
        briefIntro:
          "Designs brands for family businesses and wants feedback and approvals kept in order, not scattered across apps.",
        signal:
          "A family business approved the wordmark in email, then the son sent different notes in chat. I need one place where feedback and approvals stay in order. What works for your studio?",
        matchedKeywords: ["brand approvals", "client feedback"],
      },
      {
        displayName: "Anton Lindgren",
        title: "Freelance web designer",
        gender: "man",
        qualificationScore: 78,
        platform: "twitter",
        location: "Stockholm, Sweden",
        briefIntro:
          "Builds portfolio sites for creatives and tracks revision requests across chat, email, and a shared sheet.",
        signal:
          "Revision requests arrive in chat, approvals in email, and I still keep the tracker in a shared sheet I gave up on. There must be a simpler way to keep client work in one place.",
        matchedKeywords: ["website revisions", "client feedback"],
      },
      {
        displayName: "Yuki Tanabe",
        status: "contacted",
        title: "Freelance product designer",
        gender: "woman",
        qualificationScore: 85,
        location: "Osaka, Japan",
        briefIntro:
          "Designs web apps for small teams and describes piecing client reviews together from comments, email, and calls.",
        signal:
          "This week's client review: comments in the design file, decisions in email, and the rest on a call nobody wrote down. Assembling the timeline took longer than the fixes.",
        matchedKeywords: ["design reviews", "client feedback"],
      },
      {
        displayName: "Owen Hartley",
        status: "in_progress",
        title: "Independent web designer",
        gender: "man",
        qualificationScore: 82,
        platform: "twitter",
        location: "Manchester, UK",
        briefIntro:
          "Designs sites for local trades and describes sign-off living in chat while change requests arrive by email.",
        signal:
          "Sign-off for a trade client's booking page happened in a chat message; the change requests keep arriving by email. Two sources of truth and a launch date that will not move.",
        matchedKeywords: ["approvals", "website revisions"],
      },
      {
        displayName: "Camille Aubert",
        title: "Freelance brand designer",
        gender: "woman",
        qualificationScore: 87,
        location: "Nantes, France",
        briefIntro:
          "Designs identities for independent retailers and wants a single approval trail per project.",
        signal:
          "A retailer approved version two by email while their manager mentioned version three in chat. Client work needs one approval trail, not my memory of three conversations.",
        matchedKeywords: ["approval history", "brand approvals"],
      },
      {
        displayName: "Arjun Mehta",
        title: "Freelance UI designer",
        gender: "man",
        qualificationScore: 84,
        status: "in_progress",
        platform: "twitter",
        location: "Bengaluru, India",
        briefIntro:
          "Designs interfaces for SaaS founders and reconciles chat feedback with emailed approval lists each sprint.",
        signal:
          "The founder sends UI feedback in chat at midnight and the approved scope arrives by email two days later. Every sprint starts with reconciling the two. How do other freelance UI designers handle this?",
        matchedKeywords: ["client feedback", "design reviews"],
      },
      {
        displayName: "Elif Demir",
        status: "contacted",
        title: "Independent product designer",
        gender: "woman",
        qualificationScore: 88,
        location: "Istanbul, Türkiye",
        briefIntro:
          "Designs mobile and web products for small clients and wants approvals recorded beside the work.",
        signal:
          "A client approved the onboarding flow in email, then their developer sent contradictory notes in chat. I started saving screenshots of every approval. There has to be a better way.",
        matchedKeywords: ["approval history", "client feedback"],
      },
      {
        displayName: "Lucas Girard",
        title: "Freelance web designer",
        gender: "man",
        qualificationScore: 79,
        platform: "twitter",
        location: "Montreal, Canada",
        briefIntro:
          "Builds sites for independent restaurants and chases approvals across email, chat, and printed notes.",
        signal:
          "One restaurant client approves on paper, one by email, one in chat. Three projects, three approval trails, zero of them searchable. Freelancers, how do you keep this straight?",
        matchedKeywords: ["website revisions", "approvals"],
      },
      {
        displayName: "Mariana Vega",
        status: "in_progress",
        title: "Independent brand designer",
        gender: "woman",
        qualificationScore: 86,
        location: "Mexico City, Mexico",
        briefIntro:
          "Runs a solo identity studio and compares client approvals across email threads and chat before every delivery.",
        signal:
          "Delivery day audit: the approval email, the WhatsApp thread, and the comments in the shared deck. Two of three disagreed last week. How do solo brand designers record the final call?",
        matchedKeywords: ["brand approvals", "approval history"],
      },
      {
        displayName: "Mateus Silva",
        status: "contacted",
        title: "Freelance product designer",
        gender: "man",
        qualificationScore: 82,
        platform: "twitter",
        location: "Lisbon, Portugal",
        briefIntro:
          "Designs dashboards for small clients and tracks decisions scattered across chat, email, and design comments.",
        signal:
          "Client decisions live in chat, email, and design comments. Yesterday I rebuilt the decision trail from screenshots before a handoff. There should be one ordered record of what was approved.",
        matchedKeywords: ["design reviews", "client feedback"],
      },
      {
        displayName: "Elsa Lindqvist",
        title: "Independent web designer",
        gender: "woman",
        qualificationScore: 90,
        location: "Malmö, Sweden",
        briefIntro:
          "Designs sites for small businesses and wants feedback and sign-off kept together with the project.",
        signal:
          "A client signed off in chat, then emailed changes the same afternoon. I keep one document per project now, but approvals still arrive everywhere else. What does your sign-off flow look like?",
        matchedKeywords: ["client feedback", "approvals"],
      },
      {
        displayName: "Felix Braun",
        title: "Freelance brand and web designer",
        gender: "man",
        qualificationScore: 81,
        platform: "twitter",
        location: "Berlin, Germany",
        briefIntro:
          "Works with startup clients on brand and web and describes revision rounds lost between email and chat.",
        signal:
          "Startup clients approve in chat, then their ops lead emails a different change list. Last round I shipped the wrong landing page for two days. One approval trail would have caught it.",
        matchedKeywords: ["approval history", "website revisions"],
      },
      {
        displayName: "Ayesha Karim",
        title: "Independent UI designer",
        gender: "woman",
        qualificationScore: 85,
        location: "Dubai, United Arab Emirates",
        briefIntro:
          "Designs interfaces for independent studios and wants client feedback collected in one ordered place.",
        signal:
          "Feedback arrives in chat, approvals in email, and the brief lives in a shared drive. I spend the first hour of every review reconnecting the three. How do other UI designers centralise this?",
        matchedKeywords: ["client feedback", "design reviews"],
      },
    ],
  },
  "find-investors": {
    useCaseKey: "investor_outreach",
    workspace: "Investors — clinic software pre-seed",
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
    workspace: "Research — independent tutors",
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
    workspace: "Partners — client-feedback workshop",
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
    workspace: "Creators — developer launch",
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
    workspace: "Community — app feedback group",
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
    workspace: "Podcast guests — first-hire stories",
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
    platform: person.platform ?? platform,
    handle:
      (person.platform ?? platform) === "twitter"
        ? demoHandle(person.displayName)
        : `fictional-${person.displayName.toLowerCase().replaceAll(" ", "-")}`,
    hoursAgo: index + 1,
    matchedKeywords: person.matchedKeywords ?? [],
  });
  if (
    ["Alex Rivera", "Daniel Park", "Owen Clarke"].includes(person.displayName)
  ) {
    prospect.qualificationStatus = "disqualified";
    prospect.qualificationScore = 28;
    prospect.status = "archived";
    prospect.pipelineStage = "archived";
    prospect.qualificationReasoning = `Excluded: ${person.briefIntro}`;
  }
  return applyDemoPortrait(prospect);
}
