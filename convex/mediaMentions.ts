import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { query } from "./lib/functionBuilders";
import {
  getDefaultWorkspaceForUser,
  getOwnedProspect,
  getOwnedWorkspace,
  getUserByIdentity,
} from "./lib/accessHelpers";
import { isProspectReadyQualifiedEnriched } from "./lib/prospectAnalyticsCore";
import { getProspectIdentitySnapshot } from "./lib/prospectIdentityCore";
import {
  buildLinkedInCommentMentionEntity,
  buildPostMentionEntity,
  buildTwitterReplyMentionEntity,
} from "../shared/lib/mentions/postMentions";
import type {
  MentionEntityKind,
  MentionEntitySearchResult,
} from "../shared/lib/mentions/mentionEntities";
import {
  mentionEntityKindValidator,
  workspaceAttachmentDestinationValidator,
} from "./validators";
import {
  getWorkspaceAttachmentCompatibility,
  getWorkspaceAttachmentKind,
} from "./lib/workspaceAttachmentCore";

const ACTIVE_PLAN_STATUSES = [
  "draft",
  "approved",
  "executing",
  "paused",
  "blocked_auth",
] as const;

const MIN_PROSPECT_CANDIDATE_LIMIT = 48;

type MentionableProspectSnapshot = {
  prospectId: Id<"prospects">;
  workspaceId: Id<"workspaces">;
  origin: Doc<"prospects">["origin"];
  label: string;
  secondaryLabel: string;
  mentionText: string;
  avatarUrl: string | null;
  verified: boolean;
  handle: string | null;
  readyQualifiedEnriched: boolean;
};

function getStatusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function normalizeQueryValue(value: string) {
  return value.trim().toLowerCase();
}

function formatProspectSecondaryLabel(handle: string) {
  return handle.startsWith("@") ? handle : `@${handle}`;
}

function getProspectSummarySecondaryLabel(
  summary: Pick<
    Doc<"prospectSummaries">,
    "twitterUsername" | "linkedInUsername" | "conversationPlaceholderLabel"
  >
) {
  if (summary.twitterUsername?.trim()) {
    return formatProspectSecondaryLabel(summary.twitterUsername.trim());
  }
  if (summary.linkedInUsername?.trim()) {
    return formatProspectSecondaryLabel(summary.linkedInUsername.trim());
  }
  const placeholder = summary.conversationPlaceholderLabel.trim();
  return placeholder.length > 0 ? placeholder : "Prospect";
}

function buildProspectSnapshotFromSummary(
  summary: Doc<"prospectSummaries">
): MentionableProspectSnapshot {
  return {
    prospectId: summary.prospectId,
    workspaceId: summary.workspaceId,
    origin: summary.origin,
    label: summary.displayName,
    secondaryLabel: getProspectSummarySecondaryLabel(summary),
    mentionText: summary.displayName,
    avatarUrl: summary.avatarUrl ?? null,
    verified: summary.verified,
    handle:
      summary.twitterUsername?.trim() ??
      summary.linkedInUsername?.trim() ??
      null,
    readyQualifiedEnriched: summary.readyQualifiedEnriched,
  };
}

function buildProspectSnapshotFromProspect(
  prospect: Pick<
    Doc<"prospects">,
    | "_id"
    | "workspaceId"
    | "origin"
    | "displayName"
    | "title"
    | "data"
    | "platform"
    | "prospectType"
    | "socialProfiles"
    | "qualificationStatus"
    | "enrichmentStatus"
  >
): MentionableProspectSnapshot {
  const identity = getProspectIdentitySnapshot(prospect);
  const label =
    identity.displayName ??
    prospect.title?.trim() ??
    identity.preferredLabel ??
    "Prospect";
  const handle = identity.screenName ?? null;

  return {
    prospectId: prospect._id,
    workspaceId: prospect.workspaceId,
    origin: prospect.origin,
    label,
    secondaryLabel: handle ? formatProspectSecondaryLabel(handle) : "Prospect",
    mentionText: label,
    avatarUrl: identity.avatarUrl ?? null,
    verified: identity.verified,
    handle,
    readyQualifiedEnriched: isProspectReadyQualifiedEnriched(prospect),
  };
}

