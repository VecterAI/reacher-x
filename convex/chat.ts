// convex/chat.ts
// Chat functions using @convex-dev/agent with streaming support
// Docs: https://docs.convex.dev/agents/streaming

import { v } from "convex/values";
import { getFunctionAddress, paginationOptsValidator } from "convex/server";
import type { LanguageModel, ModelMessage } from "ai";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./lib/functionBuilders";
import { internal } from "./_generated/api";
import { components } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import {
  createThread,
  listMessages,
  vStreamArgs,
  syncStreams,
  saveMessage,
  toUIMessages,
  type ThreadDoc,
  type UIMessage,
  type StreamArgs,
} from "@convex-dev/agent";
import {
  mainAgent,
  setupAgent,
  workspaceLanguageModel,
  workspaceVisionLanguageModel,
} from "./agents";
import {
  createOutreachThreadLanguageModel,
  outreachAgent,
  outreachAgentBaseTools,
  outreachVisionLanguageModel,
} from "./agents/outreach";
import {
  buildMainAgentPrompt,
  buildOutreachAgentPrompt,
  buildSetupAgentPrompt,
} from "./agents/prompts";
import {
  getDefaultWorkspaceForUser,
  getOwnedProspect,
  getUserByIdentity,
  requireOwnedProspect,
  requireOwnedWorkspace,
  requireProspectNotArchived,
  requireUser,
} from "./lib/accessHelpers";
import { createNotification } from "./lib/outreachCore";
import {
  normalizeUnknownError,
  stringifyUnknownError,
} from "./lib/errorHelpers";
import { persistRawModelResponse } from "./lib/modelTelemetry";
import { getProspectDisplayFields } from "./lib/notificationHelpers";
import {
  createPlanBatchAgentContinuationContextHandler,
  type PlanBatchAgentResult,
} from "./lib/planBatchAgentContinuation";
import { getDeferredAgentExecution } from "./lib/deferredAgentTurn";
import { loadAgentProspectProfileContext } from "./lib/prospectProfileContextHelpers";
import { getProspectDisplayLabel } from "./lib/prospectIdentityCore";
import { getWideEventLogger } from "./lib/wideEventLogger";
import { recordWorkspaceActivityWithDb } from "./lib/workspaceActivity";
import {
  ensureProspectThreadLink,
  getLatestActiveProspectThreadLink,
  getProspectThreadContextByThreadId,
  getProspectThreadLinkByThreadId,
  listProspectThreadLinksByThreadId,
  listProspectThreadLinksByProspect,
} from "./lib/relationshipHelpers";
import {
  getSetupThreadTitle,
  parseSetupThreadState,
} from "./lib/setupThreadHelpers";
import { dedupeThreadHistoryLinksByThreadId } from "./lib/threadHistoryHelpers";
import {
  ensureWorkspaceThreadLink,
  getLatestActiveWorkspaceThreadLink,
  getWorkspaceThreadContextByThreadId,
  listWorkspaceThreadIdsByWorkspace,
  listWorkspaceThreadLinksByThreadId,
} from "./lib/workspaceThreadHelpers";
import {
  agentMessageContextMetadataValidator,
  urgencyLevelValidator,
  xChatTransientContextValidator,
} from "./validators";
import {
  getWorkspaceUseCase,
  type WorkspaceUseCaseDefinition,
} from "../shared/lib/workspaceUseCases";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { logger } from "../shared/lib/logger";
import {
  normalizeAgentMessageContextMetadata,
  type AgentMessageContextMetadata,
} from "../shared/lib/mentions/messageContext";
import { upsertAgentThreadTargetSelection } from "./lib/agentThreadTargetSelectionHelpers";
import {
  inferAttachmentMediaKind,
  isVisionAttachmentMediaKind,
} from "../shared/lib/utils/media/inferAttachmentMediaKind";
import {
  OUTREACH_MIN_MESSAGES_FOR_HISTORY_SEARCH,
  OUTREACH_RECENT_MESSAGE_LIMIT,
} from "./lib/agentContextHelpers";
import { buildPlanBatchReferenceCatalogContext } from "./lib/planBatchCore";
import { buildAgentAttachmentReferenceContext } from "./lib/agentAttachmentReferenceCore";
import { OUTREACH_AGENT_MODEL, PINNED_AGENT_MODEL } from "./lib/ai";
import { getPostedOutreachArtifactId } from "./lib/outreachResultCore";
import {
  buildTransientXChatAgentContext,
  type XChatTransientContext,
} from "./lib/xChatAgentContextCore";

type ViewerCtx = QueryCtx | MutationCtx;
type ReadableCtx = QueryCtx | MutationCtx | ActionCtx;
type OutreachAgentTools = typeof outreachAgentBaseTools;
const chatLogger = logger.withScope("Chat");
type WorkspaceAgentSurface = "main" | "setup";
type AgentTurnContextMessage = ModelMessage;
type ResolvedAgentTurnContext = {
  messages: AgentTurnContextMessage[];
  hasVisionInput: boolean;
};
type OutreachStreamStepTiming = {
  duration_ms?: number;
  finish_reason?: string;
  first_chunk_ms?: number;
  model: string;
  provider: string;
  started_at: number;
  step_number: number;
};
type OutreachStreamAttemptTiming = {
  agent_call_started_at: number;
  attempt_number: number;
  context_and_rag_ms?: number;
  first_delta_ready_ms?: number;
  first_saved_delta_ms?: number;
  first_text_delta_ready_ms?: number;
  steps: OutreachStreamStepTiming[];
  tool_calls: Array<{
    duration_ms: number;
    step_number?: number;
    success: boolean;
    tool_name: string;
  }>;
};
type OutreachStreamTiming = {
  attempts: OutreachStreamAttemptTiming[];
};
function summarizeOutreachStreamTiming(timing: OutreachStreamTiming) {
  return timing.attempts.map((attempt) => ({
    attempt_number: attempt.attempt_number,
    context_and_rag_ms: attempt.context_and_rag_ms,
    first_delta_ready_ms: attempt.first_delta_ready_ms,
    first_saved_delta_ms: attempt.first_saved_delta_ms,
    first_text_delta_ready_ms: attempt.first_text_delta_ready_ms,
    steps: attempt.steps.map(({ started_at: _startedAt, ...step }) => step),
    tool_calls: attempt.tool_calls,
  }));
}
type AttachmentReferenceInput = {
  uploadId: string | null;
  fileName: string;
  mediaUrl: string | null;
};
type ResolvedAttachmentReference = AttachmentReferenceInput & {
  mimeType: string | null;
};
type ThreadRouteContextResult =
  | { kind: "missing" }
  | {
      kind: "prospect";
      prospectId: Id<"prospects">;
      workspaceId: Id<"workspaces">;
    }
  | {
      kind: "workspace";
      workspaceId: Id<"workspaces">;
    }
  | { kind: "setup_draft" }
  | { kind: "unknown" };
type ThreadSelectedContextResult = {
  threadId: string;
  routeKind: "prospect" | "workspace" | "setup" | "unknown";
  workspaceId: Id<"workspaces"> | null;
  prospectId: Id<"prospects"> | null;
  planId: Id<"outreachPlans"> | null;
  taskId: Id<"outreachTasks"> | null;
  postId: string | null;
  postPlatform: "twitter" | "linkedin" | null;
  postUrl: string | null;
  source: "thread" | "tagged" | "none";
  ambiguousProspectIds: string[];
};

async function getViewerUser(ctx: ViewerCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  return getUserByIdentity(ctx, identity);
}

async function requireViewerUser(ctx: ViewerCtx) {
  return requireUser(ctx, { notFoundMessage: "User not found" });
}

async function resolveSetupUseCaseForThread(
  ctx: ReadableCtx,
  threadId: string
): Promise<WorkspaceUseCaseDefinition> {
  const setupSession = await ctx.runQuery(
    internal.setupSessions.getByThreadIdInternal,
    {
      threadId,
    }
  );
  if (setupSession) {
    return getWorkspaceUseCase(setupSession.useCaseKey);
  }

  const thread = await ctx.runQuery(components.agent.threads.getThread, {
    threadId,
  });

  const parsedState = parseSetupThreadState(thread?.title);
  if (!parsedState || parsedState.kind === "draft") {
    return getWorkspaceUseCase(parsedState?.useCaseKey ?? undefined);
  }

  const workspace = await ctx.runQuery(internal.workspaces.getById, {
    workspaceId: parsedState.workspaceId as Id<"workspaces">,
  });

  return getWorkspaceUseCase(workspace?.useCaseKey);
}

async function resolveOutreachUseCaseForThread(
  ctx: ReadableCtx,
  threadId: string,
  prospect?: Pick<Doc<"prospects">, "workspaceId"> | null
): Promise<WorkspaceUseCaseDefinition> {
  const workspaceId = prospect
    ? prospect.workspaceId
    : (
        await ctx.runQuery(internal.prospectThreads.getThreadProspectContext, {
          threadId,
        })
      )?.prospect.workspaceId;

  if (!workspaceId) {
    return getWorkspaceUseCase(undefined);
  }

  const workspace = await ctx.runQuery(internal.workspaces.getById, {
    workspaceId,
  });

  return getWorkspaceUseCase(workspace?.useCaseKey);
}

async function getOutreachToolsForThread(
  ctx: ActionCtx,
  threadId: string
): Promise<OutreachAgentTools> {
  void ctx;
  void threadId;
  return outreachAgentBaseTools;
}

async function getWorkspaceIdForSetupThread(
  ctx: ReadableCtx,
  threadId: string
): Promise<Id<"workspaces"> | null> {
  const workspaceThreadContext = await ctx.runQuery(
    internal.workspaceThreads.getThreadWorkspaceContext,
    {
      threadId,
    }
  );
  if (workspaceThreadContext) {
    return workspaceThreadContext.workspaceId;
  }

  const setupSession = await ctx.runQuery(
    internal.setupSessions.getByThreadIdInternal,
    {
      threadId,
    }
  );

  if (setupSession?.targetWorkspaceId) {
    return setupSession.targetWorkspaceId;
  }

  const thread = await ctx.runQuery(components.agent.threads.getThread, {
    threadId,
  });
  const parsedState = parseSetupThreadState(thread?.title);
  if (parsedState?.kind === "workspace") {
    return parsedState.workspaceId as Id<"workspaces">;
  }

  return null;
}

async function resolveWorkspaceAgentSurface(
  ctx: ReadableCtx,
  threadId: string
): Promise<WorkspaceAgentSurface> {
  const selectedContext = await ctx.runQuery(
    internal.agentThreadContext.resolveSelectedContextForThread,
    {
      threadId,
    }
  );

  return selectedContext?.routeKind === "workspace" ? "main" : "setup";
}

async function getThreadMessageById(ctx: ActionCtx, messageId: string) {
  const [message] = await ctx.runQuery(
    components.agent.messages.getMessagesByIds,
    {
      messageIds: [messageId],
    }
  );
  return message;
}

async function getAgentMessageContextMetadataById(
  ctx: ActionCtx,
  messageId: string
): Promise<AgentMessageContextMetadata | null> {
  const context = await ctx.runQuery(
    internal.chat.getAgentMessageContextInternal,
    {
      messageId,
    }
  );
  if (!context) {
    return null;
  }

  return normalizeAgentMessageContextMetadata({
    version: 1,
    promptTextSource: context.promptTextSource,
    taggedEntities: context.taggedEntities,
    attachments: context.attachments,
  });
}

type AgentThreadScopeContext =
  | {
      kind: "prospect";
      workspaceId: Id<"workspaces">;
      prospectId: Id<"prospects">;
      userId: Id<"users">;
    }
  | {
      kind: "workspace" | "setup";
      workspaceId: Id<"workspaces">;
      prospectId: null;
      userId: Id<"users">;
    }
  | {
      kind: "unknown";
      workspaceId: null;
      prospectId: null;
      userId: null;
    };

async function resolveAgentThreadScopeContext(
  ctx: ReadableCtx,
  threadId: string
): Promise<AgentThreadScopeContext> {
  const prospectThreadContext = await ctx.runQuery(
    internal.prospectThreads.getThreadProspectContext,
    {
      threadId,
    }
  );
  if (prospectThreadContext) {
    return {
      kind: "prospect",
      workspaceId: prospectThreadContext.workspaceId,
      prospectId: prospectThreadContext.prospectId,
      userId: prospectThreadContext.userId,
    };
  }

  const workspaceThreadContext = await ctx.runQuery(
    internal.workspaceThreads.getThreadWorkspaceContext,
    {
      threadId,
    }
  );
  if (workspaceThreadContext?.workspaceId) {
    return {
      kind: "workspace",
      workspaceId: workspaceThreadContext.workspaceId,
      prospectId: null,
      userId: workspaceThreadContext.userId,
    };
  }

  const setupWorkspaceId = await getWorkspaceIdForSetupThread(ctx, threadId);
  if (setupWorkspaceId) {
    const workspace = await ctx.runQuery(internal.workspaces.getById, {
      workspaceId: setupWorkspaceId,
    });
    if (!workspace) {
      return {
        kind: "unknown",
        workspaceId: null,
        prospectId: null,
        userId: null,
      };
    }
    return {
      kind: "setup",
      workspaceId: setupWorkspaceId,
      prospectId: null,
      userId: workspace.userId,
    };
  }

  return {
    kind: "unknown",
    workspaceId: null,
    prospectId: null,
    userId: null,
  };
}

async function persistAgentMessageContext(
  ctx: MutationCtx,
  args: {
    threadId: string;
    messageId: string;
    userId: Id<"users">;
    metadata: AgentMessageContextMetadata | null;
  }
) {
  const scope = await resolveAgentThreadScopeContext(ctx, args.threadId);
  const metadata = args.metadata ?? {
    version: 1 as const,
    promptTextSource: "user" as const,
    taggedEntities: [],
    attachments: [],
  };
  const createdAt = getCurrentUTCTimestamp();
  await ctx.db.insert("agentMessageContexts", {
    threadId: args.threadId,
    messageId: args.messageId,
    userId: args.userId,
    workspaceId: scope.workspaceId ?? undefined,
    prospectId: scope.prospectId ?? undefined,
    promptTextSource: metadata.promptTextSource,
    taggedEntities: metadata.taggedEntities,
    attachments: metadata.attachments,
    createdAt,
  });
  if (scope.workspaceId && metadata.taggedEntities.length > 0) {
    await upsertAgentThreadTargetSelection(ctx, {
      threadId: args.threadId,
      userId: args.userId,
      workspaceId: scope.workspaceId,
      sourceMessageId: args.messageId,
      sourceContextCreatedAt: createdAt,
      taggedEntities: metadata.taggedEntities,
    });
  }
}

export const persistAgentMessageContextInternal = internalMutation({
  args: {
    threadId: v.string(),
    messageId: v.string(),
    userId: v.id("users"),
    metadata: v.optional(agentMessageContextMetadataValidator),
  },
  handler: async (ctx, args) => {
    await persistAgentMessageContext(ctx, {
      threadId: args.threadId,
      messageId: args.messageId,
      userId: args.userId,
      metadata: normalizeAgentMessageContextMetadata(args.metadata),
    });
  },
});

function buildResolvedAttachmentLine(args: {
  fileName: string;
  mediaUrl: string | null;
  mimeType?: string | null;
}) {
  const mediaKind = inferAttachmentMediaKind({
    mimeType: args.mimeType,
    url: args.mediaUrl ?? args.fileName,
  });
  return `Attachment selected in the current message: ${args.fileName}${
    mediaKind ? ` (type: ${mediaKind})` : ""
  }. The application resolves its URL server-side; never include a storage URL in tool input.`;
}

