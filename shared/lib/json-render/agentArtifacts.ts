import {
  defineCatalog,
  type InferComponentProps,
  type Spec,
} from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

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
        postData: z.any(),
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
  postData: unknown;
  context?: string;
  taskId?: string;
  taskStatus?: string;
  panelMode?: "approval" | "posted";
  targetTweetId?: string;
  interactive?: boolean;
}) {
  return createAgentArtifact("PostArtifact", {
    platform: input.platform,
    postData: input.postData,
    context: input.context ?? null,
    taskId: input.taskId ?? null,
    taskStatus: input.taskStatus ?? null,
    panelMode: input.panelMode ?? null,
    targetTweetId: input.targetTweetId ?? null,
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
