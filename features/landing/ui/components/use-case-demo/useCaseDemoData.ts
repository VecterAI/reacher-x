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
  // Added for the extended demo datasets; each portrait downloaded and
  // checked as a male face before wiring in, same as the original pool.
  "photo-1566753323558-f4e0952af115",
  "photo-1590086782957-93c06ef21604",
  "photo-1544723795-3fb6469f5b39",
  "photo-1552374196-c4e7ffc6e126",
  "photo-1618077360395-f3068be8e001",
  "photo-1506277886164-e25aa3f4ef7f",
  "photo-1615109398623-88346a601842",
  "photo-1508341591423-4347099e1f19",
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
  status?: "new" | "contacted" | "in_progress" | "converted" | "archived";
  /**
   * Archived rows that never matched the criteria read as disqualified;
   * everything else stays qualified.
   */
  qualificationStatus?: "qualified" | "disqualified";
  company?: string;
  websiteUrl?: string;
  location?: string;
  verified?: boolean;
  /** LinkedIn author headline (falls back to title) */
  headline?: string;
  finance?: { displayValue: string; type: string };
  pain?: string;
  solution?: string;
  /** Optional second public post, rendered as extra evidence on the profile. */
  extraSignal?: { text: string; hoursAgo: number };
  /** Used to pick a face when the handle is not in DEMO_AVATAR_URLS. */
  gender?: "woman" | "man";
}

export function makeProspect(options: MakeProspectOptions): Doc<"prospects"> {
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
    qualificationStatus = "qualified",
    company,
    websiteUrl,
    location,
    verified = false,
    headline,
    finance,
    pain,
    solution,
    extraSignal,
    gender,
  } = options;

  const postedAt = BASE_TIME - hoursAgo * HOUR_MS;
  const externalId = `${platform}_${key}`;
  const avatarUrl = resolveAvatarUrl(handle, gender);

  const buildSignalPost = (postedAtMs: number, text: string, id: string) =>
    platform === "twitter"
      ? {
          id_str: id,
          full_text: text,
          tweet_created_at: new Date(postedAtMs).toISOString(),
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
          postID: id,
          text,
          author: {
            name: displayName,
            profilePictureURL: avatarUrl,
            url: `https://linkedin.com/in/${handle}`,
            headline: headline ?? title,
          },
          postedAt: { timestamp: postedAtMs },
          engagements: {
            totalReactions: 96,
            commentsCount: 18,
            repostsCount: 6,
          },
        };

  const signalPost = buildSignalPost(postedAt, signal, externalId);
  const extraPost = extraSignal
    ? buildSignalPost(
        BASE_TIME - extraSignal.hoursAgo * HOUR_MS,
        extraSignal.text,
        `${externalId}_2`
      )
    : undefined;
  const evidencePosts = extraPost ? [signalPost, extraPost] : [signalPost];

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
    qualificationReasoning: briefIntro,
    prospectType: "individual",
    qualificationScore,
    qualificationStatus,
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
    evidencePosts,
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
        finance: { displayValue: "$1.4M ARR", type: "arr" },
        pain: "Missing buying conversations happening on social platforms",
        solution: "Around the clock monitoring of X and LinkedIn for intent",
        extraSignal: {
          text: "Week two of monitoring buying signals: we surfaced 11 conversations we would have missed. Sharing the patterns, and the two that actually convert.",
          hoursAgo: 18,
        },
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
        extraSignal: {
          text: "Update after three weeks of testing: two tools recycled the same directories. One watched live posts. Guess which one found buyers who replied.",
          hoursAgo: 12,
        },
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
        pain: "Deploying Fund II now and needs specific notes, fast",
        solution: "Traction-first pitch that fits the applied AI thesis",
        extraSignal: {
          text: "Fund II is 40 percent deployed in six weeks. The pace is the point, and the bar is the same: real users, real retention.",
          hoursAgo: 20,
        },
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
        pain: "Sourcing pre-seed AI GTM tools for African and diaspora founders",
        solution: "Intro to a founder already solving go-to-market pain",
        extraSignal: {
          text: "One month of intros in: the strongest pre-seed AI GTM pitches came with adoption numbers, not decks. Noted for the next batch.",
          hoursAgo: 9,
        },
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
        pain: "Scout lane needs founders selling into sales teams",
        solution: "Warm intro to a team helping reps find or close better",
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
        finance: { displayValue: "€85k target", type: "compensation" },
        pain: "Growth-lead seats want operators, not deck writers",
        solution: "Head-of-growth seat with funnel ownership from day one",
        extraSignal: {
          text: "One thing the post could not fit: the PLG experiment that took activation from 18 to 31 percent. Happy to walk through it.",
          hoursAgo: 20,
        },
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
        pain: "DevRel seats are travel-and-talks with no real ownership",
        solution: "DevRel seat owning docs, community, and the launch loop",
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
        pain: "CS leadership seats want support managers, not playbook builders",
        solution: "First CS leadership seat built around her churn playbook",
        extraSignal: {
          text: "Sharing the churn-playbook outline publicly since several people asked. First section: instrument the first-value moment before adding channels.",
          hoursAgo: 16,
        },
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
        pain: "Episodes need operators with real stories, not product tours",
        solution: "Pitch the playbook, not the product",
        extraSignal: {
          text: "Season trailer is cut. Founders who can show a real dashboard beat talkers every time. Booking through October.",
          hoursAgo: 21,
        },
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
        pain: "Review queue needs tools he would genuinely use",
        solution: "Full access with permission to publish the rough parts",
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
        pain: "Episodes need distribution stories with receipts",
        solution: "Walk through the exact playbook on the show",
        extraSignal: {
          text: "Last week's episode question: how did you get distribution before product-market fit? Answering with guest stories next episode.",
          hoursAgo: 14,
        },
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
        pain: "Freelancing splits attention across too many clients",
        solution: "Brand ownership across product and marketing on one team",
        extraSignal: {
          text: "One thing the post could not fit: the rebrand that took a dev tool from enterprise-only to self-serve. Happy to walk through it.",
          hoursAgo: 17,
        },
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
        pain: "Junior roles want experience he has not had yet",
        solution: "Mentored seat with a real first project",
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
        pain: "AE seats run playbooks instead of building them",
        solution: "Early-stage AE seat building the motion",
        extraSignal: {
          text: "Adding one thing: I ran the mid-market territory from zero to 1.2M in eighteen months. Numbers and references ready.",
          hoursAgo: 15,
        },
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
 * Volume rows that extend each core dataset. Names, handles, and faces are
 * unique per use case so switching pills never repeats a person or portrait:
 * five fill rows (indexes 11-15) deepen the active pipeline, and six appended
 * rows (indexes 16-21) add contacted/in-progress conversions plus a converted
 * pair and an archived row so the success and archive pages stay populated.
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
  status?: "new" | "contacted" | "in_progress" | "converted" | "archived";
  qualificationStatus?: "qualified" | "disqualified";
  company?: string;
  location?: string;
  platform?: "twitter" | "linkedin";
  verified?: boolean;
  finance?: { displayValue: string; type: string };
  pain?: string;
  solution?: string;
  extraSignal?: { text: string; hoursAgo: number };
}

function handleFromName(name: string, suffix: string): string {
  const base = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return `${base}${suffix}`;
}

function buildSeedProspects(
  useCaseKey: UseCaseDemoKey,
  seeds: FillSeed[],
  firstIndex: number
): Doc<"prospects">[] {
  return seeds.map((seed, index) => {
    const n = firstIndex + index;
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
      qualificationStatus: seed.qualificationStatus,
      company: seed.company,
      location: seed.location,
      verified: seed.verified,
      headline: seed.title,
      finance: seed.finance,
      pain: seed.pain,
      solution: seed.solution,
      extraSignal: seed.extraSignal,
      gender: seed.gender,
    });
  });
}