async function resolveAttachmentReference(
  ctx: ActionCtx,
  scope: AgentThreadScopeContext,
  attachment: AttachmentReferenceInput
): Promise<ResolvedAttachmentReference | null> {
  if (attachment.uploadId) {
    const upload = await ctx.runQuery(internal.chat.getMediaUploadInternal, {
      uploadId: attachment.uploadId as Id<"mediaUploads">,
    });
    if (upload) {
      if (
        !scope.userId ||
        upload.userId !== scope.userId ||
        !scope.workspaceId ||
        upload.workspaceId !== scope.workspaceId
      ) {
        return null;
      }

      return {
        uploadId: String(upload._id),
        fileName: upload.displayName ?? upload.fileName,
        mediaUrl:
          (await ctx.storage.getUrl(upload.storageId)) ?? attachment.mediaUrl,
        mimeType: upload.mimeType ?? null,
      };
    }
  }

  if (!attachment.mediaUrl || scope.workspaceId) {
    return null;
  }

  return {
    uploadId: attachment.uploadId,
    fileName: attachment.fileName,
    mediaUrl: attachment.mediaUrl,
    mimeType: null,
  };
}

async function buildResolvedTaggedEntityLine(
  ctx: ActionCtx,
  scope: AgentThreadScopeContext,
  entity: AgentMessageContextMetadata["taggedEntities"][number]
): Promise<string | null> {
  switch (entity.kind) {
    case "prospect": {
      const prospectId = entity.prospectId ?? entity.entityId;
      if (!prospectId) {
        return null;
      }

      const prospect = await ctx.runQuery(
        internal.prospects.getProspectInternal,
        {
          prospectId: prospectId as Id<"prospects">,
        }
      );
      if (!prospect) {
        return null;
      }
      if (scope.workspaceId && prospect.workspaceId !== scope.workspaceId) {
        return null;
      }
      if (scope.prospectId && prospect._id !== scope.prospectId) {
        return null;
      }

      const label = getProspectDisplayLabel(
        prospect,
        prospect.title ?? "this prospect"
      );

      if (scope.prospectId === prospect._id) {
        return `Prospect selected in the UI: ${label}. The canonical thread context supplies the complete profile snapshot.`;
      }

      const profileContext = await loadAgentProspectProfileContext(
        ctx,
        prospect
      );

      return `Prospect selected in the UI: ${label}\n${profileContext}`;
    }
    case "plan": {
      const planId = entity.planId ?? entity.entityId;
      if (!planId) {
        return null;
      }

      const planData = await ctx.runQuery(internal.outreach.getPlanInternal, {
        planId: planId as Id<"outreachPlans">,
      });
      const plan = planData?.plan ?? null;
      if (!plan) {
        return null;
      }
      if (scope.workspaceId && plan.workspaceId !== scope.workspaceId) {
        return null;
      }
      if (scope.prospectId && plan.prospectId !== scope.prospectId) {
        return null;
      }

      const prospect = await ctx.runQuery(
        internal.prospects.getProspectInternal,
        {
          prospectId: plan.prospectId,
        }
      );
      const { prospectDisplayName } = getProspectDisplayFields(prospect);
      const prospectLabel =
        prospectDisplayName ??
        prospect?.displayName ??
        prospect?.title ??
        entity.label;

      return `Plan: Plan for ${prospectLabel} (planId: ${String(plan._id)}; prospectId: ${String(plan.prospectId)}; workspaceId: ${String(plan.workspaceId)}; status: ${plan.status})`;
    }
    case "task": {
      const taskId = entity.taskId ?? entity.entityId;
      if (!taskId) {
        return null;
      }

      const task = await ctx.runQuery(internal.outreach.getTaskInternal, {
        taskId: taskId as Id<"outreachTasks">,
      });
      if (!task) {
        return null;
      }
      const planData = await ctx.runQuery(internal.outreach.getPlanInternal, {
        planId: task.planId,
      });
      const plan = planData?.plan ?? null;
      if (!plan) {
        return null;
      }
      if (scope.workspaceId && plan.workspaceId !== scope.workspaceId) {
        return null;
      }
      if (scope.prospectId && plan.prospectId !== scope.prospectId) {
        return null;
      }

      const prospect = await ctx.runQuery(
        internal.prospects.getProspectInternal,
        {
          prospectId: plan.prospectId,
        }
      );
      const { prospectDisplayName } = getProspectDisplayFields(prospect);
      const prospectLabel =
        prospectDisplayName ??
        prospect?.displayName ??
        prospect?.title ??
        entity.label;
      const summary = task.content?.trim() || task.description.trim();

      return `Task: Task ${task.order} for ${prospectLabel} (taskId: ${String(task._id)}; planId: ${String(plan._id)}; prospectId: ${String(plan.prospectId)}; status: ${task.status}; type: ${task.type}; summary: ${summary})`;
    }
    case "attachment": {
      if (scope.kind === "prospect") {
        return null;
      }
      const resolvedAttachment = await resolveAttachmentReference(ctx, scope, {
        uploadId: entity.entityId ?? null,
        fileName: entity.label,
        mediaUrl: entity.attachmentUrl ?? null,
      });
      if (!resolvedAttachment) {
        return null;
      }

      return buildResolvedAttachmentLine({
        fileName: resolvedAttachment.fileName,
        mediaUrl: resolvedAttachment.mediaUrl,
        mimeType: resolvedAttachment.mimeType,
      });
    }
    case "post": {
      if (
        scope.workspaceId &&
        entity.workspaceId &&
        entity.workspaceId !== String(scope.workspaceId)
      ) {
        return null;
      }
      if (
        scope.prospectId &&
        entity.prospectId &&
        entity.prospectId !== String(scope.prospectId)
      ) {
        return null;
      }

      if (entity.referenceText?.trim()) {
        return entity.referenceText.trim();
      }

      if (!entity.postId && !entity.entityId) {
        return null;
      }

      return `Post: ${entity.label} (${[
        entity.postPlatform ? `platform: ${entity.postPlatform}` : null,
        `postId: ${entity.postId ?? entity.entityId}`,
        entity.postUrl ? `url: ${entity.postUrl}` : null,
        entity.prospectId ? `prospectId: ${entity.prospectId}` : null,
      ]
        .filter(Boolean)
        .join("; ")})`;
    }
    default:
      return null;
  }
}

async function buildResolvedAttachmentReferenceLine(
  ctx: ActionCtx,
  scope: AgentThreadScopeContext,
  attachment: AgentMessageContextMetadata["attachments"][number]
): Promise<string | null> {
  const resolvedAttachment = await resolveAttachmentReference(ctx, scope, {
    uploadId: attachment.uploadId,
    fileName: attachment.fileName,
    mediaUrl: attachment.mediaUrl,
  });
  if (!resolvedAttachment) {
    return null;
  }

  return buildResolvedAttachmentLine({
    fileName: resolvedAttachment.fileName,
    mediaUrl: resolvedAttachment.mediaUrl,
    mimeType: resolvedAttachment.mimeType,
  });
}

async function buildVisionAttachmentMessage(
  ctx: ActionCtx,
  scope: AgentThreadScopeContext,
  metadata: AgentMessageContextMetadata
): Promise<AgentTurnContextMessage | null> {
  const attachmentCandidates: AttachmentReferenceInput[] = [
    ...metadata.attachments.map((attachment) => ({
      uploadId: attachment.uploadId,
      fileName: attachment.fileName,
      mediaUrl: attachment.mediaUrl,
    })),
    ...metadata.taggedEntities.flatMap((entity) =>
      entity.kind === "attachment"
        ? [
            {
              uploadId: entity.entityId ?? null,
              fileName: entity.label,
              mediaUrl: entity.attachmentUrl ?? null,
            },
          ]
        : []
    ),
  ];

  const seenKeys = new Set<string>();
  const dedupedCandidates = attachmentCandidates.filter((attachment) => {
    const dedupeKey = [
      attachment.uploadId ?? "",
      attachment.mediaUrl ?? "",
      attachment.fileName,
    ].join("::");
    if (seenKeys.has(dedupeKey)) {
      return false;
    }
    seenKeys.add(dedupeKey);
    return true;
  });

  const resolvedAttachments = (
    await Promise.all(
      dedupedCandidates.map((attachment) =>
        resolveAttachmentReference(ctx, scope, attachment)
      )
    )
  ).filter(
    (
      attachment
    ): attachment is NonNullable<
      Awaited<ReturnType<typeof resolveAttachmentReference>>
    > => Boolean(attachment)
  );

  const imageParts = resolvedAttachments
    .map((attachment) => {
      const mediaKind = inferAttachmentMediaKind({
        mimeType: attachment.mimeType,
        url: attachment.mediaUrl ?? attachment.fileName,
      });
      if (!attachment.mediaUrl || !isVisionAttachmentMediaKind(mediaKind)) {
        return null;
      }

      return {
        type: "image" as const,
        image: new URL(attachment.mediaUrl),
        ...(attachment.mimeType ? { mediaType: attachment.mimeType } : {}),
      };
    })
    .filter(
      (
        part
      ): part is {
        type: "image";
        image: URL;
        mediaType?: string;
      } => Boolean(part)
    );

  if (imageParts.length === 0) {
    return null;
  }

  return {
    role: "user",
    content: [
      {
        type: "text",
        text: "The operator attached image files for this request. Inspect them directly and use them as first-class context for your response.",
      },
      ...imageParts,
    ],
  };
}

async function buildAgentTurnContextMessages(
  ctx: ActionCtx,
  args: {
    threadId: string;
    promptMessageId: string;
  }
): Promise<ResolvedAgentTurnContext> {
  const [metadata, scope] = await Promise.all([
    getAgentMessageContextMetadataById(ctx, args.promptMessageId),
    resolveAgentThreadScopeContext(ctx, args.threadId),
  ]);
  const effectiveMetadata = metadata ?? {
    version: 1 as const,
    promptTextSource: "user" as const,
    taggedEntities: [],
    attachments: [],
  };
  const taggedEntityLines = (
    await Promise.all(
      effectiveMetadata.taggedEntities.map((entity) =>
        buildResolvedTaggedEntityLine(ctx, scope, entity)
      )
    )
  ).filter((line): line is string => Boolean(line));
  const attachmentReferences =
    (scope.kind === "prospect" || scope.kind === "workspace") && scope.userId
      ? await ctx.runQuery(
          internal.agentAttachments.listAvailableForAgentTool,
          {
            threadId: args.threadId,
            messageId: args.promptMessageId,
            userId: scope.userId,
          }
        )
      : [];
  const attachmentReferenceContext =
    buildAgentAttachmentReferenceContext(attachmentReferences);
  const attachmentLines =
    scope.kind === "prospect"
      ? []
      : (
          await Promise.all(
            effectiveMetadata.attachments.map((attachment) =>
              buildResolvedAttachmentReferenceLine(ctx, scope, attachment)
            )
          )
        ).filter((line): line is string => Boolean(line));
  const visionAttachmentMessage = await buildVisionAttachmentMessage(
    ctx,
    scope,
    effectiveMetadata
  );
  const messages: AgentTurnContextMessage[] = [];
  const planReferenceContext =
    scope.kind === "workspace"
      ? buildPlanBatchReferenceCatalogContext(
          await ctx.runQuery(
            internal.planBatches.listPlanBatchReferencesForThreadInternal,
            {
              sourceThreadId: args.threadId,
              workspaceId: scope.workspaceId,
              userId: scope.userId,
            }
          )
        )
      : null;

  if (planReferenceContext) {
    messages.push({
      role: "system",
      content: planReferenceContext,
    });
  }

  if (attachmentReferenceContext) {
    messages.push({
      role: "system",
      content: attachmentReferenceContext,
    });
  }

  if (taggedEntityLines.length > 0 || attachmentLines.length > 0) {
    const sections: string[] = [
      "These references were explicitly selected in the UI for the current request.",
      "Treat them as deliberate context even when the visible user message is short or does not repeat the details.",
    ];

    if (taggedEntityLines.length > 0) {
      sections.push(
        "",
        "Tagged entities:",
        ...taggedEntityLines.map((line) => `- ${line}`)
      );
    }

    if (attachmentLines.length > 0) {
      sections.push(
        "",
        "Attached media:",
        ...attachmentLines.map((line) => `- ${line}`)
      );
    }

    messages.push({
      role: "system",
      content: sections.join("\n"),
    });
  }

  if (visionAttachmentMessage) {
    messages.push(visionAttachmentMessage);
  }

  return {
    messages,
    hasVisionInput: visionAttachmentMessage !== null,
  };
}

async function listLegacyWorkspaceThreadsByTitle(
  ctx: ReadableCtx,
  args: {
    userId: Id<"users">;
    workspaceId: Id<"workspaces">;
    limit?: number;
  }
): Promise<ThreadDoc[]> {
  const targetTitle = getSetupThreadTitle(String(args.workspaceId));
  const limit = Math.max(1, args.limit ?? 50);
  const matches: ThreadDoc[] = [];
  let cursor: string | null = null;

  while (matches.length < limit) {
    const page: {
      page: ThreadDoc[];
      continueCursor: string;
      isDone: boolean;
    } = await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
      userId: args.userId,
      paginationOpts: {
        cursor,
        numItems: 100,
      },
    });

    matches.push(
      ...page.page
        .filter((thread) => thread.title === targetTitle)
        .slice(0, limit)
    );

    if (page.isDone) {
      break;
    }

    cursor = page.continueCursor;
  }

  return matches.slice(0, limit);
}

const USER_STOPPED_ERROR_MESSAGE = "Generation stopped.";
const USER_STOPPED_VISIBLE_MESSAGE = "Generation stopped.";
const TIMED_OUT_ERROR_MESSAGE =
  "That response took too long and stopped before it finished.";
const TIMED_OUT_VISIBLE_MESSAGE =
  "That response took too long and stopped before it finished. Please try again.";
const GENERATION_FAILED_VISIBLE_MESSAGE =
  "That response stopped because of an unexpected error. Please try again.";
const DEFAULT_AGENT_STREAM_DELTAS = {
  chunking: "word" as const,
  throttleMs: 100,
};
const RETRYABLE_AGENT_TURN_MESSAGE_WINDOW = 50;
const ORPHANED_PENDING_ASSISTANT_WINDOW_MS = 15_000;

async function listPendingAssistantMessages(ctx: ViewerCtx, threadId: string) {
  const pendingMessages = await ctx.runQuery(
    components.agent.messages.listMessagesByThreadId,
    {
      threadId,
      order: "desc",
      statuses: ["pending"],
      paginationOpts: { numItems: 20, cursor: null },
    }
  );

  return pendingMessages.page.filter(
    (message) => message.message?.role === "assistant"
  );
}

async function getOutreachHistorySignals(
  ctx: ActionCtx,
  args: {
    threadId: string;
    excludeMessageId?: string;
  }
) {
  const messages = await ctx.runQuery(
    components.agent.messages.listMessagesByThreadId,
    {
      threadId: args.threadId,
      order: "desc",
      paginationOpts: { numItems: 25, cursor: null },
    }
  );

  let searchableMessageCount = 0;
  for (const message of messages.page) {
    if (args.excludeMessageId && message._id === args.excludeMessageId) {
      continue;
    }
    const role = message.message?.role;
    if (role !== "user" && role !== "assistant") {
      continue;
    }
    const text = typeof message.text === "string" ? message.text.trim() : "";
    if (text.length === 0) {
      continue;
    }
    searchableMessageCount += 1;
  }

  return {
    hasSearchableHistory:
      searchableMessageCount >= OUTREACH_MIN_MESSAGES_FOR_HISTORY_SEARCH,
  };
}

function buildDisabledHistorySearchContextOptions() {
  return {
    recentMessages: OUTREACH_RECENT_MESSAGE_LIMIT,
    searchOptions: {
      limit: 0,
      textSearch: false,
      vectorSearch: false,
    },
  };
}

function isEmptyEmbeddingInputError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("Input is empty");
}

