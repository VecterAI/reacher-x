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

export function createSecondaryCustomers(workspace: Doc<"workspaces">) {
  return [
    {
      displayName: "Daniel Okafor",
      title: "Independent web designer",
      signal:
        "I build sites for local shops. Client revisions arrive in email, WhatsApp and an old PDF. Has anyone found a simple way to keep approvals together?",
    },
    {
      displayName: "Sofia Marchetti",
      title: "Freelance brand designer",
      signal:
        "One client approved a logo in email, then requested the previous version in chat. I need a clearer client-feedback and approval trail.",
    },
    {
      displayName: "Camila Ruiz",
      title: "Independent product designer",
      signal:
        "My freelance clients send screenshots with comments in different places. A single review link would save me hours each week.",
    },
  ].map((person, index) => ({
    ...applyDemoPortrait(
      makeProspect({
        ...person,
        key: `customers_${index + 1}`,
        platform: index === 2 ? "twitter" : "linkedin",
        handle: demoHandle(person.displayName),
        briefIntro: person.signal,
        qualificationScore: 92 - index * 4,
        hoursAgo: index + 1,
        matchedKeywords: ["client feedback", "design approvals"],
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
