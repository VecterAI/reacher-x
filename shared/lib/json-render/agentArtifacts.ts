import {
  defineCatalog,
  type InferComponentProps,
  type Spec,
} from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";
import { getTwitterPostRef, summarizeTwitterPost } from "../twitter/contracts";

export const AGENT_ARTIFACT_KIND = "reacherx-agent-artifact";
export const AGENT_ARTIFACT_VERSION = 1 as const;

export const agentArtifactTaskSchema = z.object({
  _id: z.string(),
  order: z.number(),
  type: z.string(),
  description: z.string(),
  status: z.string(),
  content: z.string().optional(),
  targetTweetId: z.string().optional(),
});

export const agentArtifactProgressStepSchema = z.object({
  step: z.string(),
  status: z.enum(["pending", "running", "completed", "failed"]),
  details: z.string().optional(),
  count: z.number().optional(),
});

const profilePreviewVariantSchema = z.enum(["prospect", "twitter", "linkedin"]);

const twitterPostRefSchema = z.object({
  platform: z.literal("twitter"),
  postId: z.string(),
  conversationId: z.string().optional(),
  authorId: z.string().optional(),
  authorHandle: z.string().optional(),
  url: z.string().optional(),
});

const twitterAuthorSummarySchema = z.object({
  id: z.string().optional(),
  handle: z.string().optional(),
  name: z.string().optional(),
  avatarUrl: z.string().optional(),
  profileUrl: z.string().optional(),
});

const twitterMetricsSummarySchema = z.object({
  replies: z.number().optional(),
  reposts: z.number().optional(),
  likes: z.number().optional(),
  quotes: z.number().optional(),
  views: z.number().optional(),
  bookmarks: z.number().optional(),
});

