/**
 * Mock Prospects Data
 * Used for development/testing of ProspectCard and ProspectProfilePanel components.
 */
import type { Doc, Id } from "@/convex/_generated/dataModel";

// Helper to create fake IDs that look like Convex IDs
const fakeId = (suffix: string) => `mock_${suffix}` as Id<"prospects">;

export const MOCK_PROSPECTS: Doc<"prospects">[] = [
  {
    _id: fakeId("twitter_1"),
    _creationTime: Date.now() - 9 * 60 * 60 * 1000, // 9 hours ago
    workspaceId: "mock_workspace" as Id<"workspaces">,
    userId: "mock_user" as Id<"users">,
    platform: "twitter",
    externalId: "tweet_123456",
    status: "new",
    updatedAt: Date.now() - 9 * 60 * 60 * 1000,

    // Enriched fields
    displayName: "Muhammad Salman Farooq",
    title: "Solo SaaS founder",
    briefIntro:
      "Building in public. Focused on developer tools and AI-powered productivity apps. Previously at FAANG. Check out https://reacherx.com 🚀",
    prospectType: "individual",
    qualificationScore: 95,
    qualificationStatus: "qualified",
    company: "ReacherX",
    websiteUrl: "https://reacherx.com",
    location: "SF, California, USA",
    pipelineStage: "contacted",
    finance: {
      displayValue: "$9000-$14000",
      type: "mrr",
      evidencePosts: [
        {
          id_str: "finance_evidence_1",
          full_text:
            "Just hit $10k MRR! 🎉 What a journey from $0 to here. Thanks to everyone who believed in the product!",
          tweet_created_at: new Date(
            Date.now() - 3 * 24 * 60 * 60 * 1000
          ).toISOString(),
          user: {
            name: "Muhammad Salman Farooq",
            screen_name: "AnotherSalman",
            profile_image_url_https:
              "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
          },
          favorite_count: 234,
          retweet_count: 45,
        },
        {
          id_str: "finance_evidence_2",
          full_text:
            "Revenue update: Crossed $12k MRR this month. Our new pricing tier is working better than expected.",
          tweet_created_at: new Date(
            Date.now() - 1 * 24 * 60 * 60 * 1000
          ).toISOString(),
          user: {
            name: "Muhammad Salman Farooq",
            screen_name: "AnotherSalman",
            profile_image_url_https:
              "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
          },
          favorite_count: 156,
          retweet_count: 23,
        },
      ],
    },
    painPoints: [
      {
        pain: "Customer acquisition is hard",
        solution: "AI-powered prospecting",
        evidencePosts: [
          {
            id_str: "pain_evidence_1",
            full_text:
              "Spent $500 on ads this month. Got 2 signups. Customer acquisition costs are killing me. Anyone else struggling with this?",
            tweet_created_at: new Date(
              Date.now() - 5 * 24 * 60 * 60 * 1000
            ).toISOString(),
            user: {
              name: "Muhammad Salman Farooq",
              screen_name: "AnotherSalman",
              profile_image_url_https:
                "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
            },
            favorite_count: 89,
            retweet_count: 12,
          },
        ],
      },
      {
        pain: "Manual outreach is time-consuming",
        solution: "Automated engagement",
        evidencePosts: [
          {
            id_str: "pain_evidence_2",
            full_text:
              "Spent 4 hours today sending cold DMs. Got 0 responses. There has to be a better way to do outreach.",
            tweet_created_at: new Date(
              Date.now() - 4 * 24 * 60 * 60 * 1000
            ).toISOString(),
            user: {
              name: "Muhammad Salman Farooq",
              screen_name: "AnotherSalman",
              profile_image_url_https:
                "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
            },
            favorite_count: 67,
            retweet_count: 8,
          },
        ],
      },
    ],
    socialProfiles: {
      twitter: {
        username: "AnotherSalman",
        url: "https://x.com/AnotherSalman",
      },
      linkedin: {
        username: "salmanfarooq",
        url: "https://linkedin.com/in/salmanfarooq",
      },
    },
    matchedKeywords: ["SaaS", "customer acquisition", "founder"],

    // Raw platform data
    data: {
      id_str: "tweet_123456",
      full_text:
        "Solo SaaS founder complaining that customer acquisition is hard this week. Built 3 features, got 0 customers. The grind continues. 🚀",
      tweet_created_at: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
      user: {
        name: "Muhammad Salman Farooq",
        screen_name: "AnotherSalman",
        profile_image_url_https:
          "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
      },
      favorite_count: 42,
      retweet_count: 8,
      reply_count: 5,
    },
  },
  {
    _id: fakeId("linkedin_1"),
    _creationTime: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
    workspaceId: "mock_workspace" as Id<"workspaces">,
    userId: "mock_user" as Id<"users">,
    platform: "linkedin",
    externalId: "post_789012",
    status: "new",
    updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,

    // Enriched fields
    displayName: "Sarah Chen",
    title: "Founder & CEO at TechFlow",
    briefIntro:
      "Serial entrepreneur. Building B2B SaaS for sales teams. YC W23.",
    prospectType: "individual",
    qualificationScore: 88,
    qualificationStatus: "qualified",
    company: "TechFlow",
    websiteUrl: "https://techflow.io",
    location: "New York, NY",
    pipelineStage: "contacted",
    finance: {
      displayValue: "$2.5M ARR",
      type: "arr",
      evidencePosts: [],
    },
    painPoints: [
      {
        pain: "Lead scoring is inaccurate",
        solution: "AI qualification",
        evidencePosts: [],
      },
    ],
    socialProfiles: {
      twitter: { username: "sarahchen", url: "https://x.com/sarahchen" },
      linkedin: {
        username: "sarahchen",
        url: "https://linkedin.com/in/sarahchen",
      },
    },
    matchedKeywords: ["B2B", "sales", "leads"],

    // Raw platform data
    data: {
      postID: "post_789012",
      text: "Just closed our Series A! 🎉 After 18 months of grinding, we've raised $8M to scale our AI-powered sales platform. The journey from 0 to $2.5M ARR wasn't easy, but our team made it happen. Hiring engineers and sales reps now!",
      author: {
        name: "Sarah Chen",
        profilePictureURL: "https://media.licdn.com/dms/image/mock-sarah.jpg",
        url: "https://linkedin.com/in/sarahchen",
        headline: "Founder & CEO at TechFlow | YC W23",
      },
      postedAt: { timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000 },
      engagements: {
        totalReactions: 234,
        commentsCount: 45,
        repostsCount: 12,
      },
    },
  },
  {
    _id: fakeId("twitter_2"),
    _creationTime: Date.now() - 5 * 60 * 60 * 1000, // 5 hours ago
    workspaceId: "mock_workspace" as Id<"workspaces">,
    userId: "mock_user" as Id<"users">,
    platform: "twitter",
    externalId: "tweet_345678",
    status: "in_progress",
    updatedAt: Date.now() - 5 * 60 * 60 * 1000,

    // Enriched fields
    displayName: "Alex Rivera",
    title: "Indie Hacker",
    briefIntro:
      "Building micro-SaaS products. 3 exits. Currently working on a new project.",
    prospectType: "individual",
    qualificationScore: 72,
    qualificationStatus: "qualified",
    location: "Austin, TX",
    pipelineStage: "new",
    matchedKeywords: ["indie hacker", "micro-SaaS"],

    // Raw platform data
    data: {
      id_str: "tweet_345678",
      full_text:
        "Unpopular opinion: You don't need a big team to build a successful SaaS. My last product hit $10k MRR with just me and a VA. Focus on solving real problems.",
      tweet_created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      user: {
        name: "Alex Rivera",
        screen_name: "alexrivera_dev",
        profile_image_url_https:
          "https://pbs.twimg.com/profile_images/mock-alex.jpg",
      },
      favorite_count: 128,
      retweet_count: 24,
      reply_count: 18,
    },
  },
  {
    _id: fakeId("linkedin_2"),
    _creationTime: Date.now() - 12 * 60 * 60 * 1000, // 12 hours ago
    workspaceId: "mock_workspace" as Id<"workspaces">,
    userId: "mock_user" as Id<"users">,
    platform: "linkedin",
    externalId: "post_901234",
    status: "new",
    updatedAt: Date.now() - 12 * 60 * 60 * 1000,

    // Enriched fields
    displayName: "Acme Corp",
    title: "Enterprise Software Solutions",
    briefIntro:
      "Leading provider of enterprise automation software. 500+ customers globally.",
    prospectType: "organization",
    qualificationScore: 65,
    qualificationStatus: "qualified",
    company: "Acme Corp",
    websiteUrl: "https://acmecorp.com",
    location: "London, UK",
    pipelineStage: "new",
    matchedKeywords: ["enterprise", "automation"],

    // Raw platform data
    data: {
      postID: "post_901234",
      text: "Excited to announce our partnership with Microsoft! Together we're bringing next-gen automation to enterprise customers worldwide. 🌍",
      author: {
        name: "Acme Corp",
        profilePictureURL: "https://media.licdn.com/dms/image/mock-acme.jpg",
        url: "https://linkedin.com/company/acmecorp",
        type: "organization",
      },
      postedAt: { timestamp: Date.now() - 12 * 60 * 60 * 1000 },
      engagements: {
        totalReactions: 89,
        commentsCount: 12,
        repostsCount: 5,
      },
    },
  },
];

