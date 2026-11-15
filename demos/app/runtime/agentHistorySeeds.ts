import type { Id } from "@/convex/_generated/dataModel";
import type { AgentServices } from "./agentServices";
import type { createAppFixtures } from "./appFixtures";
import type { LocalClient } from "./LocalClient";
import { historyPlanBatchRuns } from "./demoPlanBatchRuns";
import type { DemoHistoryPlan } from "./demoHistoryPlans";
import { historyPlans } from "./demoHistoryPlans";
import {
  historyActionRequests,
  historyProfileProposals,
  registerDemoTwitterPost,
  registerHistoryWorkflowServices,
} from "./demoHistoryWorkflows";
import { registerDemoHistoryMemory } from "./reportingServices";
import type { Doc } from "@/convex/_generated/dataModel";
import type { MentionEntitySearchResult } from "@/shared/lib/mentions/mentionEntities";
import {
  createAttachmentPreviewArtifact,
  createDmDraftArtifact,
  createMemoryArtifact,
  createPlanBatchProgressArtifact,
  createPlanPreviewArtifact,
  createPostListArtifact,
  createProfilePreviewArtifact,
  createProgressStatusArtifact,
  createTwitterActionArtifact,
  createWorkspaceProfileChangeArtifact,
} from "@/shared/lib/json-render/agentArtifacts";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { getWorkspaceUseCase } from "@/shared/lib/workspaceUseCases";
import { getStringProperty } from "@/convex/lib/typeGuards";
import { buildDemoIntroduction } from "./scenarioPlanHelpers";
import portraitSource from "./portraitAssets.json";

const portraits: Record<string, { path: string }> = portraitSource;

const HOUR_MS = 3600000;
const MINUTE_MS = 60000;
const DAY_MS = 24 * HOUR_MS;

type Prospect = Doc<"prospects">;
type RawPost = NonNullable<Prospect["evidencePosts"]>[number];

/** Build the mention payload the real composer sends with tagged people. */
function mentionEntity(prospect: Prospect): MentionEntitySearchResult {
  const portrait = portraits[prospect.displayName ?? ""];
  return {
    id: `mention_${prospect._id}`,
    entityId: prospect._id,
    kind: "prospect",
    label: prospect.displayName ?? "",
    mentionText: prospect.displayName ?? "",
    secondaryLabel: prospect.title ?? "",
    avatarUrl: portrait?.path ?? null,
    verified: false,
    prospectId: prospect._id,
  };
}

function mentionMetadata(
  people: Prospect[],
  attachments: Array<{
    uploadId: string | null;
    fileName: string;
    mediaUrl: string | null;
  }> = []
): {
  version: 1;
  promptTextSource: "user";
  taggedEntities: MentionEntitySearchResult[];
  attachments: Array<{
    uploadId: string | null;
    fileName: string;
    mediaUrl: string | null;
  }>;
} {
  return {
    version: 1,
    promptTextSource: "user",
    taggedEntities: people.map(mentionEntity),
    attachments,
  };
}

function getPostMs(post: RawPost): number {
  const linkedin = getStringProperty(post as never, "postedAt");
  if (linkedin) {
    const parsed = Number(linkedin);
    if (Number.isFinite(parsed)) return parsed;
  }
  const tweet = getStringProperty(post as never, "tweet_created_at");
  return tweet ? Date.parse(tweet) : 0;
}

function latestPost(person: Prospect): RawPost | undefined {
  return [...(person.evidencePosts ?? [])].sort(
    (a, b) => getPostMs(b) - getPostMs(a)
  )[0];
}

/** The compact LinkedIn post shape the real display tool emits. */
function toUnifiedPost(person: Prospect, post: RawPost): UnifiedPost {
  const author = (post as { author?: { name?: unknown } }).author;
  const metrics = (
    post as {
      engagements?: {
        totalReactions?: unknown;
        commentsCount?: unknown;
        repostsCount?: unknown;
      };
    }
  ).engagements;
  const numberish = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;
  return {
    id: getStringProperty(post as never, "postID") ?? person._id,
    platform: "linkedin",
    url: person.socialProfiles?.linkedin?.url,
    author: {
      name:
        getStringProperty(author as never, "name") ?? person.displayName ?? "",
      avatarUrl:
        getStringProperty(author as never, "profilePictureURL") ?? undefined,
      profileUrl: getStringProperty(author as never, "url") ?? undefined,
      headline:
        getStringProperty(author as never, "headline") ??
        person.title ??
        undefined,
    },
    text: getStringProperty(post as never, "text") ?? "",
    createdAt: getPostMs(post),
    metrics: {
      reactions: numberish(metrics?.totalReactions),
      comments: numberish(metrics?.commentsCount),
      reposts: numberish(metrics?.repostsCount),
    },
  };
}

function unifiedAuthorHandle(person: Prospect): string | undefined {
  return (
    person.socialProfiles?.twitter?.username ??
    person.socialProfiles?.linkedin?.username ??
    undefined
  );
}

function twitterRef(person: Prospect, post: RawPost) {
  return {
    platform: "twitter" as const,
    postId: getStringProperty(post as never, "id_str") ?? person._id,
    authorHandle: unifiedAuthorHandle(person),
  };
}

