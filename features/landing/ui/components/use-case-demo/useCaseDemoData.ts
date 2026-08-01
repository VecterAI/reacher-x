/**
 * Use Case Demo Data
 * Mock prospect datasets for the interactive landing page demo.
 * Mirrors the shape of real prospect docs so the demo stays honest
 * when the schema evolves (typechecking is the drift guard).
 */
import type { Doc, Id } from "@/convex/_generated/dataModel";

export type UseCaseDemoKey =
  | "customers"
  | "investors"
  | "candidates"
  | "creators"
  | "job_seekers";

export interface UseCaseDemoDataset {
  key: UseCaseDemoKey;
  label: string;
  prospects: Doc<"prospects">[];
}

// Fake IDs that look like Convex IDs (same pattern as features/prospects/lib/mockData.ts)
const fakeId = (suffix: string) => `use_case_demo_${suffix}` as Id<"prospects">;

const HOUR_MS = 60 * 60 * 1000;
// Client and server must build the same mock records during hydration.
// A live clock here changes semantic attributes such as <time dateTime>.
export const USE_CASE_DEMO_REFERENCE_TIME = Date.UTC(2026, 7, 1, 18, 0, 0);
const BASE_TIME = USE_CASE_DEMO_REFERENCE_TIME;

/**
 * Real portrait photos (Unsplash, cropped to faces) so demo avatars look
 * like real people. Gender matches the prospect's name. Verified reachable.
 */
const DEMO_AVATAR_URLS: Record<string, string> = {
  priyabuilds:
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  marianalopez:
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  aisharahman:
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  elenavinvests:
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  graceliu:
    "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  sofiamarchetti:
    "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  isafontaine:
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  hannahschmidt:
    "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  laurajimenez:
    "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  ninapetrova:
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  amaradiallo:
    "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  petranovak:
    "https://images.unsplash.com/photo-1546961329-78bef0414d7c?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  mariagonzalez:
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  tanyaiyer:
    "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  emiliarossi:
    "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  danielokafor:
    "https://images.unsplash.com/photo-1463453091185-61582044d556?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  tombeckerhq:
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  jonasweber:
    "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  marcusthorne:
    "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  omarhaddad:
    "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  benkowalski:
    "https://images.unsplash.com/photo-1545167622-3a6ac756afa4?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  kwamemensah:
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  rajpatelml:
    "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  derekvaughn:
    "https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  jakemorrison:
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  leotanaka:
    "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  samwhitfield:
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  felixandersen:
    "https://images.unsplash.com/photo-1521119989659-a83eee488004?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  jordanblake:
    "https://images.unsplash.com/photo-1552058544-f2b08422138a?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
  noahfitzgerald:
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=256&h=256&fit=crop&crop=faces&auto=format&q=80",
};

const twitterAvatar = (handle: string) =>
  DEMO_AVATAR_URLS[handle] ??
  `https://pbs.twimg.com/profile_images/use_case_demo/${handle}.jpg`;
const linkedinAvatar = (handle: string) =>
  DEMO_AVATAR_URLS[handle] ??
  `https://media.licdn.com/dms/image/use_case_demo/${handle}.jpg`;

interface MakeProspectOptions {
  key: string;
  platform: "twitter" | "linkedin";
  displayName: string;
  /** Twitter screen name or LinkedIn profile slug */
  handle: string;
  title: string;
  briefIntro: string;
  /** The public post that surfaced this prospect */
  signal: string;
  qualificationScore: number;
  /** Roughly when the signal was posted */
  hoursAgo: number;
  matchedKeywords: string[];
  status?: "new" | "contacted" | "in_progress";
  company?: string;
  websiteUrl?: string;
  location?: string;
  verified?: boolean;
  /** LinkedIn author headline (falls back to title) */
  headline?: string;
  finance?: { displayValue: string; type: string };
  pain?: string;
  solution?: string;
}

function makeProspect(options: MakeProspectOptions): Doc<"prospects"> {
  const {
    key,
    platform,
    displayName,
    handle,
    title,
    briefIntro,
    signal,
    qualificationScore,
    hoursAgo,
    matchedKeywords,
    status = "new",
    company,
    websiteUrl,
    location,
    verified = false,
    headline,
    finance,
    pain,
    solution,
  } = options;

  const postedAt = BASE_TIME - hoursAgo * HOUR_MS;
  const postedAtIso = new Date(postedAt).toISOString();
  const externalId = `${platform}_${key}`;

  const signalPost =
    platform === "twitter"
      ? {
          id_str: externalId,
          full_text: signal,
          tweet_created_at: postedAtIso,
          user: {
            name: displayName,
            screen_name: handle,
            profile_image_url_https: twitterAvatar(handle),
            verified,
          },
          favorite_count: 42,
          retweet_count: 8,
          reply_count: 5,
        }
      : {
          postID: externalId,
          text: signal,
          author: {
            name: displayName,
            profilePictureURL: linkedinAvatar(handle),
            url: `https://linkedin.com/in/${handle}`,
            headline: headline ?? title,
          },
          postedAt: { timestamp: postedAt },
          engagements: {
            totalReactions: 96,
            commentsCount: 18,
            repostsCount: 6,
          },
        };

  return {
    _id: fakeId(key),
    _creationTime: postedAt,
    workspaceId: "use_case_demo_workspace" as Id<"workspaces">,
    userId: "use_case_demo_user" as Id<"users">,
    platform,
    externalId,
    status,
    updatedAt: postedAt,
    origin: "workspace_discovery",
    discoverySource: "search_post",

    displayName,
    title,
    briefIntro,
    prospectType: "individual",
    qualificationScore,
    qualificationStatus: "qualified",
    company,
    websiteUrl,
    location,
    pipelineStage: status,
    finance: finance
      ? {
          displayValue: finance.displayValue,
          type: finance.type,
          evidencePosts: [signalPost],
        }
      : undefined,
    painPoints: pain
      ? [{ pain, solution, evidencePosts: [signalPost] }]
      : undefined,
    evidencePosts: [signalPost],
    socialProfiles:
      platform === "twitter"
        ? {
            twitter: { username: handle, url: `https://x.com/${handle}` },
          }
        : {
            linkedin: {
              username: handle,
              url: `https://linkedin.com/in/${handle}`,
            },
          },
    matchedKeywords,

    data: signalPost,
  };
}