// Single prospect for detail page testing
export const MOCK_PROSPECT_DETAIL = MOCK_PROSPECTS[0];

// ============================================================================
// Mock Evidence Posts (for RelevantActivityTab)
// ============================================================================

export const MOCK_EVIDENCE_POSTS = [
  {
    id_str: "mock_evidence_1",
    full_text:
      "Just hit $10k MRR! 🎉 What a journey from $0 to here. Customer acquisition was the hardest part. Thanks to everyone who believed in the product!",
    tweet_created_at: new Date(
      Date.now() - 1 * 24 * 60 * 60 * 1000
    ).toISOString(),
    user: {
      name: "Muhammad Salman Farooq",
      screen_name: "AnotherSalman",
      profile_image_url_https:
        "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
    },
    favorite_count: 234,
    retweet_count: 45,
    reply_count: 12,
  },
  {
    id_str: "mock_evidence_2",
    full_text:
      "Spent $500 on ads this month. Got 2 signups. Customer acquisition costs are killing me. Anyone else struggling with this?",
    tweet_created_at: new Date(
      Date.now() - 3 * 24 * 60 * 60 * 1000
    ).toISOString(),
    user: {
      name: "Muhammad Salman Farooq",
      screen_name: "AnotherSalman",
      profile_image_url_https:
        "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
    },
    favorite_count: 89,
    retweet_count: 12,
    reply_count: 8,
  },
  {
    id_str: "mock_evidence_3",
    full_text:
      "Spent 4 hours today sending cold DMs. Got 0 responses. There has to be a better way to do outreach.",
    tweet_created_at: new Date(
      Date.now() - 4 * 24 * 60 * 60 * 1000
    ).toISOString(),
    user: {
      name: "Muhammad Salman Farooq",
      screen_name: "AnotherSalman",
      profile_image_url_https:
        "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
    },
    favorite_count: 67,
    retweet_count: 8,
    reply_count: 5,
  },
  {
    id_str: "mock_evidence_4",
    full_text:
      "Revenue update: Crossed $12k MRR this month. Our new pricing tier is working better than expected.",
    tweet_created_at: new Date(
      Date.now() - 5 * 24 * 60 * 60 * 1000
    ).toISOString(),
    user: {
      name: "Muhammad Salman Farooq",
      screen_name: "AnotherSalman",
      profile_image_url_https:
        "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
    },
    favorite_count: 156,
    retweet_count: 23,
    reply_count: 15,
  },
  {
    id_str: "mock_evidence_5",
    full_text:
      "The hardest part of being a solo founder? There's nobody to celebrate the small wins with. Today I got my first organic signup from Twitter!",
    tweet_created_at: new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString(),
    user: {
      name: "Muhammad Salman Farooq",
      screen_name: "AnotherSalman",
      profile_image_url_https:
        "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
    },
    favorite_count: 312,
    retweet_count: 56,
    reply_count: 28,
  },
  {
    id_str: "mock_evidence_6",
    full_text:
      "Solo SaaS founder complaining that customer acquisition is hard this week. Built 3 features, got 0 customers. The grind continues. 🚀",
    tweet_created_at: new Date(
      Date.now() - 9 * 24 * 60 * 60 * 1000
    ).toISOString(),
    user: {
      name: "Muhammad Salman Farooq",
      screen_name: "AnotherSalman",
      profile_image_url_https:
        "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
    },
    favorite_count: 42,
    retweet_count: 8,
    reply_count: 5,
  },
  // Extra posts for "Load more" testing
  {
    id_str: "mock_evidence_7",
    full_text:
      "Month 6 of building in public. Still haven't found product-market fit but learning a lot. The journey is the reward, right?",
    tweet_created_at: new Date(
      Date.now() - 14 * 24 * 60 * 60 * 1000
    ).toISOString(),
    user: {
      name: "Muhammad Salman Farooq",
      screen_name: "AnotherSalman",
      profile_image_url_https:
        "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
    },
    favorite_count: 78,
    retweet_count: 12,
    reply_count: 9,
  },
  {
    id_str: "mock_evidence_8",
    full_text:
      "Just shipped my 10th feature this month. Zero of them moved the needle. Maybe I should focus on distribution instead of product.",
    tweet_created_at: new Date(
      Date.now() - 21 * 24 * 60 * 60 * 1000
    ).toISOString(),
    user: {
      name: "Muhammad Salman Farooq",
      screen_name: "AnotherSalman",
      profile_image_url_https:
        "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
    },
    favorite_count: 45,
    retweet_count: 6,
    reply_count: 4,
  },
];

