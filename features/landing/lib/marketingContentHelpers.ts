import type { BlogDemoId } from "@/features/blog/lib/blogDemoHelpers";

/** Editorial copy shared by the visible pages and their Markdown representations. */
export const MARKETING_COPY = {
  home: {
    headline: "The △ Agent that brings the right people into your network.",
    description:
      "Tell it who you need. It watches X/Twitter and LinkedIn around the clock, finds people who fit, and helps you turn strangers into relationships.",
    setupTimeNote: "Set up in under 5 minutes.",
  },
  workflow: {
    setup:
      "No tables or sales jargon. Tell △ Agent what you are working on and who you want to reach, in plain words.",
    research:
      "ReacherX finds people on X/Twitter and LinkedIn, researches their background, and explains every match.",
    outreach:
      "△ Agent starts each conversation with a personal introduction, then keeps every reply, note, and follow-up in one place, so the relationship keeps moving.",
    finishHeading: "Who should be in your network?",
  },
  story: {
    connectionsHeading: "Selling, hiring, or raising. Same agent.",
    connections:
      "Selling, hiring, or raising. The problem is always the same: the right people.",
    authenticityHeading: "Your network is your net worth. Build it with △ Agent.",
    developersHeading: "Open source.",
    developers:
      "Use, modify, and self-host ReacherX under AGPL-3.0, as part of the Convex Open Source program. Improvements stay open for everyone.",
    communityHeading: "Join the community.",
    community:
      "ReacherX is built in the open, with people using it, not just around it.",
  },
  product: {
    discovery:
      "ReacherX keeps searching X/Twitter and LinkedIn around the clock, and researches every person it finds before you see them.",
    plans:
      "△ Agent plans how to reach each person and how to keep the conversation going, with every draft ready for your review.",
    messages:
      "Send voice notes, images, and video inside your conversations. In agent chat, mention several people in one message with @ tags.",
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
    title: "People management",
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