export const USE_CASE_DEMO_DATASETS: UseCaseDemoDataset[] = [
  {
    key: "customers",
    label: "Customers",
    prospects: [
      makeProspect({
        key: "customers_1",
        platform: "twitter",
        displayName: "Priya Nair",
        handle: "priyabuilds",
        title: "Head of Growth at Loopstack",
        briefIntro:
          "Posted asking for recommendations on tools to find early customers for a B2B SaaS. Runs growth at a seed-stage startup.",
        signal:
          "We have a product people love and no idea how to find more of them. What are teams using to find early customers in 2026? Tired of buying dead lead lists.",
        qualificationScore: 94,
        hoursAgo: 3,
        matchedKeywords: ["find customers", "B2B SaaS", "growth"],
        company: "Loopstack",
        websiteUrl: "https://loopstack.io",
        location: "Toronto, Canada",
        verified: true,
        finance: { displayValue: "$18k MRR", type: "mrr" },
        pain: "Cannot find early customers without buying stale lead lists",
        solution: "Find people already asking for what Loopstack sells",
      }),
      makeProspect({
        key: "customers_2",
        platform: "twitter",
        displayName: "Daniel Okafor",
        handle: "danielokafor",
        title: "Founder at Fleetbase",
        briefIntro:
          "Complained that cold outreach reply rates dropped under 1% this quarter. Bootstrapping a logistics SaaS.",
        signal:
          "Cold email reply rates at Fleetbase just dropped under 1%. 400 emails, 3 replies, 0 meetings. There has to be a better way to reach people who actually need this.",
        qualificationScore: 88,
        hoursAgo: 9,
        matchedKeywords: ["cold outreach", "reply rate", "founder"],
        company: "Fleetbase",
        location: "Lagos, Nigeria",
        pain: "Cold outreach reply rates dropped under 1%",
        solution: "Warm, signal-based outreach instead of cold blasts",
      }),
      makeProspect({
        key: "customers_3",
        platform: "linkedin",
        displayName: "Mariana López",
        handle: "marianalopez",
        title: "VP Sales at Clarion Health",
        briefIntro:
          "Shared that her SDR team spends half the week building lists by hand. Wants that time back for actual conversations.",
        signal:
          "My SDR team spends almost half the week building lists by hand. That is time they should spend talking to prospects. Evaluating tools that find and qualify leads automatically this quarter.",
        qualificationScore: 82,
        hoursAgo: 26,
        matchedKeywords: ["SDR", "list building", "lead qualification"],
        company: "Clarion Health",
        websiteUrl: "https://clarionhealth.com",
        location: "Austin, TX",
        headline: "VP Sales at Clarion Health | Scaling outbound",
        finance: { displayValue: "$3.2M ARR", type: "arr" },
        pain: "SDRs lose half the week to manual list building",
        solution: "Automated discovery and qualification of prospects",
      }),
      makeProspect({
        key: "customers_4",
        platform: "twitter",
        displayName: "Tom Becker",
        handle: "tombeckerhq",
        title: "Solo founder, template shop",
        briefIntro:
          "Posted about hiring his first SDR. Does all sales himself today and is hitting a ceiling.",
        signal:
          "Thinking about hiring my first SDR. I do all sales myself right now and I am the bottleneck. Either I hire or I find a smarter way to do outbound.",
        qualificationScore: 76,
        hoursAgo: 41,
        matchedKeywords: ["hiring SDR", "solo founder", "outbound"],
        location: "Berlin, Germany",
        pain: "Founder is the sales bottleneck and cannot afford a hire yet",
        solution: "Agent-run outreach before the first sales hire",
      }),
      makeProspect({
        key: "customers_5",
        platform: "linkedin",
        displayName: "Aisha Rahman",
        handle: "aisharahman",
        title: "Growth Lead at Papertrail",
        briefIntro:
          "Asked how teams monitor X and LinkedIn for buying signals. Already convinced of the approach, looking for tooling.",
        signal:
          "How are teams monitoring X and LinkedIn for buying signals? We know our best customers hang out here. Feels like we are missing conversations every day.",
        qualificationScore: 91,
        hoursAgo: 55,
        matchedKeywords: ["buying signals", "social listening", "growth"],
        status: "contacted",
        company: "Papertrail",
        location: "London, UK",
        headline: "Growth Lead at Papertrail",
        pain: "Missing buying conversations happening on social platforms",
        solution: "Around the clock monitoring of X and LinkedIn for intent",
      }),
      makeProspect({
        key: "customers_6",
        platform: "twitter",
        displayName: "Jonas Weber",
        handle: "jonasweber",
        title: "CEO at Klarheit",
        briefIntro:
          "Shared they are switching off their current lead database. Actively evaluating replacements.",
        signal:
          "Turning off our lead database this month. Half the contacts bounce and the other half already talked to three competitors. Looking for something built on live signals instead.",
        qualificationScore: 68,
        hoursAgo: 70,
        matchedKeywords: ["lead database", "switching tools", "CEO"],
        status: "in_progress",
        company: "Klarheit",
        location: "Munich, Germany",
      }),
    ],
  },
  {
    key: "investors",
    label: "Investors",
    prospects: [
      makeProspect({
        key: "investors_1",
        platform: "twitter",
        displayName: "Elena Vásquez",
        handle: "elenavinvests",
        title: "Partner at Northseed Ventures",
        briefIntro:
          "Posted her investment thesis on developer tools. Actively meeting pre-seed and seed founders this quarter.",
        signal:
          "My 2026 thesis: the best dev tools get adopted bottom-up long before a sales team shows up. If you are building this, I want to meet you before your seed round is obvious.",
        qualificationScore: 95,
        hoursAgo: 5,
        matchedKeywords: ["investment thesis", "dev tools", "seed"],
        company: "Northseed Ventures",
        websiteUrl: "https://northseed.vc",
        location: "San Francisco, CA",
        verified: true,
        finance: { displayValue: "$25M fund", type: "funding" },
      }),
      makeProspect({
        key: "investors_2",
        platform: "twitter",
        displayName: "Marcus Thorne",
        handle: "marcusthorne",
        title: "Angel investor, ex-payments operator",
        briefIntro:
          "Shared he is raising a rolling fund for pre-seed SaaS. Writes small, fast checks.",
        signal:
          "Kicking off a rolling fund for pre-seed SaaS. Small checks, fast decisions, first money in. If you are pre-revenue but shipping, my DMs are open.",
        qualificationScore: 90,
        hoursAgo: 14,
        matchedKeywords: ["rolling fund", "pre-seed", "angel"],
        location: "New York, NY",
        pain: "Wants early access to pre-seed SaaS founders",
        solution: "Direct line to founders before rounds are public",
      }),
      makeProspect({
        key: "investors_3",
        platform: "linkedin",
        displayName: "Grace Liu",
        handle: "graceliu",
        title: "Principal at Founderwell",
        briefIntro:
          "Wrote about backing technical founders at seed. Sources deals through founder content on LinkedIn.",
        signal:
          "The best seed deals I have done started with a founder writing in public. If you are a technical founder sharing what you build, keep going. We read everything.",
        qualificationScore: 84,
        hoursAgo: 30,
        matchedKeywords: ["seed", "technical founders", "venture"],
        company: "Founderwell",
        location: "Singapore",
        headline: "Principal at Founderwell | Seed stage, technical founders",
      }),
      makeProspect({
        key: "investors_4",
        platform: "twitter",
        displayName: "Omar Haddad",
        handle: "omarhaddad",
        title: "Scout for a US seed fund",
        briefIntro:
          "Asked founders building dev tools to DM him. Runs scout checks for a larger fund.",
        signal:
          "Scouting again this year. Building a dev tool or infra product? DM me what you are working on. Especially interested in founders outside the usual hubs.",
        qualificationScore: 78,
        hoursAgo: 48,
        matchedKeywords: ["scout", "dev tools", "DM"],
        location: "Dubai, UAE",
      }),
      makeProspect({
        key: "investors_5",
        platform: "linkedin",
        displayName: "Sofia Marchetti",
        handle: "sofiamarchetti",
        title: "General Partner at Lumen Capital",
        briefIntro:
          "Announced a new $40M seed fund focused on applied AI. First-time GPs with an operator bench.",
        signal:
          "Excited to share Fund II at Lumen Capital: $40M for seed-stage applied AI companies. We lead rounds and get involved early. Our first ten investments start now.",
        qualificationScore: 97,
        hoursAgo: 60,
        matchedKeywords: ["new fund", "seed", "applied AI"],
        status: "contacted",
        company: "Lumen Capital",
        websiteUrl: "https://lumencapital.eu",
        location: "Milan, Italy",
        headline: "General Partner at Lumen Capital",
        verified: true,
        finance: { displayValue: "$40M fund", type: "funding" },
      }),
      makeProspect({
        key: "investors_6",
        platform: "twitter",
        displayName: "Ben Kowalski",
        handle: "benkowalski",
        title: "Solo angel, B2B software",
        briefIntro:
          "Posted a checklist for what he wants in a cold pitch. Takes meetings from cold outreach that follows it.",
        signal:
          "What I want in a cold pitch: one sentence on the problem, one on why now, one on you, and a link. I take 5 cold meetings a month from people who follow this.",
        qualificationScore: 63,
        hoursAgo: 90,
        matchedKeywords: ["angel investor", "cold pitch", "B2B"],
        status: "in_progress",
        location: "Chicago, IL",
      }),
    ],
  },
  {
    key: "candidates",
    label: "Candidates",
    prospects: [
      makeProspect({
        key: "candidates_1",
        platform: "twitter",
        displayName: "Isabelle Fontaine",
        handle: "isafontaine",
        title: "Senior frontend engineer",
        briefIntro:
          "Shared she is exploring senior frontend roles at early-stage startups after four years at a large infra company.",
        signal:
          "After 4 years I am officially exploring what is next. Senior frontend roles at early-stage startups, ideally design-heavy products. My DM is open.",
        qualificationScore: 92,
        hoursAgo: 4,
        matchedKeywords: ["open to work", "frontend", "startup"],
        location: "Paris, France",
        verified: true,
      }),
      makeProspect({
        key: "candidates_2",
        platform: "linkedin",
        displayName: "Kwame Mensah",
        handle: "kwamemensah",
        title: "Backend engineer, ex-fintech",
        briefIntro:
          "Wrote about leaving big tech for a seed-stage team. Wants ownership over a salary bump.",
        signal:
          "Six years in big tech taught me how systems scale. Now I want to build one from zero. Looking for backend roles at seed-stage teams where ownership beats process.",
        qualificationScore: 86,
        hoursAgo: 18,
        matchedKeywords: ["backend", "seed stage", "open to roles"],
        location: "Accra, Ghana",
        headline: "Backend Engineer | Distributed systems | Open to work",
      }),
      makeProspect({
        key: "candidates_3",
        platform: "twitter",
        displayName: "Hannah Schmidt",
        handle: "hannahschmidt",
        title: "Product designer",
        briefIntro:
          "Posted her portfolio and said she is taking on founding designer roles. Previously first design hire at a SaaS startup.",
        signal:
          "Updated my portfolio and I am officially looking for founding designer roles. I was the first design hire at my last startup and took it from MVP to Series A. Link in bio.",
        qualificationScore: 89,
        hoursAgo: 33,
        matchedKeywords: ["founding designer", "portfolio", "product design"],
        location: "Amsterdam, Netherlands",
      }),
      makeProspect({
        key: "candidates_4",
        platform: "twitter",
        displayName: "Raj Patel",
        handle: "rajpatelml",
        title: "ML engineer",
        briefIntro:
          "Asked which startups are hiring applied LLM engineers. Two years of production LLM systems.",
        signal:
          "Which startups are actually hiring applied LLM engineers right now? Two years shipping production RAG and eval systems. Tired of roles that turn out to be prompt babysitting.",
        qualificationScore: 81,
        hoursAgo: 50,
        matchedKeywords: ["ML engineer", "LLM", "hiring"],
        location: "Bangalore, India",
      }),
      makeProspect({
        key: "candidates_5",
        platform: "linkedin",
        displayName: "Laura Jiménez",
        handle: "laurajimenez",
        title: "Growth marketer",
        briefIntro:
          "Shared she is looking for her first head-of-growth role after five years running PLG motion at a SaaS scale-up.",
        signal:
          "Five years running product-led growth, two promotions, one exit. Ready for my first Head of Growth role at an early-stage SaaS. Introductions welcome.",
        qualificationScore: 74,
        hoursAgo: 75,
        matchedKeywords: ["head of growth", "PLG", "SaaS"],
        status: "contacted",
        location: "Madrid, Spain",
        headline: "Growth Marketer | PLG | Open to Head of Growth roles",
      }),
      makeProspect({
        key: "candidates_6",
        platform: "twitter",
        displayName: "Derek Vaughn",
        handle: "derekvaughn",
        title: "Developer advocate",
        briefIntro:
          "Posted about wanting to join a dev tools startup. Runs a small but active community of 4k developers.",
        signal:
          "I want my next role to be DevRel at a dev tools startup. I run a 4k developer community and I have opinions about docs. Who is hiring?",
        qualificationScore: 66,
        hoursAgo: 100,
        matchedKeywords: ["DevRel", "dev tools", "hiring"],
        status: "in_progress",
        location: "Portland, OR",
      }),
    ],
  },
  {
    key: "creators",
    label: "Creators",
    prospects: [
      makeProspect({
        key: "creators_1",
        platform: "twitter",
        displayName: "Nina Petrova",
        handle: "ninapetrova",
        title: "Tech YouTuber, 210k subscribers",
        briefIntro:
          "Posted asking for new SaaS tools to review. Her reviews drive measurable signup spikes for indie products.",
        signal:
          "Planning next month of videos. Which new SaaS tools should I review? Bonus points for products built by small teams doing something genuinely different.",
        qualificationScore: 93,
        hoursAgo: 6,
        matchedKeywords: ["SaaS review", "YouTube", "creator"],
        location: "Warsaw, Poland",
        verified: true,
      }),
      makeProspect({
        key: "creators_2",
        platform: "twitter",
        displayName: "Jake Morrison",
        handle: "jakemorrison",
        title: "Indie hacking newsletter, 38k readers",
        briefIntro:
          "Shared he is looking for products to feature in his weekly tools section. Features are free if he likes the product.",
        signal:
          "Slotting products into the weekly tools section of the newsletter. What did you ship that 38k indie hackers should know about? No sponsored slots here, I only feature what I would use.",
        qualificationScore: 87,
        hoursAgo: 16,
        matchedKeywords: ["newsletter", "product feature", "indie hackers"],
        location: "Denver, CO",
      }),
      makeProspect({
        key: "creators_3",
        platform: "linkedin",
        displayName: "Amara Diallo",
        handle: "amaradiallo",
        title: "LinkedIn creator, future of work",
        briefIntro:
          "Asked her 90k followers which AI tools actually save time. Planning a deep-dive series on the winners.",
        signal:
          "Which AI tools actually save you time at work? Not the demo, the daily use. Collecting answers for a deep-dive series. The best submissions get featured with the founders.",
        qualificationScore: 83,
        hoursAgo: 28,
        matchedKeywords: ["AI tools", "creator", "future of work"],
        location: "Nairobi, Kenya",
        headline: "Creator | Future of Work | 90k followers",
      }),
      makeProspect({
        key: "creators_4",
        platform: "twitter",
        displayName: "Leo Tanaka",
        handle: "leotanaka",
        title: "Developer content creator",
        briefIntro:
          "Posted a thread about his favorite founder tools and asked for more. Threads regularly pass 100k views.",
        signal:
          "Thread: 7 tools I use every week as a founder who codes. Number 4 saved me 10 hours. What am I missing? Reply with your favorites and I will cover the best ones.",
        qualificationScore: 79,
        hoursAgo: 44,
        matchedKeywords: ["founder tools", "thread", "dev content"],
        location: "Tokyo, Japan",
      }),
      makeProspect({
        key: "creators_5",
        platform: "linkedin",
        displayName: "Petra Novak",
        handle: "petranovak",
        title: "Host, Bootstrapped Stories podcast",
        briefIntro:
          "Looking for founders building outreach and sales tools to interview. Episodes feature the product in context.",
        signal:
          "Booking guests for the next season of Bootstrapped Stories. Founders building sales, outreach, or distribution tools: tell me what you are building and why now.",
        qualificationScore: 71,
        hoursAgo: 65,
        matchedKeywords: ["podcast", "founders", "sales tools"],
        status: "contacted",
        location: "Prague, Czech Republic",
        headline: "Podcast Host | Bootstrapped Stories",
      }),
      makeProspect({
        key: "creators_6",
        platform: "twitter",
        displayName: "Sam Whitfield",
        handle: "samwhitfield",
        title: "Newsletter writer, solo tools reviews",
        briefIntro:
          "Posted that he tests one new tool each week and writes up the honest results. Small but loyal audience of builders.",
        signal:
          "Week 12 of testing one new tool every week and writing the honest review. Queue is open again. Send me your product, especially if it is weird.",
        qualificationScore: 61,
        hoursAgo: 95,
        matchedKeywords: ["tool review", "newsletter", "weekly"],
        status: "in_progress",
        location: "Melbourne, Australia",
      }),
    ],
  },
  {
    key: "job_seekers",
    label: "Job seekers",
    prospects: [
      makeProspect({
        key: "job_seekers_1",
        platform: "twitter",
        displayName: "María González",
        handle: "mariagonzalez",
        title: "Senior product manager",
        briefIntro:
          "Posted she was affected by layoffs and is open to product roles. Eight years across B2B SaaS.",
        signal:
          "Affected by the layoffs this week. Eight years of B2B SaaS product, two zero-to-one launches. Open to senior PM roles, remote or Barcelona. Grateful for any intros.",
        qualificationScore: 90,
        hoursAgo: 2,
        matchedKeywords: ["open to work", "product manager", "laid off"],
        location: "Barcelona, Spain",
        verified: true,
      }),
      makeProspect({
        key: "job_seekers_2",
        platform: "linkedin",
        displayName: "Felix Andersen",
        handle: "felixandersen",
        title: "Full-stack engineer",
        briefIntro:
          "Shared he is open to work at mission-driven startups. Five years of TypeScript and Go in production.",
        signal:
          "Open to work. Full-stack engineer, five years of TypeScript and Go in production. Looking for mission-driven startups where the code matters and the mission matters more.",
        qualificationScore: 85,
        hoursAgo: 12,
        matchedKeywords: ["open to work", "full-stack", "startup"],
        location: "Copenhagen, Denmark",
        headline: "Full-Stack Engineer | TypeScript, Go | Open to work",
      }),
      makeProspect({
        key: "job_seekers_3",
        platform: "twitter",
        displayName: "Tanya Iyer",
        handle: "tanyaiyer",
        title: "Data scientist, applied AI",
        briefIntro:
          "Asked for intros to teams hiring for applied AI roles. Published on evaluation methods for LLM products.",
        signal:
          "Looking for my next applied AI role. I build evaluation systems that tell you if the model actually works. Intros to teams hiring for this are very welcome.",
        qualificationScore: 88,
        hoursAgo: 22,
        matchedKeywords: ["applied AI", "data science", "hiring"],
        location: "Toronto, Canada",
      }),
      makeProspect({
        key: "job_seekers_4",
        platform: "twitter",
        displayName: "Jordan Blake",
        handle: "jordanblake",
        title: "SDR, 2 years in SaaS sales",
        briefIntro:
          "Posted about looking for his next sales role at a startup. Hit quota eight quarters in a row.",
        signal:
          "Two years as an SDR, quota eight quarters straight, and I am ready for a startup where I can grow into an AE role. Who is building a sales team right now?",
        qualificationScore: 72,
        hoursAgo: 38,
        matchedKeywords: ["SDR", "sales role", "startup"],
        location: "Dublin, Ireland",
      }),
      makeProspect({
        key: "job_seekers_5",
        platform: "linkedin",
        displayName: "Emilia Rossi",
        handle: "emiliarossi",
        title: "Brand designer",
        briefIntro:
          "Announced she is taking on full-time roles after three years of freelance. Portfolio spans dev tools and fintech.",
        signal:
          "After three years of freelancing I am ready to go full-time with one team. Brand and product design for dev tools and fintech. Portfolio in the comments.",
        qualificationScore: 77,
        hoursAgo: 58,
        matchedKeywords: ["brand designer", "full-time", "portfolio"],
        status: "contacted",
        location: "Milan, Italy",
        headline: "Brand Designer | Open to full-time roles",
      }),
      makeProspect({
        key: "job_seekers_6",
        platform: "twitter",
        displayName: "Noah Fitzgerald",
        handle: "noahfitzgerald",
        title: "Recent CS graduate",
        briefIntro:
          "Shared his portfolio and asked for junior backend opportunities. Shipped two open source projects with real users.",
        signal:
          "Graduated in May, shipped two open source projects with real users, and I am looking for junior backend roles. I learn fast and I read the docs. Portfolio attached.",
        qualificationScore: 64,
        hoursAgo: 80,
        matchedKeywords: ["junior backend", "graduate", "open source"],
        status: "in_progress",
        location: "Boston, MA",
      }),
    ],
  },
];