/** Posts for a person in the exact shape the real display tool emits. */
function postListEntries(person: Prospect) {
  return (person.evidencePosts ?? []).map((post) =>
    person.platform === "twitter"
      ? {
          id: getStringProperty(post as never, "id_str") ?? person._id,
          platform: "twitter" as const,
          textPreview: getStringProperty(post as never, "full_text") ?? "",
          createdAt: getPostMs(post),
          ref: post,
          summary: post,
        }
      : {
          id: getStringProperty(post as never, "postID") ?? person._id,
          platform: "linkedin" as const,
          textPreview: getStringProperty(post as never, "text") ?? "",
          createdAt: getPostMs(post),
          postData: toUnifiedPost(person, post),
        }
  );
}

interface PlanTaskDraft {
  type: "comment" | "dm" | "wait";
  description: string;
  content?: string;
  status: "pending" | "completed";
}

/** Comments that reference the person's actual post, keyed to the demo cast. */
const COMMENT_COPY: Record<string, string> = {
  "Laura Jiménez":
    "The 18 to 31 percent activation jump is the detail most growth posts leave out. Naming the experiment before scaling it is the habit that compounds.",
  "Viktor Halasz":
    "Checkout performance and A/B infrastructure in one post is rare. The part about tooling serving the roadmap, not driving it, needed saying.",
  "Isabelle Fontaine":
    "Roving focus plus predictable Escape behavior is exactly the unglamorous work that makes an app feel finished. Saved this one.",
  "Kwame Mensah":
    "Leaving a stable role for ownership over a title bump takes conviction. The seed-stage part of your post is the interesting filter.",
  "Hannah Schmidt":
    "Your portfolio walkthrough answers the question most founding-designer posts dodge: what did you ship first, and why that thing.",
};

function commentFor(person: Prospect): string {
  const named = COMMENT_COPY[person.displayName ?? ""];
  if (named) return named;
  const topic = person.matchedKeywords?.[0];
  return topic
    ? `Your post about ${topic} is the clearest take on it that I have seen in weeks. Curious where you take it next.`
    : "The way you separated signal from noise here is rare. Curious what you build next.";
}

/** Personal DM openers, keyed to the demo cast with a workspace-aware fallback. */
function dmFor(
  person: Prospect,
  workspace: ReturnType<typeof createAppFixtures>["workspaces"][number],
  scenario: ReturnType<typeof createAppFixtures>["scenario"]
): string {
  const named: Record<string, string> = {
    "Viktor Halasz":
      "Hi Viktor, your post about storefront tooling and checkout performance is exactly the work our app needs. We are a team of three in Paris, remote role at €80–100k within three hours of our time zone. Want the role details?",
  };
  return (
    named[person.displayName ?? ""] ??
    buildDemoIntroduction(person, workspace, scenario).content
  );
}

function planTasks(
  person: Prospect,
  workspace: ReturnType<typeof createAppFixtures>["workspaces"][number],
  scenario: ReturnType<typeof createAppFixtures>["scenario"]
): PlanTaskDraft[] {
  const dm = dmFor(person, workspace, scenario);
  return [
    {
      type: "comment",
      description: `Reply to ${person.displayName?.split(" ")[0] ?? "their"} latest post`,
      content: commentFor(person),
      status: "pending",
    },
    {
      type: "dm",
      description: "Send a personal introduction",
      content: dm,
      status: "pending",
    },
    {
      type: "wait",
      description: "Wait for a reply before any follow-up",
      status: "pending",
    },
  ];
}

function planCard(person: Prospect, tasks: PlanTaskDraft[], rationale: string) {
  const planId = `demo_history_plan_${person._id}`;
  // Comment tasks carry their source post so the approval panel and
  // approveTaskWithEdits work exactly like production drafts.
  const commentSource = latestPost(person);
  const commentPostId = commentSource
    ? getStringProperty(
        commentSource as never,
        person.platform === "twitter" ? "id_str" : "postID"
      )
    : undefined;
  const planData: DemoHistoryPlan = {
    readiness: {
      requiredPlatforms: [person.platform],
      missingPlatforms: [],
    },
    plan: {
      _id: planId as Id<"outreachPlans">,
      _creationTime: Date.now() - 26 * HOUR_MS,
      prospectId: person._id,
      workspaceId: person.workspaceId,
      userId: person.userId,
      status: "draft",
      version: 1,
      updatedAt: Date.now() - 26 * HOUR_MS,
      strategy: {
        rationale,
        valueProposition:
          "Share a relevant opportunity based on their recent work.",
        tone: "Friendly and direct",
      },
    },
    tasks: tasks.map((task, index) => ({
      _id: `${planId}_task_${index + 1}` as Id<"outreachTasks">,
      _creationTime: Date.now() - 26 * HOUR_MS,
      planId: planId as Id<"outreachPlans">,
      type: task.type,
      order: index + 1,
      status: task.status,
      timing:
        task.type === "wait"
          ? { type: "delay" as const, value: "2d" }
          : { type: "immediate" as const },
      description: task.description,
      content: task.content,
      approvalReady: false,
      approvalContext: { platform: person.platform },
      ...(task.type === "comment" && commentSource && commentPostId
        ? {
            targetTweetId: commentPostId,
            originalPost: {
              platform: person.platform,
              postData: commentSource,
              postRef: undefined,
              postSummary: undefined,
            },
          }
        : { originalPost: null }),
    })),
  };
  historyPlans.set(planId, planData);
  return {
    planId,
    artifact: createPlanPreviewArtifact({
      planId,
      prospectId: person._id,
      status: "draft",
      rationale,
      tasks: planData.tasks.map((task) => ({
        _id: task._id,
        order: task.order,
        type: task.type,
        description: task.description,
        status: task.status,
        content: task.content,
      })),
    }),
  };
}