const CUSTOMER_FILL: FillSeed[] = [
  {
    displayName: "Maren Holt",
    gender: "woman",
    title: "Founder at Tidepool",
    briefIntro:
      "Asked how founders find early users for workflow tools without burning money on ads. Building a support-inbox add-on.",
    signal:
      "Tidepool has a working product and zero distribution. What are founders using to find the first ten teams who actually need this? Ads feel like burning money.",
    qualificationScore: 87,
    hoursAgo: 4,
    matchedKeywords: ["first users", "workflow tools", "founder"],
    company: "Tidepool",
    location: "Oslo, Norway",
    finance: { displayValue: "$9k MRR", type: "mrr" },
    pain: "No distribution for a working product and paid channels are too expensive",
    solution: "Reach the teams already describing the workflow gap publicly",
  },
  {
    displayName: "Dario Fontana",
    gender: "man",
    title: "CRO at Brightpath",
    briefIntro:
      "Posted that his AE team burns quota on unqualified inbound and wants signal scoring before handoff.",
    signal:
      "Our AEs burned two quarters of quota on inbound that never qualified. I want signal scoring before handoff, or we keep paying for noise.",
    qualificationScore: 84,
    hoursAgo: 7,
    matchedKeywords: ["unqualified inbound", "signal scoring", "AE"],
    company: "Brightpath",
    location: "Milan, Italy",
    pain: "AEs burn quota on inbound that never qualified",
    solution: "Score live buying signals before handoff",
  },
  {
    displayName: "Ingrid Halvorsen",
    gender: "woman",
    title: "Growth lead at Meridian Labs",
    briefIntro:
      "Shared she is replacing a static lead-scoring vendor with live social intent this quarter.",
    signal:
      "We fired our lead-scoring vendor last week. The scores were a black box and half of them were stale. Replacing it with people who post about the problem in real time.",
    qualificationScore: 90,
    hoursAgo: 12,
    matchedKeywords: ["lead scoring", "social intent", "growth"],
    company: "Meridian Labs",
    location: "Copenhagen, Denmark",
    pain: "Black-box lead scores go stale before the team acts",
    solution: "Use live posts as the intent source",
  },
  {
    displayName: "Tobias Richter",
    gender: "man",
    title: "Solo founder, invoicing SaaS",
    briefIntro:
      "Says his warm network is tapped out for early users and wants people already asking for invoicing help.",
    signal:
      "Warm intros are tapped out. Where do solo founders find people who are publicly asking for what we built? Invoicing-chaos posts are everywhere, I just cannot reach them.",
    qualificationScore: 81,
    hoursAgo: 15,
    matchedKeywords: ["invoicing", "early users", "solo founder"],
    location: "Berlin, Germany",
    pain: "Warm network is tapped out for early users",
    solution: "Find new people publicly asking for invoicing help",
  },
  {
    displayName: "Amelia Cross",
    gender: "woman",
    title: "VP Marketing at Nimbus Ops",
    briefIntro:
      "Evaluated signal-based outreach last quarter and archived after choosing an enterprise suite.",
    signal:
      "Shopping for demand tools that start from public posts. Content brings traffic, not buyers, and I need actual conversations before the board asks about pipeline.",
    qualificationScore: 78,
    hoursAgo: 19,
    matchedKeywords: ["demand tools", "buyers", "VP marketing"],
    status: "archived",
    qualificationStatus: "disqualified",
    company: "Nimbus Ops",
    location: "Manchester, UK",
  },
];

const CUSTOMER_APPEND: FillSeed[] = [
  {
    displayName: "Rosa Delgado",
    gender: "woman",
    title: "Head of Sales at Cairn Analytics",
    briefIntro:
      "Asked how other sales teams time outreach to when buyers post about the problem publicly.",
    signal:
      "What do sales teams use to reach buyers within days of them posting about the problem? We sell mid-market analytics and the buying conversations happen weeks before any RFP.",
    qualificationScore: 89,
    hoursAgo: 6,
    matchedKeywords: [
      "buying conversations",
      "outreach timing",
      "head of sales",
    ],
    status: "contacted",
    platform: "twitter",
    company: "Cairn Analytics",
    location: "Madrid, Spain",
    finance: { displayValue: "$2.1M ARR", type: "arr" },
    pain: "Outreach misses the window when buyers describe the problem publicly",
    solution: "Reach people within days of their public posts",
    extraSignal: {
      text: "Follow-up from my last post: we tested timing outreach within 72 hours of a buying post. Reply rates tripled versus our usual sequences.",
      hoursAgo: 2,
    },
  },
  {
    displayName: "Felix Wagner",
    gender: "man",
    title: "Founder at Werkstatt",
    briefIntro:
      "Posted that outbound is flat while competitors grow and asked what works besides ads.",
    signal:
      "Our outbound has been flat for two quarters while competitors double down on ads. For a field-service SaaS, what actually works that is not another ad channel?",
    qualificationScore: 82,
    hoursAgo: 13,
    matchedKeywords: ["flat outbound", "field service", "founder"],
    status: "contacted",
    platform: "twitter",
    company: "Werkstatt",
    location: "Vienna, Austria",
    finance: { displayValue: "$26k MRR", type: "mrr" },
    pain: "Outbound is flat and paid channels are too expensive",
    solution: "Systematic outreach to people already describing the problem",
  },
  {
    displayName: "Marcus Bell",
    gender: "man",
    title: "VP Sales at Quarry Health",
    briefIntro:
      "Wrote that list-based outbound lost the quarter and the motion is being rebuilt around live signals.",
    signal:
      "We lost Q3 to list-based outbound. Response rates collapsed and my reps are demoralized. Rebuilding the motion around people who post about the problem we solve.",
    qualificationScore: 77,
    hoursAgo: 37,
    matchedKeywords: ["list-based outbound", "rebuilding", "VP sales"],
    status: "in_progress",
    platform: "linkedin",
    company: "Quarry Health",
    location: "Denver, CO",
    finance: { displayValue: "$5.4M ARR", type: "arr" },
    pain: "List-based outbound cost the quarter",
    solution: "Rebuild the motion on live buying signals",
  },
  {
    displayName: "Yusuf Demir",
    gender: "man",
    title: "Co-founder at Anka Commerce",
    briefIntro:
      "Shared that every customer came from communities and asked how to scale that without spamming.",
    signal:
      "Every customer we have came from niche communities. Scaling that by blasting the same forums is how you get banned. How do others turn community listening into repeatable outreach?",
    qualificationScore: 72,
    hoursAgo: 44,
    matchedKeywords: ["communities", "repeatable outreach", "co-founder"],
    status: "in_progress",
    platform: "twitter",
    location: "Istanbul, Türkiye",
    pain: "Growth relies on communities that do not scale",
    solution:
      "Turn buyer conversations across platforms into repeatable outreach",
  },
  {
    displayName: "Hannah Voss",
    gender: "woman",
    title: "Founder at Gridline",
    briefIntro:
      "Posted that dashboard sprawl eats her team's week and asked how small teams consolidate analytics.",
    signal:
      "Dashboard sprawl is eating my team's week. Every stakeholder exports to their own spreadsheet. How do small teams consolidate analytics without a six-figure BI rollout?",
    qualificationScore: 91,
    hoursAgo: 9,
    matchedKeywords: ["dashboard sprawl", "analytics", "founder"],
    status: "converted",
    platform: "linkedin",
    company: "Gridline",
    location: "Hamburg, Germany",
    finance: { displayValue: "$14k MRR", type: "mrr" },
  },
  {
    displayName: "Peter Lindqvist",
    gender: "man",
    title: "CEO at Nordvik",
    briefIntro:
      "Posted that purchased lists never replied and asked how peers find buyers now.",
    signal:
      "Half our pipeline came from purchased lists that never replied. Buying lists feels like paying for a phonebook in 2026. How are peers finding buyers who are actually in-market?",
    qualificationScore: 80,
    hoursAgo: 21,
    matchedKeywords: ["purchased lists", "in-market", "CEO"],
    status: "converted",
    platform: "twitter",
    company: "Nordvik",
    location: "Stockholm, Sweden",
    finance: { displayValue: "$310k ARR", type: "arr" },
  },
];