// ============================================================================
// Demo outreach plans (for profile plan sections and card progress badges)
// ============================================================================

import type { OutreachPlanCardTask } from "@/features/prospects/ui/components/outreach-plan";
import type { NotificationItem } from "@/features/webapp/ui/components/notifications/NotificationsInbox";
import { getProspectDisplayData } from "@/features/prospects/lib/getProspectDisplayData";

export interface DemoOutreachPlan {
  status: "draft" | "executing";
  rationale: string;
  tasks: OutreachPlanCardTask[];
  /** Progress summary rendered as the plan-state badge on prospect cards. */
  outreachProgress: Doc<"prospectSummaries">["outreachProgress"];
}

function makePlan(input: {
  status: "draft" | "executing";
  rationale: string;
  tasks: Array<{
    type: "comment" | "dm" | "wait";
    description: string;
    status: string;
    content?: string;
  }>;
}): DemoOutreachPlan {
  const tasks: OutreachPlanCardTask[] = input.tasks.map((task, index) => ({
    _id: `demo_task_${index + 1}`,
    order: index + 1,
    type: task.type,
    description: task.description,
    status: task.status,
    approvalReady: task.status === "waiting_manual",
    content: task.content,
  }));
  const finishedTaskCount = input.tasks.filter(
    (task) => task.status === "completed"
  ).length;
  const activeTaskIndex = input.tasks.findIndex(
    (task) => task.status !== "completed" && task.status !== "pending"
  );
  const activeTask =
    activeTaskIndex >= 0 ? input.tasks[activeTaskIndex] : undefined;

  return {
    status: input.status,
    rationale: input.rationale,
    tasks,
    outreachProgress: {
      planStatus: input.status,
      finishedTaskCount,
      totalTaskCount: tasks.length,
      activeTask: activeTask
        ? {
            order: activeTaskIndex + 1,
            type: activeTask.type,
            description: activeTask.description,
            status: activeTask.status as never,
            awaitingApproval: activeTask.status === "waiting_manual",
          }
        : undefined,
    },
  };
}