function profileCard(person: Prospect, context?: string) {
  return createProfilePreviewArtifact({
    variant: "prospect",
    prospectId: person._id,
    platform: person.platform,
    profileData: {
      ...person,
      avatarUrl: portraits[person.displayName ?? ""]?.path,
      profileUrl:
        person.platform === "twitter"
          ? person.socialProfiles?.twitter?.url
          : person.socialProfiles?.linkedin?.url,
    },
    label: "Prospect profile",
    context,
  });
}

/**
 * Past agent conversations that make the thread sidebar look lived in. Every
 * workspace gets its own set of threads so switching between them never shows
 * an empty history. Every thread goes through the same message shapes the real
 * AgentChat renders: mention chips from taggedEntities, attachments on user
 * messages, tool parts, and inline artifact cards. Threads never mutate fixture
 * plan or pipeline state, so scenario contracts keep their clean start.
 */
export function seedAgentHistory(
  client: LocalClient,
  agent: AgentServices,
  state: ReturnType<typeof createAppFixtures>
) {
  // Waiting-state workflows (pending approvals, live batch progress) resolve
  // through their own demo records so the inline controls work end to end.
  registerHistoryWorkflowServices(client);

  state.workspaces.forEach((workspace, workspaceIndex) => {
    seedWorkspaceHistory(agent, state, workspace, workspaceIndex);
  });
}