async function canRetryAgentTurnWithoutDuplicatingTools(
  ctx: ActionCtx,
  args: {
    threadId: string;
    promptMessageId?: string;
  }
) {
  if (!args.promptMessageId) {
    return false;
  }

  const promptMessage = await getThreadMessageById(ctx, args.promptMessageId);
  if (!promptMessage) {
    return false;
  }

  const threadMessages = await ctx.runQuery(
    components.agent.messages.listMessagesByThreadId,
    {
      threadId: args.threadId,
      order: "desc",
      paginationOpts: {
        numItems: RETRYABLE_AGENT_TURN_MESSAGE_WINDOW,
        cursor: null,
      },
    }
  );

  return !threadMessages.page.some((message) => {
    if (message.order !== promptMessage.order) {
      return false;
    }

    return (
      message._id !== promptMessage._id && message.message?.role === "tool"
    );
  });
}

async function runOutreachStreamText(
  ctx: ActionCtx,
  args: {
    threadId: string;
    promptMessageId?: string;
    system: string;
    tools: OutreachAgentTools;
    messages?: AgentTurnContextMessage[];
    model?: LanguageModel;
    timing?: OutreachStreamAttemptTiming;
    contextOptions?: ReturnType<
      typeof buildDisabledHistorySearchContextOptions
    >;
  }
) {
  const timing = args.timing;
  const addDeltaAddress = getFunctionAddress(components.agent.streams.addDelta);
  const instrumentedRunMutation: ActionCtx["runMutation"] = async (
    reference,
    mutationArgs
  ) => {
    const result = await ctx.runMutation(reference, mutationArgs);
    if (
      timing &&
      timing.first_saved_delta_ms === undefined &&
      result === true
    ) {
      const address = getFunctionAddress(reference);
      if (address.reference === addDeltaAddress.reference) {
        timing.first_saved_delta_ms =
          getCurrentUTCTimestamp() - timing.agent_call_started_at;
      }
    }
    return result;
  };
  const streamCtx: ActionCtx = timing
    ? { ...ctx, runMutation: instrumentedRunMutation }
    : ctx;

  return outreachAgent.streamText(
    streamCtx,
    { threadId: args.threadId },
    {
      ...(args.promptMessageId
        ? { promptMessageId: args.promptMessageId }
        : {}),
      ...(args.messages?.length ? { messages: args.messages } : {}),
      ...(args.model ? { model: args.model } : {}),
      // ContextHandler intentionally supplies app-owned system context blocks.
      // Opt in explicitly so AI SDK does not warn on every outreach turn.
      allowSystemInMessages: true,
      system: args.system,
      tools: args.tools,
      experimental_onStart: ({ model }) => {
        if (!args.timing) return;
        args.timing.context_and_rag_ms =
          getCurrentUTCTimestamp() - args.timing.agent_call_started_at;
        const firstStep = args.timing.steps[0];
        if (firstStep) {
          firstStep.model = model.modelId;
          firstStep.provider = model.provider;
        }
      },
      experimental_onStepStart: ({ stepNumber, model }) => {
        if (!args.timing) return;
        args.timing.steps.push({
          step_number: stepNumber,
          model: model.modelId,
          provider: model.provider,
          started_at: getCurrentUTCTimestamp(),
        });
      },
      onChunk: ({ chunk }) => {
        if (!args.timing) return;
        const now = getCurrentUTCTimestamp();
        args.timing.first_delta_ready_ms ??=
          now - args.timing.agent_call_started_at;
        if (chunk.type === "text-delta") {
          args.timing.first_text_delta_ready_ms ??=
            now - args.timing.agent_call_started_at;
        }
        const currentStep = args.timing.steps[args.timing.steps.length - 1];
        if (currentStep && currentStep.first_chunk_ms === undefined) {
          currentStep.first_chunk_ms = now - currentStep.started_at;
        }
      },
      onStepFinish: ({ finishReason }) => {
        if (!args.timing) return;
        const currentStep = args.timing.steps[args.timing.steps.length - 1];
        if (!currentStep) return;
        currentStep.duration_ms =
          getCurrentUTCTimestamp() - currentStep.started_at;
        currentStep.finish_reason = finishReason;
      },
      experimental_onToolCallFinish: ({
        durationMs,
        stepNumber,
        success,
        toolCall,
      }) => {
        args.timing?.tool_calls.push({
          duration_ms: durationMs,
          ...(stepNumber === undefined ? {} : { step_number: stepNumber }),
          success,
          tool_name: toolCall.toolName,
        });
      },
    },
    {
      contextOptions: args.contextOptions,
      saveStreamDeltas: DEFAULT_AGENT_STREAM_DELTAS,
    }
  );
}

async function runOutreachStreamTextWithHistoryFallback(
  ctx: ActionCtx,
  args: {
    threadId: string;
    promptMessageId?: string;
    system: string;
    tools: OutreachAgentTools;
    messages?: AgentTurnContextMessage[];
    model?: LanguageModel;
    preferHistorySearch?: boolean;
    timing?: OutreachStreamAttemptTiming;
  }
) {
  const initialContextOptions = args.preferHistorySearch
    ? undefined
    : buildDisabledHistorySearchContextOptions();

  try {
    return await runOutreachStreamText(ctx, {
      ...args,
      contextOptions: initialContextOptions,
    });
  } catch (error) {
    if (
      initialContextOptions !== undefined ||
      !isEmptyEmbeddingInputError(error)
    ) {
      throw error;
    }

    chatLogger.warn(
      "Empty embedding batch; retrying outreach stream with history search disabled",
      { threadId: args.threadId }
    );

    return runOutreachStreamText(ctx, {
      ...args,
      contextOptions: buildDisabledHistorySearchContextOptions(),
    });
  }
}

async function runSetupStreamText(
  ctx: ActionCtx,
  args: {
    threadId: string;
    promptMessageId?: string;
    prompt?: string;
    system: string;
    messages?: AgentTurnContextMessage[];
    model?: LanguageModel;
  }
) {
  return setupAgent.streamText(
    ctx,
    { threadId: args.threadId },
    {
      ...(args.promptMessageId
        ? { promptMessageId: args.promptMessageId }
        : {}),
      ...(args.prompt ? { prompt: args.prompt } : {}),
      ...(args.messages?.length ? { messages: args.messages } : {}),
      ...(args.model ? { model: args.model } : {}),
      system: args.system,
    },
    {
      saveStreamDeltas: DEFAULT_AGENT_STREAM_DELTAS,
    }
  );
}

async function runMainStreamText(
  ctx: ActionCtx,
  args: {
    threadId: string;
    promptMessageId?: string;
    prompt?: string;
    system: string;
    messages?: AgentTurnContextMessage[];
    model?: LanguageModel;
    disableTools?: boolean;
  }
) {
  return mainAgent.streamText(
    ctx,
    { threadId: args.threadId },
    {
      ...(args.promptMessageId
        ? { promptMessageId: args.promptMessageId }
        : {}),
      ...(args.prompt ? { prompt: args.prompt } : {}),
      ...(args.messages?.length ? { messages: args.messages } : {}),
      ...(args.model ? { model: args.model } : {}),
      ...(args.disableTools ? { tools: {} } : {}),
      system: args.system,
    },
    {
      saveStreamDeltas: DEFAULT_AGENT_STREAM_DELTAS,
    }
  );
}

async function streamOutreachTextWithFallback(
  ctx: ActionCtx,
  args: {
    threadId: string;
    promptMessageId?: string;
    system: string;
    tools: OutreachAgentTools;
    messages?: AgentTurnContextMessage[];
    model?: LanguageModel;
    preferHistorySearch?: boolean;
    timing?: OutreachStreamTiming;
  }
) {
  const executeAttempt = async () => {
    const attemptTiming: OutreachStreamAttemptTiming | undefined = args.timing
      ? {
          agent_call_started_at: getCurrentUTCTimestamp(),
          attempt_number: args.timing.attempts.length + 1,
          steps: [],
          tool_calls: [],
        }
      : undefined;
    if (attemptTiming) {
      args.timing?.attempts.push(attemptTiming);
    }
    const result = await runOutreachStreamTextWithHistoryFallback(ctx, {
      ...args,
      timing: attemptTiming,
    });
    await result.consumeStream();
    return result;
  };

  try {
    return await executeAttempt();
  } catch (error) {
    const shouldRetry = await canRetryAgentTurnWithoutDuplicatingTools(ctx, {
      threadId: args.threadId,
      promptMessageId: args.promptMessageId,
    });

    if (!shouldRetry) {
      throw normalizeUnknownError(error);
    }

    chatLogger.warn(
      "Outreach stream aborted before any tool result was saved; retrying once with the fixed outreach model",
      {
        threadId: args.threadId,
        promptMessageId: args.promptMessageId,
        errorMessage: stringifyUnknownError(error),
      }
    );

    try {
      return await executeAttempt();
    } catch (retryError) {
      throw normalizeUnknownError(retryError);
    }
  }
}

async function streamSetupTextWithRetry(
  ctx: ActionCtx,
  args: {
    threadId: string;
    promptMessageId: string;
    system: string;
    messages?: AgentTurnContextMessage[];
    model?: LanguageModel;
  }
) {
  const executeAttempt = async () => {
    const result = await runSetupStreamText(ctx, args);
    await result.consumeStream();
    return result;
  };

  try {
    return await executeAttempt();
  } catch (error) {
    const shouldRetry = await canRetryAgentTurnWithoutDuplicatingTools(ctx, {
      threadId: args.threadId,
      promptMessageId: args.promptMessageId,
    });

    if (!shouldRetry) {
      throw normalizeUnknownError(error);
    }

    chatLogger.warn(
      "Setup stream aborted before any tool result was saved; retrying once on the pinned safe provider",
      {
        threadId: args.threadId,
        promptMessageId: args.promptMessageId,
        errorMessage: stringifyUnknownError(error),
      }
    );

    try {
      return await executeAttempt();
    } catch (retryError) {
      throw normalizeUnknownError(retryError);
    }
  }
}

async function streamMainTextWithRetry(
  ctx: ActionCtx,
  args: {
    threadId: string;
    promptMessageId: string;
    system: string;
    messages?: AgentTurnContextMessage[];
    model?: LanguageModel;
  }
) {
  const executeAttempt = async () => {
    const result = await runMainStreamText(ctx, args);
    await result.consumeStream();
    return result;
  };

  try {
    return await executeAttempt();
  } catch (error) {
    const shouldRetry = await canRetryAgentTurnWithoutDuplicatingTools(ctx, {
      threadId: args.threadId,
      promptMessageId: args.promptMessageId,
    });

    if (!shouldRetry) {
      throw normalizeUnknownError(error);
    }

    chatLogger.warn(
      "Main-agent stream aborted before any tool result was saved; retrying once on the pinned safe provider",
      {
        threadId: args.threadId,
        promptMessageId: args.promptMessageId,
        errorMessage: stringifyUnknownError(error),
      }
    );

    try {
      return await executeAttempt();
    } catch (retryError) {
      throw normalizeUnknownError(retryError);
    }
  }
}

async function finalizePendingAssistantMessageForOrder(
  ctx: MutationCtx,
  args: {
    threadId: string;
    order: number;
    errorMessage: string;
    userVisibleMessage?: string;
  }
) {
  const pendingAssistantMessages = await listPendingAssistantMessages(
    ctx,
    args.threadId
  );
  const pendingMessage = pendingAssistantMessages.find(
    (message) => message.order === args.order
  );

  if (!pendingMessage) {
    await deleteAbortedStreamsForOrder(ctx, {
      threadId: args.threadId,
      order: args.order,
    });
    return false;
  }

  const visibleMessage = args.userVisibleMessage?.trim();

  try {
    await ctx.runMutation(components.agent.messages.finalizeMessage, {
      messageId: pendingMessage._id,
      result: {
        status: "failed",
        error: args.errorMessage,
      },
    });

    const [updatedMessage] = await ctx.runQuery(
      components.agent.messages.getMessagesByIds,
      {
        messageIds: [pendingMessage._id],
      }
    );

    if (
      updatedMessage &&
      visibleMessage &&
      (!updatedMessage.text || updatedMessage.text.trim().length === 0)
    ) {
      await ctx.runMutation(components.agent.messages.updateMessage, {
        messageId: pendingMessage._id,
        patch: {
          status: "failed",
          error: args.errorMessage,
          finishReason: "error",
          message: {
            role: "assistant",
            content: visibleMessage,
          },
        },
      });
    }

    return true;
  } catch (error) {
    // Agent's finalizeMessage replays any stored stream deltas when the
    // pending message has no text. An already-failed AI SDK stream contains
    // an `error` delta, which makes that replay throw again. Mark the message
    // failed directly so recovery itself cannot remain stuck on the original
    // stream error.
    chatLogger.warn(
      "Could not replay failed assistant stream; marking it failed directly",
      {
        threadId: args.threadId,
        order: args.order,
        messageId: pendingMessage._id,
        errorMessage: stringifyUnknownError(error),
      }
    );

    await ctx.runMutation(components.agent.messages.updateMessage, {
      messageId: pendingMessage._id,
      patch: {
        status: "failed",
        error: args.errorMessage,
        finishReason: "error",
        ...(visibleMessage
          ? {
              message: {
                role: "assistant" as const,
                content: visibleMessage,
              },
            }
          : {}),
      },
    });

    await deleteAbortedStreamsForOrder(ctx, {
      threadId: args.threadId,
      order: args.order,
    });

    return true;
  }
}

async function deleteAbortedStreamsForOrder(
  ctx: MutationCtx,
  args: { threadId: string; order: number }
) {
  let abortedStreams: Awaited<
    ReturnType<typeof ctx.runQuery<typeof components.agent.streams.list>>
  >;
  try {
    abortedStreams = await ctx.runQuery(components.agent.streams.list, {
      threadId: args.threadId,
      statuses: ["aborted"],
    });
  } catch (error) {
    chatLogger.warn("Could not list aborted assistant streams", {
      threadId: args.threadId,
      order: args.order,
      errorMessage: stringifyUnknownError(error),
    });
    return;
  }

  for (const stream of abortedStreams) {
    if (stream.order !== args.order) continue;

    try {
      await ctx.runMutation(components.agent.streams.deleteStreamSync, {
        streamId: stream.streamId,
      });
    } catch (error) {
      // Stream cleanup is best effort. The failed message is already
      // recoverable, and a cleanup race must not resurrect the original error.
      chatLogger.warn("Could not clean up an aborted assistant stream", {
        threadId: args.threadId,
        order: args.order,
        streamId: stream.streamId,
        errorMessage: stringifyUnknownError(error),
      });
    }
  }
}

type ThreadHistoryLinkRow = Pick<
  Doc<"prospectThreads"> | Doc<"workspaceAgentThreads">,
  "_creationTime" | "threadId" | "threadStatus" | "threadSummary"
> & { hasVisibleMessages?: boolean };

type ThreadHistoryEntry = {
  _id: string;
  _creationTime: number;
  status: "active" | "archived";
  title?: string;
  firstMessage?: string;
};

function normalizeThreadHistoryStatus(
  status: ThreadHistoryLinkRow["threadStatus"] | ThreadDoc["status"] | undefined
): "active" | "archived" {
  return status === "archived" ? "archived" : "active";
}

function shouldFetchThreadHistoryFallback(
  row: ThreadHistoryLinkRow,
  options: {
    includeFirstMessage?: boolean;
  }
) {
  if (row.threadStatus === undefined) {
    return true;
  }

  return (
    options.includeFirstMessage === true && row.threadSummary === undefined
  );
}

function isAutoPlanHistoryRow(row: ThreadHistoryLinkRow) {
  const summary = row.threadSummary?.toLowerCase() ?? "";
  return (
    summary.includes("auto-generated, research-grounded outreach plan") ||
    summary.startsWith("outreach plan created for ")
  );
}

