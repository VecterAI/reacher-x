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
 * Real Unsplash face crops for demo avatars.
 * Handles are keyed 1:1 to prospect handles below. Gender (and rough
 * presentation) matches the prospect name — verified by downloading each
 * portrait before wiring it in.
 */
const unsplashFace = (photoId: string) =>
  `https://images.unsplash.com/${photoId}?w=256&h=256&fit=crop&crop=faces&auto=format&q=80`;

/** Gender-keyed face pools for volume fill. IDs verified as reachable portraits. */
const WOMAN_FACES = [
  "photo-1607746882042-944635dfe10e",
  "photo-1544005313-94ddf0286df2",
  "photo-1580489944761-15a19d654956",
  "photo-1573496359142-b8d87734a5a2",
  "photo-1534528741775-53994a69daeb",
  "photo-1487412720507-e7ab37603c6f",
  "photo-1524504388940-b1c1722653e1",
  "photo-1489424731084-a5d8b219a5bb",
  "photo-1551836022-d5d88e9218df",
  "photo-1517841905240-472988babdf9",
  "photo-1589156280159-27698a70f29e",
  "photo-1546961329-78bef0414d7c",
  "photo-1438761681033-6461ffad8d80",
  "photo-1573497019236-17f8177b81e8",
  "photo-1573497019940-1c28c88b4f3e",
  "photo-1494790108377-be9c29b29330",
  "photo-1548142813-c348350df52b",
  "photo-1529626455594-4ff0802cfb7e",
  "photo-1531746020798-e6953c6e8e04",
  "photo-1508214751196-bcfd4ca60f91",
  "photo-1531123897727-8f129e1688ce",
  "photo-1502823403499-6ccfcf4fb453",
  "photo-1542596594-649edbc13630",
  "photo-1500917293891-ef795e70e1f6",
  "photo-1559839734-2b71ea197ec2",
  "photo-1531427186611-ecfd6d936c79",
] as const;

const MAN_FACES = [
  "photo-1463453091185-61582044d556",
  "photo-1472099645785-5658abf4ff4e",
  "photo-1547425260-76bcadfb4f2c",
  "photo-1560250097-0b93528c311a",
  "photo-1599566150163-29194dcaad36",
  "photo-1545167622-3a6ac756afa4",
  "photo-1487222477894-8943e31ef7b2",
  "photo-1539571696357-5a69c17a67c6",
  "photo-1542909168-82c3e7fdca5c",
  "photo-1506794778202-cad84cf45f1d",
  "photo-1492562080023-ab3db95bfbce",
  "photo-1507003211169-0a1dd7228f2d",
  "photo-1521119989659-a83eee488004",
  "photo-1552058544-f2b08422138a",
  "photo-1519085360753-af0119f7cbe7",
  "photo-1633332755192-727a05c4013d",
  "photo-1570295999919-56ceb5ecca61",
  "photo-1500648767791-00dcc994a43e",
  "photo-1519345182560-3f2917c472ef",
  "photo-1568602471122-7832951cc4c5",
  "photo-1522075469751-3a6694fb2f61",
  "photo-1566492031773-4f4e44671857",
] as const;

const faceCursor = { woman: 0, man: 0 };

function nextFaceUrl(gender: "woman" | "man"): string {
  const pool = gender === "woman" ? WOMAN_FACES : MAN_FACES;
  const photoId = pool[faceCursor[gender] % pool.length];
  faceCursor[gender] += 1;
  return unsplashFace(photoId);
}

const DEMO_AVATAR_URLS: Record<string, string> = {
  // Women
  priyabuilds: unsplashFace("photo-1607746882042-944635dfe10e"),
  marianalopez: unsplashFace("photo-1544005313-94ddf0286df2"),
  aisharahman: unsplashFace("photo-1580489944761-15a19d654956"),
  elenavinvests: unsplashFace("photo-1573496359142-b8d87734a5a2"),
  graceliu: unsplashFace("photo-1534528741775-53994a69daeb"),
  sofiamarchetti: unsplashFace("photo-1487412720507-e7ab37603c6f"),
  isafontaine: unsplashFace("photo-1524504388940-b1c1722653e1"),
  hannahschmidt: unsplashFace("photo-1489424731084-a5d8b219a5bb"),
  laurajimenez: unsplashFace("photo-1551836022-d5d88e9218df"),
  ninapetrova: unsplashFace("photo-1517841905240-472988babdf9"),
  amaradiallo: unsplashFace("photo-1589156280159-27698a70f29e"),
  petranovak: unsplashFace("photo-1546961329-78bef0414d7c"),
  mariagonzalez: unsplashFace("photo-1438761681033-6461ffad8d80"),
  tanyaiyer: unsplashFace("photo-1573497019236-17f8177b81e8"),
  emiliarossi: unsplashFace("photo-1573497019940-1c28c88b4f3e"),
  camilaruiz: unsplashFace("photo-1494790108377-be9c29b29330"),
  yukisato: unsplashFace("photo-1548142813-c348350df52b"),
  fatimabello: unsplashFace("photo-1573497019236-17f8177b81e8"),
  chloedupont: unsplashFace("photo-1529626455594-4ff0802cfb7e"),
  nadiakovacs: unsplashFace("photo-1531746020798-e6953c6e8e04"),
  oliviahart: unsplashFace("photo-1508214751196-bcfd4ca60f91"),
  mayachen: unsplashFace("photo-1551836022-d5d88e9218df"),
  zaraokonkwo: unsplashFace("photo-1531123897727-8f129e1688ce"),
  sophielaurent: unsplashFace("photo-1489424731084-a5d8b219a5bb"),
  ivychen: unsplashFace("photo-1502823403499-6ccfcf4fb453"),
  // Men
  danielokafor: unsplashFace("photo-1463453091185-61582044d556"),
  tombeckerhq: unsplashFace("photo-1472099645785-5658abf4ff4e"),
  jonasweber: unsplashFace("photo-1547425260-76bcadfb4f2c"),
  marcusthorne: unsplashFace("photo-1560250097-0b93528c311a"),
  omarhaddad: unsplashFace("photo-1599566150163-29194dcaad36"),
  benkowalski: unsplashFace("photo-1545167622-3a6ac756afa4"),
  kwamemensah: unsplashFace("photo-1487222477894-8943e31ef7b2"),
  rajpatelml: unsplashFace("photo-1539571696357-5a69c17a67c6"),
  derekvaughn: unsplashFace("photo-1542909168-82c3e7fdca5c"),
  jakemorrison: unsplashFace("photo-1506794778202-cad84cf45f1d"),
  leotanaka: unsplashFace("photo-1492562080023-ab3db95bfbce"),
  samwhitfield: unsplashFace("photo-1507003211169-0a1dd7228f2d"),
  felixandersen: unsplashFace("photo-1521119989659-a83eee488004"),
  jordanblake: unsplashFace("photo-1552058544-f2b08422138a"),
  noahfitzgerald: unsplashFace("photo-1519085360753-af0119f7cbe7"),
  lucasmeyer: unsplashFace("photo-1633332755192-727a05c4013d"),
  andrejnovak: unsplashFace("photo-1570295999919-56ceb5ecca61"),
  kenjitanaka: unsplashFace("photo-1500648767791-00dcc994a43e"),
  matthewhughes: unsplashFace("photo-1519345182560-3f2917c472ef"),
  carlosmendez: unsplashFace("photo-1568602471122-7832951cc4c5"),
  ethanbrooks: unsplashFace("photo-1522075469751-3a6694fb2f61"),
  owenblake: unsplashFace("photo-1633332755192-727a05c4013d"),
  hugomartins: unsplashFace("photo-1570295999919-56ceb5ecca61"),
  ryanokada: unsplashFace("photo-1500648767791-00dcc994a43e"),
  masonreed: unsplashFace("photo-1519345182560-3f2917c472ef"),
};