function collectProspectCandidatePosts(
  prospect: Pick<
    Doc<"prospects">,
    "_id" | "workspaceId" | "data" | "evidencePosts" | "painPoints" | "finance"
  >
) {
  const candidates: unknown[] = [];

  if (prospect.data) {
    candidates.push(prospect.data);
  }
  if (Array.isArray(prospect.evidencePosts)) {
    candidates.push(...prospect.evidencePosts);
  }
  if (Array.isArray(prospect.painPoints)) {
    for (const painPoint of prospect.painPoints) {
      if (Array.isArray(painPoint?.evidencePosts)) {
        candidates.push(...painPoint.evidencePosts);
      }
    }
  }
  if (Array.isArray(prospect.finance?.evidencePosts)) {
    candidates.push(...prospect.finance.evidencePosts);
  }

  return candidates;
}

function collectProspectInteractionMentionEntities(args: {
  interactions: Array<
    Pick<
      Doc<"prospectInteractions">,
      | "platform"
      | "interactionType"
      | "sourcePostId"
      | "threadId"
      | "replyPostId"
      | "sourcePostRef"
      | "sourcePostSummary"
      | "replyPostRef"
      | "replyPostSummary"
      | "sourcePostData"
      | "sourceUrl"
      | "replyText"
    >
  >;
  workspaceId: string;
  prospectId: string;
}) {
  const entities: MentionEntitySearchResult[] = [];

  for (const interaction of args.interactions) {
    if (interaction.platform === "twitter") {
      const sourceEntity = buildPostMentionEntity({
        post: interaction.sourcePostSummary ?? interaction.sourcePostRef,
        platformHint: "twitter",
        workspaceId: args.workspaceId,
        prospectId: args.prospectId,
      });
      if (sourceEntity) {
        entities.push(sourceEntity);
      }

      const replyEntity = buildTwitterReplyMentionEntity({
        post: interaction.replyPostSummary ?? interaction.replyPostRef,
        workspaceId: args.workspaceId,
        prospectId: args.prospectId,
      });
      if (replyEntity) {
        entities.push(replyEntity);
      }

      continue;
    }

    const sourceEntity = buildPostMentionEntity({
      post: interaction.sourcePostData,
      platformHint: "linkedin",
      workspaceId: args.workspaceId,
      prospectId: args.prospectId,
    });
    if (sourceEntity) {
      entities.push(sourceEntity);
    }

    if (!interaction.replyPostId && !interaction.replyText?.trim()) {
      continue;
    }

    const replyEntity = buildLinkedInCommentMentionEntity({
      comment: {
        id:
          interaction.replyPostId ||
          `${interaction.sourcePostId}:comment:${interaction.threadId}`,
        postId: interaction.sourcePostId,
        threadId: interaction.threadId,
        parentCommentId:
          interaction.interactionType === "comment_reply_posted"
            ? interaction.threadId
            : undefined,
        text: interaction.replyText ?? "",
        reactionCount: 0,
        replyCount: 0,
        author: {
          name: "You",
        },
        canReply: false,
        canReact: false,
        source: "preview",
      },
      sourcePostUrl: interaction.sourceUrl ?? undefined,
      workspaceId: args.workspaceId,
      prospectId: args.prospectId,
    });
    if (replyEntity) {
      entities.push(replyEntity);
    }
  }

  return entities;
}

async function getProspectSnapshotById(
  db: QueryCtx["db"],
  args: {
    prospectId: Id<"prospects">;
    workspaceId: Id<"workspaces">;
  }
) {
  const summary = await db
    .query("prospectSummaries")
    .withIndex("by_prospect", (q) => q.eq("prospectId", args.prospectId))
    .first();

  if (
    summary &&
    summary.workspaceId === args.workspaceId &&
    summary.origin !== "setup_preview"
  ) {
    return buildProspectSnapshotFromSummary(summary);
  }

  const prospect = await db.get(args.prospectId);
  if (!prospect || prospect.workspaceId !== args.workspaceId) {
    return null;
  }

  return buildProspectSnapshotFromProspect(prospect);
}

function scoreMatch(haystack: string, query: string) {
  if (!query) {
    return 1;
  }

  const normalizedHaystack = normalizeQueryValue(haystack);
  if (!normalizedHaystack) {
    return 0;
  }
  if (normalizedHaystack === query) {
    return 120;
  }
  if (normalizedHaystack.startsWith(query)) {
    return 80;
  }
  const index = normalizedHaystack.indexOf(query);
  if (index === -1) {
    return 0;
  }
  return Math.max(24, 60 - index);
}