async function buildThreadHistoryEntries(
  ctx: ReadableCtx,
  rows: ThreadHistoryLinkRow[],
  options: {
    activeOnly?: boolean;
    includeFirstMessage?: boolean;
  } = {}
) {
  const dedupedRows = dedupeThreadHistoryLinksByThreadId(rows);
  const rowsNeedingFallback = dedupedRows.filter((row) =>
    shouldFetchThreadHistoryFallback(row, options)
  );
  const fallbackThreads = await Promise.all(
    rowsNeedingFallback.map((row) =>
      ctx.runQuery(components.agent.threads.getThread, {
        threadId: row.threadId,
      })
    )
  );
  const fallbackByThreadId = new Map<string, ThreadDoc | null>(
    rowsNeedingFallback.map((row, index) => [
      row.threadId,
      fallbackThreads[index],
    ])
  );
  const rowsNeedingMessageCheck = options.includeFirstMessage
    ? dedupedRows.filter(
        (row) => isAutoPlanHistoryRow(row) && row.hasVisibleMessages !== true
      )
    : [];
  const messageChecks = await Promise.all(
    rowsNeedingMessageCheck.map((row) =>
      ctx.runQuery(components.agent.messages.listMessagesByThreadId, {
        threadId: row.threadId,
        order: "desc",
        paginationOpts: { numItems: 10, cursor: null },
      })
    )
  );
  const hasVisibleMessagesByThreadId = new Map(
    rowsNeedingMessageCheck.map((row, index) => [
      row.threadId,
      messageChecks[index].page.some((message) => {
        const role = message.message?.role;
        return role === "user" || role === "assistant";
      }),
    ])
  );

  const entries: ThreadHistoryEntry[] = [];

  for (const row of dedupedRows) {
    if (hasVisibleMessagesByThreadId.get(row.threadId) === false) {
      continue;
    }
    const fallbackThread = fallbackByThreadId.get(row.threadId);
    if (
      shouldFetchThreadHistoryFallback(row, options) &&
      fallbackThread === null
    ) {
      continue;
    }

    const status = normalizeThreadHistoryStatus(
      row.threadStatus ?? fallbackThread?.status
    );
    if (options.activeOnly && status !== "active") {
      continue;
    }

    entries.push({
      _id: row.threadId,
      _creationTime: row._creationTime,
      status,
      title: fallbackThread?.title,
      firstMessage: options.includeFirstMessage
        ? (row.threadSummary ?? fallbackThread?.summary ?? undefined)
        : undefined,
    });
  }

  return entries;
}

// ============================================================================
// Thread Management
// ============================================================================

/**
 * Creates a new chat thread for the current user.
 */
export const createChatThread = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireViewerUser(ctx);

    // Create a new thread - per docs: https://docs.convex.dev/agents/threads
    const threadId = await createThread(ctx, components.agent, {
      userId: user._id,
    });

    return { threadId };
  },
});

/**
 * Gets the user's most recent thread or creates one.
 * If a new thread is created, triggers the agent to send a greeting.
 *
 * NOTE: We only trigger greeting for NEW threads to avoid duplicate messages
 * when the mutation is called twice quickly (e.g., React StrictMode).
 */
export const getOrCreateThread = mutation({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, { workspaceId }) => {
    const user = await requireViewerUser(ctx);
    const workspace = workspaceId
      ? await requireOwnedWorkspace(ctx, workspaceId, {
          user,
          notFoundMessage: "Workspace not found",
          notAuthorizedMessage: "Not authorized",
        })
      : await getDefaultWorkspaceForUser(ctx, user._id);

    if (workspace) {
      const existingActiveLink = await getLatestActiveWorkspaceThreadLink(
        ctx.db,
        workspace._id
      );
      if (existingActiveLink) {
        const existingThread = await ctx.runQuery(
          components.agent.threads.getThread,
          {
            threadId: existingActiveLink.threadId,
          }
        );

        if (existingThread && existingThread.userId === user._id) {
          return { threadId: existingThread._id, isNew: false };
        }
      }

      const legacyThreads = await listLegacyWorkspaceThreadsByTitle(ctx, {
        userId: user._id,
        workspaceId: workspace._id,
        limit: 5,
      });
      const legacyActiveThread =
        legacyThreads.find((thread) => thread.status !== "archived") ??
        legacyThreads[0];
      if (legacyActiveThread) {
        await ensureWorkspaceThreadLink(ctx, {
          workspaceId: workspace._id,
          threadId: legacyActiveThread._id,
          userId: user._id,
          threadStatus:
            legacyActiveThread.status === "archived" ? "archived" : "active",
          threadSummary: legacyActiveThread.summary ?? undefined,
        });
        return { threadId: legacyActiveThread._id, isNew: false };
      }
    }

    if (!workspace) {
      // Check if user has any threads - per docs
      const existingThreads = await ctx.runQuery(
        components.agent.threads.listThreadsByUserId,
        { userId: user._id, paginationOpts: { numItems: 1, cursor: null } }
      );

      if (existingThreads.page.length > 0) {
        const threadId = existingThreads.page[0]._id;
        // Return existing thread - do NOT trigger greeting here
        // The greeting may already be in-flight or streamed
        return { threadId, isNew: false };
      }
    }

    // Create a new thread
    const threadId = await createThread(ctx, components.agent, {
      userId: user._id,
      title: workspace ? getSetupThreadTitle(String(workspace._id)) : undefined,
    });

    if (workspace) {
      await ensureWorkspaceThreadLink(ctx, {
        workspaceId: workspace._id,
        threadId,
        userId: user._id,
        threadStatus: "active",
      });
    }

    // Only setup-owned bootstrap threads should auto-greet. Workspace `/agent`
    // threads start as draft composers and should not behave like onboarding.
    if (!workspace) {
      await ctx.scheduler.runAfter(0, internal.chat.triggerAgentGreeting, {
        threadId,
      });
    }

    return { threadId, isNew: true };
  },
});

/**
 * Creates a workspace-scoped `/agent` thread without sending a prompt yet.
 * Used by mobile history so "New" can navigate directly into a fresh thread.
 */
export const createWorkspaceThread = mutation({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, { workspaceId }) => {
    const user = await requireViewerUser(ctx);
    const workspace = workspaceId
      ? await requireOwnedWorkspace(ctx, workspaceId, {
          user,
          notFoundMessage: "Workspace not found",
          notAuthorizedMessage: "Not authorized",
        })
      : await getDefaultWorkspaceForUser(ctx, user._id);

    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const threadId = await createThread(ctx, components.agent, {
      userId: user._id,
      title: getSetupThreadTitle(String(workspace._id)),
    });

    await ensureWorkspaceThreadLink(ctx, {
      workspaceId: workspace._id,
      threadId,
      userId: user._id,
      threadStatus: "active",
    });

    return { threadId };
  },
});

/**
 * Creates a brand-new workspace-scoped thread and sends the initial prompt in
 * one flow. This is used after an explicit "New" action in `/agent`, so it
 * must never fall back to an older workspace thread.
 */
export const createWorkspaceThreadWithPrompt = mutation({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    prompt: v.string(),
    metadata: v.optional(agentMessageContextMetadataValidator),
  },
  handler: async (ctx, { workspaceId, prompt, metadata }) => {
    const trimmedPrompt = prompt.trim();
    const normalizedMetadata = normalizeAgentMessageContextMetadata(metadata);
    if (!trimmedPrompt && !normalizedMetadata) {
      throw new Error("Message cannot be empty.");
    }

    const user = await requireViewerUser(ctx);
    const workspace = workspaceId
      ? await requireOwnedWorkspace(ctx, workspaceId, {
          user,
          notFoundMessage: "Workspace not found",
          notAuthorizedMessage: "Not authorized",
        })
      : await getDefaultWorkspaceForUser(ctx, user._id);

    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const threadSummary = trimmedPrompt.slice(0, 150);
    const threadId = await createThread(ctx, components.agent, {
      userId: user._id,
      title: getSetupThreadTitle(String(workspace._id)),
      summary: threadSummary,
    });

    await ensureWorkspaceThreadLink(ctx, {
      workspaceId: workspace._id,
      threadId,
      userId: user._id,
      threadStatus: "active",
      threadSummary,
    });

    const { messageId, message } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt: trimmedPrompt,
    });
    await persistAgentMessageContext(ctx, {
      threadId,
      messageId,
      userId: user._id,
      metadata: normalizedMetadata,
    });

    await ctx.scheduler.runAfter(0, internal.chat.streamAgentResponse, {
      threadId,
      promptMessageId: messageId,
    });
    await recordWorkspaceActivityWithDb(ctx, workspace._id);

    return { threadId, messageId, order: message.order };
  },
});

export const getThreadRouteContext = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }): Promise<ThreadRouteContextResult> => {
    const user = await requireViewerUser(ctx);
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId,
    });

    if (!thread) {
      return { kind: "missing" as const };
    }
    if (thread.userId !== user._id) {
      throw new Error("Not authorized");
    }

    const prospectThreadContext = await getProspectThreadContextByThreadId(
      ctx.db,
      threadId
    );
    if (prospectThreadContext) {
      return {
        kind: "prospect" as const,
        prospectId: prospectThreadContext.prospect._id,
        workspaceId: prospectThreadContext.prospect.workspaceId,
      };
    }

    const workspaceThreadContext = await getWorkspaceThreadContextByThreadId(
      ctx.db,
      threadId
    );
    if (workspaceThreadContext) {
      return {
        kind: "workspace" as const,
        workspaceId: workspaceThreadContext.workspace._id,
      };
    }

    const setupSession = await ctx.runQuery(
      internal.setupSessions.getByThreadIdInternal,
      {
        threadId,
      }
    );
    const sessionWorkspaceId =
      setupSession?.targetWorkspaceId ?? setupSession?.existingWorkspaceId;
    if (sessionWorkspaceId) {
      return {
        kind: "workspace" as const,
        workspaceId: sessionWorkspaceId,
      };
    }

    const parsedState = parseSetupThreadState(thread.title);
    if (parsedState?.kind === "workspace") {
      return {
        kind: "workspace" as const,
        workspaceId: parsedState.workspaceId as Id<"workspaces">,
      };
    }

    if (parsedState?.kind === "draft") {
      return { kind: "setup_draft" as const };
    }

    return { kind: "unknown" as const };
  },
});

export const getThreadSelectedContext = query({
  args: {
    threadId: v.string(),
  },
  handler: async (
    ctx,
    { threadId }
  ): Promise<ThreadSelectedContextResult | null> => {
    const user = await requireViewerUser(ctx);
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId,
    });

    if (!thread) {
      return null;
    }
    if (thread.userId !== user._id) {
      throw new Error("Not authorized");
    }

    return await ctx.runQuery(
      internal.agentThreadContext.resolveSelectedContextForThread,
      {
        threadId,
      }
    );
  },
});

export const listWorkspaceThreadsWithMessages = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { workspaceId, paginationOpts }) => {
    const user = await requireViewerUser(ctx);
    const workspace = workspaceId
      ? await requireOwnedWorkspace(ctx, workspaceId, {
          user,
          notFoundMessage: "Workspace not found",
          notAuthorizedMessage: "Not authorized",
        })
      : await getDefaultWorkspaceForUser(ctx, user._id);

    if (!workspace) {
      return {
        page: [] as ThreadHistoryEntry[],
        continueCursor: "",
        isDone: true,
      };
    }

    const page = await ctx.db
      .query("workspaceAgentThreads")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .order("desc")
      .paginate(paginationOpts);

    const threadsWithMessages = await buildThreadHistoryEntries(
      ctx,
      page.page,
      {
        activeOnly: true,
        includeFirstMessage: true,
      }
    );
    const linkedThreadIds = new Set(
      await listWorkspaceThreadIdsByWorkspace(ctx.db, workspace._id)
    );
    const legacyThreads = await listLegacyWorkspaceThreadsByTitle(ctx, {
      userId: user._id,
      workspaceId: workspace._id,
      limit: paginationOpts.numItems ?? 20,
    });
    const legacyEntries = legacyThreads
      .filter((thread) => !linkedThreadIds.has(thread._id))
      .filter(
        (thread) => normalizeThreadHistoryStatus(thread.status) === "active"
      )
      .map((thread) => ({
        _id: thread._id,
        _creationTime: thread._creationTime,
        status: normalizeThreadHistoryStatus(thread.status),
        title: thread.title,
        firstMessage: thread.summary ?? undefined,
      }));
    const mergedPage = [...threadsWithMessages, ...legacyEntries]
      .sort((left, right) => right._creationTime - left._creationTime)
      .slice(0, paginationOpts.numItems ?? 20);

    return {
      page: mergedPage,
      continueCursor: page.continueCursor,
      isDone: page.isDone && legacyEntries.length === 0,
    };
  },
});

// ============================================================================
// Prospect-Specific Threads (Outreach System)
// ============================================================================

/**
 * Creates a thread for a specific prospect.
 * Keeps a human-readable title, but stores the canonical relationship locally.
 */
export const createProspectThread = mutation({
  args: {
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, { prospectId }) => {
    const user = await requireViewerUser(ctx);
    await requireOwnedProspect(ctx, prospectId, {
      user,
      notFoundMessage: "Prospect not found",
      notAuthorizedMessage: "Not authorized",
    });

    // Keep the title human-readable, but the local relationship table is canonical.
    const threadId = await createThread(ctx, components.agent, {
      userId: user._id,
      title: `outreach:${prospectId}`,
    });

    await ensureProspectThreadLink(ctx, {
      prospectId,
      threadId,
      userId: user._id,
      threadStatus: "active",
    });

    return { threadId };
  },
});

/**
 * Gets an existing thread for a prospect (query only, does not create).
 * Used for lazy thread creation pattern - threads only created on first message.
 */
export const getProspectThread = query({
  args: {
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, { prospectId }) => {
    const user = await getViewerUser(ctx);
    if (!user) return null;

    const prospect = await getOwnedProspect(ctx, prospectId, user._id);
    if (!prospect) return null;

    const links = await listProspectThreadLinksByProspect(ctx.db, prospect._id);
    const prospectThreads = await buildThreadHistoryEntries(ctx, links, {
      activeOnly: true,
    });

    const existingThread = prospectThreads[0];

    return existingThread ? { threadId: existingThread._id } : null;
  },
});

export const getActiveThreadForProspect = query({
  args: {
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, { prospectId }) => {
    const user = await getViewerUser(ctx);
    if (!user) {
      return null;
    }

    const prospect = await getOwnedProspect(ctx, prospectId, user._id);
    if (!prospect) {
      return null;
    }

    const link = await getLatestActiveProspectThreadLink(ctx.db, prospect._id);
    if (!link) {
      return null;
    }

    return { threadId: link.threadId };
  },
});

/**
 * Creates a brand-new prospect-scoped thread and sends an initial prompt in
 * one flow. This powers draft mode on `/agent?prospectId=...`, so it must
 * never silently reuse an older thread after the operator clicks "New".
 */