/** Keyed by prospect `_id`. Only a few prospects per use case have plans. */
export const USE_CASE_DEMO_PLANS: Record<string, DemoOutreachPlan> = {
  use_case_demo_customers_1: makePlan({
    status: "draft",
    rationale:
      "Priya is actively asking for customer-discovery tooling, so lead with the exact signal and offer a short loom-style walkthrough instead of a pitch.",
    tasks: [
      {
        type: "comment",
        description: "Reply to her tool-recommendations thread",
        status: "waiting_manual",
        content:
          "We had the same problem at my last startup. Ended up building an agent that watches X and LinkedIn for people asking exactly this. Happy to show you what it finds for Loopstack, no strings.",
      },
      {
        type: "wait",
        description: "Wait 2 days for a reply",
        status: "pending",
      },
      {
        type: "dm",
        description: "Send a short DM with a sample match list",
        status: "pending",
      },
    ],
  }),
  use_case_demo_customers_5: makePlan({
    status: "executing",
    rationale:
      "Aisha is already sold on signal-based selling. Skip the education step and show what monitoring uncovers for Papertrail this week.",
    tasks: [
      {
        type: "comment",
        description: "Reply to her buying-signals question",
        status: "completed",
      },
      {
        type: "dm",
        description: "Send three example matches from this week",
        status: "waiting_manual",
        content:
          "Thanks for the conversation yesterday. Here are three people asking for exactly what Papertrail sells this week. Want me to keep the monitor running?",
      },
      {
        type: "wait",
        description: "Wait for her response before follow-up",
        status: "pending",
      },
    ],
  }),
  use_case_demo_investors_1: makePlan({
    status: "draft",
    rationale:
      "Elena published her thesis publicly. Reference one specific point from it and show why this company fits, instead of sending a generic deck ask.",
    tasks: [
      {
        type: "comment",
        description: "Reply to her dev-tools thesis post",
        status: "waiting_manual",
        content:
          "Your point about bottom-up adoption before sales shows up is exactly what we are seeing. We find those early believers for founders. Would love 15 minutes when you are back from SF.",
      },
      {
        type: "wait",
        description: "Wait 3 days for a reply",
        status: "pending",
      },
      {
        type: "dm",
        description: "Send the one-page memo",
        status: "pending",
      },
    ],
  }),
  use_case_demo_investors_5: makePlan({
    status: "executing",
    rationale:
      "Sofia just announced Fund II and is deploying now. Speed matters more than polish here; get a warm, specific note in front of her this week.",
    tasks: [
      {
        type: "comment",
        description: "Congratulate on Fund II with a specific takeaway",
        status: "completed",
      },
      {
        type: "dm",
        description: "Send the pitch with traction snapshot",
        status: "waiting_manual",
        content:
          "Congratulations on Fund II. We help seed-stage teams find their first believers on X and LinkedIn. 40 teams use it weekly. Worth a short call?",
      },
      {
        type: "wait",
        description: "Wait for her response before follow-up",
        status: "pending",
      },
    ],
  }),
  use_case_demo_candidates_1: makePlan({
    status: "draft",
    rationale:
      "Isabelle wants design-heavy early-stage products. Lead with the design culture and the actual product surface she would own, not the job spec.",
    tasks: [
      {
        type: "comment",
        description: "Reply to her exploring-roles post",
        status: "waiting_manual",
        content:
          "We are two people and design is half the product here. You would own the whole surface, not a lane. Can I show you what you would be working on?",
      },
      {
        type: "wait",
        description: "Wait 2 days for a reply",
        status: "pending",
      },
      {
        type: "dm",
        description: "Share the role and product walkthrough",
        status: "pending",
      },
    ],
  }),
  use_case_demo_candidates_5: makePlan({
    status: "executing",
    rationale:
      "Laura wants a first head-of-growth seat. Position the role around ownership of the whole funnel and reference her PLG exit directly.",
    tasks: [
      {
        type: "comment",
        description: "Reply to her head-of-growth announcement",
        status: "completed",
      },
      {
        type: "dm",
        description: "Send the role outline with funnel ownership",
        status: "waiting_manual",
        content:
          "Your PLG run is exactly the motion we need built from zero. This is full funnel ownership, small team, direct line to the founders. Open to a chat this week?",
      },
      {
        type: "wait",
        description: "Wait for her response before follow-up",
        status: "pending",
      },
    ],
  }),
  use_case_demo_creators_1: makePlan({
    status: "draft",
    rationale:
      "Nina reviews tools on camera. Offer a real account with real matches so the review has substance, and let her keep whatever it finds.",
    tasks: [
      {
        type: "comment",
        description: "Reply to her review-requests thread",
        status: "waiting_manual",
        content:
          "Built by a team of two, does one thing: finds the people already asking for your product. Happy to set up a real account for the review and you keep whatever it finds.",
      },
      {
        type: "wait",
        description: "Wait 2 days for a reply",
        status: "pending",
      },
      {
        type: "dm",
        description: "Send access details and talking points",
        status: "pending",
      },
    ],
  }),
  use_case_demo_creators_5: makePlan({
    status: "executing",
    rationale:
      "Petra books founders for her podcast. Pitch the story angle, not the product: bootstrapped outreach automation without a sales team.",
    tasks: [
      {
        type: "comment",
        description: "Reply to her guest-booking post",
        status: "completed",
      },
      {
        type: "dm",
        description: "Pitch the episode angle with three talking points",
        status: "waiting_manual",
        content:
          "Bootstrapped, no sales team, and our agent does the outbound for us. Happy to share the whole story, including the parts that flopped. Fit for a season episode?",
      },
      {
        type: "wait",
        description: "Wait for her response before follow-up",
        status: "pending",
      },
    ],
  }),
  use_case_demo_job_seekers_1: makePlan({
    status: "draft",
    rationale:
      "María has zero-to-one launches and is available now. Move fast with a concrete PM scope and reference her Barcelona/remote preference.",
    tasks: [
      {
        type: "comment",
        description: "Reply to her open-to-work post",
        status: "waiting_manual",
        content:
          "We need exactly that zero-to-one PM muscle. Small team, remote-first, and the roadmap is yours to shape. Can I send over what the first 90 days would look like?",
      },
      {
        type: "wait",
        description: "Wait 2 days for a reply",
        status: "pending",
      },
      {
        type: "dm",
        description: "Send the 90-day scope",
        status: "pending",
      },
    ],
  }),
  use_case_demo_job_seekers_5: makePlan({
    status: "executing",
    rationale:
      "Emilia wants one team after freelancing. Emphasize brand ownership across product and marketing, and reference her dev-tools portfolio.",
    tasks: [
      {
        type: "comment",
        description: "Reply to her full-time announcement",
        status: "completed",
      },
      {
        type: "dm",
        description: "Share the brand scope and team setup",
        status: "waiting_manual",
        content:
          "Your dev-tools portfolio is the exact taste level we need. You would own the brand end to end, product included. Worth a call this week?",
      },
      {
        type: "wait",
        description: "Wait for her response before follow-up",
        status: "pending",
      },
    ],
  }),
};

