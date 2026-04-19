import type { LinkedInConversationPanelContext } from "@/shared/lib/linkedin/conversation";
import type {
  LinkedInCommentPage,
  LinkedInPostThreadContext,
} from "@/shared/lib/linkedin/comments";
import type { LinkedInProfileData } from "@/shared/lib/linkedin/profile";
import type { ProspectInteraction } from "@/features/prospects/types";
import type { ProspectProfileData } from "@/features/prospects/ui/components/ProspectProfilePanel";
import { normalizeProspectProfileData } from "@/features/prospects/lib/normalizeProspectProfileData";
import { MOCK_PROSPECTS } from "@/features/prospects/lib/mockData";
import type { UnifiedPost } from "@/shared/lib/platforms/types";

export interface ProspectActivityPreviewRecord {
  _id: string;
  _creationTime: number;
  type:
    | "found"
    | "qualified"
    | "enriched"
    | "plan_created"
    | "contacted"
    | "posted"
    | "responded"
    | "converted"
    | "archived";
  title: string;
  description?: string;
  plan?: {
    planId: string;
    version: number;
    status: string;
    updatedAt: number;
    strategy: {
      rationale: string;
      valueProposition: string;
      tone: string;
      targetTweetId?: string;
    };
    tasks: Array<{
      _id: string;
      order: number;
      type: string;
      description: string;
      status: string;
      content?: string;
      targetTweetId?: string;
    }>;
  } | null;
}

const previewSource = MOCK_PROSPECTS.find(
  (prospect) =>
    prospect.platform === "linkedin" && prospect.displayName === "Sarah Chen"
);

if (!previewSource) {
  throw new Error("LinkedIn UI preview prospect is missing.");
}

export const UI_PREVIEW_PROSPECT = previewSource;

function buildLinkedInPreviewPost(input: {
  id: string;
  text: string;
  createdAt: number;
  reactions: number;
  comments: number;
  reposts: number;
  url: string;
}): UnifiedPost {
  return {
    id: input.id,
    platform: "linkedin",
    url: input.url,
    author: {
      id: "linkedin_sarah_chen",
      name: "Sarah Chen",
      avatarUrl: UI_PREVIEW_PROSPECT.data.author.profilePictureURL as string,
      profileUrl: "https://linkedin.com/in/sarahchen",
      headline: "Founder & CEO at TechFlow | YC W23",
      type: "person",
    },
    text: input.text,
    createdAt: input.createdAt,
    metrics: {
      reactions: input.reactions,
      comments: input.comments,
      reposts: input.reposts,
    },
  };
}

export const UI_PREVIEW_LINKEDIN_POSTS: UnifiedPost[] = [
  buildLinkedInPreviewPost({
    id: "ui_preview_li_post_1",
    text: "Just closed our Series A. The biggest surprise wasn't fundraising, it was how messy our outbound process became once lead volume picked up. Visibility between discovery, qualification, and first-touch messaging matters way more than most teams expect.",
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    reactions: 234,
    comments: 45,
    reposts: 12,
    url: "https://www.linkedin.com/feed/update/ui-preview-1",
  }),
  buildLinkedInPreviewPost({
    id: "ui_preview_li_post_2",
    text: "We reviewed five AI SDR products this week. Most can generate a message. Very few can help us inspect whether the prospect card, profile context, and conversation view actually stay aligned when real data starts flowing.",
    createdAt: Date.now() - 36 * 60 * 60 * 1000,
    reactions: 186,
    comments: 22,
    reposts: 9,
    url: "https://www.linkedin.com/feed/update/ui-preview-2",
  }),
  buildLinkedInPreviewPost({
    id: "ui_preview_li_post_3",
    text: "Lead scoring is still too brittle for most growth teams. We need systems that surface why someone is a fit, not just a number on a card.",
    createdAt: Date.now() - 6 * 24 * 60 * 60 * 1000,
    reactions: 121,
    comments: 19,
    reposts: 6,
    url: "https://www.linkedin.com/feed/update/ui-preview-3",
  }),
];