export const createProspectThreadWithPrompt = mutation({
  args: {
    prospectId: v.id("prospects"),
    prompt: v.string(),
    metadata: v.optional(agentMessageContextMetadataValidator),
  },
  handler: async (ctx, { prospectId, prompt, metadata }) => {
    const trimmedPrompt = prompt.trim();
    const normalizedMetadata = normalizeAgentMessageContextMetadata(metadata);
    if (!trimmedPrompt && !normalizedMetadata) {
      throw new Error("Message cannot be empty.");
    }
    const user = await requireViewerUser(ctx);
    const prospectDoc = await requireOwnedProspect(ctx, prospectId, {
      user,
      notFoundMessage: "Prospect not found",
      notAuthorizedMessage: "Not authorized",
    });
    requireProspectNotArchived(prospectDoc);

    // Keep the title human-readable, but store the canonical relationship locally.
    // Use summary field to store first user message for display.
    const threadSummary = trimmedPrompt.slice(0, 150);
    const threadId = await createThread(ctx, components.agent, {
      userId: user._id,
      title: `outreach:${prospectId}`,
      summary: threadSummary,
    });

    await ensureProspectThreadLink(ctx, {
      prospectId,
      threadId,
      userId: user._id,
      threadStatus: "active",
      threadSummary,
    });

    // Save the user's prompt message
    const { messageId, message } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt: trimmedPrompt,
    });
    await persistAgentMessageContext(ctx, {
      threadId,
      messageId,
      userId: user._id,
      metadata: normalizedMetadata,
    });

    // Schedule outreach agent response
    await ctx.scheduler.runAfter(0, internal.chat.streamOutreachResponse, {
      threadId,
      promptMessageId: messageId,
    });

    return { threadId, messageId, order: message.order };
  },
});

/**
 * Lists all threads for a specific prospect.
 */
export const listProspectThreads = query({
  args: {
    prospectId: v.id("prospects"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { prospectId, paginationOpts }) => {
    const user = await requireViewerUser(ctx);
    await requireOwnedProspect(ctx, prospectId, {
      user,
      notFoundMessage: "Prospect not found",
      notAuthorizedMessage: "Not authorized",
    });

    const page = await ctx.db
      .query("prospectThreads")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
      .order("desc")
      .paginate(paginationOpts);
    const prospectThreads = await buildThreadHistoryEntries(ctx, page.page, {
      activeOnly: true,
    });

    return {
      page: prospectThreads.map((thread) => ({
        _id: thread._id,
        _creationTime: thread._creationTime,
        status: thread.status,
        title: thread.title,
      })),
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

/**
 * Lists threads for a prospect with their first user message.
 * Used by HistoryPanel to display thread titles.
 * Reads from locally cached threadSummary first and falls back only for rows
 * that still need backfilled metadata.
 */
export const listProspectThreadsWithMessages = query({
  args: {
    prospectId: v.id("prospects"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { prospectId, paginationOpts }) => {
    const user = await requireViewerUser(ctx);
    await requireOwnedProspect(ctx, prospectId, {
      user,
      notFoundMessage: "Prospect not found",
      notAuthorizedMessage: "Not authorized",
    });

    const page = await ctx.db
      .query("prospectThreads")
      .withIndex("by_prospect", (q) => q.eq("prospectId", prospectId))
      .order("desc")
      .paginate(paginationOpts);
    const threadsWithMessages = await buildThreadHistoryEntries(
      ctx,
      page.page,
      {
        activeOnly: true,
        includeFirstMessage: true,
      }
    );

    return {
      page: threadsWithMessages,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

/**
 * Hard-deletes a thread and removes its prospect-thread links.
 *
 */
export const deleteThread = mutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }) => {
    const user = await requireViewerUser(ctx);

    // Verify thread exists and user owns it
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId,
    });
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user._id) throw new Error("Not authorized");

    const threadLinks = await listProspectThreadLinksByThreadId(
      ctx.db,
      threadId
    );
    const workspaceThreadLinks = await listWorkspaceThreadLinksByThreadId(
      ctx.db,
      threadId
    );
    const targetSelection = await ctx.db
      .query("agentThreadTargetSelections")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .unique();

    await outreachAgent.deleteThreadAsync(ctx, { threadId });

    await Promise.all([
      ...threadLinks.map((link) => ctx.db.delete(link._id)),
      ...workspaceThreadLinks.map((link) => ctx.db.delete(link._id)),
      ...(targetSelection ? [ctx.db.delete(targetSelection._id)] : []),
    ]);
  },
});

/**
 * Send message to prospect thread using outreach agent.
 * On first message, stores it in thread summary for display.
 */
export const sendProspectMessage = mutation({
  args: {
    threadId: v.string(),
    prompt: v.string(),
    metadata: v.optional(agentMessageContextMetadataValidator),
  },
  handler: async (ctx, { threadId, prompt, metadata }) => {
    const trimmedPrompt = prompt.trim();
    const normalizedMetadata = normalizeAgentMessageContextMetadata(metadata);
    if (!trimmedPrompt && !normalizedMetadata) {
      throw new Error("Message cannot be empty.");
    }
    const user = await requireViewerUser(ctx);

    // Verify thread access
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId,
    });
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user._id) throw new Error("Not authorized");

    const threadLink = await getProspectThreadLinkByThreadId(ctx.db, threadId);
    if (threadLink) {
      const prospectForThread = await ctx.db.get(threadLink.prospectId);
      if (prospectForThread) {
        requireProspectNotArchived(prospectForThread);
      }
    }

    // If no summary yet, this is the first user message - store it for display
    if (!thread.summary) {
      const threadSummary = trimmedPrompt.slice(0, 150);
      await ctx.runMutation(components.agent.threads.updateThread, {
        threadId,
        patch: { summary: threadSummary },
      });
      if (threadLink) {
        await ctx.db.patch(threadLink._id, {
          threadStatus: "active",
          threadSummary,
        });
      }
    }

    // Save user message
    const { messageId, message } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt: trimmedPrompt,
    });
    await persistAgentMessageContext(ctx, {
      threadId,
      messageId,
      userId: user._id,
      metadata: normalizedMetadata,
    });

    // Schedule outreach agent response
    await ctx.scheduler.runAfter(0, internal.chat.streamOutreachResponse, {
      threadId,
      promptMessageId: messageId,
    });
    if (threadLink) {
      const prospect = await ctx.db.get(threadLink.prospectId);
      if (prospect) {
        await recordWorkspaceActivityWithDb(ctx, prospect.workspaceId);
      }
    }

    return { messageId, order: message.order };
  },
});

/** Prospect row for a thread (internal; used by stream guard). */
export const getProspectForThreadInternal = internalQuery({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    const link = await getProspectThreadLinkByThreadId(ctx.db, threadId);
    if (!link) return null;
    return await ctx.db.get(link.prospectId);
  },
});

export const getMediaUploadInternal = internalQuery({
  args: { uploadId: v.id("mediaUploads") },
  handler: async (ctx, { uploadId }) => {
    return await ctx.db.get(uploadId);
  },
});

export const getAgentMessageContextInternal = internalQuery({
  args: { messageId: v.string() },
  handler: async (ctx, { messageId }) => {
    return await ctx.db
      .query("agentMessageContexts")
      .withIndex("by_message", (q) => q.eq("messageId", messageId))
      .first();
  },
});

async function runStreamOutreachResponse(
  ctx: ActionCtx,
  args: {
    threadId: string;
    promptMessageId: string;
    transientXChatContext?: string;
  }
): Promise<{
  text: string;
  finishReason: string | null;
  pendingAskHuman: boolean;
} | void> {
  const responseStartedAt = getCurrentUTCTimestamp();
  const logEvent = getWideEventLogger(ctx);
  const streamTiming: OutreachStreamTiming = { attempts: [] };
  const responseTiming: Record<string, number | undefined> = {};

  try {
    const prospectLoadStartedAt = getCurrentUTCTimestamp();
    const prospect = await ctx.runQuery(
      internal.chat.getProspectForThreadInternal,
      { threadId: args.threadId }
    );
    responseTiming.prospect_guard_ms =
      getCurrentUTCTimestamp() - prospectLoadStartedAt;
    if (prospect?.status === "archived") {
      logEvent?.set({
        agent_response: {
          outcome: "archived_prospect",
          timing: responseTiming,
        },
      });
      return;
    }

    const preModelStartedAt = getCurrentUTCTimestamp();
    const [
      useCase,
      promptMessage,
      hiddenContext,
      historySignals,
      backgroundRefreshScheduled,
    ] = await Promise.all([
      resolveOutreachUseCaseForThread(ctx, args.threadId, prospect),
      getThreadMessageById(ctx, args.promptMessageId),
      buildAgentTurnContextMessages(ctx, {
        threadId: args.threadId,
        promptMessageId: args.promptMessageId,
      }),
      getOutreachHistorySignals(ctx, {
        threadId: args.threadId,
        excludeMessageId: args.promptMessageId,
      }),
      prospect
        ? ctx.scheduler
            .runAfter(
              0,
              internal.xPostLimitsActions
                .getEffectivePostLimitWithRefreshInternal,
              { userId: prospect.userId }
            )
            .then(() => true)
            .catch(() => false)
        : Promise.resolve(false),
    ]);
    responseTiming.pre_model_parallel_ms =
      getCurrentUTCTimestamp() - preModelStartedAt;
    responseTiming.queue_delay_ms = promptMessage?._creationTime
      ? Math.max(0, responseStartedAt - promptMessage._creationTime)
      : undefined;

    const tools = await getOutreachToolsForThread(ctx, args.threadId);
    const promptText =
      typeof promptMessage?.text === "string" ? promptMessage.text : "";
    const hasSearchablePrompt = promptText.trim().length > 0;
    const shouldUseHistorySearch =
      hasSearchablePrompt && historySignals.hasSearchableHistory;
    const streamStartedAt = getCurrentUTCTimestamp();
    const result = await streamOutreachTextWithFallback(ctx, {
      threadId: args.threadId,
      promptMessageId: args.promptMessageId,
      system: buildOutreachAgentPrompt(useCase),
      tools,
      messages: args.transientXChatContext
        ? [
            ...hiddenContext.messages,
            { role: "system" as const, content: args.transientXChatContext },
          ]
        : hiddenContext.messages,
      model: hiddenContext.hasVisionInput
        ? outreachVisionLanguageModel
        : createOutreachThreadLanguageModel(args.threadId),
      preferHistorySearch: shouldUseHistorySearch,
      timing: streamTiming,
    });
    responseTiming.stream_and_tools_ms =
      getCurrentUTCTimestamp() - streamStartedAt;

    const persistenceStartedAt = getCurrentUTCTimestamp();
    if (!args.transientXChatContext) {
      await persistRawModelResponse(ctx, {
        threadId: args.threadId,
        agentName: "Outreach Agent",
        request: result.request,
        response: result.response,
        providerMetadata: result.providerMetadata,
      });
    }

    const toolCalls = await result.toolCalls;
    const askHumanCalls = toolCalls.filter((tc) => tc.toolName === "askHuman");

    for (const call of askHumanCalls) {
      const toolArgs =
        "args" in call
          ? (call.args as {
              question: string;
              context?: string;
              urgency?: "low" | "medium" | "high";
              options?: string[];
            })
          : null;

      if (!toolArgs) {
        chatLogger.warn("askHuman tool call missing args", {
          threadId: args.threadId,
          toolCallId: call.toolCallId,
          toolName: call.toolName,
        });
        continue;
      }

      await ctx.runMutation(internal.chat.createAskHumanNotification, {
        threadId: args.threadId,
        toolCallId: call.toolCallId,
        question: toolArgs.question,
        context: toolArgs.context,
        urgency: toolArgs.urgency,
        options: toolArgs.options,
      });
    }

    await ctx.runAction(internal.chat.reconcileOutreachTaskStatusAfterStream, {
      threadId: args.threadId,
    });
    responseTiming.post_stream_persistence_ms =
      getCurrentUTCTimestamp() - persistenceStartedAt;
    responseTiming.total_ms = getCurrentUTCTimestamp() - responseStartedAt;
    logEvent?.set({
      agent_response: {
        background_x_refresh_scheduled: backgroundRefreshScheduled,
        history_search_enabled: shouldUseHistorySearch,
        model_mode: hiddenContext.hasVisionInput ? "vision" : "fixed",
        stream_delta_throttle_ms: DEFAULT_AGENT_STREAM_DELTAS.throttleMs,
        timing: responseTiming,
        attempts: summarizeOutreachStreamTiming(streamTiming),
      },
    });

    return {
      text: await result.text,
      finishReason: await result.finishReason,
      pendingAskHuman: askHumanCalls.length > 0,
    };
  } catch (error) {
    responseTiming.total_ms = getCurrentUTCTimestamp() - responseStartedAt;
    logEvent?.set({
      agent_response: {
        timing: responseTiming,
        attempts: summarizeOutreachStreamTiming(streamTiming),
      },
    });
    const normalizedError = normalizeUnknownError(error);
    chatLogger.error(
      "Outreach stream error",
      {
        threadId: args.threadId,
        promptMessageId: args.promptMessageId,
      },
      normalizedError
    );
    throw normalizedError;
  }
}

/**
 * Internal action for streaming outreach agent response.
 * Detects askHuman tool calls and creates notifications.
 */
export const streamOutreachResponse = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    return await runStreamOutreachResponse(ctx, args);
  },
});

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function getFailureClassFromResultData(resultData: unknown): string | null {
  const resultRecord = asRecord(resultData);
  const errorRecord = asRecord(resultRecord?.error);
  const value = errorRecord?.classification ?? errorRecord?.type;
  return typeof value === "string" ? value : null;
}

/**
 * Write deterministic status messages for outreach execution directly to thread.
 * This avoids optimistic assistant claims when persistence says otherwise.
 */
export const bridgeOutreachTaskStatusToThread = internalAction({
  args: {
    taskId: v.id("outreachTasks"),
  },
  handler: async (
    ctx,
    { taskId }
  ): Promise<{
    bridged: boolean;
    reason?:
      | "task_not_found"
      | "thread_missing"
      | "no_bridgeable_state"
      | "already_bridged";
    state?: string;
  }> => {
    const task = await ctx.runQuery(internal.outreach.getTaskInternal, {
      taskId,
    });
    if (!task) return { bridged: false, reason: "task_not_found" as const };

    const planData = await ctx.runQuery(internal.outreach.getPlanInternal, {
      planId: task.planId,
    });
    if (!planData?.plan?.threadId) {
      return { bridged: false, reason: "thread_missing" as const };
    }

    const postedArtifactId = getPostedOutreachArtifactId(task, task.resultData);
    const failureClass = getFailureClassFromResultData(task.resultData);
    const resultRecord = asRecord(task.resultData);

    let bridgeState: string | null = null;
    let message: string | null = null;

    if (
      (task.status === "waiting_response" || task.status === "completed") &&
      postedArtifactId
    ) {
      const responseReceived = resultRecord?.responseReceived === true;
      const platform = task.approvalContext?.platform ?? "twitter";
      const artifactLabel =
        task.type === "dm"
          ? "message ID"
          : task.type === "react"
            ? "target ID"
            : platform === "linkedin"
              ? "comment ID"
              : "tweet ID";
      bridgeState = responseReceived ? "completed_response" : "posted";
      message = responseReceived
        ? `Prospect responded. Outreach was sent successfully (${artifactLabel}: ${postedArtifactId}).`
        : task.type === "dm"
          ? `${platform === "linkedin" ? "LinkedIn" : "X"} DM sent successfully (${artifactLabel}: ${postedArtifactId}).`
          : task.type === "react"
            ? `${platform === "linkedin" ? "LinkedIn reaction completed successfully" : "Post liked successfully on X"} (${artifactLabel}: ${postedArtifactId}).`
            : `${platform === "linkedin" ? "LinkedIn comment posted successfully" : "Reply posted successfully on X"} (${artifactLabel}: ${postedArtifactId}).`;
    } else if (task.status === "waiting_manual") {
      bridgeState = "waiting_manual_x_reply";
      message =
        "X blocked automatic posting for this reply. Open the target post and publish the prepared reply manually. ReacherX is monitoring X automatically and will continue this plan when the reply is detected.";
    } else if (task.status === "waiting_connection") {
      bridgeState = "waiting_linkedin_connection";
      message =
        "LinkedIn requires a connection before this DM can be sent. ReacherX is managing the connection request and will send the already-approved DM automatically after acceptance.";
    } else if (task.status === "failed") {
      if (failureClass === "reauth_required") {
        bridgeState = "failed_reauth";
        message =
          "Posting is blocked because X authentication expired. Reconnect your X account to resume.";
      } else if (failureClass === "scope_missing") {
        bridgeState = "failed_scope";
        message =
          "Posting is blocked because required X write permissions are missing. Reconnect with tweet.write and media.write to resume.";
      } else {
        bridgeState = "failed_other";
        const actionLabel =
          task.type === "dm"
            ? "DM"
            : task.type === "react"
              ? "Reaction"
              : "Reply";
        message = `${actionLabel} execution failed${task.errorMessage ? `: ${task.errorMessage}` : "."}`;
      }
    }

    if (!bridgeState || !message) {
      return { bridged: false, reason: "no_bridgeable_state" as const };
    }

    if (task.statusBridgeState === bridgeState) {
      return { bridged: false, reason: "already_bridged" as const };
    }

    await saveMessage(ctx, components.agent, {
      threadId: planData.plan.threadId,
      message: { role: "assistant", content: message },
      agentName: "Outreach Workflow",
    });

    await ctx.runMutation(internal.outreach.markTaskStatusBridgeSent, {
      taskId,
      statusBridgeState: bridgeState,
    });

    return { bridged: true, state: bridgeState };
  },
});