const INVESTOR_FILL: FillSeed[] = [
  {
    displayName: "Priyanka Raman",
    gender: "woman",
    title: "Partner at Meridian East",
    briefIntro:
      "Posted her thesis on vertical SaaS for India-first teams and is taking pre-seed meetings this month.",
    signal:
      "2026 thesis: vertical SaaS built for India-first teams, sold bottom-up. Taking ten pre-seed meetings this month. Show me usage, not projections.",
    qualificationScore: 94,
    hoursAgo: 3,
    matchedKeywords: ["thesis", "vertical SaaS", "pre-seed"],
    company: "Meridian East",
    location: "Bangalore, India",
    finance: { displayValue: "$20M fund", type: "funding" },
    pain: "Deal flow for India-first vertical SaaS is thin",
    solution: "Meet teams with bottom-up usage before rounds are public",
  },
  {
    displayName: "Grant Mercer",
    gender: "man",
    title: "Angel, ex-fintech operator",
    briefIntro:
      "Writes $25k checks for B2B fintech with evidence of real usage and wants metrics in the first note.",
    signal:
      "I write $25k checks for B2B fintech with evidence of real usage. Weekly active teams in the first note gets a reply; vision decks do not.",
    qualificationScore: 88,
    hoursAgo: 8,
    matchedKeywords: ["angel", "fintech", "first check"],
    location: "Toronto, Canada",
    pain: "Wants usage-evidence deals before they get competitive",
    solution: "Founder intros with product metrics attached",
  },
  {
    displayName: "Solveig Dahl",
    gender: "woman",
    title: "Principal at Nordkraft Ventures",
    briefIntro:
      "Sourcing applied-AI tools for Nordic industrials and prefers operator updates over decks.",
    signal:
      "Sourcing applied-AI tools that make Nordic industrials measurably faster. Operator updates over decks. If it ships and works, I want to see it.",
    qualificationScore: 91,
    hoursAgo: 11,
    matchedKeywords: ["applied AI", "industrials", "sourcing"],
    company: "Nordkraft Ventures",
    location: "Oslo, Norway",
  },
  {
    displayName: "Ibrahim Toure",
    gender: "man",
    title: "Scout for a Paris seed fund",
    briefIntro:
      "Asked francophone founders to send what they are shipping; runs fast scout checks.",
    signal:
      "Scouting francophone founders this quarter. Building from Dakar to Montréal? Send what you ship, not what you plan. Fast checks, warm path into the fund.",
    qualificationScore: 79,
    hoursAgo: 16,
    matchedKeywords: ["scout", "francophone", "seed"],
    location: "Dakar, Senegal",
  },
  {
    displayName: "Beatrice Lang",
    gender: "woman",
    title: "General Partner at Lowland Capital",
    briefIntro:
      "Raised a climate-infrastructure fund; the thesis review showed no overlap with the product's stage and category.",
    signal:
      "Lowland Fund II: climate infrastructure software, Series A, $80M checks. If your product makes grids or logistics greener, my door is open.",
    qualificationScore: 84,
    hoursAgo: 20,
    matchedKeywords: ["climate", "fund", "Series A"],
    status: "archived",
    qualificationStatus: "disqualified",
    company: "Lowland Capital",
    location: "Amsterdam, Netherlands",
  },
];

const INVESTOR_APPEND: FillSeed[] = [
  {
    displayName: "Noor Al-Rashid",
    gender: "woman",
    title: "Partner at Gulf Growth Partners",
    briefIntro:
      "Announced the first close of a $30M fund for B2B SaaS across MENA and is deploying now.",
    signal:
      "First close of our $30M fund for B2B SaaS across MENA. Deploying now, first checks out this quarter. Founders selling into the Gulf: my DMs are open.",
    qualificationScore: 96,
    hoursAgo: 5,
    matchedKeywords: ["new fund", "B2B SaaS", "MENA"],
    status: "contacted",
    platform: "linkedin",
    company: "Gulf Growth Partners",
    location: "Riyadh, Saudi Arabia",
    verified: true,
    finance: { displayValue: "$30M fund", type: "funding" },
    pain: "Needs B2B SaaS deal flow selling into the Gulf",
    solution: "Direct intro to a founder selling into the region",
    extraSignal: {
      text: "Two weeks after first close: five term sheets signed. The pace tells you everything about how hungry this region is for B2B software.",
      hoursAgo: 3,
    },
  },
  {
    displayName: "Aaron Vogel",
    gender: "man",
    title: "Solo angel, ex-marketplace CTO",
    briefIntro:
      "Takes meetings from founders who send metrics-first notes and writes small, fast checks.",
    signal:
      "Send one number I can verify and one sentence on why now. That is a meeting. A twelve-slide deck is not. Writing $40k checks for B2B teams that ship.",
    qualificationScore: 85,
    hoursAgo: 15,
    matchedKeywords: ["angel", "metrics", "B2B"],
    status: "contacted",
    platform: "twitter",
    location: "Zurich, Switzerland",
    finance: { displayValue: "$40k checks", type: "check" },
    pain: "Deal flow skews toward polished decks over working products",
    solution: "Meet teams shipping before a round is announced",
    extraSignal: {
      text: "Reminder that still holds: every cold note with one verifiable number got a reply this month. Every deck-forward note did not.",
      hoursAgo: 6,
    },
  },
  {
    displayName: "Tomás Herrera",
    gender: "man",
    title: "Managing Partner at Rioja Capital",
    briefIntro:
      "Wrote about backing GTM tooling at seed and asked founders to share adoption metrics instead of decks.",
    signal:
      "Backing GTM tooling at seed. Do not send a deck, send adoption: weekly teams, retention, and what they stopped paying for. That is what moves a decision.",
    qualificationScore: 83,
    hoursAgo: 31,
    matchedKeywords: ["GTM tooling", "seed", "adoption"],
    status: "in_progress",
    platform: "linkedin",
    company: "Rioja Capital",
    location: "Madrid, Spain",
    finance: { displayValue: "$45M fund", type: "funding" },
    pain: "Decks hide whether a product is actually used",
    solution: "Adoption metrics in the first note",
  },
  {
    displayName: "Kofi Adjei",
    gender: "man",
    title: "Scout for a US seed fund",
    briefIntro:
      "Scouting African B2B SaaS and asked for DMs with live product links over decks.",
    signal:
      "Scouting African B2B SaaS for a US fund. Send a live product link and one metric you are proud of. I pass on anything that only exists as a deck.",
    qualificationScore: 74,
    hoursAgo: 49,
    matchedKeywords: ["scout", "B2B SaaS", "Africa"],
    status: "in_progress",
    platform: "twitter",
    location: "Accra, Ghana",
    pain: "Scout pipeline is full of decks without working products",
    solution: "Live product links over pitch decks",
  },
  {
    displayName: "Lena Hartmann",
    gender: "woman",
    title: "General Partner at Spree Capital",
    briefIntro:
      "Wrote that she takes pre-seed meetings from founders who build in public and shares what earns a second meeting.",
    signal:
      "Most of my pre-seed meetings this year started from a founder posting their build in public. What earns the second meeting: real users and a straight answer about what is not working.",
    qualificationScore: 93,
    hoursAgo: 10,
    matchedKeywords: ["pre-seed", "build in public", "GP"],
    status: "converted",
    platform: "linkedin",
    company: "Spree Capital",
    location: "Berlin, Germany",
    finance: { displayValue: "$18M fund", type: "funding" },
  },
  {
    displayName: "Miguel Santos",
    gender: "man",
    title: "Angel, ex-CRO",
    briefIntro:
      "Posted that his last three angel checks came from cold notes with pipeline metrics attached.",
    signal:
      "My last three angel checks came from cold notes with pipeline metrics attached. No warm intro, no deck. If your outbound numbers are real, I read those first.",
    qualificationScore: 78,
    hoursAgo: 24,
    matchedKeywords: ["angel", "pipeline metrics", "cold note"],
    status: "converted",
    platform: "twitter",
    location: "Lisbon, Portugal",
  },
];