export const UI_PREVIEW_PROFILE: ProspectProfileData = {
  ...normalizeProspectProfileData(UI_PREVIEW_PROSPECT),
  id: "ui_preview_linkedin_sarah_chen",
  pipelineStage: "contacted",
  stageTimestamps: {
    new: Date.now() - 11 * 24 * 60 * 60 * 1000,
    contacted: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
  socialProfiles: {
    twitter: {
      username: "sarahchen",
      url: "https://x.com/sarahchen",
    },
    linkedin: {
      username: "sarahchen",
      url: "https://linkedin.com/in/sarahchen",
    },
  },
  evidencePosts: UI_PREVIEW_LINKEDIN_POSTS,
  finance: {
    displayValue: "$2.5M ARR",
    evidencePosts: [UI_PREVIEW_LINKEDIN_POSTS[0]],
  },
  painPoints: [
    {
      pain: "Lead scoring is inaccurate once founder signals get buried in activity noise.",
      solution:
        "AI qualification with visible evidence attached to the profile.",
      evidencePosts: [UI_PREVIEW_LINKEDIN_POSTS[2]],
    },
    {
      pain: "Prospect context and conversation context drift apart during outbound QA.",
      solution:
        "A unified prospect workspace with profile, evidence, and conversation panels kept in sync.",
      evidencePosts: [UI_PREVIEW_LINKEDIN_POSTS[1]],
    },
  ],
} as ProspectProfileData;

const PREVIEW_COMPANY_LOGO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFwAAABcCAMAAADUMSJqAAAAbFBMVEXw7+oUFBIAAADw8Onz8u3Qz8wREQ8TFRT39vEUFBT19PHy7+gTFRL6+fSwr6tcXFqXl5TBwb3h4NwFBQDn5uLZ2NRvb2y3trN0dHKfn5xWVlQ1NTMaGhlRUU+qqaZ7enhHR0UsLCuJiYZkY2HhrDKKAAAClklEQVRoge2X0ZLqIAyGaYoUa1Frq66rR1d9/3dckgC16zpzKM6Zc8F/oYN0flK+hIgQWVlZWVlZWVlZ/4NK1sPwbdbSaTx8k/d2xpLPo3RvcGrRTy7daPsOd72GqkDBTtvhQjTKDhpY6zeY11fF5gX0aK5vgObqWqd7yxYqb36wwS7sNqF5w7uUIJtxZtUVTupq7K4I/Yd+6VaGHkgwlxtQ3ryAmUTzPdBSsJGJ5hZnMZh/GGsuZEfrIdLEyK8cOH0qhUgFI7W7lBa5qFvymZ+u9EVIhZzx20CbljDmTvDgckC/uToa+vWTkd5NirfHCbMNmSNSfJ+ANMXc4bQ56IKFHeWfhIA0IfKjM6mlDXbukJYB6TGhjmQbMrosT2qO65xrjHzrkU53N3cItWhugObdUWOncFUK05HKHr2rAvb6If9mmH96yScO9FNDZ5yV6gib+RqQCkRapSBdCMJZwY0M9JkBdL5KK0KKR9kEOZxV6Dku/85UpVtuIVOROpzwaXStrcyF8X5RQ2KkjdulaPUuto/9krX2SCWaL2nUUHuKlu+dcwgKBy8C4V2a2Evro++dP6SA5nmXmglVWnqcv8kiXYhRlcYd66Uwu5fmFinmn69SizTWvHfeaqRmQOoTH6s0siHVB25BMHIv6HyxvYPzT3HiH2KRau6d9p11Pcis3ZL0jEv86L9Hun3I6UFy48x9lTqkcaHrnW/wi/JBoXtSlUrtz7I48z70sTEr1z3pjcrSn2VxVaoPQwsaTUhx4lUv9g+RTanTBKTG4Vw9pbBx3RPw8jIgjTi9LE7W/iki25BYZ9ywcDGIOHjD1eSXudpN8SGvR6O/tX99qRpfv6bcvn7cDV/PvH4wKysrKysrKyvrH+gb5o4fZxJAMpQAAAAASUVORK5CYII=";

export const UI_PREVIEW_LINKEDIN_PROFILE: LinkedInProfileData = {
  username: "sarahchen",
  firstName: "Sarah",
  lastName: "Chen",
  displayName: "Sarah Chen",
  headline: "Founder & CEO at TechFlow | YC W23 Founder",
  summary:
    "Operator building workflow software for revenue teams. Sarah writes about founder-led sales, outbound systems, and how AI can reduce context loss between prospect discovery and first-touch messaging.",
  profilePictureUrl: UI_PREVIEW_PROFILE.avatarUrl,
  backgroundImageUrl:
    "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1600&q=80",
  profileUrl: UI_PREVIEW_PROFILE.profileUrl,
  urn: "urn:li:person:ui_preview_sarah_chen",
  isPremium: true,
  isCreator: true,
  location: "New York, NY",
  followerCount: 18421,
  connectionCount: 500,
  connectionStatus: "not_connected",
  contact: {
    emailAddress: "sarah@techflow.io",
    websites: [
      { url: "https://sarahchen.com", category: "PERSONAL" },
      { url: "https://techflow.io", category: "COMPANY" },
    ],
  },
  positions: [
    {
      title: "Founder & CEO",
      companyName: "TechFlow",
      companyId: "techflow",
      companyLogo: PREVIEW_COMPANY_LOGO,
      companyUrl: "https://linkedin.com/company/techflow",
      location: "New York, NY",
      description:
        "Building workflow software for modern sales teams. Focused on lead routing, qualification visibility, and outbound execution quality.",
      employmentType: "Full-time",
      start: { year: 2022, month: 6 },
      isCurrent: true,
    },
    {
      title: "Head of Product",
      companyName: "TechFlow",
      companyId: "techflow",
      companyLogo: PREVIEW_COMPANY_LOGO,
      companyUrl: "https://linkedin.com/company/techflow",
      location: "New York, NY",
      description:
        "Led product strategy and roadmap for the outbound workflow platform before transitioning to CEO.",
      employmentType: "Full-time",
      start: { year: 2022, month: 1 },
      end: { year: 2022, month: 6 },
      isCurrent: false,
    },
    {
      title: "Growth Product Lead",
      companyName: "SignalStack",
      companyId: "signalstack",
      companyLogo: PREVIEW_COMPANY_LOGO,
      companyUrl: "https://linkedin.com/company/signalstack",
      location: "San Francisco, CA",
      description:
        "Led product for go-to-market automation and internal revenue tooling used by B2B teams scaling outbound.",
      employmentType: "Full-time",
      start: { year: 2019, month: 3 },
      end: { year: 2022, month: 1 },
      isCurrent: false,
    },
  ],
  education: [
    {
      school: "Stanford University",
      schoolLogo: PREVIEW_COMPANY_LOGO,
      degree: "B.S.",
      fieldOfStudy: "Computer Science",
      start: { year: 2014 },
      end: { year: 2018 },
    },
    {
      school: "Y Combinator",
      schoolLogo: PREVIEW_COMPANY_LOGO,
      degree: "W23",
      start: { year: 2023 },
      end: { year: 2023 },
    },
  ],
  skills: [
    { name: "B2B SaaS", passedAssessment: true },
    { name: "Founder-led sales" },
    { name: "Outbound systems" },
    { name: "Growth operations", passedAssessment: true },
    { name: "Product strategy" },
    { name: "Revenue workflows" },
  ],
  languages: [
    { name: "English", proficiency: "NATIVE_OR_BILINGUAL" },
    { name: "Mandarin", proficiency: "PROFESSIONAL_WORKING" },
  ],
  featuredPosts: [
    {
      url: "https://www.linkedin.com/feed/update/ui-preview-1",
      title: "Series A announcement",
      text: "A founder update on raising $8M and rebuilding outbound workflows for scale.",
      type: "Post",
    },
    {
      url: "https://t3.chat",
      title: "TechFlow product teardown",
      text: "A walkthrough of how TechFlow tracks prospect context from discovery through first message.",
      type: "Article",
    },
  ],
  currentCompany: {
    name: "TechFlow",
    description:
      "AI-assisted workflow software for pipeline operations, qualification visibility, and outbound execution.",
    website: "https://techflow.io",
    logoUrl: PREVIEW_COMPANY_LOGO,
    staffCount: 42,
    industry: "Software Development",
    headquarter: "New York, NY",
    specialities: [
      "Pipeline operations",
      "Qualification visibility",
      "Outbound execution",
    ],
    founded: 2022,
  },
  recentPosts: UI_PREVIEW_LINKEDIN_POSTS,
};

export const UI_PREVIEW_INTERACTIONS: ProspectInteraction[] = [
  {
    id: "ui_preview_interaction_1",
    platform: "linkedin",
    interactionType: "comment",
    originalPost: null,
    sourcePostData: UI_PREVIEW_LINKEDIN_POSTS[1],
    sourceUrl: UI_PREVIEW_LINKEDIN_POSTS[1].url,
    replyText:
      "This is exactly the kind of gap ReacherX is designed to make visible. We map the full prospect journey so teams can spot where response quality breaks down before pipeline does.",
    participants: [
      {
        name: "Sarah Chen",
        username: "sarahchen",
        avatarUrl: UI_PREVIEW_PROFILE.avatarUrl,
      },
      {
        name: "You",
        username: "reacherx",
      },
    ],
    threadId: "ui_preview_linkedin_thread_1",
    repliedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    origin: "agent",
    discoveredVia: "outreach_task",
    status: "active",
    lastReplyPreview:
      "We map the full prospect journey so teams can spot where response quality breaks down.",
  },
  {
    id: "ui_preview_interaction_2",
    platform: "linkedin",
    interactionType: "comment",
    originalPost: null,
    sourcePostData: buildLinkedInPreviewPost({
      id: "ui_preview_li_post_4",
      text: "Anyone else finding that most AI SDR tools look impressive in demos but fall apart when you need the context panel and the conversation view to actually line up?",
      createdAt: Date.now() - 28 * 60 * 60 * 1000,
      reactions: 91,
      comments: 18,
      reposts: 4,
      url: "https://www.linkedin.com/feed/update/ui-preview-4",
    }),
    sourceUrl: "https://www.linkedin.com/feed/update/ui-preview-4",
    replyText:
      "That mismatch is usually the first UX smell we look for too. A realistic dataset helps catch it quickly.",
    participants: [
      {
        name: "Sarah Chen",
        username: "sarahchen",
        avatarUrl: UI_PREVIEW_PROFILE.avatarUrl,
      },
      {
        name: "You",
        username: "reacherx",
      },
    ],
    threadId: "ui_preview_linkedin_thread_2",
    repliedAt: Date.now() - 24 * 60 * 60 * 1000,
    origin: "manual_reacherx",
    discoveredVia: "action_request",
    status: "active",
    lastReplyPreview:
      "A realistic dataset helps catch the profile/conversation mismatch quickly.",
  },
];

export const UI_PREVIEW_ACTIVITY: ProspectActivityPreviewRecord[] = [
  {
    _id: "ui_preview_activity_found",
    _creationTime: Date.now() - 11 * 24 * 60 * 60 * 1000,
    type: "found",
    title: "Prospect discovered",
    description:
      "Found from LinkedIn based on founder-led B2B SaaS, outbound workflow, and sales-ops intent signals.",
  },
  {
    _id: "ui_preview_activity_qualified",
    _creationTime: Date.now() - 10 * 24 * 60 * 60 * 1000,
    type: "qualified",
    title: "Qualified",
    description:
      "High-fit founder profile with clear pain around lead routing, outreach context, and conversion visibility.",
  },
  {
    _id: "ui_preview_activity_enriched",
    _creationTime: Date.now() - 9 * 24 * 60 * 60 * 1000,
    type: "enriched",
    title: "Profile enriched",
    description:
      "Pulled company, ARR, location, and social profiles to populate the overview and activity surfaces.",
  },
  {
    _id: "ui_preview_activity_plan",
    _creationTime: Date.now() - 8 * 24 * 60 * 60 * 1000,
    type: "plan_created",
    title: "Outreach plan created",
    description:
      "Created a concise founder-to-founder outreach sequence focused on broken handoffs between discovery and messaging.",
    plan: {
      planId: "ui_preview_plan_1",
      version: 1,
      status: "active",
      updatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
      strategy: {
        rationale:
          "Lead with Sarah's own language about workflow visibility so the outreach feels grounded in her current operating pain.",
        valueProposition:
          "Show how ReacherX makes prospect context and conversation context line up in one workflow.",
        tone: "Helpful, operator-to-operator",
      },
      tasks: [
        {
          _id: "ui_preview_task_1",
          order: 1,
          type: "comment",
          description: "Reply to her post about outbound workflow visibility.",
          status: "completed",
          content:
            "This is exactly the kind of workflow gap we help teams diagnose before pipeline quality drops.",
        },
        {
          _id: "ui_preview_task_2",
          order: 2,
          type: "dm",
          description: "Send a short follow-up with a tailored product angle.",
          status: "pending",
          content:
            "Happy to show how the full prospect, profile, and conversation flow stays aligned before teams commit to process changes.",
        },
      ],
    },
  },
  {
    _id: "ui_preview_activity_contacted",
    _creationTime: Date.now() - 2 * 24 * 60 * 60 * 1000,
    type: "contacted",
    title: "Outreach started",
    description:
      "Commented on Sarah's LinkedIn post and queued a direct message draft for a warmer follow-up.",
  },
  {
    _id: "ui_preview_activity_responded",
    _creationTime: Date.now() - 20 * 60 * 60 * 1000,
    type: "responded",
    title: "Prospect responded",
    description:
      "Sarah replied positively and asked to see how the conversation context stays attached to the prospect record.",
  },
];

export const UI_PREVIEW_LINKEDIN_CONVERSATION: LinkedInConversationPanelContext =
  {
    platform: "linkedin",
    conversationId: "ui_preview_linkedin_conversation",
    participantUserId: "linkedin_sarah_chen",
    participantUsername: "sarahchen",
    participantHeadline: "Founder & CEO at TechFlow | YC W23",
    prospect: {
      prospectId: UI_PREVIEW_PROFILE.id,
      displayName: UI_PREVIEW_PROFILE.displayName ?? "Sarah Chen",
      title: UI_PREVIEW_PROFILE.title,
      avatarUrl: UI_PREVIEW_PROFILE.avatarUrl,
      profileUrl: UI_PREVIEW_PROFILE.profileUrl,
      username: "sarahchen",
      urn: "urn:li:person:ui_preview_sarah_chen",
    },
    eligibility: {
      enabled: true,
      reasonCode: "eligible",
      reasonLabel: "Preview mode",
      conversationId: "ui_preview_linkedin_conversation",
    },
    messages: [
      {
        id: "ui_preview_msg_1",
        conversationId: "ui_preview_linkedin_conversation",
        direction: "received",
        text: "Appreciate the comment. Most tools we test look okay at card level, but the profile and conversation panels drift once real data shows up.",
        createdAt: new Date(Date.now() - 19 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "ui_preview_msg_2",
        conversationId: "ui_preview_linkedin_conversation",
        direction: "sent",
        text: "That drift is exactly why we built this workflow around realistic prospect data. You can inspect the card, profile tabs, and conversation side by side before polishing the workflow.",
        createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
        readAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "ui_preview_msg_3",
        conversationId: "ui_preview_linkedin_conversation",
        direction: "received",
        text: "Perfect. If that looks coherent, I'd want my team to use it during outbound QA.",
        createdAt: new Date(Date.now() - 17 * 60 * 60 * 1000).toISOString(),
      },
    ],
    draftText:
      "Happy to share a quick walkthrough of how the prospect card, profile panel, and message thread stay in sync.",
  };

function buildPreviewComment(input: {
  id: string;
  text: string;
  createdAtOffsetHours: number;
  reactionCount?: number;
  replyCount?: number;
  author: {
    id: string;
    name: string;
    headline?: string;
    avatarUrl?: string;
    isViewer?: boolean;
  };
  source?: "preview" | "optimistic";
}): LinkedInCommentPage["items"][number] {
  return {
    id: input.id,
    postId: UI_PREVIEW_LINKEDIN_POSTS[0].id,
    threadId: UI_PREVIEW_LINKEDIN_POSTS[0].id,
    text: input.text,
    createdAt: new Date(
      Date.now() - input.createdAtOffsetHours * 60 * 60 * 1000
    ).toISOString(),
    reactionCount: input.reactionCount ?? 0,
    replyCount: input.replyCount ?? 0,
    author: input.author,
    canReply: true,
    canReact: true,
    source: input.source ?? "preview",
  };
}

const PREVIEW_THREAD_SINGLE_COMMENT: LinkedInPostThreadContext = {
  resolvedPost: UI_PREVIEW_LINKEDIN_POSTS[0],
  resolvedPostId: UI_PREVIEW_LINKEDIN_POSTS[0].id,
  permissions: {
    canComment: true,
    canReact: true,
    canShare: false,
  },
  eligibility: {
    enabled: true,
    reasonCode: "eligible",
    reasonLabel: "Preview mode",
  },
  topLevelComments: {
    items: [
      buildPreviewComment({
        id: "ui_preview_comment_single_1",
        text: "Love this. Clear systems thinking, especially around how context slips between discovery and first touch.",
        createdAtOffsetHours: 36,
        reactionCount: 3,
        author: {
          id: "preview_author_forest",
          name: "Forest Mars",
          headline: "Principal AI Architect | Engineering Leadership",
          avatarUrl: UI_PREVIEW_PROFILE.avatarUrl,
        },
      }),
    ],
    cursor: null,
    totalItems: 1,
    sort: "MOST_RELEVANT",
    source: "preview",
  },
  source: "preview",
};

const PREVIEW_THREAD_WITH_REPLIES: LinkedInPostThreadContext = {
  ...PREVIEW_THREAD_SINGLE_COMMENT,
  topLevelComments: {
    ...PREVIEW_THREAD_SINGLE_COMMENT.topLevelComments,
    items: [
      buildPreviewComment({
        id: "ui_preview_comment_replies_1",
        text: "Million dollar meals are the best!",
        createdAtOffsetHours: 48,
        reactionCount: 18,
        replyCount: 2,
        author: {
          id: "preview_author_zeno",
          name: "Zeno Rocha",
          headline: "Founder & CEO at Resend",
          avatarUrl: UI_PREVIEW_PROFILE.avatarUrl,
        },
      }),
    ],
  },
};

const PREVIEW_THREAD_MULTIPLE: LinkedInPostThreadContext = {
  ...PREVIEW_THREAD_SINGLE_COMMENT,
  topLevelComments: {
    items: [
      buildPreviewComment({
        id: "ui_preview_comment_multi_1",
        text: "Build vs. buy debates always assumed building was expensive. That assumption is changing fast.",
        createdAtOffsetHours: 72,
        reactionCount: 9,
        replyCount: 1,
        author: {
          id: "preview_author_ed",
          name: "Ed Biden",
          headline: "Super practical product management and AI training",
        },
      }),
      buildPreviewComment({
        id: "ui_preview_comment_multi_2",
        text: "Agreed, but this is only true for tech-literate orgs like Vercel or us.",
        createdAtOffsetHours: 70,
        reactionCount: 11,
        replyCount: 4,
        author: {
          id: "preview_author_julius",
          name: "Julius Stener",
          headline:
            "Co-Founder @ Righthand AI | Building AI Employees for Services Businesses",
        },
      }),
      buildPreviewComment({
        id: "ui_preview_comment_multi_3",
        text: "Really interesting perspective. Curious how you're balancing agent-generated workflows with governance.",
        createdAtOffsetHours: 68,
        author: {
          id: "preview_author_hijab",
          name: "Hijab Zulfiqar",
          headline:
            "I help founders ship investor-ready MVPs in weeks, enabling entrepreneurs to...",
        },
      }),
    ],
    cursor: "preview-next-comments",
    totalItems: 8,
    sort: "MOST_RELEVANT",
    source: "preview",
  },
  source: "preview",
};

export const UI_PREVIEW_LINKEDIN_THREAD_SCENARIOS: Record<
  string,
  {
    thread: LinkedInPostThreadContext;
    repliesByCommentId?: Record<string, LinkedInCommentPage>;
    loading?: boolean;
    error?: string;
  }
> = {
  single: {
    thread: PREVIEW_THREAD_SINGLE_COMMENT,
  },
  replies: {
    thread: PREVIEW_THREAD_WITH_REPLIES,
    repliesByCommentId: {
      ui_preview_comment_replies_1: {
        items: [
          buildPreviewComment({
            id: "ui_preview_reply_1",
            text: "heck yeah",
            createdAtOffsetHours: 47,
            author: {
              id: "preview_author_jp",
              name: "Jp Valery",
              headline: "Customer Success Engineer @ Resend",
            },
            source: "preview",
          }),
          buildPreviewComment({
            id: "ui_preview_reply_2",
            text: "it truly is! Thank you for pioneering this at Resend 😄",
            createdAtOffsetHours: 46,
            author: {
              id: "preview_author_viewer",
              name: "You",
              headline: "Founder @ ReacherX",
              isViewer: true,
            },
            source: "preview",
          }),
        ],
        cursor: null,
        totalItems: 2,
        sort: "MOST_RELEVANT",
        source: "preview",
      },
    },
  },
  multiple: {
    thread: PREVIEW_THREAD_MULTIPLE,
  },
  optimistic: {
    thread: {
      ...PREVIEW_THREAD_WITH_REPLIES,
      topLevelComments: {
        ...PREVIEW_THREAD_WITH_REPLIES.topLevelComments,
        items: [
          buildPreviewComment({
            id: "ui_preview_comment_now",
            text: "Raina Vinci Rufus 👀",
            createdAtOffsetHours: 0,
            author: {
              id: "preview_author_viewer",
              name: "You",
              headline: "Founder @ ReacherX | Building AI agents through...",
              isViewer: true,
            },
            source: "optimistic",
          }),
          ...PREVIEW_THREAD_WITH_REPLIES.topLevelComments.items,
        ],
      },
    },
  },
  loading: {
    thread: PREVIEW_THREAD_SINGLE_COMMENT,
    loading: true,
  },
  readonly: {
    thread: {
      ...PREVIEW_THREAD_SINGLE_COMMENT,
      permissions: {
        canComment: false,
        canReact: false,
        canShare: false,
      },
      eligibility: {
        enabled: false,
        reasonCode: "missing_connection",
        reasonLabel: "Connect LinkedIn to comment or reply.",
      },
      warning: {
        code: "read_only_fallback",
        message:
          "Showing read-only LinkedIn comments because no connected account is available.",
      },
    },
  },
  error: {
    thread: PREVIEW_THREAD_SINGLE_COMMENT,
    error: "Could not load LinkedIn comments right now.",
  },
};
