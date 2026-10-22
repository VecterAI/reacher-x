import type { BlogDemoId } from "@/features/blog/lib/blogDemoHelpers";

/** Editorial copy shared by the visible pages and their Markdown representations. */
export const MARKETING_COPY = {
  home: {
    reveal: [],
    revealLine: "GTM. Unified",
    /** Plain-text form of the hero for the OG image and Markdown title. */
    headline: "GTM. Unified",
    /** Hero sub text; rendered with inline brand logos and repo link.
     * Ends without a period so the "Open source" link closes the line. */
    tagline:
      "Clay and Apollo take weeks to learn. ReacherX takes 5 minutes. Prospecting, CRM, outreach, and social in one tool. Open source",
    description:
      "Describe who you want to reach. ReacherX watches X/Twitter and LinkedIn around the clock, finds people who match, and helps you start real conversations.",
    guaranteeNote: "30-day money-back guarantee.",
    setupTimeNote: "Set up in under 5 minutes.",
  },
  /**
   * Hero-follow narrative, rendered as a scroll-fill statement. Covers the
   * four pillars: 24/7 discovery (X/Twitter, LinkedIn), built-in CRM, rich
   * outreach, and baked-in social engagement.
   */
  narrative: [
    "The people you're looking for are out there on X/Twitter and LinkedIn.",
    "ReacherX △ Agent finds them around the clock, keeps every relationship in a built-in CRM, and drafts outreach with voice notes, images, and videos. View profiles, like, comment, reply. All without leaving the app.",
    "No more stitching prospecting, a CRM, and outreach tools together. No funnels, no sales vocabulary. Just say who you need, in plain words.",
  ],
  workflow: {
    setup:
      "No tables or sales jargon. Tell △ Agent what you are working on and who you want to reach, in plain words.",
    research:
      "ReacherX finds people on X/Twitter and LinkedIn, researches their background, and explains every match.",
    outreach:
      "△ Agent writes to each person differently: your voice, their context, the research behind it. Replies, notes, and follow-ups stay in one place, so the relationship keeps moving.",
    outreachLimits: "Outreach runs within safe, human-like limits.",
    finishHeading: "Not for you? Full refund in 30 days.",
  },
  story: {
    connectionsHeading: "Not just for sales.",
    connections:
      "For founders, recruiters, creators — anyone building a network. Founders find customers and investors. Recruiters find candidates. Creators find collaborators. The problem is always the same: the right people.",
    authenticityHeading:
      "Everything in one tool. Nothing to learn.",
    developersHeading: "Open source.",
    developers:
      "ReacherX is built on Convex and part of the Convex Open Source program. Use, modify, and self-host it under AGPL-3.0. Improvements stay open for everyone.",
    communityHeading: "Join the community.",
  },
  product: {
    discovery:
      "There is no stale contact database to buy. ReacherX searches X/Twitter and LinkedIn in real time, around the clock, and researches every person it finds before you see them.",
    plans:
      "In a message, @ people and △ Agent drafts a plan for each: their profile, their recent work, the angle that fits. Review before anything goes out.",
    messages: "Send voice notes, images, and video inside your conversations.",
    memory:
      "Tell △ Agent how you write and who you look for, once. It applies your preferences to every later search and message.",
    moreHeading: "More, built in.",
  },
} as const;

export const MARKETING_CAPABILITY_CONTENT = [
  {
    title: "Qualification and enrichment",
    body: "Every match comes with research: profile details, recent posts, and why the person fits.",
    href: "/blog/how-reacherx-enrichment-works",
    demo: "how-reacherx-enrichment-works",
  },
  {
    title: "Manage relations",
    body: "Track status, notes, and conversations for everyone you find. A light CRM without the sales jargon.",
    href: "/blog/manage-people-with-reacherx",
    demo: "manage-people-with-reacherx",
  },
  {
    title: "Workspaces",
    body: "Give each goal or client its own △ Agent, people, and settings.",
    href: "/blog/workspaces-explained",
    demo: "workspaces-explained",
  },
  {
    title: "Analytics",
    body: "See replies, conversations, and results across your outreach in one report.",
    href: "/blog/read-your-reacherx-analytics",
    demo: "read-your-reacherx-analytics",
  },
  {
    title: "Agent observability",
    body: "Check what △ Agent did and why, at any moment. Pause it whenever you want.",
    href: "/blog/understand-agent-observability",
    demo: "understand-agent-observability",
  },
  {
    title: "Conversations in one place",
    body: "Read and reply to X/Twitter and LinkedIn messages side by side.",
    href: "/blog/manage-dm-conversations",
    demo: "manage-dm-conversations",
  },
  {
    title: "Autocomplete",
    body: "Write faster with suggestions that match your voice.",
    href: "/blog/write-with-autocomplete",
    demo: "write-with-autocomplete",
  },
  {
    title: "What runs on its own",
    body: "Discovery and research keep working when you are away. Every message waits for your approval unless you change that in settings.",
    href: "/blog/what-reacherx-does-automatically",
    demo: "what-reacherx-does-automatically",
  },
] satisfies { title: string; body: string; href: string; demo: BlogDemoId }[];