const CANDIDATE_FILL: FillSeed[] = [
  {
    displayName: "Signe Aas",
    gender: "woman",
    title: "Senior product designer",
    briefIntro:
      "Open to founding designer roles; shipped two zero-to-one design systems and keeps her portfolio current.",
    signal:
      "Open to founding designer roles. I have shipped two zero-to-one design systems and I still push my own pixels. Portfolio in bio.",
    qualificationScore: 91,
    hoursAgo: 3,
    matchedKeywords: ["founding designer", "design systems", "portfolio"],
    location: "Oslo, Norway",
  },
  {
    displayName: "Matteo Ricci",
    gender: "man",
    title: "Staff frontend engineer",
    briefIntro:
      "Eight years on React design systems; wants a seed-stage seat where he still ships UI weekly.",
    signal:
      "Eight years on React design systems at scale. I want a seat where I still ship interface weekly, not just review other people's PRs. Seed-stage teams, my DMs are open.",
    qualificationScore: 88,
    hoursAgo: 7,
    matchedKeywords: ["frontend", "design systems", "staff"],
    location: "Bologna, Italy",
  },
  {
    displayName: "Freja Lund",
    gender: "woman",
    title: "Design engineer",
    briefIntro:
      "Ships interfaces from Figma to production and wants a team where design and code are one job.",
    signal:
      "Design engineer: I ship from Figma to production and I am looking for a team where design and code are one job. Latest work in the thread.",
    qualificationScore: 86,
    hoursAgo: 12,
    matchedKeywords: ["design engineer", "frontend", "portfolio"],
    location: "Copenhagen, Denmark",
  },
  {
    displayName: "Arun Nair",
    gender: "man",
    title: "Full-stack engineer, TypeScript",
    briefIntro:
      "Four years of Next.js and Node; wants a small team with end-to-end ownership and a fast shipping loop.",
    signal:
      "Four years of Next.js and Node in production. Looking for a small team where I own features end to end and ship weekly. GitHub in bio.",
    qualificationScore: 83,
    hoursAgo: 16,
    matchedKeywords: ["full-stack", "TypeScript", "small team"],
    location: "Pune, India",
  },
  {
    displayName: "Elif Kaya",
    gender: "woman",
    title: "Engineering manager",
    briefIntro:
      "Looking for engineering management roles; not a fit for the open individual-contributor seat.",
    signal:
      "After five years of IC work I am moving into engineering management. Looking for a team that needs a manager who still codes.",
    qualificationScore: 85,
    hoursAgo: 21,
    matchedKeywords: ["engineering manager", "platform", "leadership"],
    status: "archived",
    qualificationStatus: "disqualified",
    location: "Istanbul, Türkiye",
  },
];

const CANDIDATE_APPEND: FillSeed[] = [
  {
    displayName: "Maja Kowalczyk",
    gender: "woman",
    title: "Senior frontend engineer",
    briefIntro:
      "Open to senior frontend roles at product-led startups; six years of React and accessibility work.",
    signal:
      "Six years of React with a focus on accessibility. Looking for a senior frontend role at a product-led startup where the interface is the product. Portfolio and references ready.",
    qualificationScore: 89,
    hoursAgo: 6,
    matchedKeywords: ["frontend", "accessibility", "open to work"],
    status: "contacted",
    platform: "linkedin",
    location: "Kraków, Poland",
    finance: { displayValue: "€78k current", type: "compensation" },
    pain: "Senior IC roles want generalists; her depth is accessible, complex interfaces",
    solution: "Frontend seat owning complex UI and accessibility",
    extraSignal: {
      text: "From the vault: the audit checklist I run before shipping any complex settings screen. Steal it. Three teams have already caught bugs with it.",
      hoursAgo: 4,
    },
  },
  {
    displayName: "Diego Fuentes",
    gender: "man",
    title: "Product designer",
    briefIntro:
      "Redesigned onboarding for a fintech app and lifted activation 22 percent; wants a design-led team.",
    signal:
      "Case study: we redesigned onboarding for a fintech app and activation went up 22 percent. Sharing what we cut and why. Looking for a team where design leads the product.",
    qualificationScore: 84,
    hoursAgo: 13,
    matchedKeywords: ["product design", "case study", "onboarding"],
    status: "contacted",
    platform: "twitter",
    location: "Mexico City, Mexico",
    finance: { displayValue: "$60k target", type: "compensation" },
    pain: "Design seats are ticket-driven instead of design-led",
    solution: "Design seat owning the whole product surface",
    extraSignal: {
      text: "One more from that case study: we cut support tickets by a third by simplifying the first-run checklist. Full write-up in the thread.",
      hoursAgo: 5,
    },
  },
  {
    displayName: "Nikolai Sokolov",
    gender: "man",
    title: "Staff product engineer",
    briefIntro:
      "Ships across the stack with a designer's eye; open to founding-engineer seats at small teams.",
    signal:
      "Staff product engineer: I ship across the stack with a designer's eye for detail. Open to a founding-engineer seat on a small team where quality is the strategy.",
    qualificationScore: 79,
    hoursAgo: 30,
    matchedKeywords: ["product engineer", "founding", "full-stack"],
    status: "in_progress",
    platform: "linkedin",
    location: "Belgrade, Serbia",
    pain: "Big-company lanes cap what he can own",
    solution: "Founding engineer seat across the whole product",
  },
  {
    displayName: "Elliot Hayes",
    gender: "man",
    title: "Frontend engineer, design systems",
    briefIntro:
      "Maintains a 4k-star open source component library and wants a role where that muscle is the job.",
    signal:
      "I maintain a 4k-star component library on nights and weekends. I want the job where that is the actual work: design systems that make a product feel inevitable.",
    qualificationScore: 73,
    hoursAgo: 42,
    matchedKeywords: ["design systems", "open source", "frontend"],
    status: "in_progress",
    platform: "twitter",
    location: "Manchester, UK",
    pain: "Design-systems work is a side project today",
    solution: "Role where the component library is the product",
  },
  {
    displayName: "Amara Osei",
    gender: "woman",
    title: "Founding product designer",
    briefIntro:
      "Posted her portfolio with a note: founding designer seats only, where design owns the product.",
    signal:
      "Portfolio refresh is live. One rule: founding designer seats only. I want to own the design of a product from the first screen, not decorate someone else's roadmap.",
    qualificationScore: 92,
    hoursAgo: 8,
    matchedKeywords: ["founding designer", "portfolio", "zero-to-one"],
    status: "converted",
    platform: "linkedin",
    location: "Accra, Ghana",
  },
  {
    displayName: "Victor Adeyemi",
    gender: "man",
    title: "Frontend engineer",
    briefIntro:
      "Shared a rebuild of his team's design-system docs site and asked which startups need that obsession.",
    signal:
      "I rebuilt our design-system docs site in a weekend because it was embarrassing. Which startups need that level of obsession on their frontend? Open to roles.",
    qualificationScore: 81,
    hoursAgo: 26,
    matchedKeywords: ["frontend", "TypeScript", "open to roles"],
    status: "converted",
    platform: "twitter",
    location: "Lagos, Nigeria",
  },
];