// ============================================================================
// Demo summary records (cards render plan-state badges from summaries)
// ============================================================================

/** Build the summary read-model record the real list pages feed to cards. */
export function toDemoProspectSummary(
  prospect: Doc<"prospects">,
  plan?: DemoOutreachPlan
): Doc<"prospectSummaries"> {
  const identity = getProspectDisplayData(prospect);
  return {
    _id: `${prospect._id}_summary` as Doc<"prospectSummaries">["_id"],
    _creationTime: prospect._creationTime,
    prospectId: prospect._id,
    workspaceId: prospect.workspaceId,
    userId: prospect.userId,
    platform: prospect.platform,
    origin: prospect.origin,
    status: prospect.status,
    pipelineStage: prospect.pipelineStage,
    qualificationStatus: prospect.qualificationStatus,
    qualifiedAt: prospect.qualifiedAt,
    planGenerationStatus: plan ? "completed" : prospect.planGenerationStatus,
    outreachProgress: plan?.outreachProgress,
    readyQualifiedEnriched: true,
    sortQualificationScore: prospect.qualificationScore ?? 0,
    qualificationScore: prospect.qualificationScore,
    prospectCreatedAt: prospect._creationTime,
    updatedAt: prospect.updatedAt,
    displayName: prospect.displayName ?? "Unknown",
    title: prospect.title,
    briefIntro: prospect.briefIntro,
    websiteUrl: prospect.websiteUrl,
    websiteHref: prospect.websiteHref,
    websiteDisplayText: prospect.websiteDisplayText,
    bioUrlEntities: prospect.bioUrlEntities,
    matchedKeywords: prospect.matchedKeywords,
    location: prospect.location,
    financeDisplayValue: prospect.finance?.displayValue,
    prospectType: prospect.prospectType,
    avatarUrl: identity.avatarUrl,
    profileUrl: identity.profileUrl,
    twitterUsername: identity.twitterUsername,
    linkedInUsername: identity.linkedinUsername,
    verified: identity.verified,
    conversationPlaceholderLabel: identity.conversationPlaceholderLabel,
    discoverySource: prospect.discoverySource,
    searchText: "",
  };
}