/**
 * Reconcile latest outreach task state after each outreach-agent stream completes.
 */
export const reconcileOutreachTaskStatusAfterStream = internalAction({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }): Promise<{ processed: number }> => {
    const threadContext = await ctx.runQuery(
      internal.prospectThreads.getThreadProspectContext,
      {
        threadId,
      }
    );
    if (!threadContext) {
      return { processed: 0 };
    }

    const active = await ctx.runQuery(
      internal.outreach.getProspectActivePlanInternal,
      {
        prospectId: threadContext.prospectId,
      }
    );
    if (!active) {
      return { processed: 0 };
    }

    const candidates = active.tasks
      .filter(
        (task: (typeof active.tasks)[number]) =>
          (task.type === "comment" || task.type === "react") &&
          (task.status === "waiting_response" ||
            task.status === "completed" ||
            task.status === "failed")
      )
      .sort(
        (a: (typeof active.tasks)[number], b: (typeof active.tasks)[number]) =>
          b.order - a.order
      );

    let processed = 0;
    for (const task of candidates) {
      const result = await ctx.runAction(
        internal.chat.bridgeOutreachTaskStatusToThread,
        {
          taskId: task._id,
        }
      );
      if (result.bridged) {
        processed += 1;
      }
    }

    return { processed };
  },
});

// ============================================================================
// Message Listing (for UI with Streaming)
// ============================================================================

/**
 * When the agent component has no thread doc (stale `threadId` in the URL,
 * dev DB reset, etc.), return an empty page matching `useUIMessages` /
 * `syncStreams` instead of throwing so the UI can recover.
 */
function emptyListThreadMessagesResult(streamArgs: StreamArgs | undefined) {
  const paginated = {
    page: [] as UIMessage[],
    isDone: true,
    continueCursor: "",
  };
  const streams =
    streamArgs === undefined
      ? undefined
      : streamArgs.kind === "list"
        ? { kind: "list" as const, messages: [] }
        : { kind: "deltas" as const, deltas: [] };
  return { ...paginated, streams };
}

async function attachAgentMessageContextMetadata(
  ctx: QueryCtx,
  messages: UIMessage[]
) {
  const contextRows = await Promise.all(
    messages
      .filter((message) => message.role === "user")
      .map(async (message) => {
        const context = await ctx.db
          .query("agentMessageContexts")
          .withIndex("by_message", (q) => q.eq("messageId", message.id))
          .first();
        return context ? [message.id, context] : null;
      })
  );

  const contextByMessageId = new Map(
    contextRows.filter(
      (entry): entry is [string, Doc<"agentMessageContexts">] => Boolean(entry)
    )
  );

  return messages.map((message) => {
    const context = contextByMessageId.get(message.id);
    if (!context) {
      return message;
    }

    return {
      ...message,
      metadata: {
        version: 1,
        promptTextSource: context.promptTextSource,
        taggedEntities: context.taggedEntities,
        attachments: context.attachments,
      },
    };
  });
}

/**
 * List messages in a thread with streaming support.
 * Per docs: https://docs.convex.dev/agents/streaming#retrieving-streamed-deltas
 *
 * This query is used by useUIMessages hook on the frontend.
 */
export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    // Required for streaming - per docs
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);

    // Verify user has access to this thread
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId: args.threadId,
    });

    if (!thread) {
      return emptyListThreadMessagesResult(args.streamArgs);
    }

    if (thread.userId !== user._id) {
      throw new Error("Not authorized to access this thread");
    }

    // `toUIMessages` intentionally omits model/provider fields. Preserve the
    // stored answer model per assistant order so each badge describes its own
    // response instead of falling back to the latest model in the thread.
    const [messageDocs, streams] = await Promise.all([
      listMessages(ctx, components.agent, args),
      syncStreams(ctx, components.agent, {
        ...args,
        // The Agent component saves the final message atomically with stream
        // completion. Returning finished streams creates a duplicate ghost row
        // until the component's delayed cleanup removes it.
        includeStatuses: ["streaming", "aborted"],
      }),
    ]);
    const modelByAssistantOrder = new Map<number, string>();
    for (const messageDoc of messageDocs.page) {
      if (
        messageDoc.message?.role === "assistant" &&
        typeof messageDoc.model === "string" &&
        messageDoc.model.trim()
      ) {
        modelByAssistantOrder.set(messageDoc.order, messageDoc.model);
      }
    }
    const pageWithModels = toUIMessages(messageDocs.page).map((message) => {
      if (message.role !== "assistant") {
        return message;
      }
      const model = modelByAssistantOrder.get(message.order);
      return model ? { ...message, model } : message;
    });
    const pageWithMetadata = await attachAgentMessageContextMetadata(
      ctx,
      pageWithModels
    );

    return { ...messageDocs, page: pageWithMetadata, streams };
  },
});

/**
 * Returns the current generation state for a thread so the UI can reconcile
 * stalled runs into a user-visible failure state.
 */
export const getThreadGenerationState = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }) => {
    const user = await requireViewerUser(ctx);

    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId,
    });
    if (!thread) {
      return null;
    }
    if (thread.userId !== user._id) {
      throw new Error("Not authorized");
    }

    const streams = await ctx.runQuery(components.agent.streams.list, {
      threadId,
      statuses: ["streaming", "aborted"],
    });

    const activeOrders = new Set(
      streams
        .filter((stream) => stream.status === "streaming")
        .map((stream) => stream.order)
    );
    const abortedOrders = new Set(
      streams
        .filter((stream) => stream.status === "aborted")
        .map((stream) => stream.order)
    );

    const pendingAssistantMessages = await listPendingAssistantMessages(
      ctx,
      threadId
    );
    const stalledMessage = pendingAssistantMessages.find(
      (message) =>
        abortedOrders.has(message.order) && !activeOrders.has(message.order)
    );

    if (stalledMessage) {
      return {
        status: "stalled" as const,
        order: stalledMessage.order,
      };
    }

    const now = getCurrentUTCTimestamp();
    const orphanedPendingMessage = pendingAssistantMessages.find(
      (message) =>
        !activeOrders.has(message.order) &&
        !abortedOrders.has(message.order) &&
        now - message._creationTime >= ORPHANED_PENDING_ASSISTANT_WINDOW_MS
    );

    if (orphanedPendingMessage) {
      return {
        status: "stalled" as const,
        order: orphanedPendingMessage.order,
      };
    }

    return {
      status: activeOrders.size > 0 ? ("running" as const) : ("idle" as const),
    };
  },
});

/**
 * Converts a stalled run into a failed assistant message with user-friendly copy.
 * This handles cases where the background Convex action timed out after the
 * stream itself was already marked aborted by the Agent component.
 */
export const reconcileThreadGenerationFailure = mutation({
  args: {
    threadId: v.string(),
    order: v.number(),
    errorMessage: v.optional(v.string()),
    userVisibleMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);

    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId: args.threadId,
    });
    if (!thread) {
      throw new Error("Thread not found");
    }
    if (thread.userId !== user._id) {
      throw new Error("Not authorized");
    }

    const activeStreams = await ctx.runQuery(components.agent.streams.list, {
      threadId: args.threadId,
      statuses: ["streaming"],
    });
    if (activeStreams.some((stream) => stream.order === args.order)) {
      return {
        resolved: false,
        reason: "still_streaming" as const,
      };
    }

    const finalized = await finalizePendingAssistantMessageForOrder(ctx, {
      threadId: args.threadId,
      order: args.order,
      errorMessage: args.errorMessage?.trim() || TIMED_OUT_ERROR_MESSAGE,
      userVisibleMessage:
        args.userVisibleMessage?.trim() || TIMED_OUT_VISIBLE_MESSAGE,
    });

    return finalized
      ? {
          resolved: true,
          order: args.order,
        }
      : {
          resolved: false,
          reason: "no_pending_message" as const,
        };
  },
});

export const finalizeWorkspaceAgentGenerationFailureInternal = internalMutation(
  {
    args: {
      threadId: v.string(),
      order: v.number(),
      errorMessage: v.string(),
    },
    handler: async (ctx, args) => {
      return await finalizePendingAssistantMessageForOrder(ctx, {
        threadId: args.threadId,
        order: args.order,
        errorMessage: args.errorMessage,
        userVisibleMessage: GENERATION_FAILED_VISIBLE_MESSAGE,
      });
    },
  }
);

// ============================================================================
// Message Sending (Streaming Pattern)
// ============================================================================

/**
 * Initiates a streaming message send.
 * Per docs: https://docs.convex.dev/agents/agent-usage#saving-the-prompt-then-generating-responses-asynchronously
 *
 * Benefits:
 * - Optimistic UI updates via mutations
 * - Message saved transactionally with other writes
 * - Can safely retry without duplicating prompt
 */
export const initiateStreamingMessage = mutation({
  args: {
    threadId: v.string(),
    prompt: v.string(),
    metadata: v.optional(agentMessageContextMetadataValidator),
    setupSourceUrl: v.optional(v.string()),
    expectedSurface: v.optional(v.literal("setup")),
  },
  handler: async (ctx, args) => {
    const trimmedPrompt = args.prompt.trim();
    const normalizedMetadata = normalizeAgentMessageContextMetadata(
      args.metadata
    );
    if (!trimmedPrompt && !normalizedMetadata) {
      throw new Error("Message cannot be empty.");
    }

    const user = await requireViewerUser(ctx);

    // Verify user has access to this thread
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId: args.threadId,
    });

    if (!thread) {
      throw new Error("Thread not found");
    }

    if (thread.userId !== user._id) {
      throw new Error("Not authorized to access this thread");
    }

    // Surface hints strengthen client intent validation, but server-owned
    // thread membership determines whether setup input must be captured. A
    // setup turn must never lose its raw description because one caller
    // omitted an optional UI hint.
    const setupSession = await ctx.runQuery(
      internal.setupSessions.getByThreadIdInternal,
      {
        threadId: args.threadId,
      }
    );
    if (args.expectedSurface === "setup") {
      if (!setupSession || setupSession.userId !== user._id) {
        throw new Error("This is not an active setup thread.");
      }
    }

    const workspaceThreadLink = await getWorkspaceThreadContextByThreadId(
      ctx.db,
      args.threadId
    );
    if (!thread.summary) {
      const threadSummary = trimmedPrompt.slice(0, 150);
      await ctx.runMutation(components.agent.threads.updateThread, {
        threadId: args.threadId,
        patch: { summary: threadSummary },
      });
      if (workspaceThreadLink) {
        await ctx.db.patch(workspaceThreadLink.link._id, {
          threadStatus: "active",
          threadSummary,
        });
      }
    }

    // Save the user's message first - per docs
    const { messageId, message } = await saveMessage(ctx, components.agent, {
      threadId: args.threadId,
      prompt: trimmedPrompt ? args.prompt : "",
    });
    await persistAgentMessageContext(ctx, {
      threadId: args.threadId,
      messageId,
      userId: user._id,
      metadata: normalizedMetadata,
    });

    // Keep the exact user-authored setup text before the setup agent can
    // transform it into tool arguments. The accepted submission copies this
    // verbatim value into both rawUserDescription and seedDescription.
    if (setupSession && trimmedPrompt) {
      await ctx.runMutation(
        internal.setupSessions.captureRawSetupInputFromChatInternal,
        {
          sessionId: setupSession._id,
          messageId,
          rawUserDescription: args.prompt,
        }
      );
    }

    // Schedule the streaming action
    await ctx.scheduler.runAfter(0, internal.chat.streamAgentResponse, {
      threadId: args.threadId,
      promptMessageId: messageId,
      setupSourceUrl: args.setupSourceUrl,
    });
    if (workspaceThreadLink) {
      await recordWorkspaceActivityWithDb(
        ctx,
        workspaceThreadLink.workspace._id
      );
    } else {
      const workspaceId = await getWorkspaceIdForSetupThread(
        ctx,
        args.threadId
      );
      if (workspaceId) {
        await recordWorkspaceActivityWithDb(ctx, workspaceId);
      }
    }

    return {
      messageId,
      order: message.order,
    };
  },
});

/**
 * Save the operator's visible XChat-analysis request without scheduling the
 * normal Agent path. The browser follows this with streamSharedXChatResponse,
 * whose decrypted context is deliberately not written to application tables.
 */
export const initiateSharedXChatAnalysis = mutation({
  args: {
    threadId: v.string(),
    prospectId: v.id("prospects"),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const prompt = args.prompt.trim();
    if (!prompt) {
      throw new Error("Message cannot be empty.");
    }

    const user = await requireViewerUser(ctx);
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId: args.threadId,
    });
    if (!thread || thread.userId !== user._id) {
      throw new Error("Thread not found or not authorized.");
    }

    const prospect = await requireOwnedProspect(ctx, args.prospectId, {
      user,
      notFoundMessage: "Prospect not found",
      notAuthorizedMessage: "Not authorized",
    });
    requireProspectNotArchived(prospect);
    const scope = await resolveAgentThreadScopeContext(ctx, args.threadId);
    if (
      scope.userId !== user._id ||
      scope.workspaceId !== prospect.workspaceId ||
      (scope.kind === "prospect" && scope.prospectId !== prospect._id) ||
      scope.kind === "setup"
    ) {
      throw new Error("The XChat conversation does not match this Agent task.");
    }

    const { messageId, message } = await saveMessage(ctx, components.agent, {
      threadId: args.threadId,
      prompt,
    });
    await persistAgentMessageContext(ctx, {
      threadId: args.threadId,
      messageId,
      userId: user._id,
      metadata: null,
    });

    return { messageId, order: message.order };
  },
});

/**
 * Stream one Agent response with browser-decrypted, explicitly shared XChat
 * text. The plaintext exists only in this action invocation and the model
 * request; it is excluded from ReacherX raw-model telemetry and message
 * context tables.
 */