const CREATOR_FILL: FillSeed[] = [
  {
    displayName: "Alba Serrano",
    gender: "woman",
    title: "YouTuber, productivity tools, 95k subs",
    briefIntro:
      "Planning next month of tool reviews and wants products with a clear before and after she can film.",
    signal:
      "Planning next month of reviews for my 95k subscribers. What I look for: a before and after I can film in one take. Small teams with real products, send links.",
    qualificationScore: 92,
    hoursAgo: 4,
    matchedKeywords: ["tool reviews", "YouTube", "creator"],
    location: "Valencia, Spain",
  },
  {
    displayName: "Ravi Menon",
    gender: "man",
    title: "Newsletter, pricing teardowns, 19k readers",
    briefIntro:
      "Features one underrated tool each week and writes for operators who actually buy software.",
    signal:
      "Every Thursday: one underrated tool, one pricing teardown, zero pay-to-play. 19k operators read it. Send what you built and where it stings.",
    qualificationScore: 86,
    hoursAgo: 9,
    matchedKeywords: ["newsletter", "pricing", "operators"],
    location: "Singapore",
  },
  {
    displayName: "Camille Roux",
    gender: "woman",
    title: "LinkedIn creator, B2B buying, 64k followers",
    briefIntro:
      "Collecting founder quotes for a roundup on how B2B buying actually changed.",
    signal:
      "How did B2B buying actually change? Not the panel-talk answer. Collecting founder quotes for a roundup my 64k followers read. The best get featured with links.",
    qualificationScore: 88,
    hoursAgo: 13,
    matchedKeywords: ["B2B buying", "roundup", "LinkedIn"],
    location: "Brussels, Belgium",
  },
  {
    displayName: "Stefan Marek",
    gender: "man",
    title: "Podcast host, Small Teams",
    briefIntro:
      "Books founders who grew distribution without a sales team; messy playbooks welcome.",
    signal:
      "Booking season five of Small Teams. If you grew a distribution channel without a sales team and the playbook is messy, that is exactly the episode I want.",
    qualificationScore: 81,
    hoursAgo: 18,
    matchedKeywords: ["podcast", "distribution", "founders"],
    location: "Zagreb, Croatia",
  },
  {
    displayName: "Dana Whitmore",
    gender: "woman",
    title: "TikTok creator, lifestyle, 50k followers",
    briefIntro:
      "Opens brand slots each month; audience skews consumer lifestyle rather than software buyers.",
    signal:
      "50k of you asked for the brand slot list again. Opening four slots this month. Day-in-the-life and unboxing formats only.",
    qualificationScore: 70,
    hoursAgo: 23,
    matchedKeywords: ["TikTok", "brand slots", "lifestyle"],
    status: "archived",
    qualificationStatus: "disqualified",
    location: "Austin, TX",
  },
];

const CREATOR_APPEND: FillSeed[] = [
  {
    displayName: "Greta Lindqvist",
    gender: "woman",
    title: "Newsletter, design tools, 31k readers",
    briefIntro:
      "Asks which design tools deserve a deep-dive and interviews the founders behind them.",
    signal:
      "Next month's deep-dive is open. Which design tool changed how your team actually ships? I interview the founders and tear down the pricing. No sponsored takes.",
    qualificationScore: 90,
    hoursAgo: 5,
    matchedKeywords: ["design tools", "deep-dive", "newsletter"],
    status: "contacted",
    platform: "linkedin",
    location: "Malmö, Sweden",
    finance: { displayValue: "$2.8k per sponsor slot", type: "sponsorship" },
    pain: "Deep-dives need products worth the scrutiny, without sponsor pressure",
    solution: "Full access plus honest talking points, no approval over copy",
    extraSignal: {
      text: "Mailbag results are in: you want tool comparisons with pricing teardowns, not listicles. The next three issues are exactly that.",
      hoursAgo: 3,
    },
  },
  {
    displayName: "Tobi Adesanya",
    gender: "man",
    title: "YouTube, indie SaaS builds, 57k subs",
    briefIntro:
      "Films build-in-public walkthroughs and asks for products learnable on camera in 30 minutes.",
    signal:
      "Filming walkthroughs for the next month. Rule: I have to learn your product on camera in 30 minutes, from scratch, no script. If it survives that, 57k subscribers see it.",
    qualificationScore: 85,
    hoursAgo: 12,
    matchedKeywords: ["YouTube", "walkthrough", "indie SaaS"],
    status: "contacted",
    platform: "twitter",
    location: "Lagos, Nigeria",
    finance: {
      displayValue: "$1.5k per integration video",
      type: "sponsorship",
    },
    pain: "Walkthrough videos need products learnable on camera",
    solution: "Guided sandbox with a real account and honest talking points",
  },
  {
    displayName: "Bruno Costa",
    gender: "man",
    title: "Podcast host, SaaS Operators",
    briefIntro:
      "Booking operators who moved one metric with one tool; episodes dissect the before and after.",
    signal:
      "Booking season guests. Format: one operator, one tool, one metric that moved. If you can name the before and after, you are the episode.",
    qualificationScore: 80,
    hoursAgo: 33,
    matchedKeywords: ["podcast", "operators", "metrics"],
    status: "in_progress",
    platform: "linkedin",
    location: "São Paulo, Brazil",
    finance: { displayValue: "$1.2k per episode slot", type: "sponsorship" },
    pain: "Episodes lack concrete before and after stories",
    solution: "One metric, one tool, dissected on air",
  },
  {
    displayName: "Henrik Fosse",
    gender: "man",
    title: "LinkedIn creator, developer tools, 45k followers",
    briefIntro:
      "Writing a series on tools that make small teams look big and collecting real weekly workflows.",
    signal:
      "Series in progress: tools that make a five-person team look like fifty. Send the workflow you actually run weekly, screenshots beat decks. 45k developer followers get the unfiltered version.",
    qualificationScore: 76,
    hoursAgo: 47,
    matchedKeywords: ["developer tools", "series", "workflow"],
    status: "in_progress",
    platform: "twitter",
    location: "Bergen, Norway",
    pain: "Series needs real weekly workflows, not vendor demos",
    solution: "Show the actual weekly workflow inside the product",
  },
  {
    displayName: "Mei Watanabe",
    gender: "woman",
    title: "Newsletter, no-code and AI tools, 44k readers",
    briefIntro:
      "Featured the product in her weekly tools issue after a hands-on trial and tracked the signup spike.",
    signal:
      "This week I tested eleven tools so you do not have to. The one I kept on my home screen gets the deep-dive section. 44k readers, honest verdicts only.",
    qualificationScore: 88,
    hoursAgo: 9,
    matchedKeywords: ["newsletter", "tools issue", "no-code"],
    status: "converted",
    platform: "linkedin",
    location: "Osaka, Japan",
    finance: { displayValue: "$3.2k per sponsor slot", type: "sponsorship" },
  },
  {
    displayName: "Louis Moreau",
    gender: "man",
    title: "YouTuber, tech reviews, 130k subs",
    briefIntro:
      "Published the review video with tracked signups and pinned the founder reply in the comments.",
    signal:
      "New review is live. What I say in the first 90 seconds decides whether you keep watching, so I test for a week before I film. 130k subscribers, no paid placements.",
    qualificationScore: 82,
    hoursAgo: 27,
    matchedKeywords: ["YouTube", "review", "tech"],
    status: "converted",
    platform: "twitter",
    location: "Lyon, France",
  },
];