// ============================================================================
// Mock Interactions (for YourInteractionsTab)
// ============================================================================

import type { Tweet } from "@/features/threads/types";
import type { ProspectInteraction } from "../types";

export const MOCK_INTERACTIONS: ProspectInteraction[] = [
  {
    id: "interaction_1",
    threadId: "1549281861687451648",
    repliedAt: Date.now() - 9 * 60 * 60 * 1000,
    originalPost: {
      id_str: "original_post_1",
      full_text:
        "Solo SaaS founder complaining that customer acquisition is hard this week. Built 3 features, got 0 customers. The grind continues. 🚀",
      tweet_created_at: new Date(
        Date.now() - 10 * 60 * 60 * 1000
      ).toISOString(),
      user: {
        id_str: "prospect_user_1",
        name: "Muhammad Salman Farooq",
        screen_name: "AnotherSalman",
        profile_image_url_https:
          "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
      },
      favorite_count: 42,
      retweet_count: 8,
      reply_count: 5,
    } as Tweet,
    participants: [
      {
        name: "Muhammad Salman Farooq",
        username: "AnotherSalman",
        avatarUrl:
          "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
      },
      {
        name: "You",
        username: "reacherx",
        avatarUrl:
          "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
      },
    ],
    lastReplyPreview:
      "Have you tried ReacherX? It helps with customer acquisition for SaaS founders...",
  },
  {
    id: "interaction_2",
    threadId: "1549281861687451649",
    repliedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    originalPost: {
      id_str: "original_post_2",
      full_text:
        "@ProductHunt Just launched my new SaaS! 🎉 It's been a long journey but we're finally live. Would love your feedback!",
      tweet_created_at: new Date(
        Date.now() - 3 * 24 * 60 * 60 * 1000
      ).toISOString(),
      in_reply_to_screen_name: "ProductHunt",
      user: {
        id_str: "other_user_1",
        name: "Product Hunt",
        screen_name: "ProductHunt",
        profile_image_url_https:
          "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
      },
      favorite_count: 156,
      retweet_count: 23,
      reply_count: 45,
    } as Tweet,
    participants: [
      {
        name: "Product Hunt",
        username: "ProductHunt",
        avatarUrl:
          "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
      },
      {
        name: "Muhammad Salman Farooq",
        username: "AnotherSalman",
        avatarUrl:
          "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
      },
      {
        name: "You",
        username: "reacherx",
        avatarUrl:
          "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
      },
      {
        name: "Sarah Chen",
        username: "sarahchen",
        avatarUrl:
          "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
      },
      {
        name: "Alex Rivera",
        username: "alexrivera_dev",
        avatarUrl:
          "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
      },
      {
        name: "John Doe",
        username: "johndoe",
        avatarUrl:
          "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
      },
      {
        name: "Jane Smith",
        username: "janesmith",
        avatarUrl:
          "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
      },
    ],
    lastReplyPreview: "Congrats on the launch! Excited to try it out.",
  },
];