export const searchMentionEntities = query({
  args: {
    query: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    prospectId: v.optional(v.id("prospects")),
    limit: v.optional(v.number()),
    allowedKinds: v.optional(v.array(mentionEntityKindValidator)),
    attachmentDestination: v.optional(workspaceAttachmentDestinationValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await getUserByIdentity(ctx, identity);
    if (!user) {
      return [];
    }

    const workspace = args.workspaceId
      ? await getOwnedWorkspace(ctx, args.workspaceId, user._id)
      : await getDefaultWorkspaceForUser(ctx, user._id);
    if (!workspace) {
      return [];
    }

    const scopedProspect = args.prospectId
      ? await getOwnedProspect(ctx, args.prospectId, user._id)
      : null;
    if (
      args.prospectId &&
      (!scopedProspect || scopedProspect.workspaceId !== workspace._id)
    ) {
      return [];
    }

    const normalizedQuery = normalizeQueryValue(args.query);
    const resultLimit = Math.max(1, Math.min(12, args.limit ?? 8));
    const prospectCandidateLimit = Math.max(
      resultLimit * 6,
      MIN_PROSPECT_CANDIDATE_LIMIT
    );
    const allowedKinds = new Set<MentionEntityKind>(
      args.allowedKinds ?? ["prospect", "plan", "task", "attachment", "post"]
    );
    const shouldIncludeProspects = allowedKinds.has("prospect");
    const shouldIncludePlans = allowedKinds.has("plan");
    const shouldIncludeTasks = allowedKinds.has("task");
    const shouldIncludeAttachments = allowedKinds.has("attachment");
    const shouldIncludePosts = allowedKinds.has("post");
    const shouldLoadProspectSnapshots =
      shouldIncludeProspects || shouldIncludePlans || shouldIncludeTasks;

    let prospects: MentionableProspectSnapshot[] = [];

    if (!shouldLoadProspectSnapshots) {
      prospects = [];
    } else if (scopedProspect) {
      const scopedSnapshot = await getProspectSnapshotById(ctx.db, {
        prospectId: scopedProspect._id,
        workspaceId: workspace._id,
      });
      prospects =
        scopedSnapshot?.origin !== "setup_preview" &&
        scopedSnapshot?.readyQualifiedEnriched
          ? [scopedSnapshot]
          : [];
    } else if (normalizedQuery) {
      const summaryRows = await ctx.db
        .query("prospectSummaries")
        .withSearchIndex("search_prospect_summaries", (q) =>
          q
            .search("searchText", normalizedQuery)
            .eq("workspaceId", workspace._id)
            .eq("readyQualifiedEnriched", true)
        )
        .take(prospectCandidateLimit * 2);

      prospects = summaryRows
        .filter((summary) => summary.origin !== "setup_preview")
        .slice(0, prospectCandidateLimit)
        .map(buildProspectSnapshotFromSummary);
    } else {
      const summaryRows = await ctx.db
        .query("prospectSummaries")
        .withIndex("by_workspace_ready_score", (q) =>
          q.eq("workspaceId", workspace._id).eq("readyQualifiedEnriched", true)
        )
        .order("desc")
        .take(prospectCandidateLimit * 2);

      prospects = summaryRows
        .filter((summary) => summary.origin !== "setup_preview")
        .slice(0, prospectCandidateLimit)
        .map(buildProspectSnapshotFromSummary);
    }

    const uploads = !shouldIncludeAttachments
      ? []
      : normalizedQuery
        ? await ctx.db
            .query("mediaUploads")
            .withSearchIndex("search_workspace_attachments", (q) =>
              q
                .search("searchText", normalizedQuery)
                .eq("workspaceId", workspace._id)
                .eq("userId", user._id)
            )
            .take(Math.max(resultLimit * 3, 12))
        : await ctx.db
            .query("mediaUploads")
            .withIndex("by_workspace_and_user_and_uploaded_at", (q) =>
              q.eq("workspaceId", workspace._id).eq("userId", user._id)
            )
            .order("desc")
            .take(Math.max(resultLimit * 3, 12));

    const plans =
      shouldIncludePlans || shouldIncludeTasks
        ? scopedProspect
          ? await ctx.db
              .query("outreachPlans")
              .withIndex("by_prospect", (q) =>
                q.eq("prospectId", scopedProspect._id)
              )
              .order("desc")
              .take(8)
          : (
              await Promise.all(
                ACTIVE_PLAN_STATUSES.map((status) =>
                  ctx.db
                    .query("outreachPlans")
                    .withIndex("by_workspace_status", (q) =>
                      q.eq("workspaceId", workspace._id).eq("status", status)
                    )
                    .take(6)
                )
              )
            )
              .flat()
              .sort((left, right) => right.updatedAt - left.updatedAt)
              .slice(0, 12)
        : [];
    const interactions =
      shouldIncludePosts && scopedProspect
        ? await ctx.db
            .query("prospectInteractions")
            .withIndex("by_user_prospect_replied", (q) =>
              q.eq("userId", user._id).eq("prospectId", scopedProspect._id)
            )
            .order("desc")
            .take(24)
        : [];

    const prospectById = new Map(
      prospects.map(
        (prospect) => [String(prospect.prospectId), prospect] as const
      )
    );

    const uploadMentionEntities = await Promise.all(
      uploads.map(async (upload) => {
        const displayName = upload.displayName ?? upload.fileName;
        const attachmentUrl = await ctx.storage.getUrl(upload.storageId);
        const attachmentMediaKind = getWorkspaceAttachmentKind(upload);
        const compatibility = args.attachmentDestination
          ? getWorkspaceAttachmentCompatibility({
              attachment: upload,
              destination: args.attachmentDestination,
            })
          : null;
        return {
          id: `attachment:${String(upload._id)}`,
          entityId: String(upload._id),
          kind: "attachment" as const,
          label: displayName,
          mentionText: `Attachment: ${displayName}`,
          secondaryLabel: "Workspace attachment",
          avatarUrl: null,
          verified: false,
          referenceText: `Attachment: ${displayName}`,
          workspaceId: String(workspace._id),
          attachmentUrl,
          attachmentMimeType: upload.mimeType,
          attachmentSize: upload.size,
          attachmentMediaKind,
          attachmentDisabled: compatibility ? !compatibility.compatible : false,
          attachmentDisabledReason: compatibility?.reason ?? null,
        };
      })
    );

    const postMentionEntities =
      shouldIncludePosts && scopedProspect
        ? [
            ...collectProspectCandidatePosts(scopedProspect)
              .map((post) =>
                buildPostMentionEntity({
                  post,
                  platformHint:
                    scopedProspect.platform === "linkedin"
                      ? "linkedin"
                      : "twitter",
                  workspaceId: String(workspace._id),
                  prospectId: String(scopedProspect._id),
                })
              )
              .filter(
                (entity): entity is NonNullable<typeof entity> =>
                  entity !== null
              ),
            ...collectProspectInteractionMentionEntities({
              interactions,
              workspaceId: String(workspace._id),
              prospectId: String(scopedProspect._id),
            }),
          ]
        : [];

    const mentionEntities: MentionEntitySearchResult[] = [
      ...(shouldIncludeProspects
        ? prospects.map((prospect) => {
            const handleLabel = prospect.handle
              ? formatProspectSecondaryLabel(prospect.handle)
              : null;
            return {
              id: `prospect:${String(prospect.prospectId)}`,
              entityId: String(prospect.prospectId),
              kind: "prospect" as const,
              label: prospect.label,
              mentionText: prospect.mentionText,
              secondaryLabel:
                scopedProspect && scopedProspect._id === prospect.prospectId
                  ? handleLabel
                    ? `Current prospect • ${handleLabel}`
                    : "Current prospect"
                  : prospect.secondaryLabel,
              avatarUrl: prospect.avatarUrl,
              verified: prospect.verified,
              referenceText: `Prospect: ${prospect.label} (prospectId: ${String(prospect.prospectId)}; workspaceId: ${String(prospect.workspaceId)}${prospect.handle ? `; handle: ${formatProspectSecondaryLabel(prospect.handle)}` : ""})`,
              workspaceId: String(prospect.workspaceId),
              prospectId: String(prospect.prospectId),
              handle: prospect.handle ?? undefined,
            };
          })
        : []),
      ...uploadMentionEntities,
      ...postMentionEntities,
      ...(
        await Promise.all(
          plans.map(async (plan) => {
            const planProspect =
              prospectById.get(String(plan.prospectId)) ??
              (await getProspectSnapshotById(ctx.db, {
                prospectId: plan.prospectId,
                workspaceId: workspace._id,
              }));
            if (!planProspect) {
              return [];
            }

            prospectById.set(String(plan.prospectId), planProspect);

            const prospectLabel = planProspect.label;
            const prospectAvatarUrl = planProspect.avatarUrl;
            const entries: MentionEntitySearchResult[] = [];

            if (shouldIncludePlans) {
              entries.push({
                id: `plan:${String(plan._id)}`,
                entityId: String(plan._id),
                kind: "plan" as const,
                label: `Plan for ${prospectLabel}`,
                mentionText: `Plan: ${prospectLabel}`,
                secondaryLabel: `${getStatusLabel(plan.status)} plan`,
                avatarUrl: prospectAvatarUrl,
                verified: false,
                referenceText: `Plan: Plan for ${prospectLabel} (planId: ${String(plan._id)}; prospectId: ${String(plan.prospectId)}; workspaceId: ${String(plan.workspaceId)}; status: ${plan.status})`,
                workspaceId: String(plan.workspaceId),
                prospectId: String(plan.prospectId),
                planId: String(plan._id),
              });
            }

            if (!shouldIncludeTasks) {
              return entries;
            }

            const tasks = await ctx.db
              .query("outreachTasks")
              .withIndex("by_plan_order", (q) => q.eq("planId", plan._id))
              .order("desc")
              .take(scopedProspect ? 8 : 4);

            const taskEntries = tasks.map((task) => {
              const taskSummary =
                task.content?.trim() || task.description.trim();
              return {
                id: `task:${String(task._id)}`,
                entityId: String(task._id),
                kind: "task" as const,
                label: `Task ${task.order}: ${taskSummary}`,
                mentionText: `Task ${task.order}: ${taskSummary}`,
                secondaryLabel: `${task.type} task • ${prospectLabel}`,
                avatarUrl: prospectAvatarUrl,
                verified: false,
                referenceText: `Task: Task ${task.order} for ${prospectLabel} (taskId: ${String(task._id)}; planId: ${String(plan._id)}; prospectId: ${String(plan.prospectId)}; status: ${task.status}; type: ${task.type})`,
                workspaceId: String(plan.workspaceId),
                prospectId: String(plan.prospectId),
                planId: String(plan._id),
                taskId: String(task._id),
              };
            });

            return [...entries, ...taskEntries];
          })
        )
      ).flat(),
    ];

    const rankedResults = mentionEntities
      .map((entity) => {
        const score =
          scoreMatch(entity.label, normalizedQuery) * 3 +
          scoreMatch(entity.mentionText, normalizedQuery) * 2 +
          scoreMatch(entity.secondaryLabel, normalizedQuery);

        if (normalizedQuery && score === 0) {
          return null;
        }

        const scopeBoost =
          scopedProspect &&
          "prospectId" in entity &&
          entity.prospectId === String(scopedProspect._id)
            ? 25
            : 0;
        const kindBoost =
          entity.kind === "prospect"
            ? 16
            : entity.kind === "plan"
              ? 12
              : entity.kind === "task"
                ? 10
                : entity.kind === "post"
                  ? 9
                  : 8;

        return {
          ...entity,
          rankingScore: score + scopeBoost + kindBoost,
        };
      })
      .filter(
        (
          value
        ): value is (typeof mentionEntities)[number] & {
          rankingScore: number;
        } => value !== null
      )
      .sort((left, right) => right.rankingScore - left.rankingScore);

    const dedupedResults: typeof rankedResults = [];
    const seenIds = new Set<string>();
    for (const entity of rankedResults) {
      if (seenIds.has(entity.id)) {
        continue;
      }
      seenIds.add(entity.id);
      dedupedResults.push(entity);
      if (dedupedResults.length >= resultLimit) {
        break;
      }
    }

    return dedupedResults.map(({ rankingScore: _rankingScore, ...entity }) => {
      return entity;
    });
  },
});
