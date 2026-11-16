import type { Doc } from "@/convex/_generated/dataModel";
import { getNestedRecord } from "@/convex/lib/typeGuards";
import { makeProspect } from "@/features/landing/ui/components/use-case-demo/useCaseDemoData";
import { additionalDemoPosts } from "./profileActivityFixtures";
import { applyDemoPortrait } from "./portraitHelpers";

export function demoHandle(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 15);
}

/** Freelance-designer customers keep every tab populated without colliding with story people. */
export function createSecondaryCustomers(workspace: Doc<"workspaces">) {
  const seeds: Array<{
    displayName: string;
    title: string;
    signal: string;
    gender: "woman" | "man";
    status?: "new" | "contacted" | "in_progress";
    platform?: "twitter" | "linkedin";
    location?: string;
    score: number;
  }> = [
    {
      displayName: "Daniel Okafor",
      title: "Independent web designer",
      signal:
        "I build sites for local shops. Client revisions arrive in email, WhatsApp and an old PDF. Has anyone found a simple way to keep approvals together?",
      gender: "man",
      score: 92,
    },
    {
      displayName: "Sofia Marchetti",
      title: "Freelance brand designer",
      signal:
        "One client approved a logo in email, then requested the previous version in chat. I need a clearer client-feedback and approval trail.",
      gender: "woman",
      score: 88,
    },
    {
      displayName: "Camila Ruiz",
      title: "Independent product designer",
      signal:
        "My freelance clients send screenshots with comments in different places. A single review link would save me hours each week.",
      gender: "woman",
      score: 84,
    },
    {
      displayName: "Greta Hoffmann",
      title: "Independent brand designer",
      gender: "woman",
      score: 89,
      location: "Vienna, Austria",
      signal:
        "Small retail clients approve in chat, then email changes the same week. I need one approval trail per project, not three apps.",
    },
    {
      displayName: "Priya Desai",
      title: "Freelance web designer",
      gender: "woman",
      score: 86,
      platform: "twitter",
      location: "Pune, India",
      signal:
        "My studio clients send feedback in chat and approvals by email. Reconciling the two before delivery takes longer than the redesign.",
    },
    {
      displayName: "Nadia Rahim",
      title: "Independent product designer",
      gender: "woman",
      score: 90,
      location: "Copenhagen, Denmark",
      signal:
        "A client approved the onboarding flow in email, then their developer sent different notes in chat. One ordered record of decisions would fix this.",
    },
    {
      displayName: "Lucia Fernandez",
      title: "Freelance brand and web designer",
      gender: "woman",
      score: 83,
      location: "Madrid, Spain",
      signal:
        "Boutique clients approve in WhatsApp and revise by email. I started restating every approval in one line; the revision rounds finally stopped.",
    },
    {
      displayName: "Emma Lefevre",
      title: "Independent UI designer",
      gender: "woman",
      score: 81,
      platform: "twitter",
      location: "Lille, France",
      signal:
        "Client feedback lives in chat, approvals in email, and the brief on a shared drive. The first hour of every review reconnects the three.",
    },
    {
      displayName: "Hana Kimura",
      title: "Freelance product designer",
      gender: "woman",
      score: 88,
      location: "Kyoto, Japan",
      signal:
        "Small teams approve in chat at midnight and email the scope the next morning. My project doc is the only place both exist together.",
    },
    {
      displayName: "Tara McAllister",
      title: "Independent web designer",
      gender: "woman",
      score: 85,
      status: "contacted",
      location: "Galway, Ireland",
      signal:
        "Local clients approve on paper, by email, and in chat. I photograph the paper and file all three; there must be a simpler way.",
    },
    {
      displayName: "Viktor Halvorsen",
      title: "Freelance brand designer",
      gender: "man",
      score: 87,
      location: "Oslo, Norway",
      signal:
        "A client approved the wrong logo version from an old email thread. An approval summary with every round is my rule now.",
    },
    {
      displayName: "Omar Farouk",
      title: "Independent web designer",
      gender: "man",
      score: 82,
      platform: "twitter",
      location: "Casablanca, Morocco",
      signal:
        "Restaurant clients sign off in chat while change requests arrive in a shared document. Two sources of truth, one launch date.",
    },
    {
      displayName: "Jules Marchand",
      title: "Freelance product designer",
      gender: "man",
      score: 84,
      location: "Bordeaux, France",
      signal:
        "Founders send UI feedback in chat at midnight; the approved scope arrives by email later. Sprint one is reconciling the two.",
    },
    {
      displayName: "Emil Sørensen",
      title: "Independent UI designer",
      gender: "man",
      score: 79,
      platform: "twitter",
      location: "Aarhus, Denmark",
      signal:
        "Agency partners approve in email; their clients comment in the design file. One ordered trail of decisions is what I actually need.",
    },
    {
      displayName: "Nico Weiss",
      title: "Freelance web designer",
      gender: "man",
      score: 86,
      location: "Zurich, Switzerland",
      signal:
        "Startup clients approve in chat and their ops lead emails a different change list. A numbered change list is doing the work of three apps.",
    },
    {
      displayName: "Ken Ishida",
      title: "Independent brand designer",
      gender: "man",
      score: 83,
      status: "in_progress",
      location: "Nagoya, Japan",
      signal:
        "Delivery-day audit: the approval email, the chat thread, and the deck comments. Two of three disagreed last week.",
    },
    {
      displayName: "Paul Egan",
      title: "Freelance web designer",
      gender: "man",
      score: 80,
      platform: "twitter",
      location: "Cork, Ireland",
      signal:
        "Trades clients sign off in chat and revise by email. I keep one numbered list per project; approvals still arrive everywhere else.",
    },
    {
      displayName: "Marco Duarte",
      title: "Independent product designer",
      gender: "man",
      score: 88,
      location: "São Paulo, Brazil",
      signal:
        "Client decisions live in chat, email, and file comments. Rebuilding the decision trail from screenshots before handoffs should not be my job.",
    },
    {
      displayName: "Stefan Vogt",
      title: "Freelance brand and web designer",
      gender: "man",
      score: 81,
      location: "Hamburg, Germany",
      signal:
        "Boutique clients mean personal service, but the approval trail should not live in my memory. One confirmed message per milestone is the ask now.",
    },
    {
      displayName: "Idris Lawal",
      title: "Independent web designer",
      gender: "man",
      score: 85,
      platform: "twitter",
      location: "Lagos, Nigeria",
      signal:
        "Client revisions arrive in email, WhatsApp, and an old PDF. Has anyone found a simple way to keep approvals together?",
    },
    {
      displayName: "Henrik Dahl",
      title: "Freelance UI designer",
      gender: "man",
      score: 87,
      location: "Malmö, Sweden",
      signal:
        "I record the decision beside the screen it changed. Everything else is archaeology across chat and email.",
    },
    {
      displayName: "Callum Wright",
      title: "Independent product designer",
      gender: "man",
      score: 82,
      platform: "twitter",
      location: "Leeds, UK",
      signal:
        "A client approved last Tuesday's flow in email, then requested the old version in chat on Friday. The tracker caught it; the tools did not.",
    },
    {
      displayName: "Beatriz Lima",
      title: "Freelance brand designer",
      gender: "woman",
      score: 90,
      status: "contacted",
      location: "Lisbon, Portugal",
      signal:
        "The family business approved the wordmark by email; the founder's son sent different notes in chat that evening. The written approval summary settled it.",
    },
    {
      displayName: "Sara Haugen",
      title: "Independent web designer",
      gender: "woman",
      score: 86,
      status: "contacted",
      location: "Bergen, Norway",
      signal:
        "A client signed off in chat, then emailed changes the same afternoon. One document per project keeps the conflict visible.",
    },
    {
      displayName: "Zoe Palmer",
      title: "Freelance product designer",
      gender: "woman",
      score: 84,
      status: "contacted",
      platform: "twitter",
      location: "Bristol, UK",
      signal:
        "Approvals in Slack, revisions by email, briefs in a doc. My weekly digest turns the three into one summary clients reply to.",
    },
    {
      displayName: "Leila Nasser",
      title: "Independent brand designer",
      gender: "woman",
      score: 88,
      status: "contacted",
      location: "Tunis, Tunisia",
      signal:
        "A retailer approved version two by email while their manager mentioned version three in chat. One approval trail with names and dates fixed it.",
    },
    {
      displayName: "Anna Kowalik",
      title: "Freelance web designer",
      gender: "woman",
      score: 83,
      status: "contacted",
      location: "Kraków, Poland",
      signal:
        "The client's team approves in three chats and one email. Quoting the approval back in writing ends every dispute before it starts.",
    },
    {
      displayName: "Bianca Ferretti",
      title: "Independent UI designer",
      gender: "woman",
      score: 87,
      status: "contacted",
      location: "Bologna, Italy",
      signal:
        "I record who approved what beside the screen it changed. Clients have started copying the format for their own teams.",
    },
    {
      displayName: "Wren Ashby",
      title: "Freelance product designer",
      gender: "woman",
      score: 85,
      status: "contacted",
      platform: "twitter",
      location: "Cardiff, UK",
      signal:
        "Two inboxes, one client, and a homepage revision nobody can find. Restating each decision in one line before building saved whole rounds.",
    },
    {
      displayName: "Mina Alvarado",
      title: "Independent web designer",
      gender: "woman",
      score: 81,
      status: "contacted",
      location: "Valparaíso, Chile",
      signal:
        "Local shops sign off in chat and revise by email. One project folder with every approval photographed is now the only complete record.",
    },
    {
      displayName: "Viktor Sandberg",
      title: "Freelance brand and web designer",
      gender: "man",
      score: 89,
      status: "in_progress",
      location: "Uppsala, Sweden",
      signal:
        "The client approved in chat at midnight and emailed a different direction at nine. One thread and one approval message per milestone fixed it.",
    },
    {
      displayName: "Ayla Demirkan",
      title: "Independent product designer",
      gender: "woman",
      score: 86,
      status: "in_progress",
      location: "Izmir, Türkiye",
      signal:
        "Client decisions live in chat, email, and file comments. The decision log in the project doc is now the only thing everybody reads.",
    },
    {
      displayName: "Rui Tavares",
      title: "Freelance web designer",
      gender: "man",
      score: 83,
      status: "in_progress",
      platform: "twitter",
      location: "Faro, Portugal",
      signal:
        "Sign-off for the booking page happened in chat; the change requests keep arriving by email. Rebuilding the tracker tonight.",
    },
    {
      displayName: "Paloma Herrera",
      title: "Independent brand designer",
      gender: "woman",
      score: 88,
      status: "in_progress",
      location: "Seville, Spain",
      signal:
        "The delivery audit found version four approved in email and version three in chat. The written summary has prevented a repeat twice now.",
    },
    {
      displayName: "Elias Brandt",
      title: "Freelance UI designer",
      gender: "man",
      score: 80,
      status: "in_progress",
      platform: "twitter",
      location: "Dresden, Germany",
      signal:
        "Founder feedback arrives in chat at midnight; the approved scope comes by email two days later. Restating each approval in one line saves the sprint.",
    },
    {
      displayName: "Noor Edwards",
      title: "Independent product designer",
      gender: "woman",
      score: 87,
      status: "in_progress",
      location: "Manchester, UK",
      signal:
        "A client approved the onboarding flow in email, then their developer sent contradictory notes in chat. The decision log beside each screen settles it.",
    },
    {
      displayName: "Tomas Ricci",
      title: "Freelance brand designer",
      gender: "man",
      score: 84,
      status: "in_progress",
      location: "Florence, Italy",
      signal:
        "One client, three approval channels, zero searchable records. The project doc is now the single trail and disputes end at the record.",
    },
  ];
  return seeds.map((person, index) => ({
    ...applyDemoPortrait(
      makeProspect({
        displayName: person.displayName,
        title: person.title,
        briefIntro: person.signal,
        signal: person.signal,
        key: `customers_${index + 1}`,
        platform: person.platform ?? (index % 3 === 2 ? "twitter" : "linkedin"),
        handle: demoHandle(person.displayName),
        qualificationScore: person.score,
        hoursAgo: index + 1,
        matchedKeywords: ["client feedback", "design approvals"],
        status: person.status,
        gender: person.gender,
        ...(person.location ? { location: person.location } : {}),
      })
    ),
    workspaceId: workspace._id,
    userId: workspace.userId,
    enrichmentStatus: "enriched" as const,
  }));
}