export const streamSharedXChatResponse = action({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    context: xChatTransientContextValidator,
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    text: string;
    finishReason: string | null;
    pendingAskHuman?: boolean;
  } | void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const user = await ctx.runQuery(internal.users.getUserByWorkosIdInternal, {
      workosUserId: identity.subject,
    });
    if (!user) {
      throw new Error("User not found");
    }

    const [thread, prospect, scope, promptMessage]: [
      Awaited<ReturnType<typeof ctx.runQuery>>,
      Awaited<ReturnType<typeof ctx.runQuery>>,
      AgentThreadScopeContext,
      Awaited<ReturnType<typeof getThreadMessageById>>,
    ] = await Promise.all([
      ctx.runQuery(components.agent.threads.getThread, {
        threadId: args.threadId,
      }),
      ctx.runQuery(internal.prospects.getProspectInternal, {
        prospectId: args.context.prospectId,
      }),
      resolveAgentThreadScopeContext(ctx, args.threadId),
      getThreadMessageById(ctx, args.promptMessageId),
    ]);
    if (!thread || thread.userId !== user._id) {
      throw new Error("Thread not found or not authorized.");
    }
    if (!promptMessage || promptMessage.threadId !== args.threadId) {
      throw new Error("The XChat analysis message was not found.");
    }
    if (
      !prospect ||
      prospect.userId !== user._id ||
      prospect.workspaceId !== scope.workspaceId ||
      (scope.kind === "prospect" && scope.prospectId !== prospect._id) ||
      scope.kind === "setup"
    ) {
      throw new Error("The XChat conversation does not match this Agent task.");
    }

    const transientXChatContext = buildTransientXChatAgentContext(
      args.context as XChatTransientContext
    );
    return scope.kind === "prospect"
      ? await runStreamOutreachResponse(ctx, {
          threadId: args.threadId,
          promptMessageId: args.promptMessageId,
          transientXChatContext,
        })
      : await runStreamAgentResponse(ctx, {
          threadId: args.threadId,
          promptMessageId: args.promptMessageId,
          transientXChatContext,
        });
  },
});

/**
 * Aborts any active agent streams for a thread owned by the current user.
 * This powers the prompt-input "Stop generating" action in the chat UI.
 */
export const abortThreadStream = mutation({
  args: {
    threadId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { threadId, reason }) => {
    const user = await requireViewerUser(ctx);

    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId,
    });
    if (!thread) {
      throw new Error("Thread not found");
    }
    if (thread.userId !== user._id) {
      throw new Error("Not authorized");
    }

    const activeStreams = await ctx.runQuery(components.agent.streams.list, {
      threadId,
      statuses: ["streaming"],
    });

    let abortedCount = 0;
    const abortedOrders = new Set<number>();
    for (const stream of activeStreams) {
      const aborted = await ctx.runMutation(
        components.agent.streams.abortByOrder,
        {
          threadId,
          order: stream.order,
          reason: reason?.trim() || "Stopped by user",
        }
      );
      if (aborted) {
        abortedCount += 1;
        abortedOrders.add(stream.order);
      }
    }

    let finalizedCount = 0;
    for (const order of abortedOrders) {
      const finalized = await finalizePendingAssistantMessageForOrder(ctx, {
        threadId,
        order,
        errorMessage: reason?.trim() || USER_STOPPED_ERROR_MESSAGE,
        userVisibleMessage: USER_STOPPED_VISIBLE_MESSAGE,
      });

      if (finalized) {
        finalizedCount += 1;
      }
    }

    return {
      abortedCount,
      finalizedCount,
    };
  },
});

async function runStreamAgentResponse(
  ctx: ActionCtx,
  args: {
    threadId: string;
    promptMessageId: string;
    setupSourceUrl?: string;
    transientXChatContext?: string;
  }
): Promise<{ text: string; finishReason: string | null } | void> {
  try {
    const useCase = await resolveSetupUseCaseForThread(ctx, args.threadId);
    const surface = await resolveWorkspaceAgentSurface(ctx, args.threadId);
    if (args.transientXChatContext && surface !== "main") {
      throw new Error("XChat analysis is available only in the main Agent.");
    }
    const hiddenContext = await buildAgentTurnContextMessages(ctx, {
      threadId: args.threadId,
      promptMessageId: args.promptMessageId,
    });
    const mainMessages = args.transientXChatContext
      ? [
          ...hiddenContext.messages,
          { role: "system" as const, content: args.transientXChatContext },
        ]
      : hiddenContext.messages;
    const result =
      surface === "main"
        ? await streamMainTextWithRetry(ctx, {
            threadId: args.threadId,
            promptMessageId: args.promptMessageId,
            messages: mainMessages,
            model: hiddenContext.hasVisionInput
              ? workspaceVisionLanguageModel
              : undefined,
            system: buildMainAgentPrompt(useCase),
          })
        : await streamSetupTextWithRetry(ctx, {
            threadId: args.threadId,
            promptMessageId: args.promptMessageId,
            messages: args.setupSourceUrl
              ? [
                  ...hiddenContext.messages,
                  {
                    role: "system" as const,
                    content: `This setup turn came from the website URL ${args.setupSourceUrl}. Pass that exact URL as sourceUrl if you call submitSetupAudience.`,
                  },
                ]
              : hiddenContext.messages,
            model: hiddenContext.hasVisionInput
              ? workspaceVisionLanguageModel
              : undefined,
            system: buildSetupAgentPrompt(useCase),
          });

    // Browser-decrypted XChat text is intentionally current-turn-only. The
    // model necessarily receives it after explicit consent, but ReacherX does
    // not copy the raw model request/response into its telemetry table.
    if (!args.transientXChatContext) {
      await persistRawModelResponse(ctx, {
        threadId: args.threadId,
        agentName: surface === "main" ? "Main Agent" : "Setup Agent",
        request: result.request,
        response: result.response,
        providerMetadata: result.providerMetadata,
      });
    }

    return {
      text: await result.text,
      finishReason: await result.finishReason,
    };
  } catch (error) {
    const normalizedError = normalizeUnknownError(error);
    try {
      const promptMessage = await getThreadMessageById(
        ctx,
        args.promptMessageId
      );
      if (promptMessage) {
        const finalized: boolean = await ctx.runMutation(
          internal.chat.finalizeWorkspaceAgentGenerationFailureInternal,
          {
            threadId: args.threadId,
            order: promptMessage.order,
            errorMessage: stringifyUnknownError(normalizedError),
          }
        );
        if (!finalized) {
          chatLogger.warn(
            "Workspace agent stream failed without a pending assistant message",
            {
              threadId: args.threadId,
              promptMessageId: args.promptMessageId,
            }
          );
        }
      }
    } catch (finalizationError) {
      chatLogger.error(
        "Workspace agent stream failure could not be finalized",
        {
          threadId: args.threadId,
          promptMessageId: args.promptMessageId,
        },
        normalizeUnknownError(finalizationError)
      );
    }
    chatLogger.error(
      "Workspace agent stream error",
      {
        threadId: args.threadId,
        promptMessageId: args.promptMessageId,
      },
      normalizedError
    );
    throw normalizedError;
  }
}

/**
 * Internal action that streams the agent response.
 * Per docs: https://docs.convex.dev/agents/streaming#streaming-message-deltas
 *
 * Called asynchronously after the user message is saved.
 */
export const streamAgentResponse = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    setupSourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => await runStreamAgentResponse(ctx, args),
});

type PlanBatchAgentResponseContext = {
  runId: Id<"planBatchRuns">;
  threadId: string;
  promptMessageId?: string;
  responseStartedAt?: number;
  responseCompletedAt?: number;
  result: PlanBatchAgentResult;
};

async function hasDeferredPlanBatchToolResult(
  ctx: ActionCtx,
  args: {
    threadId: string;
    promptMessageId: string;
    runId: Id<"planBatchRuns">;
  }
) {
  const promptMessage = await getThreadMessageById(ctx, args.promptMessageId);
  if (!promptMessage) {
    return false;
  }

  const messages = await ctx.runQuery(
    components.agent.messages.listMessagesByThreadId,
    {
      threadId: args.threadId,
      order: "desc",
      paginationOpts: {
        numItems: RETRYABLE_AGENT_TURN_MESSAGE_WINDOW,
        cursor: null,
      },
    }
  );

  return messages.page.some((message) => {
    if (
      message.order !== promptMessage.order ||
      message.message?.role !== "tool"
    ) {
      return false;
    }

    return message.message.content.some((part) => {
      if (part.type !== "tool-result" || part.toolName !== "managePlanBatch") {
        return false;
      }

      return (
        getDeferredAgentExecution(part.output)?.continuationId ===
        String(args.runId)
      );
    });
  });
}

async function hasCompletedSuccessfulAssistantResponseSince(
  ctx: ActionCtx,
  args: {
    threadId: string;
    promptMessageId: string;
    startedAt: number;
  }
) {
  const promptMessage = await getThreadMessageById(ctx, args.promptMessageId);
  if (!promptMessage) {
    return false;
  }

  const messages = await ctx.runQuery(
    components.agent.messages.listMessagesByThreadId,
    {
      threadId: args.threadId,
      order: "desc",
      paginationOpts: {
        numItems: RETRYABLE_AGENT_TURN_MESSAGE_WINDOW,
        cursor: null,
      },
    }
  );

  return messages.page.some(
    (message) =>
      message.order === promptMessage.order &&
      message._creationTime >= args.startedAt &&
      message.message?.role === "assistant" &&
      message.status === "success" &&
      typeof message.text === "string" &&
      message.text.trim().length > 0
  );
}

export const resumePlanBatchAgentResponse = internalAction({
  args: { runId: v.id("planBatchRuns") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const responseContext = (await ctx.runQuery(
      internal.planBatches.getPlanBatchAgentResponseContextInternal,
      { runId }
    )) as PlanBatchAgentResponseContext | null;
    if (!responseContext?.promptMessageId) {
      return null;
    }
    if (responseContext.responseCompletedAt) {
      const hasSuccessfulResponse =
        await hasCompletedSuccessfulAssistantResponseSince(ctx, {
          threadId: responseContext.threadId,
          promptMessageId: responseContext.promptMessageId,
          startedAt: responseContext.responseStartedAt ?? 0,
        });
      if (hasSuccessfulResponse) {
        return null;
      }
      await ctx.runMutation(
        internal.planBatches.reopenPlanBatchAgentResponseInternal,
        {
          runId,
          errorMessage:
            "Completion marker had no successful assistant response.",
        }
      );
    }
    if (
      !(await hasDeferredPlanBatchToolResult(ctx, {
        threadId: responseContext.threadId,
        promptMessageId: responseContext.promptMessageId,
        runId,
      }))
    ) {
      throw new Error(
        "Deferred plan-batch tool result is not persisted yet; retrying."
      );
    }

    const claim = await ctx.runMutation(
      internal.planBatches.claimPlanBatchAgentResponseInternal,
      { runId }
    );
    if (!claim || !claim.shouldGenerate) {
      return null;
    }

    try {
      if (
        await hasCompletedSuccessfulAssistantResponseSince(ctx, {
          threadId: responseContext.threadId,
          promptMessageId: responseContext.promptMessageId,
          startedAt: claim.startedAt,
        })
      ) {
        await ctx.runMutation(
          internal.planBatches.completePlanBatchAgentResponseInternal,
          { runId }
        );
        return null;
      }

      const useCase = await resolveSetupUseCaseForThread(
        ctx,
        responseContext.threadId
      );
      const contextHandler = createPlanBatchAgentContinuationContextHandler({
        runId: String(runId),
        result: responseContext.result,
      });
      const attempts = [
        {
          model: undefined,
          modelId: OUTREACH_AGENT_MODEL,
        },
        {
          model: workspaceLanguageModel,
          modelId: PINNED_AGENT_MODEL,
        },
      ] satisfies Array<{
        model: LanguageModel | undefined;
        modelId: string;
      }>;
      let responseText = "";
      let responseFinishReason:
        | "stop"
        | "length"
        | "content-filter"
        | "tool-calls"
        | "error"
        | "other"
        | "unknown"
        | undefined;
      let responseModelId = attempts[0].modelId;
      let lastAttemptError: Error | null = null;

      for (const [attemptIndex, attempt] of attempts.entries()) {
        try {
          const result = await mainAgent.generateText(
            ctx,
            { threadId: responseContext.threadId },
            {
              promptMessageId: responseContext.promptMessageId,
              system: buildMainAgentPrompt(useCase),
              tools: {},
              ...(attempt.model ? { model: attempt.model } : {}),
            },
            {
              contextHandler,
              storageOptions: { saveMessages: "none" },
            }
          );

          await persistRawModelResponse(ctx, {
            threadId: responseContext.threadId,
            agentName: "Main Agent",
            request: result.request,
            response: result.response,
            providerMetadata: result.providerMetadata,
          });

          const text = result.text.trim();
          if (!text) {
            lastAttemptError = new Error(
              `Main Agent returned an empty plan-batch response using ${attempt.modelId}.`
            );
          } else {
            responseText = text;
            responseFinishReason = result.finishReason;
            responseModelId = attempt.modelId;
            break;
          }
        } catch (error) {
          lastAttemptError = normalizeUnknownError(error);
        }

        if (attemptIndex < attempts.length - 1) {
          chatLogger.warn(
            "Plan-batch Agent continuation produced no usable response; retrying once on the fallback model",
            {
              threadId: responseContext.threadId,
              promptMessageId: responseContext.promptMessageId,
              runId,
              model: attempt.modelId,
              errorMessage: lastAttemptError?.message,
            }
          );
        }
      }

      if (!responseText) {
        throw (
          lastAttemptError ??
          new Error("Main Agent returned an empty plan-batch response.")
        );
      }

      await saveMessage(ctx, components.agent, {
        threadId: responseContext.threadId,
        promptMessageId: responseContext.promptMessageId,
        agentName: "Main Agent",
        message: {
          role: "assistant",
          content: responseText,
        },
        metadata: {
          status: "success",
          finishReason: responseFinishReason,
          model: responseModelId,
          provider: "openrouter",
        },
      });
      await ctx.runMutation(
        internal.planBatches.completePlanBatchAgentResponseInternal,
        { runId }
      );
      return null;
    } catch (error) {
      const normalizedError = normalizeUnknownError(error);
      await ctx.runMutation(
        internal.planBatches.failPlanBatchAgentResponseInternal,
        {
          runId,
          errorMessage: normalizedError.message,
        }
      );
      throw normalizedError;
    }
  },
});

/**
 * Internal action that triggers the agent to send an initial greeting.
 * Called when a new thread is created.
 *
 * The agent will call getUserStatus first (per system prompt) to determine
 * the appropriate greeting based on user state.
 */
export const triggerAgentGreeting = internalAction({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const surface = await resolveWorkspaceAgentSurface(ctx, args.threadId);
      if (surface === "main") {
        return {
          text: "",
          finishReason: "stop",
        };
      }

      const useCase = await resolveSetupUseCaseForThread(ctx, args.threadId);
      // Use a special init prompt to trigger the agent greeting
      // This prompt is filtered out in the UI (see useAgentChat.ts)
      // The agent's system prompt instructs it to call getUserStatus first
      const result = await runSetupStreamText(ctx, {
        threadId: args.threadId,
        prompt: "__INIT__",
        system: buildSetupAgentPrompt(useCase),
      });

      await result.consumeStream();
      await persistRawModelResponse(ctx, {
        threadId: args.threadId,
        agentName: "Setup Agent",
        request: result.request,
        response: result.response,
        providerMetadata: result.providerMetadata,
      });

      return {
        text: await result.text,
        finishReason: await result.finishReason,
      };
    } catch (error) {
      const normalizedError = normalizeUnknownError(error);
      chatLogger.error(
        "Agent greeting error",
        { threadId: args.threadId },
        normalizedError
      );
      throw normalizedError;
    }
  },
});

// ============================================================================
// Non-Streaming Fallback
// ============================================================================

/**
 * Sends a message to the agent and gets a response (non-streaming).
 * Per docs: https://docs.convex.dev/agents/agent-usage#basic-approach-synchronous
 *
 * Use this as a fallback when streaming isn't needed.
 */