const twitterMediaSummarySchema = z.object({
  type: z.enum(["photo", "video", "animated_gif", "link"]),
  url: z.string(),
  previewUrl: z.string().optional(),
  altText: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

const twitterPostSummarySchema = z.object({
  platform: z.literal("twitter"),
  ref: twitterPostRefSchema,
  url: z.string(),
  textPreview: z.string(),
  createdAt: z.number().optional(),
  author: twitterAuthorSummarySchema.optional(),
  metrics: twitterMetricsSummarySchema.optional(),
  media: z.array(twitterMediaSummarySchema).optional(),
  inReplyToPostId: z.string().optional(),
  inReplyToHandle: z.string().optional(),
  quotePostId: z.string().optional(),
  lang: z.string().optional(),
  source: z.string().optional(),
});

export const agentArtifactCatalog = defineCatalog(schema, {
  components: {
    OnboardingCard: {
      props: z.object({
        workspaceId: z.string(),
      }),
      description:
        "Shows onboarding/prospecting setup progress for a workspace.",
    },
    ProgressStatusCard: {
      props: z.object({
        title: z.string().nullable().optional(),
        message: z.string().nullable().optional(),
        progress: z.array(agentArtifactProgressStepSchema),
        totalProspects: z.number().nullable().optional(),
      }),
      description:
        "Shows structured progress or status from agent workflows such as prospect search.",
    },
    PostArtifact: {
      props: z.object({
        platform: z.enum(["twitter", "linkedin"]),
        prospectId: z.string().nullable().optional(),
        openKind: z.enum(["post", "post_list"]).nullable().optional(),
        postData: z.any().nullable().optional(),
        postRef: twitterPostRefSchema.nullable().optional(),
        postSummary: twitterPostSummarySchema.nullable().optional(),
        context: z.string().nullable().optional(),
        taskId: z.string().nullable().optional(),
        taskStatus: z.string().nullable().optional(),
        panelMode: z.enum(["approval", "posted"]).nullable().optional(),
        targetTweetId: z.string().nullable().optional(),
        interactive: z.boolean().nullable().optional(),
      }),
      description:
        "Displays a Twitter or LinkedIn post artifact in chat, optionally opening a related panel.",
    },
    ProfilePreviewCard: {
      props: z.object({
        variant: profilePreviewVariantSchema,
        prospectId: z.string().nullable().optional(),
        platform: z.enum(["twitter", "linkedin"]).nullable().optional(),
        profileData: z.any(),
        label: z.string().nullable().optional(),
        context: z.string().nullable().optional(),
        interactive: z.boolean().nullable().optional(),
      }),
      description:
        "Displays the top-section inline preview for a generic or platform-specific profile.",
    },
    PostListArtifact: {
      props: z.object({
        platform: z.enum(["twitter", "linkedin"]),
        title: z.string(),
        prospectId: z.string().nullable().optional(),
        context: z.string().nullable().optional(),
        posts: z.array(
          z.object({
            id: z.string(),
            platform: z.enum(["twitter", "linkedin"]),
            textPreview: z.string(),
            createdAt: z.number().nullable().optional(),
            postData: z.any().nullable().optional(),
            postRef: twitterPostRefSchema.nullable().optional(),
            postSummary: twitterPostSummarySchema.nullable().optional(),
          })
        ),
        interactive: z.boolean().nullable().optional(),
      }),
      description:
        "Displays a compact inline preview of multiple posts and opens the canonical posts panel.",
    },
    PlanPreviewCard: {
      props: z.object({
        planId: z.string().nullable().optional(),
        status: z.string(),
        rationale: z.string(),
        tasks: z.array(agentArtifactTaskSchema),
      }),
      description:
        "Shows a compact outreach plan preview with strategy summary and optional approval affordances.",
    },
    MemoryCard: {
      props: z.object({
        memoryId: z.string(),
        workspaceId: z.string().nullable().optional(),
        prospectId: z.string().nullable().optional(),
        title: z.string(),
        category: z.string(),
        source: z.string(),
        confidence: z.number(),
        impactScore: z.number(),
      }),
      description:
        "Slim confirmation card for a saved workspace memory, with category badge and optional deep link into Agent Ops.",
    },
    TwitterActionCard: {
      props: z.object({
        platform: z.enum(["twitter", "linkedin"]).nullable().optional(),
        actionKey: z.string(),
        actionRequestId: z.string().nullable().optional(),
        title: z.string(),
        message: z.string().nullable().optional(),
        status: z.string(),
        approvalMode: z.string().nullable().optional(),
        riskLevel: z.string().nullable().optional(),
        targetTweetId: z.string().nullable().optional(),
        sourcePostData: z.any().nullable().optional(),
        sourcePostRef: twitterPostRefSchema.nullable().optional(),
        sourcePostSummary: twitterPostSummarySchema.nullable().optional(),
        sourceContext: z.string().nullable().optional(),
        draftContent: z.string().nullable().optional(),
        createdTweetId: z.string().nullable().optional(),
        interactive: z.boolean().nullable().optional(),
      }),
      description:
        "Displays a durable Twitter action request or completion state, with optional approval and review affordances.",
    },
    DmDraftCard: {
      props: z.object({
        platform: z.enum(["twitter", "linkedin"]).nullable().optional(),
        prospectId: z.string(),
        actionRequestId: z.string(),
        title: z.string(),
        message: z.string().nullable().optional(),
        status: z.string(),
        draftContent: z.string().nullable().optional(),
      }),
      description:
        "Displays an inline DM preview card for a staged X message draft with send/cancel/open actions.",
    },
  },
  actions: {},
});

export type AgentArtifactSpec = Spec;
export type AgentArtifactTask = z.infer<typeof agentArtifactTaskSchema>;
export type AgentArtifactProgressStep = z.infer<
  typeof agentArtifactProgressStepSchema
>;

export interface AgentArtifactEnvelope {
  kind: typeof AGENT_ARTIFACT_KIND;
  version: typeof AGENT_ARTIFACT_VERSION;
  spec: AgentArtifactSpec;
}

type AgentArtifactComponent = keyof typeof agentArtifactCatalog.data.components;
type AgentArtifactComponentProps<T extends AgentArtifactComponent> =
  InferComponentProps<typeof agentArtifactCatalog, T>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeTwitterPostRef(value: unknown) {
  return getTwitterPostRef(value) ?? null;
}

function normalizeTwitterPostSummary(value: unknown) {
  return summarizeTwitterPost(value) ?? null;
}

function buildSingleElementSpec<T extends AgentArtifactComponent>(
  type: T,
  props: AgentArtifactComponentProps<T>
): unknown {
  return {
    root: "artifact",
    elements: {
      artifact: {
        type,
        props,
        children: [],
      },
    },
  };
}

export function createAgentArtifact<T extends AgentArtifactComponent>(
  type: T,
  props: AgentArtifactComponentProps<T>
): AgentArtifactEnvelope | undefined {
  const result = agentArtifactCatalog.validate(
    buildSingleElementSpec(type, props)
  );
  if (!result.success || !result.data) {
    return undefined;
  }

  return {
    kind: AGENT_ARTIFACT_KIND,
    version: AGENT_ARTIFACT_VERSION,
    spec: result.data as Spec,
  };
}

export function validateAgentArtifactEnvelope(
  value: unknown
): AgentArtifactEnvelope | null {
  if (!isRecord(value)) return null;
  if (value.kind !== AGENT_ARTIFACT_KIND) return null;
  if (value.version !== AGENT_ARTIFACT_VERSION) return null;

  const validatedSpec = agentArtifactCatalog.validate(value.spec);
  if (!validatedSpec.success || !validatedSpec.data) return null;

  return {
    kind: AGENT_ARTIFACT_KIND,
    version: AGENT_ARTIFACT_VERSION,
    spec: validatedSpec.data as Spec,
  };
}

export function getAgentArtifactFromResult(
  value: unknown
): AgentArtifactEnvelope | null {
  if (!isRecord(value) || !("artifact" in value)) return null;
  return validateAgentArtifactEnvelope(value.artifact);
}

export function createOnboardingArtifact(workspaceId: string) {
  return createAgentArtifact("OnboardingCard", {
    workspaceId,
  });
}

export function createProgressStatusArtifact(input: {
  title?: string | null;
  message?: string | null;
  progress?: AgentArtifactProgressStep[];
  totalProspects?: number | null;
}) {
  return createAgentArtifact("ProgressStatusCard", {
    title: input.title ?? null,
    message: input.message ?? null,
    progress: input.progress ?? [],
    totalProspects: input.totalProspects ?? null,
  });
}

export function createPostArtifact(input: {
  platform: "twitter" | "linkedin";
  prospectId?: string;
  openKind?: "post" | "post_list";
  postData?: unknown;
  postRef?: unknown;
  postSummary?: unknown;
  context?: string;
  taskId?: string;
  taskStatus?: string;
  panelMode?: "approval" | "posted";
  targetTweetId?: string;
  interactive?: boolean;
}) {
  const postRef =
    input.platform === "twitter"
      ? normalizeTwitterPostRef(input.postRef)
      : null;
  const postSummary =
    input.platform === "twitter"
      ? normalizeTwitterPostSummary(input.postSummary)
      : null;

  return createAgentArtifact("PostArtifact", {
    platform: input.platform,
    prospectId: input.prospectId ?? null,
    openKind: input.openKind ?? "post",
    postData: input.postData ?? null,
    postRef,
    postSummary,
    context: input.context ?? null,
    taskId: input.taskId ?? null,
    taskStatus: input.taskStatus ?? null,
    panelMode: input.panelMode ?? null,
    targetTweetId: input.targetTweetId ?? null,
    interactive: input.interactive ?? true,
  });
}

export function createProfilePreviewArtifact(input: {
  variant: "prospect" | "twitter" | "linkedin";
  prospectId?: string;
  platform?: "twitter" | "linkedin";
  profileData: unknown;
  label?: string;
  context?: string;
  interactive?: boolean;
}) {
  return createAgentArtifact("ProfilePreviewCard", {
    variant: input.variant,
    prospectId: input.prospectId ?? null,
    platform: input.platform ?? null,
    profileData: input.profileData,
    label: input.label ?? null,
    context: input.context ?? null,
    interactive: input.interactive ?? true,
  });
}

export function createPostListArtifact(input: {
  platform: "twitter" | "linkedin";
  title: string;
  prospectId?: string;
  context?: string;
  posts: Array<{
    id: string;
    platform: "twitter" | "linkedin";
    textPreview: string;
    createdAt?: number;
    rawData?: unknown;
    ref?: unknown;
    summary?: unknown;
  }>;
  interactive?: boolean;
}) {
  return createAgentArtifact("PostListArtifact", {
    platform: input.platform,
    title: input.title,
    prospectId: input.prospectId ?? null,
    context: input.context ?? null,
    posts: input.posts.map((post) => ({
      id: post.id,
      platform: post.platform,
      textPreview: post.textPreview,
      createdAt: post.createdAt ?? null,
      postData: post.rawData ?? null,
      postRef:
        post.platform === "twitter" ? normalizeTwitterPostRef(post.ref) : null,
      postSummary:
        post.platform === "twitter"
          ? normalizeTwitterPostSummary(post.summary)
          : null,
    })),
    interactive: input.interactive ?? true,
  });
}

export function createPlanPreviewArtifact(input: {
  planId?: string;
  status: string;
  rationale: string;
  tasks: AgentArtifactTask[];
}) {
  return createAgentArtifact("PlanPreviewCard", {
    planId: input.planId ?? null,
    status: input.status,
    rationale: input.rationale,
    tasks: input.tasks,
  });
}

export function createMemoryArtifact(input: {
  memoryId: string;
  workspaceId?: string | null;
  prospectId?: string | null;
  title: string;
  category: string;
  source: string;
  confidence: number;
  impactScore: number;
}) {
  return createAgentArtifact("MemoryCard", {
    memoryId: input.memoryId,
    workspaceId: input.workspaceId ?? null,
    prospectId: input.prospectId ?? null,
    title: input.title,
    category: input.category,
    source: input.source,
    confidence: input.confidence,
    impactScore: input.impactScore,
  });
}

export function createTwitterActionArtifact(input: {
  platform?: "twitter" | "linkedin";
  actionKey: string;
  actionRequestId?: string;
  title: string;
  message?: string;
  status: string;
  approvalMode?: string;
  riskLevel?: string;
  targetTweetId?: string;
  sourcePostData?: unknown;
  sourcePostRef?: unknown;
  sourcePostSummary?: unknown;
  sourceContext?: string;
  draftContent?: string;
  createdTweetId?: string;
  interactive?: boolean;
}) {
  const platform =
    input.platform ??
    (input.actionKey.startsWith("linkedin_") ? "linkedin" : "twitter");
  return createAgentArtifact("TwitterActionCard", {
    platform,
    actionKey: input.actionKey,
    actionRequestId: input.actionRequestId ?? null,
    title: input.title,
    message: input.message ?? null,
    status: input.status,
    approvalMode: input.approvalMode ?? null,
    riskLevel: input.riskLevel ?? null,
    targetTweetId: input.targetTweetId ?? null,
    sourcePostData: input.sourcePostData ?? null,
    sourcePostRef:
      platform === "twitter"
        ? normalizeTwitterPostRef(input.sourcePostRef)
        : null,
    sourcePostSummary:
      platform === "twitter"
        ? normalizeTwitterPostSummary(input.sourcePostSummary)
        : null,
    sourceContext: input.sourceContext ?? null,
    draftContent: input.draftContent ?? null,
    createdTweetId: input.createdTweetId ?? null,
    interactive: input.interactive ?? true,
  });
}

export function createDmDraftArtifact(input: {
  platform?: "twitter" | "linkedin";
  prospectId: string;
  actionRequestId: string;
  title: string;
  message?: string;
  status: string;
  draftContent?: string;
}) {
  return createAgentArtifact("DmDraftCard", {
    platform: input.platform ?? "twitter",
    prospectId: input.prospectId,
    actionRequestId: input.actionRequestId,
    title: input.title,
    message: input.message ?? null,
    status: input.status,
    draftContent: input.draftContent ?? null,
  });
}