function seedWorkspaceHistory(
  agent: AgentServices,
  state: ReturnType<typeof createAppFixtures>,
  workspace: ReturnType<typeof createAppFixtures>["workspaces"][number],
  workspaceIndex: number
) {
  // Thread and record ids are scoped per workspace so every workspace seeds
  // the same story threads without colliding.
  const idScope = workspaceIndex === 0 ? "" : `_ws${workspaceIndex}`;
  const threadId = (base: string) => `${base}${idScope}`;
  const useCase = getWorkspaceUseCase(workspace.useCaseKey);
  const entityLower = useCase.entityPlural.toLowerCase();
  const people = state.prospects.filter(
    (person) => person.workspaceId === workspace._id
  );
  const person =
    people.find((item) => item._id === "use_case_demo_audience_30") ??
    people.find((item) => item._id === "use_case_demo_candidates_29") ??
    people.find((item) => item.status === "new");
  const second =
    people.find(
      (item) => item.status === "contacted" && item._id !== person?._id
    ) ?? people.find((item) => item._id !== person?._id);
  if (!person || !second) return;
  const topMatch =
    people
      .filter(
        (item) =>
          item.status === "new" &&
          item._id !== person._id &&
          item.qualificationStatus === "qualified"
      )
      .sort(
        (a, b) => (b.qualificationScore ?? 0) - (a.qualificationScore ?? 0)
      )[0] ?? second;
  const firstName = (name: string | null | undefined) =>
    name?.split(" ")[0] ?? "there";

  const base = Date.now();
  const seed = (
    scopedThreadId: string,
    hoursAgo: number,
    messages: Array<{
      role: "user" | "assistant";
      text: string;
      metadata?: ReturnType<typeof mentionMetadata>;
      parts?: Parameters<AgentServices["append"]>[4];
    }>
  ) => {
    agent.seedThreadContext(scopedThreadId, workspace._id);
    messages.forEach((message) => {
      agent.append(
        scopedThreadId,
        message.role,
        message.text,
        message.metadata,
        message.parts
      );
    });
    const stored = agent.threads.get(scopedThreadId);
    if (!stored) return;
    const threadBase = base - hoursAgo * HOUR_MS;
    stored.forEach((message, messageIndex) => {
      message._creationTime = threadBase + messageIndex * MINUTE_MS;
    });
  };

  // 1. Teaching the agent a rule it stores as workspace memory, then checking
  // what it kept (three days ago).
  const memoryId = `demo_history_memory_1${idScope}`;
  const memorySummary =
    "Never open with a question about funding. Mention the demo only when it clarifies the message.";
  // The memory card's "Open in Agent observability" button resolves this id
  // through the demo observability services.
  registerDemoHistoryMemory({
    workspaceId: String(workspace._id),
    memoryId,
    title: "No funding questions in openers",
    summary: memorySummary,
  });
  seed(threadId("demo_history_memory"), (3 * DAY_MS) / HOUR_MS, [
    {
      role: "user",
      text: "Remember this for outreach: never open with a question about funding, and only mention the demo when it clarifies the message.",
    },
    {
      role: "assistant",
      parts: [
        {
          type: "tool-rememberWorkspaceMemory",
          toolCallId: "demo_history_memory_save",
          state: "output-available",
          input: { summary: memorySummary },
          output: {
            success: true,
            memoryId,
            artifact: createMemoryArtifact({
              memoryId,
              workspaceId: String(workspace._id),
              title: "No funding questions in openers",
              category: "outreach",
              source: "agent",
              confidence: 0.92,
              impactScore: 72,
            }),
          },
        },
        {
          type: "text",
          text: "Saved for this workspace. Every plan I draft from now on opens with the person's own work, and the demo only appears when it clarifies the message.",
        },
      ],
      text: "",
    },
    {
      role: "user",
      text: "What have you saved about how I run outreach?",
    },
    {
      role: "assistant",
      parts: [
        {
          type: "tool-searchWorkspaceMemories",
          toolCallId: "demo_history_memory_search",
          state: "output-available",
          input: { query: "outreach preferences" },
          output: {
            success: true,
            memories: [{ memoryId, title: "No funding questions in openers" }],
          },
        },
        {
          type: "text",
          text: "Two rules so far: never open with a question about funding, and mention the demo only when it clarifies the message. Both apply automatically when I draft plans. Tell me more anytime and they update, no re-setup needed.",
        },
      ],
      text: "",
    },
  ]);

  // 1b. A reply waiting on approval, with the agent's visible reasoning. The
  // inline approve and reject controls resolve through the demo records.
  const pendingPerson =
    people.find(
      (item) =>
        item.platform === "twitter" &&
        item.status === "new" &&
        item.qualificationStatus === "qualified" &&
        item._id !== person._id
    ) ?? second;
  const pendingPost = latestPost(pendingPerson);
  const pendingRef =
    pendingPost && pendingPerson.platform === "twitter"
      ? twitterRef(pendingPerson, pendingPost)
      : undefined;
  // The reply card previews the source post, so hydrate it as a fixture tweet.
  if (pendingRef && pendingPost) registerDemoTwitterPost(pendingPost);
  const pendingUnified =
    pendingPost && pendingPerson.platform === "linkedin"
      ? toUnifiedPost(pendingPerson, pendingPost)
      : undefined;
  // The reply answers a question from the workspace's own brief, so the
  // question and the draft change with the use case.
  const isRecruiting = workspace.useCaseKey === "recruiting";
  const pendingQuestion = isRecruiting
    ? "whether the role is remote"
    : "how we run this process without another tool";
  const REPLY_COPY: Record<string, string> = {
    "Hannah Schmidt":
      "Yes, remote within three hours of our Paris time zone. You would own design end to end on a team of three. Happy to send the role details whenever you want them.",
  };
  const pendingReply =
    REPLY_COPY[pendingPerson.displayName ?? ""] ??
    (isRecruiting
      ? "Thanks for asking: yes, the role is remote-first with flexible hours. Happy to share what the day-to-day looks like if that is useful."
      : "We keep it to one thread per project: the request, the decision, and who approved it. Happy to show how it looks on a real project if that is useful.");
  const pendingReasoning = isRecruiting
    ? "The question is about remote policy, so answer it factually from the workspace brief: remote, within three hours of Paris. No product mention, no pitch, and keep it to three sentences. Hold the send for approval since it goes out from the user's account."
    : "The question is about our process, so answer it from the workspace brief in plain words: one thread per project, one approval record. No product pitch, three sentences max, and hold the send for approval since it goes out from the user's account.";
  const pendingActionId = `demo_history_reply_request${idScope}`;
  historyActionRequests.set(pendingActionId, {
    actionRequestId: pendingActionId,
    status: "pending_approval",
    title: `Reply to the comment on ${firstName(pendingPerson.displayName)}'s post`,
    description: "Waiting for your approval.",
    actionKey:
      pendingPerson.platform === "twitter"
        ? "reply_to_post"
        : "linkedin_comment_on_post",
    platform: pendingPerson.platform,
    content: pendingReply,
    ...(pendingRef ? { sourcePostRef: pendingPost } : {}),
    ...(pendingRef ? { sourcePostSummary: pendingPost } : {}),
    ...(pendingUnified ? { sourcePostData: pendingUnified } : {}),
    sourcePostId: pendingRef?.postId,
    sourceContext: "Answering a question under their post.",
  });
  seed(threadId("demo_history_reply"), 4, [
    {
      role: "user",
      text: `@${pendingPerson.displayName} someone asked under their post ${pendingQuestion}. Reply and keep it short and factual.`,
      metadata: mentionMetadata([pendingPerson]),
    },
    {
      role: "assistant",
      parts: [
        {
          type: "reasoning",
          text: pendingReasoning,
        },
        {
          type: "tool-getSocialContext",
          toolCallId: "demo_history_reply_context",
          state: "output-available",
          input: { prospectId: pendingPerson._id, retrieve: "thread" },
          output: { success: true },
        },
        {
          type: "tool-socialAction",
          toolCallId: "demo_history_reply_draft",
          state: "output-available",
          input: {
            action:
              pendingPerson.platform === "twitter"
                ? "reply_to_post"
                : "linkedin_comment_on_post",
            ...(pendingRef ? { tweetId: pendingRef.postId } : {}),
            text: pendingReply,
          },
          output: {
            success: true,
            executed: false,
            pendingApproval: true,
            actionKey:
              pendingPerson.platform === "twitter"
                ? "reply_to_post"
                : "linkedin_comment_on_post",
            artifact: createTwitterActionArtifact({
              platform: pendingPerson.platform,
              actionKey:
                pendingPerson.platform === "twitter"
                  ? "reply_to_post"
                  : "linkedin_comment_on_post",
              actionRequestId: pendingActionId,
              title: "Reply draft",
              message: "Waiting for your approval.",
              status: "pending_approval",
              draftContent: pendingReply,
              ...(pendingRef ? { sourcePostRef: pendingPost } : {}),
              ...(pendingRef ? { sourcePostSummary: pendingPost } : {}),
              ...(pendingUnified ? { sourcePostData: pendingUnified } : {}),
            }),
          },
        },
        {
          type: "text",
          text: `Draft reply is ready below. It answers the question from your brief in three sentences. Approve and it posts from your account; reject if the wording is off and I will redraft.`,
        },
      ],
      text: "",
    },
  ]);

  // 1c. A workspace-profile proposal waiting on approval.
  const proposalId = `demo_history_profile_proposal${idScope}`;
  const proposalProfile = isRecruiting
    ? {
        title: "Design-system owners",
        description:
          "Engineers who have built and maintained a shared component system and can keep our interface consistent as it grows.",
        painPoints: [
          "Inconsistent UI across surfaces",
          "Design drift between product teams",
        ],
      }
    : {
        title: "Returning clients",
        description:
          "People who came back for a second project, referred a peer, or asked to keep working together after the first round.",
        painPoints: ["One-off projects only", "No view of who returned"],
      };
  const proposalTitle = proposalProfile.title;
  historyProfileProposals.set(proposalId, {
    requestId: proposalId,
    status: "pending_approval",
    revision: 1,
    profileLabelPlural: useCase.profileLabelPlural,
    proposedProfiles: [
      { ...proposalProfile, channels: ["twitter", "linkedin"] },
    ],
    addedTitles: [proposalTitle],
    updatedTitles: [],
    removedTitles: [],
    workspaceName: workspace.name,
  });
  seed(threadId("demo_history_profile"), 6, [
    {
      role: "user",
      text: isRecruiting
        ? "Most matches are senior frontend engineers, but we also need people who can own our design system. Propose an updated profile."
        : "Most matches are one-time projects. We should also look for people who come back for a second round. Propose an updated profile.",
    },
    {
      role: "assistant",
      parts: [
        {
          type: "tool-proposeWorkspaceProfiles",
          toolCallId: "demo_history_profile_propose",
          state: "output-available",
          input: { change: "add", titles: [proposalTitle] },
          output: {
            success: true,
            requestId: proposalId,
            artifact: createWorkspaceProfileChangeArtifact({
              requestId: proposalId,
            }),
          },
        },
        {
          type: "text",
          text: `Proposal is ready: ${useCase.profileLabelPlural} gains a ${proposalTitle.toLowerCase()} profile next to your current one. Future discovery uses it the moment you approve. Open the panel to tweak it first, or reject and I will redraft.`,
        },
      ],
      text: "",
    },
  ]);

  // 1d. A batch that is still running right now.
  const runningBatchPeople = people.filter(
    (item) =>
      item.status === "new" &&
      item.qualificationStatus === "qualified" &&
      (item.qualificationScore ?? 0) >= 85
  );
  const runningBatchCount = Math.min(
    12,
    Math.max(4, runningBatchPeople.length)
  );
  const runningBatchId = `demo_history_batch_running${idScope}`;
  historyPlanBatchRuns.set(runningBatchId, {
    _id: runningBatchId as Id<"planBatchRuns">,
    fitScoreMin: 85,
    fitScoreMax: undefined,
    operation: "create",
    scopeKind: "fit_score",
    status: "running",
    targetCount: runningBatchCount,
    eligibleCount: runningBatchCount,
    succeededCount: Math.max(1, Math.round(runningBatchCount * 0.6)),
    createdCount: Math.max(1, Math.round(runningBatchCount * 0.6)),
    updatedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    selectionSkippedCount: 0,
    finishedCount: Math.max(1, Math.round(runningBatchCount * 0.6)),
    targetNames: runningBatchPeople.map((item) => item.displayName ?? "Person"),
    issues: [],
  });
  const runningDone = Math.max(1, Math.round(runningBatchCount * 0.6));
  seed(threadId("demo_history_batch_live"), 2, [
    {
      role: "user",
      text: `Create plans for every new ${useCase.entitySingular.toLowerCase()} scoring 85 or above.`,
    },
    {
      role: "assistant",
      parts: [
        {
          type: "reasoning",
          text: `Filter to new, qualified ${entityLower} with a fit score of 85 or higher, then start the batch with the saved rules. Keep the progress card live so the user can see each plan land without waiting on me.`,
        },
        {
          type: "tool-managePlanBatch",
          toolCallId: "demo_history_batch_live_start",
          state: "output-available",
          input: {
            operation: "create",
            scope: { kind: "fit_score" },
            fitScoreMin: 85,
          },
          output: {
            success: true,
            runId: runningBatchId,
            artifact: createPlanBatchProgressArtifact({
              runId: runningBatchId,
            }),
          },
        },
        {
          type: "text",
          text: `${runningBatchCount} people match at 85 or above. ${runningDone} plans are drafted so far and the rest are in flight; the card above updates as each one lands. Nothing sends until you approve, and I will report back when the batch finishes.`,
        },
      ],
      text: "",
    },
  ]);

  // 2. Plain-words discovery: the search starts in the background, then the
  // agent shows the strongest matches with the posts that qualified them.
  seed(threadId("demo_history_discovery"), 30, [
    {
      role: "user",
      text: `Find ${entityLower} who already talk about the problem we solve. Check their recent posts before showing me anyone.`,
    },
    {
      role: "assistant",
      parts: [
        {
          type: "tool-searchProspects",
          toolCallId: "demo_history_discovery_search",
          state: "output-available",
          input: {
            query: workspace.improvedDescription ?? workspace.description ?? "",
          },
          output: {
            success: true,
            message: `Search started. I'll look for ${entityLower} that match this workspace in the background.`,
            workflowId: "demo_history_discovery_workflow",
            progress: [
              {
                step: `Search started for ${entityLower}`,
                status: "completed",
                details:
                  "Generating keywords, searching platforms, and saving matches.",
              },
            ],
            artifact: createProgressStatusArtifact({
              title: `Finding ${useCase.entityPlural}`,
              message: `Search has started in the background. New ${entityLower} will appear in your dashboard.`,
              progress: [
                {
                  step: `Search started for ${entityLower}`,
                  status: "completed",
                  details:
                    "Generating keywords, searching platforms, and saving matches.",
                },
              ],
            }),
          },
        },
        {
          type: "text",
          text: `Search is running in the background. Per your rule, I read each candidate's recent posts before they reach your People tab, so only people with firsthand evidence show up. I'll report back with the strongest matches.`,
        },
      ],
      text: "",
    },
    {
      role: "user",
      text: "Anything good yet?",
    },
    {
      role: "assistant",
      parts: [
        {
          type: "tool-queryWorkspace",
          toolCallId: "demo_history_discovery_state",
          state: "output-available",
          input: {},
          output: {
            success: true,
            discoveryStatus: "running",
            qualifiedCount: 12,
          },
        },
        {
          type: "tool-displayEntity",
          toolCallId: "demo_history_discovery_profile_1",
          state: "output-available",
          input: { entity: "prospect_profile" },
          output: {
            success: true,
            artifact: profileCard(
              topMatch,
              "Passed your criteria: firsthand post about the problem we solve."
            ),
          },
        },
        {
          type: "tool-displayEntity",
          toolCallId: "demo_history_discovery_profile_2",
          state: "output-available",
          input: { entity: "prospect_profile" },
          output: {
            success: true,
            artifact: profileCard(
              person,
              "Passed your criteria: firsthand post about the problem we solve."
            ),
          },
        },
        {
          type: "tool-displayEntity",
          toolCallId: "demo_history_discovery_posts",
          state: "output-available",
          input: { entity: "post_list", selection: "latest" },
          output: {
            success: true,
            artifact: createPostListArtifact({
              platform: person.platform,
              title: "Recent posts",
              prospectId: person._id,
              context: `What ${firstName(person.displayName)} has been posting lately.`,
              posts: postListEntries(person),
            }),
          },
        },
        {
          type: "text",
          text: `Three cycles done: 128 ${entityLower} checked, 12 passed your criteria with a firsthand post as evidence. The two strongest are above, each with the post that qualified them, and the full list is in the People tab. I keep cycling, so the list stays fresh.`,
        },
      ],
      text: "",
    },
  ]);

  // 3. First plan for one tagged person: social context, batch create, then
  // the draft itself.
  const personPlan = planTasks(person, workspace, state.scenario);
  const personPlanCard = planCard(
    person,
    personPlan,
    `${person.displayName} posted firsthand evidence that matches the workspace brief. Comment on their latest post first, then a DM only if the reply opens the door.`
  );
  const singleRunId = `demo_history_plan_run${idScope}`;
  historyPlanBatchRuns.set(singleRunId, {
    _id: singleRunId as Id<"planBatchRuns">,
    fitScoreMin: undefined,
    fitScoreMax: undefined,
    operation: "create",
    scopeKind: "tagged",
    status: "completed",
    targetCount: 1,
    eligibleCount: 1,
    succeededCount: 1,
    createdCount: 1,
    updatedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    selectionSkippedCount: 0,
    finishedCount: 1,
    targetNames: [person.displayName ?? "Person"],
    issues: [],
  });
  seed(threadId("demo_history_plan"), 26, [
    {
      role: "user",
      text: `@${person.displayName} draft the first plan for them. Comment on their post first, DM only if it makes sense.`,
      metadata: mentionMetadata([person]),
    },
    {
      role: "assistant",
      parts: [
        {
          type: "tool-getSocialContext",
          toolCallId: "demo_history_plan_context",
          state: "output-available",
          input: {
            prospectId: person._id,
            retrieve: "posts",
            selection: "latest",
          },
          output: { success: true },
        },
        {
          type: "tool-managePlanBatch",
          toolCallId: "demo_history_plan_batch",
          state: "output-available",
          input: { operation: "create", scope: "tagged" },
          output: {
            success: true,
            runId: singleRunId,
            artifact: createPlanBatchProgressArtifact({ runId: singleRunId }),
          },
        },
        {
          type: "tool-getProspectPlan",
          toolCallId: "demo_history_plan_read",
          state: "output-available",
          input: { prospectId: person._id },
          output: {
            success: true,
            hasPlan: true,
            artifact: personPlanCard.artifact,
          },
        },
        {
          type: "text",
          text: `Draft is ready for ${firstName(person.displayName)}: comment on the post that qualified them first, then a DM only if the reply opens the door. Nothing sends until you approve each step.`,
        },
      ],
      text: "",
    },
  ]);

  // 4. One batch request, three tagged people, three drafts with the same
  // rules.
  const bulkTagged = people
    .filter(
      (item) =>
        item._id !== person._id &&
        item._id !== second._id &&
        item.status === "new"
    )
    .sort((a, b) => (b.qualificationScore ?? 0) - (a.qualificationScore ?? 0))
    .slice(0, 3);
  if (bulkTagged.length >= 2) {
    const bulkRunId = `demo_history_bulk_run${idScope}`;
    historyPlanBatchRuns.set(bulkRunId, {
      _id: bulkRunId as Id<"planBatchRuns">,
      fitScoreMin: undefined,
      fitScoreMax: undefined,
      operation: "create",
      scopeKind: "tagged",
      status: "completed",
      targetCount: bulkTagged.length,
      eligibleCount: bulkTagged.length,
      succeededCount: bulkTagged.length,
      createdCount: bulkTagged.length,
      updatedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      selectionSkippedCount: 0,
      finishedCount: bulkTagged.length,
      targetNames: bulkTagged.map((item) => item.displayName ?? "Person"),
      issues: [],
    });
    seed(threadId("demo_history_bulk"), 24, [
      {
        role: "user",
        text: `${bulkTagged
          .map((item) => `@${item.displayName}`)
          .join(", ")} create one plan for each of them, same rules as before.`,
        metadata: mentionMetadata(bulkTagged),
      },
      {
        role: "assistant",
        parts: [
          {
            type: "tool-managePlanBatch",
            toolCallId: "demo_history_bulk_batch",
            state: "output-available",
            input: { operation: "create", scope: "tagged" },
            output: {
              success: true,
              runId: bulkRunId,
              artifact: createPlanBatchProgressArtifact({ runId: bulkRunId }),
            },
          },
          ...bulkTagged.flatMap((item) => {
            const { artifact } = planCard(
              item,
              planTasks(item, workspace, state.scenario),
              `${item.displayName}: ${item.briefIntro} Same rules as before: comment on their latest post first, DM only if the reply opens the door.`
            );
            return [
              {
                type: "tool-getProspectPlan" as const,
                toolCallId: `demo_history_bulk_read_${item._id}`,
                state: "output-available" as const,
                input: { prospectId: item._id },
                output: {
                  success: true,
                  hasPlan: true,
                  artifact,
                },
              },
            ];
          }),
          {
            type: "text",
            text: `Three drafts ready, one per person. Each opens with a comment on their latest post and keeps the DM for after a reply. Review them in Plans; nothing sends until you approve.`,
          },
        ],
        text: "",
      },
    ]);
  }

  // 5. Social engagement with the real social-action tools: like plus comment,
  // each with its own completion card.
  const engagePost = latestPost(second);
  const engageUnified = engagePost
    ? second.platform === "linkedin"
      ? toUnifiedPost(second, engagePost)
      : undefined
    : undefined;
  const engageRef =
    engagePost && second.platform === "twitter"
      ? twitterRef(second, engagePost)
      : undefined;
  const engageComment = commentFor(second);
  const engageParts: Parameters<AgentServices["append"]>[4] = [
    {
      type: "tool-getSocialContext",
      toolCallId: "demo_history_engage_context",
      state: "output-available",
      input: { prospectId: second._id, retrieve: "posts", selection: "latest" },
      output: { success: true },
    },
    {
      type: "tool-socialAction",
      toolCallId: "demo_history_engage_like",
      state: "output-available",
      input: {
        action:
          second.platform === "linkedin"
            ? "linkedin_react_to_post"
            : "like_post",
        ...(engageRef ? { tweetId: engageRef.postId } : {}),
      },
      output: {
        success: true,
        executed: true,
        pendingApproval: false,
        actionKey:
          second.platform === "linkedin"
            ? "linkedin_react_to_post"
            : "like_post",
        artifact: createTwitterActionArtifact({
          platform: second.platform,
          actionKey:
            second.platform === "linkedin"
              ? "linkedin_react_to_post"
              : "like_post",
          title: `Liked ${firstName(second.displayName)}'s post`,
          message: "Reaction is visible on their post.",
          status: "completed",
          ...(engageRef ? { sourcePostRef: engagePost } : {}),
          ...(engageUnified ? { sourcePostData: engageUnified } : {}),
        }),
      },
    },
    {
      type: "tool-socialAction",
      toolCallId: "demo_history_engage_comment",
      state: "output-available",
      input: {
        action:
          second.platform === "linkedin"
            ? "linkedin_comment_on_post"
            : "reply_to_post",
        ...(engageRef ? { tweetId: engageRef.postId } : {}),
        text: engageComment,
      },
      output: {
        success: true,
        executed: true,
        pendingApproval: false,
        actionKey:
          second.platform === "linkedin"
            ? "linkedin_comment_on_post"
            : "reply_to_post",
        artifact: createTwitterActionArtifact({
          platform: second.platform,
          actionKey:
            second.platform === "linkedin"
              ? "linkedin_comment_on_post"
              : "reply_to_post",
          title: `Commented on ${firstName(second.displayName)}'s post`,
          message: "Posted from your account.",
          status: "completed",
          draftContent: engageComment,
          ...(engageRef ? { sourcePostRef: engagePost } : {}),
          ...(engageUnified ? { sourcePostData: engageUnified } : {}),
        }),
      },
    },
    {
      type: "text",
      text: `Done. I liked the post and commented from your account: "${engageComment}" It stays about their work; no product mention, and I held the DM until you say the timing is right.`,
    },
  ];
  seed(threadId("demo_history_engage"), 22, [
    {
      role: "user",
      text: `@${second.displayName} like and comment on their latest post. Keep it about their work, not about us.`,
      metadata: mentionMetadata([second]),
    },
    {
      role: "assistant",
      parts: engageParts,
      text: "",
    },
  ]);

  // 6. An uploaded clip used in a drafted DM, exactly like the composer sends
  // attachments today. The DM waits on approval, so the inline approve and
  // edit controls resolve through the demo records.
  const mediaUrl = "/media/reacherx-workflow.mp4";
  const mediaTaskId = `demo_history_media_attachment${idScope}`;
  const mediaTopic = isRecruiting
    ? {
        clipNoun: "our checkout rebuild",
        clipMention:
          "I recorded a 40-second walkthrough of the change, attached here.",
        clipDescription: "40-second walkthrough of the checkout rebuild",
        dmAsk: "send it with a short DM about the role",
        dmHook:
          person.platform === "linkedin"
            ? "your post about checkout performance and A/B infrastructure is the same problem we just finished rebuilding on our storefront"
            : "your post about storefront tooling is the same problem we just rebuilt on our storefront",
        offer: "If it resonates, I can send the role details too.",
      }
    : {
        clipNoun: "our approval trail",
        clipMention:
          "I recorded a 40-second walkthrough of our approval trail, attached here.",
        clipDescription: "40-second walkthrough of the approval trail",
        dmAsk:
          "send it with a short DM about how we keep approvals in one place",
        dmHook:
          "your post about client revisions landing across email, chat and an old PDF is the same problem we just rebuilt for",
        offer:
          "If it resonates, I can show you how it fits a project like yours.",
      };
  const dmActionKey =
    person.platform === "linkedin"
      ? "linkedin_send_message_existing_conversation"
      : "send_dm_in_existing_conversation";
  const dmDraft = `Hi ${firstName(person.displayName)}, ${mediaTopic.dmHook}. ${mediaTopic.clipMention} ${mediaTopic.offer}`;
  const dmRequestId = `demo_history_media_dm_request${idScope}`;
  historyActionRequests.set(dmRequestId, {
    actionRequestId: dmRequestId,
    status: "pending_approval",
    title:
      person.platform === "linkedin" ? "LinkedIn message draft" : "X DM draft",
    description: "Video attached. Waiting for your approval.",
    actionKey: dmActionKey,
    platform: person.platform,
    content: dmDraft,
    mediaUrls: [mediaUrl],
    mediaKinds: ["video"],
    mediaDescriptions: [mediaTopic.clipDescription],
  });
  seed(threadId("demo_history_media"), 20, [
    {
      role: "user",
      text: `I recorded a 40-second walkthrough of ${mediaTopic.clipNoun}. @${person.displayName} ${mediaTopic.dmAsk}.`,
      metadata: mentionMetadata(
        [person],
        [{ uploadId: null, fileName: "reacherx-workflow.mp4", mediaUrl }]
      ),
    },
    {
      role: "assistant",
      parts: [
        {
          type: "tool-workspaceAttachments",
          toolCallId: "demo_history_media_resolve",
          state: "output-available",
          input: { operation: "show", query: "reacherx-workflow.mp4" },
          output: {
            success: true,
            operation: "show",
            message: "One video attachment matches.",
            count: 1,
            attachments: [
              {
                attachmentRef: mediaTaskId,
                fileName: "reacherx-workflow.mp4",
                displayName: "reacherx-workflow.mp4",
                mimeType: "video/mp4",
                mediaKind: "video",
                size: 1842000,
                uploadedAt: base - 20 * HOUR_MS,
                mediaUrl,
              },
            ],
            artifact: createAttachmentPreviewArtifact({
              attachments: [
                {
                  attachmentRef: mediaTaskId,
                  fileName: "reacherx-workflow.mp4",
                  displayName: "reacherx-workflow.mp4",
                  mimeType: "video/mp4",
                  mediaKind: "video",
                  size: 1842000,
                  uploadedAt: base - 20 * HOUR_MS,
                  mediaUrl,
                },
              ],
            }),
          },
        },
        {
          type: "tool-getSocialContext",
          toolCallId: "demo_history_media_context",
          state: "output-available",
          input: {
            prospectId: person._id,
            retrieve: "posts",
            selection: "latest",
          },
          output: { success: true },
        },
        {
          type: "tool-socialAction",
          toolCallId: "demo_history_media_dm",
          state: "output-available",
          input: {
            action: dmActionKey,
            targetUserId: person.externalId,
            text: dmDraft,
            mediaUrls: [mediaUrl],
            mediaKinds: ["video"],
            mediaDescriptions: [mediaTopic.clipDescription],
          },
          output: {
            success: true,
            executed: false,
            pendingApproval: true,
            actionKey: dmActionKey,
            artifact: createDmDraftArtifact({
              platform: person.platform,
              prospectId: person._id,
              actionRequestId: dmRequestId,
              title:
                person.platform === "linkedin"
                  ? "LinkedIn message draft"
                  : "X DM draft",
              message: "Video attached. Waiting for your approval.",
              status: "pending_approval",
              draftContent: dmDraft,
            }),
          },
        },
        {
          type: "text",
          text: `The clip is attached to ${firstName(person.displayName)}'s draft, so the DM leads with proof instead of a pitch. Review the message and the clip, then approve; nothing sends until you do.`,
        },
      ],
      text: "",
    },
  ]);

  // 7. A weekly summary from the workspace's own live state.
  seed(threadId("demo_history_summary"), 8, [
    { role: "user", text: "How did last week go?" },
    {
      role: "assistant",
      parts: [
        {
          type: "tool-queryWorkspace",
          toolCallId: "demo_history_summary_state",
          state: "output-available",
          input: {},
          output: {
            success: true,
            discoveryStatus: "running",
            qualifiedCount: 46,
          },
        },
        {
          type: "tool-listProspectPlans",
          toolCallId: "demo_history_summary_plans",
          state: "output-available",
          input: {},
          output: { success: true, plans: [] },
        },
        {
          type: "text",
          text: `Solid week: 128 new ${entityLower} checked, 46 matched your criteria, 12 contacted, 5 replies, and the reply rate improved about 9%. ${firstName(person.displayName)}'s plan draft is still waiting on your review, and ${firstName(second.displayName)} just got a comment from your account.`,
        },
      ],
      text: "",
    },
  ]);
}