export const sendMessage = action({
  args: {
    threadId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const trimmedMessage = args.message.trim();
    if (!trimmedMessage) {
      throw new Error("Message cannot be empty.");
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify user owns/has access to this thread
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId: args.threadId,
    });

    if (!thread) {
      throw new Error("Thread not found");
    }

    // Get the authenticated user to compare IDs
    const user = await ctx.runQuery(internal.users.getUserByWorkosIdInternal, {
      workosUserId: identity.subject,
    });

    if (!user || thread.userId !== user._id) {
      throw new Error("Not authorized to access this thread");
    }

    const workspaceThreadContext = await ctx.runQuery(
      internal.workspaceThreads.getThreadWorkspaceContext,
      {
        threadId: args.threadId,
      }
    );
    if (!thread.summary) {
      const threadSummary = trimmedMessage.slice(0, 150);
      await ctx.runMutation(components.agent.threads.updateThread, {
        threadId: args.threadId,
        patch: { summary: threadSummary },
      });
      if (workspaceThreadContext) {
        await ctx.runMutation(internal.workspaceThreads.ensureThreadLink, {
          workspaceId: workspaceThreadContext.workspaceId,
          threadId: args.threadId,
          userId: user._id,
          threadStatus: "active",
          threadSummary,
        });
      }
    }

    const surface = await resolveWorkspaceAgentSurface(ctx, args.threadId);
    const useCase = await resolveSetupUseCaseForThread(ctx, args.threadId);
    const result =
      surface === "main"
        ? await mainAgent.generateText(
            ctx,
            { threadId: args.threadId },
            { prompt: trimmedMessage, system: buildMainAgentPrompt(useCase) }
          )
        : await setupAgent.generateText(
            ctx,
            { threadId: args.threadId },
            { prompt: trimmedMessage, system: buildSetupAgentPrompt(useCase) }
          );
    await persistRawModelResponse(ctx, {
      userId: user._id,
      threadId: args.threadId,
      agentName: surface === "main" ? "Main Agent" : "Setup Agent",
      request: result.request,
      response: result.response,
      providerMetadata: result.providerMetadata,
    });
    if (workspaceThreadContext) {
      await ctx.runMutation(
        internal.workspaces.recordWorkspaceActivityInternal,
        {
          workspaceId: workspaceThreadContext.workspaceId,
        }
      );
    } else {
      const workspaceId = await getWorkspaceIdForSetupThread(
        ctx,
        args.threadId
      );
      if (!workspaceId) {
        return {
          text: result.text,
          finishReason: result.finishReason,
        };
      }
      await ctx.runMutation(
        internal.workspaces.recordWorkspaceActivityInternal,
        {
          workspaceId,
        }
      );
    }

    return {
      text: result.text,
      finishReason: result.finishReason,
    };
  },
});

// ============================================================================
// askHuman Support
// ============================================================================

/**
 * Create notification for askHuman tool call (internal).
 * Called when outreach agent uses askHuman during chat.
 */
export const createAskHumanNotification = internalMutation({
  args: {
    threadId: v.string(),
    toolCallId: v.string(),
    question: v.string(),
    context: v.optional(v.string()),
    urgency: v.optional(urgencyLevelValidator),
    options: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Get thread to find user and prospect
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId: args.threadId,
    });

    if (!thread) {
      throw new Error("Thread not found");
    }

    // Validate userId exists (Agent component types it as optional)
    if (!thread.userId) {
      chatLogger.warn(
        "Cannot create askHuman notification because thread has no userId",
        { threadId: args.threadId }
      );
      return;
    }
    const userId = thread.userId as Id<"users">;

    const threadContext = await getProspectThreadContextByThreadId(
      ctx.db,
      args.threadId
    );
    const prospectId = threadContext?.link.prospectId;
    const prospect = threadContext?.prospect;

    // Fetch prospect for display fields and workspace scoping
    let prospectWorkspaceId: Id<"workspaces"> | undefined;
    let prospectDisplayFields = {
      prospectAvatarUrl: undefined as string | undefined,
      prospectDisplayName: undefined as string | undefined,
      prospectType: undefined as
        | "individual"
        | "organization"
        | "unknown"
        | undefined,
      prospectPlatform: undefined as "twitter" | "linkedin" | undefined,
      prospectScreenName: undefined as string | undefined,
    };
    if (prospect) {
      prospectDisplayFields = getProspectDisplayFields(prospect);
      prospectWorkspaceId = prospect.workspaceId;
    }

    // Prefer prospect workspace for strict notification scoping.
    let workspaceId: Id<"workspaces"> | undefined = prospectWorkspaceId;
    if (!workspaceId) {
      const fallbackWorkspace = await getDefaultWorkspaceForUser(ctx, userId);
      workspaceId = fallbackWorkspace?._id;
    }

    // Create notification (workspaceId may be undefined if user has no workspace)
    if (!workspaceId) {
      chatLogger.warn(
        "Cannot create askHuman notification because no workspace was found",
        { threadId: args.threadId, userId: String(userId) }
      );
      return;
    }

    // Build message with context if provided
    let message = args.question;
    if (args.context) {
      message = `${args.question}\n\nContext: ${args.context}`;
    }
    if (args.options && args.options.length > 0) {
      message += `\n\nOptions: ${args.options.join(", ")}`;
    }

    const workspace = await ctx.db.get(workspaceId);
    const useCase = getWorkspaceUseCase(workspace?.useCaseKey);

    // Dynamic title with name at the end for natural reading
    const name =
      prospectDisplayFields.prospectDisplayName ||
      useCase.entitySingular.toLowerCase();
    const title = `Agent needs your input for ${name}`;

    await createNotification(ctx, {
      userId,
      workspaceId,
      type: "ask_human",
      title,
      message,
      prospectId,
      threadId: args.threadId,
      toolCallId: args.toolCallId,
      ...prospectDisplayFields,
    });
  },
});

/**
 * Respond to an askHuman tool call.
 * Called when user provides input for a pending askHuman request.
 */
export const respondToAskHuman = internalAction({
  args: {
    threadId: v.string(),
    toolCallId: v.string(),
    response: v.string(),
    notificationId: v.optional(v.id("outreachNotifications")),
  },
  handler: async (ctx, args) => {
    if (!args.response.trim()) {
      throw new Error("Response cannot be empty.");
    }
    // Save tool result message per human-agents.md docs
    await saveMessage(ctx, components.agent, {
      threadId: args.threadId,
      agentName: "User",
      message: {
        role: "tool",
        content: [
          {
            type: "tool-result",
            result: args.response,
            toolCallId: args.toolCallId,
            toolName: "askHuman",
          },
        ],
      },
    });

    // Mark notification as seen if provided
    if (args.notificationId) {
      await ctx.runMutation(internal.chat.markNotificationSeen, {
        notificationId: args.notificationId,
      });
    }

    // Continue agent generation with the tool result
    const useCase = await resolveOutreachUseCaseForThread(ctx, args.threadId);
    const tools = await getOutreachToolsForThread(ctx, args.threadId);

    const result = await streamOutreachTextWithFallback(ctx, {
      threadId: args.threadId,
      system: buildOutreachAgentPrompt(useCase),
      tools,
      model: createOutreachThreadLanguageModel(args.threadId),
      preferHistorySearch: true,
    });

    await persistRawModelResponse(ctx, {
      threadId: args.threadId,
      agentName: "Outreach Agent",
      request: result.request,
      response: result.response,
      providerMetadata: result.providerMetadata,
    });

    return {
      text: await result.text,
      finishReason: await result.finishReason,
    };
  },
});

/**
 * Mark notification as seen (internal).
 */
export const markNotificationSeen = internalMutation({
  args: {
    notificationId: v.id("outreachNotifications"),
  },
  handler: async (ctx, { notificationId }) => {
    await ctx.db.patch(notificationId, {
      status: "seen",
    });
  },
});

// ============================================================================
// Vector Search for Thread History
// ============================================================================

/**
 * Extracts a preview snippet centered around the matching text.
 * Used by searchProspectMessages to show relevant context in thread cards.
 *
 * @param content - Full message content
 * @param query - Search query to find
 * @param maxLength - Maximum preview length (default 150)
 * @returns Preview string with ellipsis if truncated
 */
function extractMatchPreview(
  content: string,
  query: string,
  maxLength: number = 150
): string {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerContent.indexOf(lowerQuery);

  if (matchIndex === -1) {
    // Fallback: no exact match found (likely vector search semantic match)
    return (
      content.slice(0, maxLength) + (content.length > maxLength ? "..." : "")
    );
  }

  // Calculate context to show around the match
  const queryLength = query.length;
  const contextSize = Math.floor((maxLength - queryLength) / 2);
  const start = Math.max(0, matchIndex - contextSize);
  const end = Math.min(content.length, matchIndex + queryLength + contextSize);

  let preview = content.slice(start, end);
  if (start > 0) preview = "..." + preview;
  if (end < content.length) preview = preview + "...";

  return preview;
}

function extractFetchedContextMessageText(content: unknown): string {
  const messageContent =
    content && typeof content === "object" && "content" in content
      ? (content as { content?: unknown }).content
      : undefined;
  if (typeof messageContent === "string") {
    return messageContent;
  }
  if (Array.isArray(messageContent)) {
    return messageContent
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object" && "text" in part) {
          return String(part.text ?? "");
        }
        return "";
      })
      .join(" ");
  }
  return "";
}

/**
 * Search messages in prospect threads using hybrid text + vector search.
 * Uses agent's built-in search capabilities per docs/convex/llm-context.md.
 *
 * Returns matching threads with preview of matched content.
 */
export const searchProspectMessages = action({
  args: {
    prospectId: v.id("prospects"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(internal.users.getUserByWorkosIdInternal, {
      workosUserId: identity.subject,
    });
    if (!user) throw new Error("User not found");

    const prospect = await ctx.runQuery(
      internal.prospects.getProspectInternal,
      {
        prospectId: args.prospectId,
      }
    );
    if (!prospect || prospect.userId !== user._id) {
      throw new Error("Prospect not found");
    }

    const threadLinks = await ctx.runQuery(
      internal.prospectThreads.listThreadLinksForProspect,
      {
        prospectId: args.prospectId,
      }
    );
    const prospectThreads = threadLinks
      .filter(
        (threadLink: (typeof threadLinks)[number]) =>
          threadLink.userId === user._id
      )
      .filter(
        (threadLink: (typeof threadLinks)[number]) =>
          normalizeThreadHistoryStatus(threadLink.threadStatus) === "active"
      )
      .map((threadLink: (typeof threadLinks)[number]) => ({
        _id: threadLink.threadId,
        _creationTime: threadLink._creationTime,
        status: normalizeThreadHistoryStatus(threadLink.threadStatus),
      }));

    if (prospectThreads.length === 0) {
      return { threads: [] };
    }

    // Search type for results
    type SearchResult = {
      threadId: string;
      thread: (typeof prospectThreads)[0];
      matchPreview: string;
      matchCount: number;
    };

    const results: SearchResult[] = [];

    // Search messages in each thread using agent's fetchContextMessages
    for (const thread of prospectThreads) {
      try {
        const messages = await outreachAgent.fetchContextMessages(ctx, {
          userId: user._id,
          threadId: thread._id,
          searchText: args.query,
          contextOptions: {
            recentMessages: 0, // Only search results, no recent
            searchOptions: {
              limit: args.limit ?? 10, // Increased limit for better recall
              textSearch: true, // Text search for keyword matching
              vectorSearch: true, // Vector search for semantic similarity
            },
          },
        });

        if (messages.length > 0) {
          // Find message containing the exact query (case-insensitive)
          // Both text search and vector search may return semantically similar
          // but not exact matches - we only want to show threads where the
          // query substring actually exists.
          const lowerQuery = args.query.toLowerCase();
          let matchedText = "";
          for (const msg of messages) {
            const text = extractFetchedContextMessageText(msg.message);
            if (text.toLowerCase().includes(lowerQuery)) {
              matchedText = text;
              break;
            }
          }

          // Only include thread if we found an exact match
          // This ensures "No matching threads" is shown when query isn't found
          if (matchedText) {
            const matchPreview = extractMatchPreview(matchedText, args.query);
            results.push({
              threadId: thread._id,
              thread,
              matchPreview,
              matchCount: messages.length,
            });
          }
        }
      } catch (error) {
        // Log but continue with other threads
        chatLogger.warn(
          "Thread history search failed",
          {
            prospectId: String(args.prospectId),
            threadId: thread._id,
          },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }

    // Sort by number of matches (threads with more matches first)
    results.sort((a, b) => b.matchCount - a.matchCount);

    return { threads: results };
  },
});

export const searchWorkspaceMessages = action({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.runQuery(internal.users.getUserByWorkosIdInternal, {
      workosUserId: identity.subject,
    });
    if (!user) {
      throw new Error("User not found");
    }

    const workspace = args.workspaceId
      ? await ctx.runQuery(internal.workspaces.getById, {
          workspaceId: args.workspaceId,
        })
      : await ctx.runQuery(internal.workspaces.getDefaultWorkspaceInternal, {
          userId: user._id,
        });
    if (!workspace || workspace.userId !== user._id) {
      throw new Error("Workspace not found");
    }

    const threadLinks = await ctx.runQuery(
      internal.workspaceThreads.listThreadLinksForWorkspace,
      {
        workspaceId: workspace._id,
      }
    );
    const workspaceThreads = threadLinks
      .filter((threadLink: (typeof threadLinks)[number]) => {
        return threadLink.userId === user._id;
      })
      .filter((threadLink: (typeof threadLinks)[number]) => {
        return (
          normalizeThreadHistoryStatus(threadLink.threadStatus) === "active"
        );
      })
      .map((threadLink: (typeof threadLinks)[number]) => ({
        _id: threadLink.threadId,
        _creationTime: threadLink._creationTime,
        status: normalizeThreadHistoryStatus(threadLink.threadStatus),
      }));
    const linkedThreadIds = new Set(
      workspaceThreads.map(
        (thread: (typeof workspaceThreads)[number]) => thread._id
      )
    );
    const legacyThreads = await listLegacyWorkspaceThreadsByTitle(ctx, {
      userId: user._id,
      workspaceId: workspace._id,
      limit: 50,
    });
    const mergedWorkspaceThreads = [
      ...workspaceThreads,
      ...legacyThreads
        .filter((thread) => !linkedThreadIds.has(thread._id))
        .filter(
          (thread) => normalizeThreadHistoryStatus(thread.status) === "active"
        )
        .map((thread) => ({
          _id: thread._id,
          _creationTime: thread._creationTime,
          status: normalizeThreadHistoryStatus(thread.status),
        })),
    ];

    if (mergedWorkspaceThreads.length === 0) {
      return { threads: [] };
    }

    type SearchResult = {
      threadId: string;
      thread: (typeof mergedWorkspaceThreads)[0];
      matchPreview: string;
      matchCount: number;
    };

    const results: SearchResult[] = [];

    for (const thread of mergedWorkspaceThreads) {
      try {
        const messages = await mainAgent.fetchContextMessages(ctx, {
          userId: user._id,
          threadId: thread._id,
          searchText: args.query,
          contextOptions: {
            recentMessages: 0,
            searchOptions: {
              limit: args.limit ?? 10,
              textSearch: true,
              // Results are filtered to exact substring matches below. Avoid
              // generating the same query embedding once for every thread.
              vectorSearch: false,
            },
          },
        });

        if (messages.length === 0) {
          continue;
        }

        const lowerQuery = args.query.toLowerCase();
        let matchedText = "";
        for (const msg of messages) {
          const text = extractFetchedContextMessageText(msg.message);
          if (text.toLowerCase().includes(lowerQuery)) {
            matchedText = text;
            break;
          }
        }

        if (matchedText) {
          results.push({
            threadId: thread._id,
            thread,
            matchPreview: extractMatchPreview(matchedText, args.query),
            matchCount: messages.length,
          });
        }
      } catch (error) {
        chatLogger.warn(
          "Workspace thread history search failed",
          {
            workspaceId: String(workspace._id),
            threadId: thread._id,
          },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }

    results.sort((a, b) => b.matchCount - a.matchCount);

    return { threads: results };
  },
});