const JOB_SEEKER_FILL: FillSeed[] = [
  {
    displayName: "Hanne Skov",
    gender: "woman",
    title: "Senior PM, B2B fintech",
    briefIntro:
      "Open to senior PM roles after eight years in B2B fintech; two zero-to-one launches.",
    signal:
      "Eight years in B2B fintech product, two zero-to-one launches, and now open to senior PM roles. Remote or Copenhagen. Intros very welcome.",
    qualificationScore: 90,
    hoursAgo: 2,
    matchedKeywords: ["senior PM", "open to work", "B2B"],
    location: "Aarhus, Denmark",
  },
  {
    displayName: "Dario Bianchi",
    gender: "man",
    title: "Growth marketer, PLG",
    briefIntro:
      "Ran PLG experiments at two SaaS scale-ups; ready for a growth lead seat where experiments ship weekly.",
    signal:
      "Four years of PLG experiments across two SaaS scale-ups. Ready for a growth lead seat where experiments actually ship weekly. Happy to share my experiment log.",
    qualificationScore: 87,
    hoursAgo: 6,
    matchedKeywords: ["growth", "PLG", "open to work"],
    location: "Turin, Italy",
  },
  {
    displayName: "Margaux Petit",
    gender: "woman",
    title: "Content designer",
    briefIntro:
      "Ships product copy that cuts support tickets and wants a team where words count as design.",
    signal:
      "I ship product copy that measurably cuts support tickets. Looking for a product team where words count as design, not an afterthought. Case studies in bio.",
    qualificationScore: 85,
    hoursAgo: 10,
    matchedKeywords: ["content design", "UX writing", "open to work"],
    location: "Nantes, France",
  },
  {
    displayName: "Kunal Mehta",
    gender: "man",
    title: "Data engineer",
    briefIntro:
      "Built the data spine for a fintech's analytics and wants a product-adjacent data role.",
    signal:
      "Built the data spine behind a fintech's analytics, from ingestion to the dashboards PMs actually read. Looking for a startup data role that sits close to product.",
    qualificationScore: 82,
    hoursAgo: 14,
    matchedKeywords: ["data engineer", "pipelines", "open to work"],
    location: "Pune, India",
  },
  {
    displayName: "Pia Kristensen",
    gender: "woman",
    title: "QA engineer",
    briefIntro:
      "Focused on QA lead roles with automation ownership; not a fit for the open product seat.",
    signal:
      "QA engineer with automation ownership across three releases. Exploring lead QA roles where the testing strategy is mine to build.",
    qualificationScore: 76,
    hoursAgo: 19,
    matchedKeywords: ["QA", "automation", "open to work"],
    status: "archived",
    qualificationStatus: "disqualified",
    location: "Odense, Denmark",
  },
];

const JOB_SEEKER_APPEND: FillSeed[] = [
  {
    displayName: "Nadia Ferreira",
    gender: "woman",
    title: "Product analyst, growth",
    briefIntro:
      "Runs the experimentation dashboard for a marketplace and wants growth work that ships.",
    signal:
      "I run the experimentation dashboard at a marketplace and I am looking for a growth team that treats analysis as a product input, not a reporting chore. Happy to walk through the dashboard.",
    qualificationScore: 88,
    hoursAgo: 5,
    matchedKeywords: ["product analyst", "growth", "experimentation"],
    status: "contacted",
    platform: "linkedin",
    location: "Campinas, Brazil",
    finance: { displayValue: "R$16k current", type: "compensation" },
    pain: "Analysis ends in decks nobody ships",
    solution: "Growth seat where insights become experiments",
    extraSignal: {
      text: "From the dashboard work: one cohort chart killed a third of our roadmap backlog. The method is simple and I wrote it up, link in comments.",
      hoursAgo: 3,
    },
  },
  {
    displayName: "Tomás Rivera",
    gender: "man",
    title: "Mobile engineer, React Native",
    briefIntro:
      "Shipped two consumer apps end to end and wants a mobile seat where mobile is the product.",
    signal:
      "Shipped two consumer apps end to end, from store listing to crash-free rates. Looking for a mobile seat at a startup where mobile IS the product, not a feature. Portfolio in bio.",
    qualificationScore: 84,
    hoursAgo: 12,
    matchedKeywords: ["mobile engineer", "React Native", "open to work"],
    status: "contacted",
    platform: "twitter",
    location: "Medellín, Colombia",
    finance: { displayValue: "$70k target", type: "compensation" },
    pain: "Mobile is a feature, not the product, at most companies",
    solution: "Mobile-first seat owning the whole app",
  },
  {
    displayName: "Abdou Kamara",
    gender: "man",
    title: "Backend engineer, Go",
    briefIntro:
      "Five years of Go and Postgres at a payments company and wants a seat with real ownership.",
    signal:
      "Five years of Go and Postgres at a payments company. I want a backend seat where I own services end to end, not a queue of tickets someone else scopes.",
    qualificationScore: 79,
    hoursAgo: 31,
    matchedKeywords: ["backend", "Go", "open to roles"],
    status: "in_progress",
    platform: "linkedin",
    location: "Abuja, Nigeria",
    finance: { displayValue: "$80k target", type: "compensation" },
    pain: "Payments backend work is maintenance-heavy",
    solution: "Backend seat owning services end to end",
  },
  {
    displayName: "Leon Fischer",
    gender: "man",
    title: "PMM, dev tools",
    briefIntro:
      "Launched two developer products to ten thousand users and wants PMM work where launch is the craft.",
    signal:
      "Launched two developer products from zero to ten thousand users. Open to PMM roles where launch is the craft, not a slide in a QBR. Launch recaps in my featured section.",
    qualificationScore: 73,
    hoursAgo: 44,
    matchedKeywords: ["PMM", "dev tools", "launch"],
    status: "in_progress",
    platform: "twitter",
    location: "Leipzig, Germany",
    pain: "PMM sits between sales and product with no owner",
    solution: "PMM seat owning launches end to end",
  },
  {
    displayName: "Ines Moreau",
    gender: "woman",
    title: "Senior content designer",
    briefIntro:
      "Posted a teardown of onboarding copy that cut the activation steps in half on paper.",
    signal:
      "I tore down the onboarding copy of an app I love and cut the activation steps from nine to four on paper. Teams that ship words like design: let's talk.",
    qualificationScore: 87,
    hoursAgo: 8,
    matchedKeywords: ["content design", "onboarding", "portfolio"],
    status: "converted",
    platform: "linkedin",
    location: "Geneva, Switzerland",
  },
  {
    displayName: "Tobias Kern",
    gender: "man",
    title: "Full-stack engineer, TypeScript",
    briefIntro:
      "Wants a four-person team where he owns features end to end, portfolio and references ready.",
    signal:
      "Four years of TypeScript and Node. Looking for a small team, four-ish people, where I own features end to end. References from two CTOs who say I ship. Portfolio in bio.",
    qualificationScore: 77,
    hoursAgo: 25,
    matchedKeywords: ["full-stack", "TypeScript", "small team"],
    status: "converted",
    platform: "twitter",
    location: "Rotterdam, Netherlands",
  },
];

const FILL_SEEDS_BY_USE_CASE: Record<UseCaseDemoKey, FillSeed[]> = {
  customers: CUSTOMER_FILL,
  investors: INVESTOR_FILL,
  candidates: CANDIDATE_FILL,
  creators: CREATOR_FILL,
  job_seekers: JOB_SEEKER_FILL,
};

const APPEND_SEEDS_BY_USE_CASE: Record<UseCaseDemoKey, FillSeed[]> = {
  customers: CUSTOMER_APPEND,
  investors: INVESTOR_APPEND,
  candidates: CANDIDATE_APPEND,
  creators: CREATOR_APPEND,
  job_seekers: JOB_SEEKER_APPEND,
};