// ============================================================================
// Mock Thread Tweets (for ConversationPanel)
// ============================================================================

export const MOCK_THREAD_TWEETS: Tweet[] = [
  {
    id_str: "thread_tweet_1",
    full_text:
      "Solo SaaS founder complaining that customer acquisition is hard this week. Built 3 features, got 0 customers. The grind continues. 🚀",
    tweet_created_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    user: {
      id_str: "user_1",
      name: "Muhammad Salman Farooq",
      screen_name: "AnotherSalman",
      profile_image_url_https:
        "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
    },
    favorite_count: 42,
    retweet_count: 8,
    reply_count: 5,
  } as Tweet,
  {
    id_str: "thread_tweet_2",
    full_text:
      "@AnotherSalman Have you tried content marketing? I found that building in public helped me get my first 100 customers.",
    tweet_created_at: new Date(Date.now() - 9.5 * 60 * 60 * 1000).toISOString(),
    in_reply_to_status_id_str: "thread_tweet_1",
    in_reply_to_screen_name: "AnotherSalman",
    user: {
      id_str: "user_2",
      name: "Sarah Chen",
      screen_name: "sarahchen",
      profile_image_url_https:
        "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
    },
    favorite_count: 12,
    retweet_count: 2,
    reply_count: 3,
  } as Tweet,
  {
    id_str: "thread_tweet_3",
    full_text:
      "@sarahchen @AnotherSalman Totally agree! Building in public is underrated. Also, have you tried ReacherX? It helps find and engage with potential customers automatically.",
    tweet_created_at: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
    in_reply_to_status_id_str: "thread_tweet_2",
    in_reply_to_screen_name: "sarahchen",
    user: {
      id_str: "user_3",
      name: "You",
      screen_name: "reacherx",
      profile_image_url_https:
        "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
    },
    favorite_count: 5,
    retweet_count: 1,
    reply_count: 1,
  } as Tweet,
  {
    id_str: "thread_tweet_4",
    full_text:
      "@reacherx @sarahchen Thanks for the suggestion! I'll check it out. Always looking for tools to help with outreach.",
    tweet_created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    in_reply_to_status_id_str: "thread_tweet_3",
    in_reply_to_screen_name: "reacherx",
    user: {
      id_str: "user_1",
      name: "Muhammad Salman Farooq",
      screen_name: "AnotherSalman",
      profile_image_url_https:
        "https://pbs.twimg.com/profile_images/1982508131570638849/tv79lCTu_400x400.jpg",
    },
    favorite_count: 3,
    retweet_count: 0,
    reply_count: 0,
  } as Tweet,
];