function resolveAvatarUrl(handle: string, gender?: "woman" | "man"): string {
  if (DEMO_AVATAR_URLS[handle]) {
    return DEMO_AVATAR_URLS[handle];
  }
  if (gender) {
    return nextFaceUrl(gender);
  }
  return `https://pbs.twimg.com/profile_images/use_case_demo/${handle}.jpg`;
}

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
  /** Used to pick a face when the handle is not in DEMO_AVATAR_URLS. */
  gender?: "woman" | "man";
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
    gender,
  } = options;

  const postedAt = BASE_TIME - hoursAgo * HOUR_MS;
  const postedAtIso = new Date(postedAt).toISOString();
  const externalId = `${platform}_${key}`;
  const avatarUrl = resolveAvatarUrl(handle, gender);

  const signalPost =
    platform === "twitter"
      ? {
          id_str: externalId,
          full_text: signal,
          tweet_created_at: postedAtIso,
          user: {
            name: displayName,
            screen_name: handle,
            profile_image_url_https: avatarUrl,
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
            profilePictureURL: avatarUrl,
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

const USE_CASE_DEMO_CORE_DATASETS: UseCaseDemoDataset[] = [
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
      makeProspect({
        key: "customers_7",
        platform: "twitter",
        displayName: "Camila Ruiz",
        handle: "camilaruiz",
        title: "Co-founder at Northline",
        briefIntro:
          "Posted that inbound slowed and she needs a repeatable way to find buyers who already feel the pain.",
        signal:
          "Inbound dried up after we stopped running ads. Looking for a repeatable way to find buyers who already feel the pain, not another spray-and-pray sequence.",
        qualificationScore: 85,
        hoursAgo: 11,
        matchedKeywords: ["inbound", "find buyers", "co-founder"],
        company: "Northline",
        location: "Mexico City, Mexico",
        finance: { displayValue: "$42k MRR", type: "mrr" },
        pain: "Inbound dried up and outbound feels like spray-and-pray",
        solution:
          "Signal-based discovery of people already describing the pain",
      }),
      makeProspect({
        key: "customers_8",
        platform: "linkedin",
        displayName: "Lucas Meyer",
        handle: "lucasmeyer",
        title: "Head of Sales at Arcbound",
        briefIntro:
          "Wrote that his team wastes hours chasing leads that never had intent. Evaluating intent-based tools this quarter.",
        signal:
          "Our team wastes hours chasing leads that never had intent. Evaluating tools that surface people already talking about the problem we solve. Recommendations welcome.",
        qualificationScore: 79,
        hoursAgo: 34,
        matchedKeywords: ["intent", "sales tools", "lead quality"],
        company: "Arcbound",
        location: "Zurich, Switzerland",
        headline: "Head of Sales at Arcbound | Intent-led outbound",
        pain: "Sales team chases leads with no real intent",
        solution: "Prioritize people already discussing the problem publicly",
      }),
      makeProspect({
        key: "customers_9",
        platform: "twitter",
        displayName: "Nadia Kovacs",
        handle: "nadiakovacs",
        title: "Founder, compliance ops SaaS",
        briefIntro:
          "Asked for tools that find compliance buyers before they hit a vendor shortlist. Selling into mid-market fintech.",
        signal:
          "Anyone finding compliance buyers before they hit a vendor shortlist? We sell into mid-market fintech and LinkedIn search is not cutting it anymore.",
        qualificationScore: 73,
        hoursAgo: 52,
        matchedKeywords: ["compliance buyers", "fintech", "founder"],
        status: "contacted",
        location: "Budapest, Hungary",
        pain: "Cannot reach compliance buyers before they shortlist vendors",
        solution: "Catch buying conversations earlier on X and LinkedIn",
      }),
      makeProspect({
        key: "customers_10",
        platform: "linkedin",
        displayName: "Carlos Méndez",
        handle: "carlosmendez",
        title: "Revenue lead at Fieldkit",
        briefIntro:
          "Shared that reply rates from purchased lists collapsed. Looking for live social signals instead of static CSVs.",
        signal:
          "Purchased lists are dead for us. Reply rates collapsed. Looking for anything that works off live social signals instead of another static CSV.",
        qualificationScore: 64,
        hoursAgo: 88,
        matchedKeywords: ["reply rates", "social signals", "revenue"],
        status: "in_progress",
        company: "Fieldkit",
        location: "Bogotá, Colombia",
        headline: "Revenue Lead at Fieldkit",
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
      makeProspect({
        key: "investors_7",
        platform: "linkedin",
        displayName: "Yuki Sato",
        handle: "yukisato",
        title: "Partner at Harborline Ventures",
        briefIntro:
          "Wrote she is meeting seed founders building GTM infrastructure. Prefers operator-led decks over polished fundraising narratives.",
        signal:
          "Spending this quarter meeting seed founders building GTM infrastructure. Prefer operator-led decks over polished fundraising narratives. If that is you, say hello.",
        qualificationScore: 92,
        hoursAgo: 8,
        matchedKeywords: ["seed", "GTM", "partner"],
        company: "Harborline Ventures",
        location: "Tokyo, Japan",
        headline: "Partner at Harborline Ventures | Seed GTM",
        finance: { displayValue: "$60M fund", type: "funding" },
      }),
      makeProspect({
        key: "investors_8",
        platform: "twitter",
        displayName: "Andrej Novak",
        handle: "andrejnovak",
        title: "Angel, ex-SaaS CRO",
        briefIntro:
          "Posted he writes first checks for B2B teams with proof of outbound working. Wants real pipeline metrics in the first note.",
        signal:
          "Writing first checks again for B2B teams that already have outbound working. Send pipeline metrics, not a vision slide. If reply rates are real, I want to talk.",
        qualificationScore: 81,
        hoursAgo: 27,
        matchedKeywords: ["angel", "B2B", "outbound"],
        location: "Ljubljana, Slovenia",
      }),
      makeProspect({
        key: "investors_9",
        platform: "linkedin",
        displayName: "Fatima Bello",
        handle: "fatimabello",
        title: "Principal at Sahel Ventures",
        briefIntro:
          "Announced she is sourcing pre-seed AI tools for African and diaspora founders. Actively taking intros this month.",
        signal:
          "Sourcing pre-seed AI tools for African and diaspora founders this month. If you are building something that makes go-to-market less painful, I want the intro.",
        qualificationScore: 88,
        hoursAgo: 46,
        matchedKeywords: ["pre-seed", "AI tools", "sourcing"],
        status: "contacted",
        company: "Sahel Ventures",
        location: "Lagos, Nigeria",
        headline: "Principal at Sahel Ventures",
      }),
      makeProspect({
        key: "investors_10",
        platform: "twitter",
        displayName: "Matthew Hughes",
        handle: "matthewhughes",
        title: "Scout, Bay Area seed fund",
        briefIntro:
          "Asked founders selling into sales teams to DM him. Runs scout checks and moves fast on warm intros.",
        signal:
          "Scouting founders selling into sales teams right now. If your product helps reps find or close better, DM me. Fast checks, warm intros into the partnership team.",
        qualificationScore: 70,
        hoursAgo: 102,
        matchedKeywords: ["scout", "sales tools", "seed"],
        status: "in_progress",
        location: "San Francisco, CA",
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
      makeProspect({
        key: "candidates_7",
        platform: "linkedin",
        displayName: "Chloe Dupont",
        handle: "chloedupont",
        title: "Staff product engineer",
        briefIntro:
          "Shared she is open to founding-engineer roles after eight years shipping B2B products. Wants ownership over process.",
        signal:
          "Eight years shipping B2B products and I am ready for a founding-engineer seat. I want ownership over process, not another ticket queue. Introductions welcome.",
        qualificationScore: 90,
        hoursAgo: 7,
        matchedKeywords: ["founding engineer", "B2B", "open to roles"],
        location: "Montreal, Canada",
        headline: "Staff Product Engineer | Open to founding roles",
      }),
      makeProspect({
        key: "candidates_8",
        platform: "twitter",
        displayName: "Kenji Tanaka",
        handle: "kenjitanaka",
        title: "Platform engineer",
        briefIntro:
          "Asked which startups need someone who has built internal tooling for sales teams. Tired of infra work with no product contact.",
        signal:
          "Which startups need a platform engineer who has built internal tooling for sales teams? Tired of infra work with zero product contact. Ready to move.",
        qualificationScore: 83,
        hoursAgo: 24,
        matchedKeywords: ["platform engineer", "internal tools", "hiring"],
        location: "Osaka, Japan",
      }),
      makeProspect({
        key: "candidates_9",
        platform: "linkedin",
        displayName: "Olivia Hart",
        handle: "oliviahart",
        title: "Customer success lead",
        briefIntro:
          "Wrote she wants her first CS leadership role at a seed-stage SaaS. Built a playbook that cut churn in half.",
        signal:
          "Built a CS playbook that cut churn in half at my last company. Looking for my first Customer Success leadership role at a seed-stage SaaS. Happy to share the playbook.",
        qualificationScore: 76,
        hoursAgo: 58,
        matchedKeywords: ["customer success", "seed stage", "leadership"],
        status: "contacted",
        location: "Vienna, Austria",
        headline: "CS Lead | Open to Head of CS roles",
      }),
      makeProspect({
        key: "candidates_10",
        platform: "twitter",
        displayName: "Ethan Brooks",
        handle: "ethanbrooks",
        title: "Full-stack engineer, TypeScript",
        briefIntro:
          "Posted his GitHub and said he wants a small team where he can own features end to end. Four years of Next.js and Convex.",
        signal:
          "Four years of TypeScript, Next.js, and Convex. Looking for a small team where I own features end to end, not a lane on a 40-person eng org. Portfolio and GitHub in bio.",
        qualificationScore: 71,
        hoursAgo: 96,
        matchedKeywords: ["full-stack", "TypeScript", "small team"],
        status: "in_progress",
        location: "Austin, TX",
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
      makeProspect({
        key: "creators_7",
        platform: "linkedin",
        displayName: "Maya Chen",
        handle: "mayachen",
        title: "LinkedIn creator, B2B sales",
        briefIntro:
          "Asked her 120k audience which outbound tools are worth the hype. Planning a roundup post with founder quotes.",
        signal:
          "Which outbound tools are actually worth the hype in 2026? Collecting founder quotes for a roundup. If your product changed how your team sells, I want to hear it.",
        qualificationScore: 86,
        hoursAgo: 10,
        matchedKeywords: ["outbound tools", "B2B sales", "creator"],
        location: "Buenos Aires, Argentina",
        headline: "Creator | B2B Sales | 120k followers",
      }),
      makeProspect({
        key: "creators_8",
        platform: "twitter",
        displayName: "Owen Blake",
        handle: "owenblake",
        title: "Indie hacker YouTuber, 85k subs",
        briefIntro:
          "Posted a call for products to screen-record in his next build-in-public video. Prefers tools with a clear before/after.",
        signal:
          "Filming next month's build-in-public videos. Need products with a clear before/after I can screen-record. Small teams preferred. Reply with a link and one sentence on the pain.",
        qualificationScore: 80,
        hoursAgo: 31,
        matchedKeywords: ["YouTube", "build in public", "product demo"],
        location: "Berlin, Germany",
      }),
      makeProspect({
        key: "creators_9",
        platform: "linkedin",
        displayName: "Zara Okonkwo",
        handle: "zaraokonkwo",
        title: "Host, African Founders podcast",
        briefIntro:
          "Booking guests who built distribution without a sales team. Episodes highlight the exact playbook, not the pitch.",
        signal:
          "Booking guests who built distribution without a sales team. If your playbook is messy and real, I want that episode. DMs open for the next season.",
        qualificationScore: 74,
        hoursAgo: 62,
        matchedKeywords: ["podcast", "distribution", "founders"],
        status: "contacted",
        location: "Accra, Ghana",
        headline: "Podcast Host | African Founders",
      }),
      makeProspect({
        key: "creators_10",
        platform: "twitter",
        displayName: "Hugo Martins",
        handle: "hugomartins",
        title: "Substack writer, SaaS experiments",
        briefIntro:
          "Shared he features one underrated SaaS tool each Friday. Audience is operators who actually buy software.",
        signal:
          "Friday feature slot is open again. One underrated SaaS tool, honest write-up, no pay-to-play. Audience is operators who buy software, not lurkers.",
        qualificationScore: 67,
        hoursAgo: 110,
        matchedKeywords: ["Substack", "SaaS", "feature"],
        status: "in_progress",
        location: "Zagreb, Croatia",
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
      makeProspect({
        key: "job_seekers_7",
        platform: "linkedin",
        displayName: "Sophie Laurent",
        handle: "sophielaurent",
        title: "Product marketing manager",
        briefIntro:
          "Posted she is open to PMM roles after a reorg. Built launch motions for two B2B products from zero to GA.",
        signal:
          "Open to product marketing roles after the reorg. Built launch motions for two B2B products from zero to GA. Remote or Montreal. Grateful for intros.",
        qualificationScore: 84,
        hoursAgo: 9,
        matchedKeywords: ["product marketing", "open to work", "B2B"],
        location: "Montreal, Canada",
        headline: "PMM | B2B launches | Open to work",
      }),
      makeProspect({
        key: "job_seekers_8",
        platform: "twitter",
        displayName: "Ryan Okada",
        handle: "ryanokada",
        title: "SRE, cloud infrastructure",
        briefIntro:
          "Asked for intros to startups hiring SREs who have run on-call for developer platforms. Wants smaller blast radius than big tech.",
        signal:
          "Looking for SRE roles at startups running developer platforms. Five years of on-call, tired of big-tech blast radius. Want a team where reliability work is visible.",
        qualificationScore: 78,
        hoursAgo: 29,
        matchedKeywords: ["SRE", "on-call", "startup"],
        location: "Osaka, Japan",
      }),
      makeProspect({
        key: "job_seekers_9",
        platform: "linkedin",
        displayName: "Ivy Chen",
        handle: "ivychen",
        title: "Account executive, mid-market",
        briefIntro:
          "Shared she is looking for an AE seat at an early-stage SaaS after hitting President's Club twice.",
        signal:
          "Hit President's Club twice as a mid-market AE and I am ready for an early-stage seat where I can help build the motion, not just run it. Open to intros.",
        qualificationScore: 75,
        hoursAgo: 54,
        matchedKeywords: ["account executive", "SaaS", "open to work"],
        status: "contacted",
        location: "Denver, CO",
        headline: "AE | Mid-market SaaS | Open to work",
      }),
      makeProspect({
        key: "job_seekers_10",
        platform: "twitter",
        displayName: "Mason Reed",
        handle: "masonreed",
        title: "Junior designer, product",
        briefIntro:
          "Posted his portfolio after a bootcamp and asked for junior product design roles. Strong systems thinking, light shipping experience.",
        signal:
          "Just finished a product design bootcamp, shipped two case studies, and I am looking for junior product design roles. I think in systems and I take feedback well. Portfolio in bio.",
        qualificationScore: 58,
        hoursAgo: 105,
        matchedKeywords: ["junior designer", "portfolio", "product design"],
        status: "in_progress",
        location: "Nashville, TN",
      }),
    ],
  },
];

/**
 * Five extra rows per use case (10 core + 5 fill = 15 total) so the
 * 3-col demo grid feels full without endless scrolling.
 * Gender is explicit so every face comes from the matching Unsplash pool.
 */
interface FillSeed {
  displayName: string;
  gender: "woman" | "man";
  title: string;
  briefIntro: string;
  signal: string;
  qualificationScore: number;
  hoursAgo: number;
  matchedKeywords: string[];
  status?: "new" | "contacted" | "in_progress";
  company?: string;
  location?: string;
  platform?: "twitter" | "linkedin";
  finance?: { displayValue: string; type: string };
}

function handleFromName(name: string, suffix: string): string {
  const base = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return `${base}${suffix}`;
}

function buildFillProspects(
  useCaseKey: UseCaseDemoKey,
  seeds: FillSeed[]
): Doc<"prospects">[] {
  return seeds.map((seed, index) => {
    const n = index + 11;
    const handle = handleFromName(seed.displayName, String(n));
    return makeProspect({
      key: `${useCaseKey}_${n}`,
      platform: seed.platform ?? (index % 2 === 0 ? "twitter" : "linkedin"),
      displayName: seed.displayName,
      handle,
      title: seed.title,
      briefIntro: seed.briefIntro,
      signal: seed.signal,
      qualificationScore: seed.qualificationScore,
      hoursAgo: seed.hoursAgo,
      matchedKeywords: seed.matchedKeywords,
      status: seed.status ?? "new",
      company: seed.company,
      location: seed.location,
      headline: seed.title,
      finance: seed.finance,
      gender: seed.gender,
    });
  });
}

const CUSTOMER_FILL: FillSeed[] = [
  {
    displayName: "Helena Costa",
    gender: "woman",
    title: "Founder at Relink",
    briefIntro:
      "Asked which tools find buyers who already complain about manual prospecting. Selling a CRM add-on.",
    signal:
      "Looking for tools that find buyers who already complain about manual prospecting. We sell a CRM add-on and cold lists are a dead end.",
    qualificationScore: 87,
    hoursAgo: 4,
    matchedKeywords: ["buyers", "prospecting", "CRM"],
    company: "Relink",
    location: "Lisbon, Portugal",
    finance: { displayValue: "$11k MRR", type: "mrr" },
  },
  {
    displayName: "Victor Lang",
    gender: "man",
    title: "CRO at Stacklane",
    briefIntro:
      "Posted that his AE team is drowning in unqualified inbound. Wants signal scoring before handoff.",
    signal:
      "Our AEs are drowning in unqualified inbound. Need signal scoring before handoff or we keep burning quota on tire-kickers.",
    qualificationScore: 84,
    hoursAgo: 7,
    matchedKeywords: ["inbound", "signal scoring", "AE"],
    company: "Stacklane",
    location: "Seattle, WA",
  },
  {
    displayName: "Nora Berg",
    gender: "woman",
    title: "Growth at Brightform",
    briefIntro:
      "Shared she is ripping out their intent-data vendor. Looking for live social intent instead.",
    signal:
      "Ripping out our intent-data vendor this quarter. Looking for live social intent, not another black-box score.",
    qualificationScore: 90,
    hoursAgo: 12,
    matchedKeywords: ["intent data", "social intent", "growth"],
    company: "Brightform",
    location: "Stockholm, Sweden",
  },
  {
    displayName: "Ibrahim Saleh",
    gender: "man",
    title: "Solo founder, billing SaaS",
    briefIntro:
      "Complained that LinkedIn Sales Navigator is too noisy. Wants people already asking for billing tools.",
    signal:
      "Sales Navigator is noise. I need people already asking for billing tools, not another filtered title search.",
    qualificationScore: 81,
    hoursAgo: 15,
    matchedKeywords: ["Sales Navigator", "billing", "solo founder"],
    location: "Amman, Jordan",
  },
  {
    displayName: "Claire Dubois",
    gender: "woman",
    title: "VP Marketing at Nimbus Ops",
    briefIntro:
      "Wrote that content brings traffic but not buyers. Evaluating demand tools that start from public posts.",
    signal:
      "Content brings traffic, not buyers. Evaluating tools that start from public posts where people describe the pain we solve.",
    qualificationScore: 78,
    hoursAgo: 19,
    matchedKeywords: ["demand", "content", "buyers"],
    company: "Nimbus Ops",
    location: "Lyon, France",
  },
];

const INVESTOR_FILL: FillSeed[] = [
  {
    displayName: "Helena Costa",
    gender: "woman",
    title: "Partner at Atlantic Seed",
    briefIntro:
      "Posted her thesis on GTM infrastructure for technical founders. Taking meetings this month.",
    signal:
      "Thesis for 2026: GTM infrastructure for technical founders. Taking meetings this month if you are building in that lane.",
    qualificationScore: 94,
    hoursAgo: 3,
    matchedKeywords: ["GTM", "seed", "thesis"],
    company: "Atlantic Seed",
    location: "Lisbon, Portugal",
    finance: { displayValue: "$35M fund", type: "funding" },
  },
  {
    displayName: "Victor Lang",
    gender: "man",
    title: "Angel, ex-CRO",
    briefIntro:
      "Shared he writes $50k checks for pre-seed B2B with proof of outbound. Wants metrics in the first note.",
    signal:
      "Writing $50k checks for pre-seed B2B with proof of outbound. Send metrics in the first note or do not bother.",
    qualificationScore: 88,
    hoursAgo: 8,
    matchedKeywords: ["angel", "pre-seed", "outbound"],
    location: "Seattle, WA",
  },
  {
    displayName: "Nora Berg",
    gender: "woman",
    title: "Principal at Nordic Ventures",
    briefIntro:
      "Wrote she is sourcing applied AI tools for European founders. Prefers operator updates over decks.",
    signal:
      "Sourcing applied AI tools for European founders. Prefer operator updates over polished decks. DMs open.",
    qualificationScore: 91,
    hoursAgo: 11,
    matchedKeywords: ["applied AI", "Europe", "sourcing"],
    company: "Nordic Ventures",
    location: "Stockholm, Sweden",
  },
  {
    displayName: "Ibrahim Saleh",
    gender: "man",
    title: "Scout for a MENA seed fund",
    briefIntro:
      "Asked founders outside SF to DM him. Runs scout checks for a regional fund.",
    signal:
      "Scouting founders outside SF this year. Building in MENA or Europe? DM me what you ship. Fast checks.",
    qualificationScore: 79,
    hoursAgo: 16,
    matchedKeywords: ["scout", "MENA", "seed"],
    location: "Amman, Jordan",
  },
  {
    displayName: "Claire Dubois",
    gender: "woman",
    title: "GP at Lumière Capital",
    briefIntro:
      "Announced Fund I focused on sales and distribution software. Leading seed rounds now.",
    signal:
      "Excited to share Lumière Fund I: focused on sales and distribution software. Leading seed rounds starting now.",
    qualificationScore: 96,
    hoursAgo: 20,
    matchedKeywords: ["new fund", "sales software", "seed"],
    company: "Lumière Capital",
    location: "Lyon, France",
    finance: { displayValue: "$28M fund", type: "funding" },
  },
];

const CANDIDATE_FILL: FillSeed[] = [
  {
    displayName: "Helena Costa",
    gender: "woman",
    title: "Senior product designer",
    briefIntro:
      "Posted she is open to founding designer roles after five years in B2B SaaS.",
    signal:
      "Open to founding designer roles. Five years in B2B SaaS, two zero-to-one launches. Portfolio in bio.",
    qualificationScore: 91,
    hoursAgo: 3,
    matchedKeywords: ["founding designer", "B2B", "portfolio"],
    location: "Lisbon, Portugal",
  },
  {
    displayName: "Victor Lang",
    gender: "man",
    title: "Staff backend engineer",
    briefIntro:
      "Wrote he wants seed-stage ownership after eight years in big tech.",
    signal:
      "Eight years in big tech. Looking for seed-stage backend ownership where I can still touch production daily.",
    qualificationScore: 88,
    hoursAgo: 7,
    matchedKeywords: ["backend", "seed stage", "staff"],
    location: "Seattle, WA",
  },
  {
    displayName: "Nora Berg",
    gender: "woman",
    title: "Product manager",
    briefIntro:
      "Shared she is exploring PM roles at early-stage tools companies. Two zero-to-one launches.",
    signal:
      "Exploring PM roles at early-stage tools companies. Two zero-to-one launches. Intros welcome.",
    qualificationScore: 86,
    hoursAgo: 12,
    matchedKeywords: ["PM", "early-stage", "zero-to-one"],
    location: "Stockholm, Sweden",
  },
  {
    displayName: "Ibrahim Saleh",
    gender: "man",
    title: "Full-stack engineer",
    briefIntro:
      "Asked which startups need TypeScript generalists who have shipped billing systems.",
    signal:
      "Which startups need TypeScript generalists who have shipped billing systems? Ready to move this quarter.",
    qualificationScore: 83,
    hoursAgo: 16,
    matchedKeywords: ["TypeScript", "full-stack", "billing"],
    location: "Amman, Jordan",
  },
  {
    displayName: "Claire Dubois",
    gender: "woman",
    title: "Growth marketer",
    briefIntro:
      "Posted she wants her first growth lead seat after running PLG at a scale-up.",
    signal:
      "Ran PLG at a scale-up for four years. Ready for my first Growth Lead seat at an early-stage SaaS.",
    qualificationScore: 85,
    hoursAgo: 21,
    matchedKeywords: ["growth lead", "PLG", "SaaS"],
    location: "Lyon, France",
  },
];

const CREATOR_FILL: FillSeed[] = [
  {
    displayName: "Helena Costa",
    gender: "woman",
    title: "YouTuber, B2B tools, 140k subs",
    briefIntro:
      "Asked for new B2B tools to review on camera. Reviews drive signup spikes for indie products.",
    signal:
      "Planning next month of B2B tool reviews. Small teams with a clear before/after, reply with a link.",
    qualificationScore: 92,
    hoursAgo: 4,
    matchedKeywords: ["YouTube", "B2B tools", "review"],
    location: "Lisbon, Portugal",
  },
  {
    displayName: "Victor Lang",
    gender: "man",
    title: "Newsletter, sales ops, 22k readers",
    briefIntro:
      "Shared he features one underrated sales tool each week. Audience is operators who buy.",
    signal:
      "Weekly underrated sales tool feature is open. Audience is operators who buy software. No pay-to-play.",
    qualificationScore: 86,
    hoursAgo: 9,
    matchedKeywords: ["newsletter", "sales tools", "operators"],
    location: "Seattle, WA",
  },
  {
    displayName: "Nora Berg",
    gender: "woman",
    title: "LinkedIn creator, GTM",
    briefIntro:
      "Asked her 70k audience which outbound tools actually work. Planning a roundup.",
    signal:
      "Which outbound tools actually work in 2026? Collecting founder quotes for a roundup. 70k GTM audience.",
    qualificationScore: 88,
    hoursAgo: 13,
    matchedKeywords: ["LinkedIn", "outbound", "GTM"],
    location: "Stockholm, Sweden",
  },
  {
    displayName: "Ibrahim Saleh",
    gender: "man",
    title: "Podcast host, founder stories",
    briefIntro:
      "Booking guests who built distribution without a big sales team.",
    signal:
      "Booking guests who built distribution without a big sales team. Messy playbooks welcome.",
    qualificationScore: 81,
    hoursAgo: 18,
    matchedKeywords: ["podcast", "distribution", "founders"],
    location: "Amman, Jordan",
  },
  {
    displayName: "Claire Dubois",
    gender: "woman",
    title: "Substack, SaaS experiments",
    briefIntro:
      "Posted she tests one SaaS tool a week and writes the honest review.",
    signal:
      "Week 18 of testing one SaaS tool a week. Queue open again. Especially if the product is weird.",
    qualificationScore: 79,
    hoursAgo: 23,
    matchedKeywords: ["Substack", "SaaS", "review"],
    location: "Lyon, France",
  },
];

const JOB_SEEKER_FILL: FillSeed[] = [
  {
    displayName: "Helena Costa",
    gender: "woman",
    title: "Senior PM, B2B SaaS",
    briefIntro:
      "Posted she is open to senior PM roles after a reorg. Eight years of B2B product.",
    signal:
      "Open to senior PM roles after the reorg. Eight years of B2B product, two zero-to-one launches. Remote or Lisbon.",
    qualificationScore: 90,
    hoursAgo: 2,
    matchedKeywords: ["PM", "open to work", "B2B"],
    location: "Lisbon, Portugal",
  },
  {
    displayName: "Victor Lang",
    gender: "man",
    title: "Staff engineer",
    briefIntro:
      "Shared he is open to work after a layoff. Distributed systems and TypeScript.",
    signal:
      "Laid off this week. Staff engineer, distributed systems and TypeScript. Looking for mission-driven teams.",
    qualificationScore: 87,
    hoursAgo: 6,
    matchedKeywords: ["laid off", "staff engineer", "TypeScript"],
    location: "Seattle, WA",
  },
  {
    displayName: "Nora Berg",
    gender: "woman",
    title: "Product designer",
    briefIntro:
      "Asked for intros to teams hiring product designers. Strong systems thinking.",
    signal:
      "Looking for product design roles. Strong systems thinking, shipped two design systems. Intros welcome.",
    qualificationScore: 85,
    hoursAgo: 10,
    matchedKeywords: ["product designer", "design systems", "open to work"],
    location: "Stockholm, Sweden",
  },
  {
    displayName: "Ibrahim Saleh",
    gender: "man",
    title: "Full-stack engineer",
    briefIntro:
      "Posted his portfolio after finishing a contract. Looking for full-time startup roles.",
    signal:
      "Contract wrapped. Looking for full-time full-stack startup roles. TypeScript, React, and backend. Portfolio linked.",
    qualificationScore: 82,
    hoursAgo: 14,
    matchedKeywords: ["full-stack", "startup", "TypeScript"],
    location: "Amman, Jordan",
  },
  {
    displayName: "Claire Dubois",
    gender: "woman",
    title: "PMM",
    briefIntro:
      "Shared she is open to product marketing roles. Built two B2B launches from zero to GA.",
    signal:
      "Open to PMM roles. Built two B2B launches from zero to GA. Remote or France.",
    qualificationScore: 84,
    hoursAgo: 19,
    matchedKeywords: ["PMM", "B2B launches", "open to work"],
    location: "Lyon, France",
  },
];

const FILL_SEEDS_BY_USE_CASE: Record<UseCaseDemoKey, FillSeed[]> = {
  customers: CUSTOMER_FILL,
  investors: INVESTOR_FILL,
  candidates: CANDIDATE_FILL,
  creators: CREATOR_FILL,
  job_seekers: JOB_SEEKER_FILL,
};

export const USE_CASE_DEMO_DATASETS: UseCaseDemoDataset[] =
  USE_CASE_DEMO_CORE_DATASETS.map((dataset) => ({
    ...dataset,
    prospects: [
      ...dataset.prospects,
      ...buildFillProspects(dataset.key, FILL_SEEDS_BY_USE_CASE[dataset.key]),
    ],
  }));

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
  id: string;
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
    _id: `${input.id}_task_${index + 1}`,
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

/** New prospect: comment awaiting approval, then wait, then DM. */
function draftPlan(input: {
  id: string;
  rationale: string;
  commentDescription: string;
  commentContent: string;
  waitDays?: number;
  dmDescription: string;
}): DemoOutreachPlan {
  return makePlan({
    id: input.id,
    status: "draft",
    rationale: input.rationale,
    tasks: [
      {
        type: "comment",
        description: input.commentDescription,
        status: "waiting_manual",
        content: input.commentContent,
      },
      {
        type: "wait",
        description: `Wait ${input.waitDays ?? 2} days for a reply`,
        status: "pending",
      },
      {
        type: "dm",
        description: input.dmDescription,
        status: "pending",
      },
    ],
  });
}

/** Contacted: public comment done, DM awaiting approval. */
function contactedPlan(input: {
  id: string;
  rationale: string;
  commentDescription: string;
  dmDescription: string;
  dmContent: string;
}): DemoOutreachPlan {
  return makePlan({
    id: input.id,
    status: "executing",
    rationale: input.rationale,
    tasks: [
      {
        type: "comment",
        description: input.commentDescription,
        status: "completed",
      },
      {
        type: "dm",
        description: input.dmDescription,
        status: "waiting_manual",
        content: input.dmContent,
      },
      {
        type: "wait",
        description: "Wait for a response before follow-up",
        status: "pending",
      },
    ],
  });
}

/** In progress: comment + DM done, follow-up DM awaiting approval. */
function inProgressPlan(input: {
  id: string;
  rationale: string;
  commentDescription: string;
  dmDescription: string;
  followUpDescription: string;
  followUpContent: string;
}): DemoOutreachPlan {
  return makePlan({
    id: input.id,
    status: "executing",
    rationale: input.rationale,
    tasks: [
      {
        type: "comment",
        description: input.commentDescription,
        status: "completed",
      },
      {
        type: "dm",
        description: input.dmDescription,
        status: "completed",
      },
      {
        type: "wait",
        description: "Wait for their reply",
        status: "completed",
      },
      {
        type: "dm",
        description: input.followUpDescription,
        status: "waiting_manual",
        content: input.followUpContent,
      },
    ],
  });
}

/**
 * Keyed by prospect `_id`.
 * Coverage: every contacted + in_progress prospect, plus draft plans for
 * several high-fit "new" rows so the grid shows plan badges while scrolling.
 */
export const USE_CASE_DEMO_PLANS: Record<string, DemoOutreachPlan> = {
  // -------------------------------------------------------------------------
  // Customers
  // -------------------------------------------------------------------------
  use_case_demo_customers_1: draftPlan({
    id: "customers_1",
    rationale:
      "Priya is actively asking for customer-discovery tooling, so lead with the exact signal and offer a short loom-style walkthrough instead of a pitch.",
    commentDescription: "Reply to her tool-recommendations thread",
    commentContent:
      "We had the same problem at my last startup. Ended up building an agent that watches X and LinkedIn for people asking exactly this. Happy to show you what it finds for Loopstack, no strings.",
    dmDescription: "Send a short DM with a sample match list",
  }),
  use_case_demo_customers_2: draftPlan({
    id: "customers_2",
    rationale:
      "Daniel's cold email reply rate collapsed under 1%. Lead with that number and show warm, signal-based outreach as the alternative to another blast.",
    commentDescription: "Reply to his cold-email rant",
    commentContent:
      "Sub-1% is brutal. We stopped blasting and started commenting where people already complain about the problem. Happy to show what that looks like for Fleetbase.",
    dmDescription: "Share a sample of live logistics buyers",
  }),
  use_case_demo_customers_3: draftPlan({
    id: "customers_3",
    rationale:
      "Mariana's SDRs lose half the week to list building. Pitch time-back: automated discovery so the team spends hours in conversations, not spreadsheets.",
    commentDescription: "Reply to her SDR list-building post",
    commentContent:
      "Half a week on lists is half a week not selling. We surface already-qualified people from X and LinkedIn so SDRs open conversations instead of CSVs. Worth a 15-minute look for Clarion?",
    dmDescription: "Send a Clarion-shaped sample list",
  }),
  use_case_demo_customers_4: draftPlan({
    id: "customers_4",
    rationale:
      "Tom is the sales bottleneck and cannot afford an SDR yet. Position the agent as outbound before the first hire, not another headcount decision.",
    commentDescription: "Reply to his first-SDR post",
    commentContent:
      "Before you hire an SDR, worth seeing if an agent can keep outbound moving while you stay in the deals that matter. Built for solo founders hitting that ceiling.",
    dmDescription: "Send a lightweight outbound walkthrough",
  }),
  use_case_demo_customers_5: contactedPlan({
    id: "customers_5",
    rationale:
      "Aisha is already sold on signal-based selling. Skip the education step and show what monitoring uncovers for Papertrail this week.",
    commentDescription: "Reply to her buying-signals question",
    dmDescription: "Send three example matches from this week",
    dmContent:
      "Thanks for the conversation yesterday. Here are three people asking for exactly what Papertrail sells this week. Want me to keep the monitor running?",
  }),
  use_case_demo_customers_6: inProgressPlan({
    id: "customers_6",
    rationale:
      "Jonas is switching off a dead lead database. Keep momentum with a live-signal alternative and a concrete Klarheit monitor, not another firmographic dump.",
    commentDescription: "Reply to his lead-database shutdown post",
    dmDescription: "Send the live-signal alternative overview",
    followUpDescription: "Follow up with a Klarheit monitor sample",
    followUpContent:
      "Circling back with ten live posts from people describing Klarheit's pain this week. Still evaluating replacements, or ready for a short setup call?",
  }),
  use_case_demo_customers_7: draftPlan({
    id: "customers_7",
    rationale:
      "Camila's inbound dried up after ads stopped. Offer a repeatable way to find buyers already describing the pain, not another spray sequence.",
    commentDescription: "Reply to her inbound-dried-up post",
    commentContent:
      "When ads stop, the buyers are still talking. We find people already describing Northline's pain on X and LinkedIn so outbound is not spray-and-pray. Happy to show a week of matches.",
    dmDescription: "Send a week of Northline-shaped matches",
  }),
  use_case_demo_customers_8: draftPlan({
    id: "customers_8",
    rationale:
      "Lucas wants intent before chase time. Lead with prioritizing people already discussing Arcbound's problem publicly.",
    commentDescription: "Reply to his intent-tools ask",
    commentContent:
      "Chasing no-intent leads is expensive. We surface people already talking about the problem Arcbound solves, then you decide who is worth a conversation.",
    dmDescription: "Share three intent matches for Arcbound",
  }),
  use_case_demo_customers_9: contactedPlan({
    id: "customers_9",
    rationale:
      "Nadia needs compliance buyers before they hit a vendor shortlist. Show early fintech buying conversations, not another LinkedIn search export.",
    commentDescription: "Reply to her compliance-buyers ask",
    dmDescription: "Send early fintech buying conversations",
    dmContent:
      "Here are four mid-market fintech folks discussing compliance tooling before shortlists form. Want me to keep watching this lane for you?",
  }),
  use_case_demo_customers_10: inProgressPlan({
    id: "customers_10",
    rationale:
      "Carlos already rejected purchased lists. Stay on live social signals and make the next step a Fieldkit-specific monitor, not another CSV.",
    commentDescription: "Reply to his purchased-lists rant",
    dmDescription: "Send the live-signals overview",
    followUpDescription: "Follow up with Fieldkit monitor samples",
    followUpContent:
      "Pulled eight live posts from people who need what Fieldkit sells. Still off purchased lists, or ready to run this as the default source?",
  }),
  use_case_demo_customers_11: draftPlan({
    id: "customers_11",
    rationale:
      "Helena is hunting buyers who already complain about manual prospecting. Mirror her Relink CRM wedge and skip generic lead-gen language.",
    commentDescription: "Reply to her manual-prospecting ask",
    commentContent:
      "Manual prospecting complaints are the buyers. We watch for those posts and route them to Relink-shaped outreach. Happy to show what turned up this week.",
    dmDescription: "Send Relink-shaped buyer samples",
  }),
  use_case_demo_customers_13: draftPlan({
    id: "customers_13",
    rationale:
      "Nora is ripping out an intent-data vendor. Position live social intent as the replacement, not another black-box score.",
    commentDescription: "Reply to her intent-vendor teardown",
    commentContent:
      "If the score is a black box, live posts are the receipt. We replace vendor intent with people already describing Brightform's problem in public.",
    dmDescription: "Send a live-intent sample for Brightform",
  }),

  // -------------------------------------------------------------------------
  // Investors
  // -------------------------------------------------------------------------
  use_case_demo_investors_1: draftPlan({
    id: "investors_1",
    rationale:
      "Elena published her thesis publicly. Reference one specific point from it and show why this company fits, instead of sending a generic deck ask.",
    commentDescription: "Reply to her dev-tools thesis post",
    commentContent:
      "Your point about bottom-up adoption before sales shows up is exactly what we are seeing. We find those early believers for founders. Would love 15 minutes when you are back from SF.",
    waitDays: 3,
    dmDescription: "Send the one-page memo",
  }),
  use_case_demo_investors_2: draftPlan({
    id: "investors_2",
    rationale:
      "Marcus wants pre-revenue founders who are shipping. Lead with product usage and a fast first-check ask, not a polished Series A narrative.",
    commentDescription: "Reply to his rolling-fund announcement",
    commentContent:
      "Pre-revenue, shipping weekly, and the product finds early believers before a sales hire. Fits the rolling-fund brief. Open to a short note?",
    dmDescription: "Send the short founder memo",
  }),
  use_case_demo_investors_3: draftPlan({
    id: "investors_3",
    rationale:
      "Grace sources seed deals from founders writing in public. Meet her there: share what we build in the open, then ask for a first meeting.",
    commentDescription: "Reply to her founder-writing post",
    commentContent:
      "We write in public about finding buyers from live posts. Technical founders, seed stage, no sales theatre. Happy to share what we shipped last month.",
    dmDescription: "Send the public writing + product link",
  }),
  use_case_demo_investors_4: draftPlan({
    id: "investors_4",
    rationale:
      "Omar asked for DMs from founders outside the usual hubs. Keep it short, product-first, and respect the scout path into the larger fund.",
    commentDescription: "Reply to his scouting call",
    commentContent:
      "Building a signal-based outreach agent for founders who cannot hire sales yet. Outside the usual hubs, shipping. Worth a scout note?",
    dmDescription: "Send the scout-friendly one-pager",
  }),
  use_case_demo_investors_5: contactedPlan({
    id: "investors_5",
    rationale:
      "Sofia just announced Fund II and is deploying now. Speed matters more than polish here; get a warm, specific note in front of her this week.",
    commentDescription: "Congratulate on Fund II with a specific takeaway",
    dmDescription: "Send the pitch with traction snapshot",
    dmContent:
      "Congratulations on Fund II. We help seed-stage teams find their first believers on X and LinkedIn. 40 teams use it weekly. Worth a short call?",
  }),
  use_case_demo_investors_6: inProgressPlan({
    id: "investors_6",
    rationale:
      "Ben published a cold-pitch checklist and takes meetings from people who follow it. Stick to problem / why now / you / link.",
    commentDescription: "Reply acknowledging his pitch checklist",
    dmDescription: "Send the four-line cold pitch",
    followUpDescription: "Follow up with the product link only",
    followUpContent:
      "Per your checklist: we find buyers from live posts before a sales hire; now because cold email died; two founders shipping weekly; product: reacherx.com. Still taking those five cold meetings?",
  }),
  use_case_demo_investors_7: draftPlan({
    id: "investors_7",
    rationale:
      "Yuki wants operator-led decks on GTM infrastructure. Lead with how the product works in the wild, not a fundraising narrative.",
    commentDescription: "Reply to her GTM infrastructure post",
    commentContent:
      "Operator-led, not fundraising-polished: we automate finding people who already ask for the product. Seed GTM infrastructure. Happy to show the motion, not a vision slide.",
    dmDescription: "Send the operator one-pager",
  }),
  use_case_demo_investors_8: draftPlan({
    id: "investors_8",
    rationale:
      "Andrej wants real outbound metrics in the first note. Lead with reply rates and pipeline, skip the vision deck.",
    commentDescription: "Reply to his first-check post",
    commentContent:
      "Outbound is the product. Happy to send pipeline metrics and reply rates from teams using us, not a vision slide.",
    dmDescription: "Send pipeline metrics snapshot",
  }),
  use_case_demo_investors_9: contactedPlan({
    id: "investors_9",
    rationale:
      "Fatima is sourcing pre-seed AI GTM tools for African and diaspora founders. Make the intro about go-to-market pain, not a generic AI pitch.",
    commentDescription: "Reply to her sourcing post",
    dmDescription: "Send the GTM-pain founder intro",
    dmContent:
      "Building an AI agent that makes go-to-market less painful for founders who cannot hire sales. Fit for Sahel's pre-seed lane this month?",
  }),
  use_case_demo_investors_10: inProgressPlan({
    id: "investors_10",
    rationale:
      "Matthew scouts founders selling into sales teams. Keep the follow-up product-specific and offer a warm path into the partnership team.",
    commentDescription: "Reply to his sales-tools scouting post",
    dmDescription: "Send the sales-team wedge memo",
    followUpDescription: "Follow up with a warm intro ask",
    followUpContent:
      "We help reps find people already in-market from live social signals. Still scouting that lane? Happy to take a warm intro into the partnership team.",
  }),
  use_case_demo_investors_11: draftPlan({
    id: "investors_11",
    rationale:
      "Helena's thesis is GTM infrastructure for technical founders. Mirror that language and ask for a meeting this month.",
    commentDescription: "Reply to her GTM thesis post",
    commentContent:
      "GTM infrastructure for technical founders is exactly the lane. We help them find early believers without a sales org. Open to a meeting this month?",
    waitDays: 3,
    dmDescription: "Send the thesis-fit memo",
  }),
  use_case_demo_investors_13: draftPlan({
    id: "investors_13",
    rationale:
      "Nora is sourcing applied AI tools for European founders and prefers operator updates over decks. Lead with what shipped, not a pitch narrative.",
    commentDescription: "Reply to her applied-AI sourcing post",
    commentContent:
      "Applied AI for European founders, operator update not a deck: we ship an agent that finds buyers from live posts. Happy to send what we shipped last month.",
    dmDescription: "Send the operator update memo",
  }),

  // -------------------------------------------------------------------------
  // Candidates
  // -------------------------------------------------------------------------
  use_case_demo_candidates_1: draftPlan({
    id: "candidates_1",
    rationale:
      "Isabelle wants design-heavy early-stage products. Lead with the design culture and the actual product surface she would own, not the job spec.",
    commentDescription: "Reply to her exploring-roles post",
    commentContent:
      "We are two people and design is half the product here. You would own the whole surface, not a lane. Can I show you what you would be working on?",
    dmDescription: "Share the role and product walkthrough",
  }),
  use_case_demo_candidates_2: draftPlan({
    id: "candidates_2",
    rationale:
      "Kwame wants ownership at seed over a salary bump. Lead with what he would build from zero, not comp bands.",
    commentDescription: "Reply to his seed-stage backend post",
    commentContent:
      "Seed-stage backend with real ownership, not another process layer. You would own the systems that find and qualify people from live signals. Open to a walkthrough?",
    dmDescription: "Send the ownership-shaped role note",
  }),
  use_case_demo_candidates_3: draftPlan({
    id: "candidates_3",
    rationale:
      "Hannah was a first design hire through Series A. Offer a founding designer seat with clear MVP-to-growth ownership.",
    commentDescription: "Reply to her founding-designer post",
    commentContent:
      "Founding designer seat, full product surface, early stage. Your MVP-to-Series-A path is exactly the muscle we need. Portfolio looked sharp.",
    dmDescription: "Share the founding designer brief",
  }),
  use_case_demo_candidates_4: draftPlan({
    id: "candidates_4",
    rationale:
      "Raj wants applied LLM work, not prompt babysitting. Lead with production RAG/eval ownership and real shipping cadence.",
    commentDescription: "Reply to his applied-LLM hiring ask",
    commentContent:
      "Not prompt babysitting. Production RAG, evals, and shipping. Looking for someone who has done the two years you just described. Worth a chat?",
    dmDescription: "Send the applied ML role outline",
  }),
  use_case_demo_candidates_5: contactedPlan({
    id: "candidates_5",
    rationale:
      "Laura wants a first head-of-growth seat. Position the role around ownership of the whole funnel and reference her PLG exit directly.",
    commentDescription: "Reply to her head-of-growth announcement",
    dmDescription: "Send the role outline with funnel ownership",
    dmContent:
      "Your PLG run is exactly the motion we need built from zero. This is full funnel ownership, small team, direct line to the founders. Open to a chat this week?",
  }),
  use_case_demo_candidates_6: inProgressPlan({
    id: "candidates_6",
    rationale:
      "Derek wants DevRel at a dev tools startup and already runs a 4k community. Follow up with docs-and-community ownership, not a vague advocate title.",
    commentDescription: "Reply to his DevRel hiring ask",
    dmDescription: "Send the DevRel role + community ownership",
    followUpDescription: "Follow up with docs samples and next steps",
    followUpContent:
      "Still looking for DevRel at a tools company? Here is how the 4k community would plug into our docs and launch loop. Open to a call this week?",
  }),
  use_case_demo_candidates_7: draftPlan({
    id: "candidates_7",
    rationale:
      "Chloe wants a founding-engineer seat with ownership over process. Lead with end-to-end product ownership, not a ticket queue.",
    commentDescription: "Reply to her founding-engineer post",
    commentContent:
      "Founding-engineer seat, ownership over process, B2B product. No 40-person ticket queue. Happy to show what you would ship in the first month.",
    dmDescription: "Send the founding eng scope",
  }),
  use_case_demo_candidates_8: draftPlan({
    id: "candidates_8",
    rationale:
      "Kenji built internal tooling for sales teams and wants product contact. Mirror that background into our platform/outreach stack.",
    commentDescription: "Reply to his platform-engineer ask",
    commentContent:
      "Platform role with real product contact: the systems behind finding and reaching people from live signals. Your sales-tooling background is the fit.",
    dmDescription: "Share the platform role brief",
  }),
  use_case_demo_candidates_9: contactedPlan({
    id: "candidates_9",
    rationale:
      "Olivia cut churn in half and wants her first CS leadership seat. Lead with playbook ownership at seed, not a support manager title.",
    commentDescription: "Reply to her CS leadership post",
    dmDescription: "Send the Head of CS outline",
    dmContent:
      "First CS leadership seat at seed. Your churn playbook is the starting point, not a binder on a shelf. Open to sharing how we would use it here?",
  }),
  use_case_demo_candidates_10: inProgressPlan({
    id: "candidates_10",
    rationale:
      "Ethan wants end-to-end ownership on a small TypeScript/Next/Convex team. Follow up with a concrete feature he would own.",
    commentDescription: "Reply to his small-team full-stack post",
    dmDescription: "Send the stack + ownership note",
    followUpDescription: "Follow up with a first-feature walkthrough",
    followUpContent:
      "Same stack you listed. Here is the first feature you would own end to end. Still looking for a small team, or ready to dig in?",
  }),
  use_case_demo_candidates_11: draftPlan({
    id: "candidates_11",
    rationale:
      "Helena wants a founding designer seat after five years in B2B SaaS. Lead with zero-to-one product ownership, not a mid-level design lane.",
    commentDescription: "Reply to her founding-designer post",
    commentContent:
      "Founding designer seat, full product surface, early stage. Your two zero-to-one launches are the muscle. Portfolio looked sharp — can I send the brief?",
    dmDescription: "Share the founding designer brief",
  }),
  use_case_demo_candidates_13: draftPlan({
    id: "candidates_13",
    rationale:
      "Nora is exploring PM roles at early-stage tools companies with two zero-to-one launches. Offer concrete PM ownership of the tools product.",
    commentDescription: "Reply to her early-stage PM post",
    commentContent:
      "Early-stage tools company, PM ownership of a real surface, not a feature lane. Your zero-to-one launches are the fit. Happy to send a 90-day scope.",
    dmDescription: "Send the PM 90-day scope",
  }),

  // -------------------------------------------------------------------------
  // Creators
  // -------------------------------------------------------------------------
  use_case_demo_creators_1: draftPlan({
    id: "creators_1",
    rationale:
      "Nina reviews tools on camera. Offer a real account with real matches so the review has substance, and let her keep whatever it finds.",
    commentDescription: "Reply to her review-requests thread",
    commentContent:
      "Built by a team of two, does one thing: finds the people already asking for your product. Happy to set up a real account for the review and you keep whatever it finds.",
    dmDescription: "Send access details and talking points",
  }),
  use_case_demo_creators_2: draftPlan({
    id: "creators_2",
    rationale:
      "Jake only features what he would use. Pitch product substance for indie hackers, not a sponsored slot.",
    commentDescription: "Reply to his weekly tools section post",
    commentContent:
      "No sponsored ask. Agent that finds people already asking for your product. Built for small teams. Happy to give you an account and let the product speak.",
    dmDescription: "Send a feature-ready product brief",
  }),
  use_case_demo_creators_3: draftPlan({
    id: "creators_3",
    rationale:
      "Amara is collecting AI tools that save real daily time. Lead with a concrete before/after, not a demo reel.",
    commentDescription: "Reply to her AI tools that save time post",
    commentContent:
      "Daily use, not a demo: we turn public buying signals into a shortlist so founders stop spending mornings on list building. Happy to show a real week of output.",
    dmDescription: "Send a before/after for her series",
  }),
  use_case_demo_creators_4: draftPlan({
    id: "creators_4",
    rationale:
      "Leo's founder-tools threads get reach. Offer a clear wedge he can slot as a missing tool, with a real account to try.",
    commentDescription: "Reply to his founder-tools thread",
    commentContent:
      "Missing from the list: finding people already asking for what you sell. Happy to give you a real account so you can decide if it earns a spot in a follow-up thread.",
    dmDescription: "Send access + one-sentence wedge",
  }),
  use_case_demo_creators_5: contactedPlan({
    id: "creators_5",
    rationale:
      "Petra books founders for her podcast. Pitch the story angle, not the product: bootstrapped outreach automation without a sales team.",
    commentDescription: "Reply to her guest-booking post",
    dmDescription: "Pitch the episode angle with three talking points",
    dmContent:
      "Bootstrapped, no sales team, and our agent does the outbound for us. Happy to share the whole story, including the parts that flopped. Fit for a season episode?",
  }),
  use_case_demo_creators_6: inProgressPlan({
    id: "creators_6",
    rationale:
      "Sam writes honest weekly tool reviews. Follow up with access and permission to be weirdly specific about what works and what does not.",
    commentDescription: "Reply to his weekly tool-test post",
    dmDescription: "Send product access for the review",
    followUpDescription: "Follow up with talking points + no spin",
    followUpContent:
      "Access is live. Talking points attached, including the parts that still feel rough. Still open for a Week 13 review?",
  }),
  use_case_demo_creators_7: draftPlan({
    id: "creators_7",
    rationale:
      "Maya is collecting founder quotes on outbound tools. Offer a concrete quote and a product she can verify with her audience.",
    commentDescription: "Reply to her outbound-tools roundup ask",
    commentContent:
      "Founder quote ready: we stopped buying lists and started commenting where buyers already complain. Happy to back it with a product she can click through.",
    dmDescription: "Send quote + product link for the roundup",
  }),
  use_case_demo_creators_8: draftPlan({
    id: "creators_8",
    rationale:
      "Owen needs a clear before/after for screen recording. Lead with list-building mornings vs live shortlists.",
    commentDescription: "Reply to his build-in-public filming call",
    commentContent:
      "Before: mornings on lists. After: a shortlist of people already asking for the product. Small team, clear screen-record path. Link in a reply if useful.",
    dmDescription: "Send demo script + product access",
  }),
  use_case_demo_creators_9: contactedPlan({
    id: "creators_9",
    rationale:
      "Zara wants messy, real distribution stories without a sales team. Pitch the playbook, not a polished product tour.",
    commentDescription: "Reply to her distribution-without-sales post",
    dmDescription: "Pitch the messy playbook episode",
    dmContent:
      "Distribution without a sales team, including the messy parts. Happy to walk through the exact playbook on African Founders if that still fits the season.",
  }),
  use_case_demo_creators_10: inProgressPlan({
    id: "creators_10",
    rationale:
      "Hugo features underrated SaaS for operators who buy. Follow up with an honest write-up pack, not pay-to-play language.",
    commentDescription: "Reply to his Friday feature slot post",
    dmDescription: "Send the underrated-SaaS brief",
    followUpDescription: "Follow up with operator-facing talking points",
    followUpContent:
      "Friday slot still open? Here is an operator-facing brief with what we do and where we still fall short. No pay-to-play.",
  }),
  use_case_demo_creators_11: draftPlan({
    id: "creators_11",
    rationale:
      "Helena reviews B2B tools on YouTube. Offer a real account and a clear before/after for the episode.",
    commentDescription: "Reply to her B2B tools review call",
    commentContent:
      "B2B tool with a clear before/after for screen recording. Real account, real matches, you keep whatever it finds. Fit for the next batch?",
    dmDescription: "Send access + episode talking points",
  }),
  use_case_demo_creators_13: draftPlan({
    id: "creators_13",
    rationale:
      "Nora asked her audience which outbound tools work. Offer a founder quote and a product path she can verify.",
    commentDescription: "Reply to her outbound-tools audience ask",
    commentContent:
      "Happy to send a founder quote plus a product path your audience can click. No hype round — just what changed in weekly outbound.",
    dmDescription: "Send quote + verify link",
  }),

  // -------------------------------------------------------------------------
  // Job seekers
  // -------------------------------------------------------------------------
  use_case_demo_job_seekers_1: draftPlan({
    id: "job_seekers_1",
    rationale:
      "María has zero-to-one launches and is available now. Move fast with a concrete PM scope and reference her Barcelona/remote preference.",
    commentDescription: "Reply to her open-to-work post",
    commentContent:
      "We need exactly that zero-to-one PM muscle. Small team, remote-first, and the roadmap is yours to shape. Can I send over what the first 90 days would look like?",
    dmDescription: "Send the 90-day scope",
  }),
  use_case_demo_job_seekers_2: draftPlan({
    id: "job_seekers_2",
    rationale:
      "Felix wants mission-driven work with TypeScript and Go. Lead with mission and stack fit, not a generic eng hiring blurb.",
    commentDescription: "Reply to his open-to-work post",
    commentContent:
      "Mission-driven, TypeScript and Go in production, code that matters. Looking for someone with your five years who wants the mission to matter more. Open to a scope note?",
    dmDescription: "Send the full-stack role scope",
  }),
  use_case_demo_job_seekers_3: draftPlan({
    id: "job_seekers_3",
    rationale:
      "Tanya builds eval systems for LLM products. Lead with applied AI ownership and evaluation work, not a vague ML title.",
    commentDescription: "Reply to her applied-AI intros ask",
    commentContent:
      "Applied AI role centered on evaluation systems that tell you if the model works. Your published eval work is the fit. Happy to send a concrete scope.",
    dmDescription: "Send the applied AI role outline",
  }),
  use_case_demo_job_seekers_4: draftPlan({
    id: "job_seekers_4",
    rationale:
      "Jordan hit quota eight quarters and wants an AE growth path. Offer a startup sales seat with a clear SDR-to-AE trajectory.",
    commentDescription: "Reply to his startup sales post",
    commentContent:
      "Building the sales team and need someone who already hits quota. Clear path from SDR muscle into AE ownership. Open to hearing what the first two quarters look like?",
    dmDescription: "Send the sales-seat trajectory",
  }),
  use_case_demo_job_seekers_5: contactedPlan({
    id: "job_seekers_5",
    rationale:
      "Emilia wants one team after freelancing. Emphasize brand ownership across product and marketing, and reference her dev-tools portfolio.",
    commentDescription: "Reply to her full-time announcement",
    dmDescription: "Share the brand scope and team setup",
    dmContent:
      "Your dev-tools portfolio is the exact taste level we need. You would own the brand end to end, product included. Worth a call this week?",
  }),
  use_case_demo_job_seekers_6: inProgressPlan({
    id: "job_seekers_6",
    rationale:
      "Noah is a recent grad with real open-source users. Follow up with a junior backend seat that has mentorship and a first project.",
    commentDescription: "Reply to his junior backend post",
    dmDescription: "Send the junior backend + mentorship note",
    followUpDescription: "Follow up with the first project brief",
    followUpContent:
      "First project brief attached, plus who mentors. Still looking for junior backend, or timing changed after graduation?",
  }),
  use_case_demo_job_seekers_7: draftPlan({
    id: "job_seekers_7",
    rationale:
      "Sophie built zero-to-GA launch motions. Offer a PMM seat owning launches, remote or Montreal as she asked.",
    commentDescription: "Reply to her PMM open-to-work post",
    commentContent:
      "PMM seat owning launches for a B2B product. Your zero-to-GA motions are the fit. Remote or Montreal both work on our side.",
    dmDescription: "Send the PMM launch ownership brief",
  }),
  use_case_demo_job_seekers_8: draftPlan({
    id: "job_seekers_8",
    rationale:
      "Ryan wants SRE work with a smaller blast radius on a developer platform. Lead with visibility of reliability work.",
    commentDescription: "Reply to his SRE startup ask",
    commentContent:
      "SRE on a developer platform with a blast radius you can see. Reliability work is visible to the whole team, not buried in a huge org.",
    dmDescription: "Send the SRE role outline",
  }),
  use_case_demo_job_seekers_9: contactedPlan({
    id: "job_seekers_9",
    rationale:
      "Ivy wants an early-stage AE seat where she helps build the motion. Position ownership of mid-market motion, not just running a playbook.",
    commentDescription: "Reply to her early-stage AE post",
    dmDescription: "Send the AE motion-building outline",
    dmContent:
      "Early-stage AE seat where you help build the motion, not only run it. President's Club track record is the bar. Open to a territory chat this week?",
  }),
  use_case_demo_job_seekers_10: inProgressPlan({
    id: "job_seekers_10",
    rationale:
      "Mason is a junior product designer with systems thinking. Follow up with a mentored seat and a first case-study-shaped project.",
    commentDescription: "Reply to his junior design post",
    dmDescription: "Send the junior design + mentorship note",
    followUpDescription: "Follow up with the first design project",
    followUpContent:
      "First project brief and who reviews design crits. Still looking for junior product design, or ready to walk through the case studies?",
  }),
  use_case_demo_job_seekers_11: draftPlan({
    id: "job_seekers_11",
    rationale:
      "Helena is open to senior PM roles after a reorg, remote or Lisbon. Move fast with a concrete B2B PM scope.",
    commentDescription: "Reply to her senior PM open-to-work post",
    commentContent:
      "Senior PM seat, B2B product, remote or Lisbon both work. Your zero-to-one launches are exactly the muscle. Can I send the first 90 days?",
    dmDescription: "Send the senior PM 90-day scope",
  }),
  use_case_demo_job_seekers_13: draftPlan({
    id: "job_seekers_13",
    rationale:
      "Nora wants product design roles and has shipped design systems. Lead with systems thinking and a concrete first project.",
    commentDescription: "Reply to her product design intros ask",
    commentContent:
      "Product design seat with real systems work, not another component farm. Your design-system shipping is the fit. Happy to send a first-project brief.",
    dmDescription: "Send the design role + first project",
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
  const newCount = dataset.prospects.filter(
    (prospect) => prospect.status === "new"
  ).length;

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
      message: `△ Agent found ${newCount} new ${entityPluralLower} matching your profile while you were away.`,
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