export const USE_CASE_DEMO_DATASETS: UseCaseDemoDataset[] =
  USE_CASE_DEMO_CORE_DATASETS.map((dataset) => ({
    ...dataset,
    prospects: [
      ...dataset.prospects,
      ...buildSeedProspects(
        dataset.key,
        FILL_SEEDS_BY_USE_CASE[dataset.key],
        11
      ),
      ...buildSeedProspects(
        dataset.key,
        APPEND_SEEDS_BY_USE_CASE[dataset.key],
        16
      ),
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
      "Maren has a working product and no distribution. Mirror her first-ten-teams ask with what we find for teams like Tidepool and skip generic lead-gen language.",
    commentDescription: "Reply to her first-users ask",
    commentContent:
      "The first ten teams are already complaining in public. We watch for those posts and route them to Tidepool-shaped outreach. Happy to show what turned up this week.",
    dmDescription: "Send Tidepool-shaped buyer samples",
  }),
  use_case_demo_customers_13: draftPlan({
    id: "customers_13",
    rationale:
      "Ingrid just fired her lead-scoring vendor. Position live posts as the replacement source, not another black-box score.",
    commentDescription: "Reply to her lead-scoring teardown",
    commentContent:
      "A black-box score is hard to defend to the team. Live posts are the receipt: people already describing Meridian's problem in public. Happy to show a week of them.",
    dmDescription: "Send a live-intent sample for Meridian Labs",
  }),
  use_case_demo_customers_16: contactedPlan({
    id: "customers_16",
    rationale:
      "Rosa is asking exactly how outreach timing works. Show the 72-hour window with live Cairn-shaped matches and make the next step concrete.",
    commentDescription: "Reply to her outreach-timing question",
    dmDescription: "Send three live Cairn-shaped matches",
    dmContent:
      "Here are three mid-market analytics buyers posting about consolidation this week, all inside your 72-hour window. Want me to keep the monitor running for Cairn?",
  }),
  use_case_demo_customers_17: contactedPlan({
    id: "customers_17",
    rationale:
      "Felix's outbound is flat and ads are too expensive. Show what commenting where buyers complain does for Werkstatt before he spends another quarter on paid.",
    commentDescription: "Reply to his flat-outbound post",
    dmDescription: "Send a Werkstatt-shaped sample of live posts",
    dmContent:
      "Pulled six posts from teams complaining about field-service scheduling this week. This is the lane we would put Werkstatt in. Worth a look?",
  }),
  use_case_demo_customers_18: inProgressPlan({
    id: "customers_18",
    rationale:
      "Marcus is rebuilding the motion after a lost quarter. Keep momentum with a week of live Quarry-shaped signals and a concrete setup plan.",
    commentDescription: "Reply to his Q3 postmortem",
    dmDescription: "Send the live-signal motion overview",
    followUpDescription: "Follow up with a week of Quarry-shaped signals",
    followUpContent:
      "Here is a full week of live posts from health buyers describing the exact problem Quarry solves. Ready to pilot this as the default source for one rep?",
  }),
  use_case_demo_customers_19: inProgressPlan({
    id: "customers_19",
    rationale:
      "Yusuf knows communities do not scale. Show him the same listening across platforms without the spam.",
    commentDescription: "Reply to his community-scaling post",
    dmDescription: "Send the cross-platform listening overview",
    followUpDescription: "Follow up with Anka-shaped buyer threads",
    followUpContent:
      "Found nine buyer threads across X and LinkedIn this week that read like your best communities. Want me to route them to Anka weekly?",
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
      "Priyanka's thesis is vertical SaaS for India-first teams sold bottom-up. Mirror that language and ask for a meeting this month.",
    commentDescription: "Reply to her vertical-SaaS thesis post",
    commentContent:
      "Vertical SaaS sold bottom-up is exactly the lane. We help those teams find their first believers without a sales org. Open to a meeting this month?",
    waitDays: 3,
    dmDescription: "Send the thesis-fit memo",
  }),
  use_case_demo_investors_13: draftPlan({
    id: "investors_13",
    rationale:
      "Solveig is sourcing applied AI tools for Nordic industrials and prefers operator updates over decks. Lead with what shipped, not a pitch narrative.",
    commentDescription: "Reply to her applied-AI sourcing post",
    commentContent:
      "Applied AI for Nordic industrials, operator update not a deck: we ship an agent that finds buyers from live posts. Happy to send what we shipped last month.",
    dmDescription: "Send the operator update memo",
  }),
  use_case_demo_investors_16: contactedPlan({
    id: "investors_16",
    rationale:
      "Noor just closed a fund and is deploying now. Get a specific, traction-first note in front of her while the pace is hot.",
    commentDescription:
      "Congratulate her on the first close with a specific takeaway",
    dmDescription: "Send the MENA go-to-market note",
    dmContent:
      "Congratulations on the close. We help B2B teams in the Gulf find their first buyers from live posts. Ten teams run it weekly. Worth a short call while Fund I is deploying?",
  }),
  use_case_demo_investors_17: contactedPlan({
    id: "investors_17",
    rationale:
      "Aaron takes meetings from one verifiable number. Lead with weekly active teams, not a narrative.",
    commentDescription: "Reply to his one-number rule post",
    dmDescription: "Send the one-number note",
    dmContent:
      "One number: 40 teams run weekly discovery with us, up from 11 in March. Why now: cold email died. That is the whole note. Worth the meeting?",
  }),
  use_case_demo_investors_18: inProgressPlan({
    id: "investors_18",
    rationale:
      "Tomás asked for adoption over decks. Follow up with the exact numbers he named and a concrete next step.",
    commentDescription: "Reply to his adoption-over-decks post",
    dmDescription: "Send the adoption metrics snapshot",
    followUpDescription: "Follow up with the three numbers he asked for",
    followUpContent:
      "The three you asked for: weekly active teams, 90-day retention, and what they stopped paying for. Still open to a first meeting with Rioja?",
  }),
  use_case_demo_investors_19: inProgressPlan({
    id: "investors_19",
    rationale:
      "Kofi scouts with live product links, not decks. Send the product and the one metric, then keep the scout path warm.",
    commentDescription: "Reply to his scouting call",
    dmDescription: "Send the live product link and metric",
    followUpDescription: "Follow up with a draft scout note",
    followUpContent:
      "Product link and the metric are in. Want me to draft the scout note for the US fund so you can forward it this week?",
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
      "Signe wants a founding designer seat after shipping two zero-to-one design systems. Lead with zero-to-one product ownership, not a mid-level design lane.",
    commentDescription: "Reply to her founding-designer post",
    commentContent:
      "Founding designer seat, full product surface, early stage. Your two zero-to-one design systems are the muscle. Portfolio looked sharp — can I send the brief?",
    dmDescription: "Share the founding designer brief",
  }),
  use_case_demo_candidates_13: draftPlan({
    id: "candidates_13",
    rationale:
      "Freja is a design engineer who ships from Figma to production. Offer a seat where design and code are one job.",
    commentDescription: "Reply to her design-engineer post",
    commentContent:
      "A seat where design and code are one job is exactly how we build. Your Figma-to-production work is the fit. Happy to send what you would own in the first month.",
    dmDescription: "Send the design-engineer role brief",
  }),
  use_case_demo_candidates_16: contactedPlan({
    id: "candidates_16",
    rationale:
      "Maja wants a frontend seat where accessibility is the craft. Lead with the complex interfaces she would own and her audit-checklist angle.",
    commentDescription: "Reply to her accessibility-focused open-to-work post",
    dmDescription: "Send the frontend role brief with real UI",
    dmContent:
      "Your checklist post is the exact bar we hire for. The seat owns our settings and editor surfaces, complex keyboard-heavy UI. Can I send the brief?",
  }),
  use_case_demo_candidates_17: contactedPlan({
    id: "candidates_17",
    rationale:
      "Diego's onboarding case study is exactly the design-led work we need. Reference the 22 percent and ask about the next seat.",
    commentDescription: "Reply to his onboarding case study",
    dmDescription: "Send the design-led role note",
    dmContent:
      "The 22 percent activation lift is the kind of work we want owning our product. Design leads here, no ticket queue. Open to seeing the surface you would take over?",
  }),
  use_case_demo_candidates_18: inProgressPlan({
    id: "candidates_18",
    rationale:
      "Nikolai wants a founding-engineer seat with quality as the strategy. Follow up with the concrete first month.",
    commentDescription: "Reply to his founding-engineer post",
    dmDescription: "Send the founding-engineer scope",
    followUpDescription: "Follow up with a first-month walkthrough",
    followUpContent:
      "Here is what the first month looks like: one surface, end to end, with the quality bar yours to set. Still open to a founding seat?",
  }),
  use_case_demo_candidates_19: inProgressPlan({
    id: "candidates_19",
    rationale:
      "Elliot wants the component library to be the job. Follow up with the systems role and what he would inherit.",
    commentDescription: "Reply to his component-library post",
    dmDescription: "Send the design-systems role brief",
    followUpDescription: "Follow up with the library walkthrough",
    followUpContent:
      "The library you would inherit and the roadmap it needs. Still interested in making design systems the day job?",
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
      "Alba reviews productivity tools for 95k subscribers and films the before and after in one take. Offer a real account with real matches for the review.",
    commentDescription: "Reply to her tool-review planning thread",
    commentContent:
      "Built by a team of two, does one thing: finds the people already asking for your product. Real account for the review, you keep whatever it finds. Fit for the next batch?",
    dmDescription: "Send access + episode talking points",
  }),
  use_case_demo_creators_13: draftPlan({
    id: "creators_13",
    rationale:
      "Camille is collecting founder quotes on how B2B buying changed. Offer a concrete quote and a product she can verify with her audience.",
    commentDescription: "Reply to her B2B-buying roundup ask",
    commentContent:
      "Founder quote ready: we stopped buying lists and started commenting where buyers already complain. Happy to back it with a product your followers can click through.",
    dmDescription: "Send quote + product link for the roundup",
  }),
  use_case_demo_creators_16: contactedPlan({
    id: "creators_16",
    rationale:
      "Greta deep-dives design tools with founder interviews. Offer full access, real usage, and zero approval over her copy.",
    commentDescription: "Reply to her deep-dive call",
    dmDescription: "Send full access plus talking points",
    dmContent:
      "Full access, no strings, and you keep final cut on the copy. If it survives your pricing teardown, your readers get the truth and we get the scrutiny. In?",
  }),
  use_case_demo_creators_17: contactedPlan({
    id: "creators_17",
    rationale:
      "Tobi films 30-minute on-camera walkthroughs. Offer a sandbox account that survives being learned live, no script.",
    commentDescription: "Reply to his walkthrough call",
    dmDescription: "Send sandbox access for the on-camera test",
    dmContent:
      "Sandbox is live, no script needed. If you cannot learn it on camera in 30 minutes, we want to know that too. Filming window open all month.",
  }),
  use_case_demo_creators_18: inProgressPlan({
    id: "creators_18",
    rationale:
      "Bruno books one operator, one tool, one moved metric. Follow up with the exact before and after story he books.",
    commentDescription: "Reply to his season-booking post",
    dmDescription: "Send the before-and-after episode angle",
    followUpDescription: "Follow up with the operator guest offer",
    followUpContent:
      "The before: mornings lost to list building. The after: a live shortlist and one metric, reply rate. Fit for a season episode with the real numbers?",
  }),
  use_case_demo_creators_19: inProgressPlan({
    id: "creators_19",
    rationale:
      "Henrik wants real weekly workflows for the series. Follow up with actual captures from a working week, not a demo.",
    commentDescription: "Reply to his series call",
    dmDescription: "Send the real-workflow screenshots",
    followUpDescription: "Follow up with a week of raw workflow captures",
    followUpContent:
      "Captured a full week of real usage, unedited, the messy parts stay in. Still useful for the series?",
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
      "Hanne is open to senior PM roles after eight years in B2B fintech, remote or Copenhagen. Move fast with a concrete B2B PM scope.",
    commentDescription: "Reply to her senior PM open-to-work post",
    commentContent:
      "Senior PM seat, B2B product, remote or Copenhagen both work. Your zero-to-one launches are exactly the muscle. Can I send the first 90 days?",
    dmDescription: "Send the senior PM 90-day scope",
  }),
  use_case_demo_job_seekers_13: draftPlan({
    id: "job_seekers_13",
    rationale:
      "Margaux ships copy that cuts support tickets and wants words to count as design. Lead with a surface where the words are the interface.",
    commentDescription: "Reply to her content-design post",
    commentContent:
      "A product where the words are the interface, not an afterthought. Your support-ticket cuts are the proof. Happy to send a first-project brief.",
    dmDescription: "Send the content-design role + first project",
  }),
  use_case_demo_job_seekers_16: contactedPlan({
    id: "job_seekers_16",
    rationale:
      "Nadia wants analysis that ships. Lead with how her dashboards would drive the experiment queue.",
    commentDescription: "Reply to her product-analyst post",
    dmDescription: "Send the growth-team scope note",
    dmContent:
      "Your cohort-chart post is the exact input our growth loop needs. The seat owns the experiment queue end to end. Can I send the scope?",
  }),
  use_case_demo_job_seekers_17: contactedPlan({
    id: "job_seekers_17",
    rationale:
      "Tomás wants mobile to be the product. Lead with the app surface he would own and the crash-free bar.",
    commentDescription: "Reply to his mobile open-to-work post",
    dmDescription: "Send the mobile-first role note",
    dmContent:
      "Mobile is the whole product here. You would own the app end to end, store listing to crash-free rate. Can I send what you would take over?",
  }),
  use_case_demo_job_seekers_18: inProgressPlan({
    id: "job_seekers_18",
    rationale:
      "Abdou wants backend ownership, not scoped tickets. Follow up with the services he would own and the on-call shape.",
    commentDescription: "Reply to his backend open-to-roles post",
    dmDescription: "Send the backend ownership brief",
    followUpDescription: "Follow up with the service ownership map",
    followUpContent:
      "Here is the map: three services, one owner, and an on-call you can shape. Still looking for that kind of backend seat?",
  }),
  use_case_demo_job_seekers_19: inProgressPlan({
    id: "job_seekers_19",
    rationale:
      "Leon wants launch to be the craft. Follow up with a launch he would run in the first month.",
    commentDescription: "Reply to his PMM open-to-work post",
    dmDescription: "Send the launch-ownership brief",
    followUpDescription: "Follow up with the first-launch plan",
    followUpContent:
      "Here is the launch you would run in month one, with the retro from our last one attached. Still open to PMM seats?",
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
    qualificationReasoning: prospect.qualificationReasoning,
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
  const inProgress =
    dataset.prospects.find((prospect) => prospect.status === "in_progress") ??
    dataset.prospects[1];
  const converted =
    dataset.prospects.find((prospect) => prospect.status === "converted") ??
    dataset.prospects[1];
  const firstNameOf = (displayName: string | undefined) =>
    displayName?.split(" ")[0] ?? "there";
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
      _creationTime: BASE_TIME - 9 * HOUR,
      type: "outreach_sent",
      title: `${inProgress.displayName} — introduction sent`,
      message: `The approved introduction posted to ${firstNameOf(inProgress.displayName)}'s thread. The follow-up is drafted and waiting for your approval.`,
      status: "seen",
      prospectId: inProgress._id,
      prospectDisplayName: inProgress.displayName,
      prospectPlatform: inProgress.platform,
      prospectType: inProgress.prospectType,
      eventUpdatedAt: BASE_TIME - 9 * HOUR,
    },
    {
      _id: `demo_notification_${dataset.key}_4`,
      _creationTime: BASE_TIME - DAY - 3 * HOUR,
      type: "prospects_found",
      title: `New ${entityPluralLower} found`,
      message: `△ Agent found ${newCount} new ${entityPluralLower} matching your profile while you were away.`,
      status: "seen",
      eventUpdatedAt: BASE_TIME - DAY - 3 * HOUR,
    },
    {
      _id: `demo_notification_${dataset.key}_5`,
      _creationTime: BASE_TIME - DAY - 6 * HOUR,
      type: "plan_completed",
      title: `Plan completed for ${converted.displayName}`,
      message: `Outreach for ${converted.displayName} wrapped up with every task completed and logged on their profile.`,
      status: "seen",
      prospectId: converted._id,
      prospectDisplayName: converted.displayName,
      prospectPlatform: converted.platform,
      prospectType: converted.prospectType,
      eventUpdatedAt: BASE_TIME - DAY - 6 * HOUR,
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

/**
 * Derive the use case from a demo prospect id (`use_case_demo_<key>_<n>`).
 * Prospects travel through shared panels that do not receive the shell
 * context, so the id is the one reliable carrier of the use case.
 */
export function getDemoUseCaseKeyFromId(
  id: string
): UseCaseDemoKey | undefined {
  const match = /^use_case_demo_([a-z_]+)_(\d+)$/.exec(id);
  if (!match) return undefined;
  const candidate = match[1] as UseCaseDemoKey;
  return USE_CASE_DEMO_DATASETS.some((dataset) => dataset.key === candidate)
    ? candidate
    : undefined;
}