/** Evidence dates, identity and summary detail share one source throughout the demo. */
export function populateDemoResearch(person: Doc<"prospects">, index: number) {
  const handle = demoHandle(person.displayName ?? `person${index}`);
  const keywords = person.matchedKeywords?.length
    ? person.matchedKeywords
    : (person.title ?? "Independent professional")
        .split(/[ ·]+/)
        .filter((word) => word.length > 3)
        .slice(0, 4);
  person.matchedKeywords = keywords;
  person.finance = undefined;
  if (!person.company)
    person.company = /investor/i.test(person.title ?? "")
      ? person.displayName === "Amelia Grant"
        ? "Harbour Health Ventures"
        : /angel/i.test(person.title ?? "")
          ? "Independent angel investor"
          : "Northbank Growth Partners"
      : /tutor/i.test(person.title ?? "")
        ? /centre/i.test(person.title ?? "")
          ? "Oakbridge Learning Centre"
          : "Independent tutoring practice"
        : /designer|design/i.test(person.title ?? "")
          ? "Independent design practice"
          : /creator|educator|teacher/i.test(person.title ?? "")
            ? "Independent education studio"
            : "Independent developer";
  if (!person.location)
    person.location = /investor|tutor/i.test(person.title ?? "")
      ? "London, United Kingdom"
      : "Berlin, Germany";

  person.stageTimestamps = {
    new: person._creationTime,
    ...(["contacted", "in_progress", "converted"].includes(person.status)
      ? { contacted: person._creationTime + 60000 }
      : {}),
    ...(["in_progress", "converted"].includes(person.status)
      ? { in_progress: person._creationTime + 120000 }
      : {}),
    ...(person.status === "converted"
      ? { converted: person._creationTime + 180000 }
      : {}),
    ...(person.status === "archived"
      ? { archived: person._creationTime + 180000 }
      : {}),
  };
  person.updatedAt =
    person.stageTimestamps[person.status] ?? person._creationTime;
  person.qualificationReasoning =
    person.qualificationStatus === "disqualified"
      ? `Excluded: ${person.briefIntro}`
      : `Relevant evidence: ${person.briefIntro ?? "Professional experience matches the requested audience."} Review the original activity and current profile before reaching out; availability and interest have not been assumed.`;
  person.socialProfiles = {
    ...person.socialProfiles,
    ...(person.platform === "twitter"
      ? { twitter: { username: handle, url: `https://x.com/${handle}` } }
      : {}),
  };
  if ((person.evidencePosts?.length ?? 0) === 1)
    person.evidencePosts = [
      ...person.evidencePosts!,
      ...additionalDemoPosts(person),
    ];
  for (const [postIndex, post] of (person.evidencePosts ?? []).entries()) {
    const timestamp = person._creationTime - (postIndex + 1) * 86400000;
    const id = `${BigInt("1900000000000000000") + BigInt(index * 100 + postIndex)}`;
    const user = getNestedRecord(post, "user");
    if (user) {
      post.id_str = id;
      user.screen_name = handle;
      post.tweet_created_at = new Date(timestamp).toISOString();
      post.favorite_count = 18 + index * 7;
      post.reply_count = 2 + index;
    } else {
      post.postID = `urn:li:activity:${id}`;
      post.postedAt = { timestamp };
      post.engagements = {
        totalReactions: 23 + index * 11,
        commentsCount: 3 + index * 2,
        repostsCount: index + 1,
      };
    }
  }
}
