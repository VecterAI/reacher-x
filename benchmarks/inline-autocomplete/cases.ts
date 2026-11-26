import type { AutocompleteCase } from "./types";

const REACHERX_WORKSPACE = {
  name: "ReacherX",
  description:
    "Open-source networking and relationship platform that unifies prospect discovery, CRM, outreach, and social in one app.",
  outreachGoal:
    "Start genuine conversations with founders, indie hackers, and developers who need a simpler way to find their first customers.",
  audienceLabel: "prospects",
} as const;

const TWITTER_VOICE =
  "Casual, direct, builder-to-builder. Short lowercase-friendly sentences, zero corporate buzzwords, no exclamation spam, sounds like a real founder replying on X.";

const LINKEDIN_VOICE =
  "Warm, concise, peer-to-peer founder voice. No corporate fluff or cringe hooks. 1-2 short sentences that respond directly to what the other person shared.";

/**
 * 20 realistic ReacherX inline-autocomplete scenarios spanning all live
 * surfaces plus multi-keystroke cache sequences and no-completion edge cases.
 */
export const AUTOCOMPLETE_CASES: readonly AutocompleteCase[] = [
  // =========================================================================
  // 1. Agent Chat Threads (5 cases, including a 3-keystroke cache sequence)
  // =========================================================================
  {
    id: "agent-thread-cache-1",
    surface: "agent_chat",
    surfaceLabel: "agent_chat",
    platform: "generic",
    cacheGroup: "agent-thread-a",
    workspace: REACHERX_WORKSPACE,
    styleProfile: TWITTER_VOICE,
    conversationHistory: [
      {
        role: "user",
        text: "Find 15 devtool founders on X who launched an AI coding tool in the last 30 days and complained about cold outreach.",
      },
      {
        role: "assistant",
        text: "Found 14 matching founders and added them to the list. Top 3 matches are @maya_builds (CodePulse), @devon_k (TestPilot), and @sara_cli (ShipFast CLI). Want me to draft X DMs for the top 3 or filter by follower count first?",
      },
    ],
    beforeCursor: "Filter out anyone with fewer than ",
    expectedIntent:
      "Continue the filtering criterion naturally (e.g. '1,000 followers and draft DMs for the rest' or '500 followers first').",
  },
  {
    id: "agent-thread-cache-2",
    surface: "agent_chat",
    surfaceLabel: "agent_chat",
    platform: "generic",
    cacheGroup: "agent-thread-a",
    workspace: REACHERX_WORKSPACE,
    styleProfile: TWITTER_VOICE,
    conversationHistory: [
      {
        role: "user",
        text: "Find 15 devtool founders on X who launched an AI coding tool in the last 30 days and complained about cold outreach.",
      },
      {
        role: "assistant",
        text: "Found 14 matching founders and added them to the list. Top 3 matches are @maya_builds (CodePulse), @devon_k (TestPilot), and @sara_cli (ShipFast CLI). Want me to draft X DMs for the top 3 or filter by follower count first?",
      },
    ],
    beforeCursor: "Draft X DMs for @maya_builds and ",
    expectedIntent:
      "Reference the other top matches from the thread (@devon_k and @sara_cli).",
  },
  {
    id: "agent-thread-cache-3",
    surface: "agent_chat",
    surfaceLabel: "agent_chat",
    platform: "generic",
    cacheGroup: "agent-thread-a",
    workspace: REACHERX_WORKSPACE,
    styleProfile: TWITTER_VOICE,
    conversationHistory: [
      {
        role: "user",
        text: "Find 15 devtool founders on X who launched an AI coding tool in the last 30 days and complained about cold outreach.",
      },
      {
        role: "assistant",
        text: "Found 14 matching founders and added them to the list. Top 3 matches are @maya_builds (CodePulse), @devon_k (TestPilot), and @sara_cli (ShipFast CLI). Want me to draft X DMs for the top 3 or filter by follower count first?",
      },
    ],
    beforeCursor: "Keep the DMs super short and mention ",
    expectedIntent:
      "Reference their recent AI coding tool launch or cold outreach pain point from the thread.",
  },
  {
    id: "agent-thread-plan-edit",
    surface: "agent_chat",
    surfaceLabel: "agent_chat",
    platform: "generic",
    workspace: REACHERX_WORKSPACE,
    prospect: {
      displayName: "Devon Kim",
      title: "Co-founder & CTO",
      company: "TestPilot",
      briefIntro: "Building AI end-to-end test generation for Next.js teams.",
    },
    styleProfile: TWITTER_VOICE,
    conversationHistory: [
      {
        role: "user",
        text: "What's the current outreach plan for Devon?",
      },
      {
        role: "assistant",
        text: "Devon has 2 pending tasks: 1) Reply to his X post about flaky Playwright tests (scheduled tomorrow), 2) Send a LinkedIn connection request with a short note next Tuesday.",
      },
    ],
    beforeCursor: "Skip the LinkedIn invite and just ",
    expectedIntent:
      "Reference keeping/sending the X reply about flaky Playwright tests instead.",
  },
  {
    id: "agent-thread-recruiter-usecase",
    surface: "agent_chat",
    surfaceLabel: "agent_chat",
    platform: "generic",
    workspace: {
      name: "Founding Engineer Search",
      description:
        "Hiring a founding full-stack TypeScript engineer in Europe or UK remote.",
      outreachGoal:
        "Reach out to strong TypeScript/Next.js builders with open-source work.",
      audienceLabel: "candidates",
    },
    conversationHistory: [
      {
        role: "user",
        text: "Show me candidates from yesterday's batch who have shipped production Convex or Next.js apps.",
      },
      {
        role: "assistant",
        text: "4 candidates matched: Lukas Weber (Berlin), Priya Nair (London), Tomas Novak (Prague), and Hannah Lind (Stockholm). Lukas and Priya both maintain popular open-source TypeScript repos.",
      },
    ],
    beforeCursor: "Let's start with Lukas and Priya, can you ",
    expectedIntent:
      "Ask the agent to draft outreach, inspect their repos/profiles, or create a plan for them.",
  },

  // =========================================================================
  // 2. X DMs (4 cases, including a 2-keystroke cache sequence)
  // =========================================================================
  {
    id: "x-dm-cache-1",
    surface: "x_dm",
    surfaceLabel: "x_dm_composer",
    platform: "twitter",
    cacheGroup: "x-dm-a",
    workspace: REACHERX_WORKSPACE,
    prospect: {
      displayName: "Maya Chen",
      title: "Founder",
      company: "CodePulse",
      briefIntro:
        "Solo founder building an AI PR review bot. Bootstrapped, 2k followers.",
    },
    styleProfile: TWITTER_VOICE,
    conversationHistory: [
      {
        role: "user",
        text: "hey maya, saw your thread about burning 4 hours stitching clay + apollo together for codepulse. we're building an open-source tool that replaces that whole stack in one place if you ever want to peek.",
      },
      {
        role: "prospect",
        author: "Maya Chen",
        text: "oh nice, honestly tired of paying $300/mo across three tools just to send 20 DMs a week. is it self-hostable or hosted? and do you have a GitHub link?",
      },
    ],
    beforeCursor: "yep both, you can self-host or ",
    expectedIntent:
      "Answer her question naturally (use the hosted version + drop the GitHub link).",
  },
  {
    id: "x-dm-cache-2",
    surface: "x_dm",
    surfaceLabel: "x_dm_composer",
    platform: "twitter",
    cacheGroup: "x-dm-a",
    workspace: REACHERX_WORKSPACE,
    prospect: {
      displayName: "Maya Chen",
      title: "Founder",
      company: "CodePulse",
      briefIntro:
        "Solo founder building an AI PR review bot. Bootstrapped, 2k followers.",
    },
    styleProfile: TWITTER_VOICE,
    conversationHistory: [
      {
        role: "user",
        text: "hey maya, saw your thread about burning 4 hours stitching clay + apollo together for codepulse. we're building an open-source tool that replaces that whole stack in one place if you ever want to peek.",
      },
      {
        role: "prospect",
        author: "Maya Chen",
        text: "oh nice, honestly tired of paying $300/mo across three tools just to send 20 DMs a week. is it self-hostable or hosted? and do you have a GitHub link?",
      },
    ],
    beforeCursor: "here's the GitHub repo if you ",
    expectedIntent:
      "Continue naturally in casual X DM tone (e.g., 'want to check it out' / 'wanna poke around').",
  },
  {
    id: "x-dm-scheduling",
    surface: "x_dm",
    surfaceLabel: "x_dm_composer",
    platform: "twitter",
    workspace: REACHERX_WORKSPACE,
    prospect: {
      displayName: "Samir Patel",
      title: "Indie Hacker",
      company: "LaunchDeck",
    },
    styleProfile: TWITTER_VOICE,
    conversationHistory: [
      {
        role: "prospect",
        author: "Samir Patel",
        text: "down to do a quick 15 min walkthrough Thursday afternoon if you're free, I'm on EST",
      },
    ],
    beforeCursor: "Thursday works great, how about ",
    expectedIntent:
      "Suggest a specific Thursday afternoon EST time (e.g., '2pm EST?' or '3pm EST?').",
  },
  {
    id: "x-dm-creator-collab",
    surface: "x_dm",
    surfaceLabel: "x_dm_composer",
    platform: "twitter",
    workspace: {
      name: "Creator Partnerships",
      description: "Partnering with AI/dev YouTubers for product demos.",
      outreachGoal: "Book sponsored demo videos with developer creators.",
      audienceLabel: "creators",
    },
    prospect: {
      displayName: "Alex Rivera",
      title: "YouTube Creator",
      briefIntro: "Makes Next.js & TypeScript tutorial videos (45k subs).",
    },
    styleProfile: TWITTER_VOICE,
    conversationHistory: [
      {
        role: "user",
        text: "loved your recent Next.js 16 caching breakdown. would you be open to a sponsored deep-dive next month?",
      },
      {
        role: "prospect",
        author: "Alex Rivera",
        text: "thanks! I'm booked through the first week of December, could fit something around Dec 12 if the product fits my audience. what are you building?",
      },
    ],
    beforeCursor: "Dec 12 works well for us, we're building ",
    expectedIntent:
      "Briefly describe the product for a dev YouTube audience without sounding salesy.",
  },

  // =========================================================================
  // 3. LinkedIn DMs (3 cases)
  // =========================================================================
  {
    id: "linkedin-dm-warm-reply",
    surface: "linkedin_dm",
    surfaceLabel: "linkedin_dm_composer",
    platform: "linkedin",
    workspace: REACHERX_WORKSPACE,
    prospect: {
      displayName: "Claire Dubois",
      title: "Head of Growth",
      company: "MetricFlow",
      briefIntro: "Runs B2B SaaS growth and outbound experiments in Paris.",
    },
    styleProfile: LINKEDIN_VOICE,
    conversationHistory: [
      {
        role: "user",
        text: "Thanks for connecting Claire! Loved your breakdown on why automated sequences tank reply rates.",
      },
      {
        role: "prospect",
        author: "Claire Dubois",
        text: "Appreciate that! We cut all multi-step drip tools this quarter and went back to small, high-context outreach. Are you doing founder-led outreach for ReacherX too?",
      },
    ],
    beforeCursor: "Yes, we actually built ReacherX because ",
    expectedIntent:
      "Tie back to her point about high-context outreach vs automated drip tools.",
  },
  {
    id: "linkedin-dm-intro-followup",
    surface: "linkedin_dm",
    surfaceLabel: "linkedin_dm_composer",
    platform: "linkedin",
    workspace: REACHERX_WORKSPACE,
    prospect: {
      displayName: "Omar Al-Mansoor",
      title: "Partner",
      company: "SeedCraft Ventures",
    },
    styleProfile: LINKEDIN_VOICE,
    conversationHistory: [
      {
        role: "prospect",
        author: "Omar Al-Mansoor",
        text: "Great catching up earlier. Send over the short deck and current traction numbers whenever you have a moment.",
      },
    ],
    beforeCursor: "Will do, I'll send over the deck and ",
    expectedIntent:
      "Reference the traction numbers and timing (e.g., 'our latest traction numbers later today.').",
  },
  {
    id: "linkedin-dm-feedback",
    surface: "linkedin_dm",
    surfaceLabel: "linkedin_dm_composer",
    platform: "linkedin",
    workspace: REACHERX_WORKSPACE,
    prospect: {
      displayName: "Elena Rossi",
      title: "Product Designer",
      company: "StudioNove",
    },
    styleProfile: LINKEDIN_VOICE,
    conversationHistory: [
      {
        role: "prospect",
        author: "Elena Rossi",
        text: "Tried the onboarding flow this morning. Loved how minimal the UI feels, though the LinkedIn connect step took me a second to find.",
      },
    ],
    beforeCursor: "Really appreciate the honest feedback, we're going to ",
    expectedIntent:
      "Address making the LinkedIn connect step easier to find in onboarding.",
  },

  // =========================================================================
  // 4. X Replies (3 cases, including 280-char budget check)
  // =========================================================================
  {
    id: "x-reply-pain-point",
    surface: "x_reply",
    surfaceLabel: "x_reply_composer",
    platform: "twitter",
    workspace: REACHERX_WORKSPACE,
    styleProfile: TWITTER_VOICE,
    replyToAuthorHandle: "jared_ships",
    replyToText:
      "unpopular opinion: 90% of CRM software is built for VPs of Sales making dashboards, not for solo founders who just need to remember who they DM'd last week.",
    maxLength: 280,
    characterCountMode: "x_post",
    beforeCursor: "100% this. Most solo founders just want ",
    expectedIntent:
      "Agree in casual builder voice about keeping track of conversations without bloated CRM dashboards.",
  },
  {
    id: "x-reply-technical",
    surface: "x_reply",
    surfaceLabel: "x_reply_composer",
    platform: "twitter",
    workspace: REACHERX_WORKSPACE,
    styleProfile: TWITTER_VOICE,
    replyToAuthorHandle: "kyle_ts",
    replyToText:
      "Moved our real-time inbox from polling REST endpoints to Convex reactive queries and cut 600 lines of cache invalidation bugs in one afternoon.",
    maxLength: 280,
    characterCountMode: "x_post",
    beforeCursor: "same experience here, removing manual cache ",
    expectedIntent:
      "Continue naturally about ditching cache invalidation / polling boilerplate with Convex.",
  },
  {
    id: "x-reply-tight-budget",
    surface: "x_reply",
    surfaceLabel: "x_reply_composer",
    platform: "twitter",
    workspace: REACHERX_WORKSPACE,
    styleProfile: TWITTER_VOICE,
    replyToAuthorHandle: "nina_saas",
    replyToText:
      "Hot take: stop hiding your pricing page behind a 'Book a Demo' button if your product is under $100/mo.",
    maxLength: 280,
    characterCountMode: "x_post",
    beforeCursor:
      "Nothing makes me close a tab faster than seeing 'Book a Demo' for a simple tool. If I have to sit through a 30-minute discovery call just to find out it costs $49/mo, I'm already looking for an open-source alternative or ",
    expectedIntent:
      "Short ending that fits within the remaining ~55 characters of the 280-char X limit.",
  },

  // =========================================================================
  // 5. LinkedIn Comments (3 cases — previously blind to parent post!)
  // =========================================================================
  {
    id: "linkedin-comment-post-1",
    surface: "linkedin_comment",
    surfaceLabel: "linkedin_comment_composer",
    platform: "linkedin",
    workspace: REACHERX_WORKSPACE,
    styleProfile: LINKEDIN_VOICE,
    replyToAuthorHandle: "Marcus Thorne",
    replyToText:
      "We spent $18k last year on enrichment credits and cold email seats, and our best 6 enterprise deals still came from genuine replies to posts people wrote on LinkedIn and X. Warm context beats volume every single time.",
    maxLength: 1250,
    characterCountMode: "raw",
    beforeCursor: "Couldn't agree more. Showing up with real context on ",
    expectedIntent:
      "Connect to his point about replying to posts beating high-volume cold email/enrichment tools.",
  },
  {
    id: "linkedin-comment-post-2",
    surface: "linkedin_comment",
    surfaceLabel: "linkedin_comment_composer",
    platform: "linkedin",
    workspace: REACHERX_WORKSPACE,
    styleProfile: LINKEDIN_VOICE,
    replyToAuthorHandle: "Priya Subramanian",
    replyToText:
      "As a designer who started shipping my own TypeScript PRs this year: the hardest part wasn't syntax, it was resisting the urge to over-engineer abstractions before talking to 5 real users.",
    maxLength: 1250,
    characterCountMode: "raw",
    beforeCursor: "As a designer turned developer myself, this hits home. ",
    expectedIntent:
      "Relate to shipping simple things for users instead of over-engineering abstractions.",
  },
  {
    id: "linkedin-comment-approval",
    surface: "linkedin_comment",
    surfaceLabel: "linkedin_comment_task_approval",
    platform: "linkedin",
    workspace: REACHERX_WORKSPACE,
    prospect: {
      displayName: "Daniel Brooks",
      title: "Founder",
      company: "RelayKit",
    },
    styleProfile: LINKEDIN_VOICE,
    replyToAuthorHandle: "Daniel Brooks",
    replyToText:
      "Just open-sourced our webhook debugger after 8 months of using it internally. Nervous about maintaining issues solo, any advice from folks running AGPL/MIT repos?",
    maxLength: 1250,
    characterCountMode: "raw",
    beforeCursor: "Congrats on the launch Daniel! One thing that helped us ",
    expectedIntent:
      "Give concise practical open-source maintenance advice relevant to his post.",
  },

  // =========================================================================
  // 6. Edge Cases (mid-sentence suffix + no-suggestion silence)
  // =========================================================================
  {
    id: "edge-mid-sentence-suffix",
    surface: "x_dm",
    surfaceLabel: "x_dm_composer",
    platform: "twitter",
    workspace: REACHERX_WORKSPACE,
    prospect: {
      displayName: "Maya Chen",
      title: "Founder",
      company: "CodePulse",
    },
    styleProfile: TWITTER_VOICE,
    conversationHistory: [
      {
        role: "prospect",
        author: "Maya Chen",
        text: "can I import my existing X bookmarks or prospects from a CSV?",
      },
    ],
    beforeCursor: "yep you can import directly from ",
    afterCursor: " and start messaging right away.",
    expectedIntent:
      "Insert 'a CSV' or 'CSV or your X list' cleanly WITHOUT repeating 'and start messaging right away.'",
  },
  {
    id: "edge-complete-sentence-empty",
    surface: "agent_chat",
    surfaceLabel: "agent_chat",
    platform: "generic",
    workspace: REACHERX_WORKSPACE,
    conversationHistory: [
      {
        role: "assistant",
        text: "I paused the outreach campaign for Batch 2 and archived the 3 bounced prospects.",
      },
    ],
    beforeCursor: "Sounds good, thanks!",
    expectEmpty: true,
    expectedIntent:
      "Text is already a complete acknowledgment; should return empty / no suggestion.",
  },
];