// ============================================================================
// Demo notifications (per use case, referencing that dataset's people)
// ============================================================================

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function getDemoNotifications(
  dataset: UseCaseDemoDataset
): NotificationItem[] {
  const first = dataset.prospects[0];
  const contacted =
    dataset.prospects.find((prospect) => prospect.status === "contacted") ??
    dataset.prospects[1];
  const entityPluralLower = dataset.label.toLowerCase();

  return [
    {
      _id: `demo_notification_${dataset.key}_1`,
      _creationTime: BASE_TIME - 2 * HOUR,
      type: "ask_human",
      title: "Plan needs your approval",
      message: `△ Agent drafted an outreach plan for ${first.displayName}. Review the tasks before anything goes out.`,
      status: "pending",
      actionLabel: "Review plan",
      prospectId: first._id,
      prospectDisplayName: first.displayName,
      prospectPlatform: first.platform,
      prospectType: first.prospectType,
      eventUpdatedAt: BASE_TIME - 2 * HOUR,
    },
    {
      _id: `demo_notification_${dataset.key}_2`,
      _creationTime: BASE_TIME - 6 * HOUR,
      type: "prospect_replied",
      title: `${contacted.displayName} replied`,
      message:
        "Responded to your last message. The conversation is waiting for your input.",
      status: "pending",
      replyCount: 1,
      prospectId: contacted._id,
      prospectDisplayName: contacted.displayName,
      prospectPlatform: contacted.platform,
      prospectType: contacted.prospectType,
      eventUpdatedAt: BASE_TIME - 6 * HOUR,
    },
    {
      _id: `demo_notification_${dataset.key}_3`,
      _creationTime: BASE_TIME - DAY - 3 * HOUR,
      type: "prospects_found",
      title: `New ${entityPluralLower} found`,
      message: `△ Agent found 4 new ${entityPluralLower} matching your profile while you were away.`,
      status: "seen",
      eventUpdatedAt: BASE_TIME - DAY - 3 * HOUR,
    },
  ];
}

/** Pending (unseen) notification count for the header bell badge. */
export function getDemoPendingNotificationCount(
  dataset: UseCaseDemoDataset
): number {
  return getDemoNotifications(dataset).filter(
    (notification) => notification.status === "pending"
  ).length;
}
