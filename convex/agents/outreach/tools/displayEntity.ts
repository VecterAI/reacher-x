"use node";

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../../_generated/api";
import {
  createPostArtifact,
  createPostListArtifact,
  createProfilePreviewArtifact,
  type AgentArtifactEnvelope,
} from "../../../../shared/lib/json-render/agentArtifacts";
import {
  resolveSocialContext,
  type NormalizedSocialPost,
} from "./socialContextShared";

const displayEntitySchema = z.enum([
  "prospect_profile",
  "twitter_profile",
  "linkedin_profile",
  "post",
  "post_list",
  "thread",
]);

const displayPlatformSchema = z.enum(["twitter", "linkedin"]);
const displaySelectionSchema = z.enum([
  "latest",
  "oldest",
  "best_for_reply",
  "discovery",
]);

type PanelMode = "approval" | "posted";

export interface DisplayEntityResult {
  success: boolean;
  artifact?: AgentArtifactEnvelope;
  openPayload?: unknown;
  prospect?: unknown;
  profile?: unknown;
  posts: NormalizedSocialPost[];
  thread?: unknown;
  activitySummary?: unknown;
  selection?: unknown;
  resolvedPlatform?: "twitter" | "linkedin";
  error?: string;
}

function getPanelModeFromTaskStatus(status?: string): PanelMode | undefined {
  if (!status) return undefined;
  if (
    status === "pending" ||
    status === "executing" ||
    status === "scheduled"
  ) {
    return "approval";
  }
  if (status === "waiting_response" || status === "completed") {
    return "posted";
  }
  return undefined;
}

function getPostListTitle(args: {
  entity: z.infer<typeof displayEntitySchema>;
  selection?: z.infer<typeof displaySelectionSchema>;
  dateFrom?: string;
  dateTo?: string;
}): string {
  if (args.entity === "thread") {
    return "Thread";
  }

  if (args.selection === "latest") {
    return "Latest post";
  }

  if (args.selection === "oldest") {
    return "Oldest post";
  }

  if (args.selection === "best_for_reply") {
    return "Best reply candidate";
  }

  if (args.dateFrom || args.dateTo) {
    return "Posts";
  }

  return "Recent posts";
}

async function resolveTaskContextForPost(args: {
  ctx: Parameters<Parameters<typeof createTool>[0]["handler"]>[0];
  prospectId: string;
  platform: "twitter" | "linkedin";
  post: NormalizedSocialPost | undefined;
}) {
  if (!args.post || args.platform !== "twitter") {
    return {
      taskId: undefined,
      taskStatus: undefined,
      panelMode: undefined,
    };
  }

  const taskMatch = await args.ctx.runQuery(
    internal.outreach.getTaskByProspectAndTargetTweet,
    {
      prospectId: args.prospectId as any,
      targetTweetId: args.post.id,
    }
  );

  const task = taskMatch?.task;
  const taskStatus = typeof task?.status === "string" ? task.status : undefined;

  return {
    taskId: task?._id,
    taskStatus,
    panelMode: getPanelModeFromTaskStatus(taskStatus),
  };
}

export const displayEntity = createTool({
  description:
    "Render a prospect profile, platform profile, post, post list, or thread inline in chat and optionally open the canonical right-side panel. Use this whenever the user asks to see something visually.",
  args: z.object({
    entity: displayEntitySchema.describe(
      "What to render inline: generic prospect profile, Twitter profile, LinkedIn profile, post, post list, or thread."
    ),
    platform: displayPlatformSchema
      .optional()
      .describe("Optional explicit platform for post or profile display."),
    selection: displaySelectionSchema
      .optional()
      .describe(
        "Optional post selector. Use latest/oldest for exact retrieval and best_for_reply only when explicitly requested."
      ),
    dateFrom: z
      .string()
      .optional()
      .describe("Optional ISO lower bound for post list display."),
    dateTo: z
      .string()
      .optional()
      .describe("Optional ISO upper bound for post list display."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .default(5)
      .describe("Maximum number of posts to show."),
    postId: z
      .string()
      .optional()
      .describe("Specific post id for thread display."),
    postIds: z
      .array(z.string())
      .optional()
      .describe(
        "Optional explicit post ids to prioritize in post list displays."
      ),
    context: z
      .string()
      .optional()
      .describe("Optional short explanation shown with the inline artifact."),
    openPanel: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        "Whether the UI should automatically open the matching side panel."
      ),
  }),
  handler: async (ctx, args): Promise<DisplayEntityResult> => {
    try {
      const mode =
        args.entity === "prospect_profile"
          ? "prospect_profile"
          : args.entity === "twitter_profile" ||
              args.entity === "linkedin_profile"
            ? "platform_profile"
            : args.entity === "thread"
              ? "thread"
              : "posts";

      const resolved = await resolveSocialContext(ctx, {
        mode,
        platform:
          args.entity === "twitter_profile"
            ? "twitter"
            : args.entity === "linkedin_profile"
              ? "linkedin"
              : (args.platform ?? "auto"),
        selection:
          args.entity === "post" && !args.selection && !args.postId
            ? "latest"
            : args.selection,
        dateFrom: args.dateFrom,
        dateTo: args.dateTo,
        limit: args.limit,
        includeReplies: true,
        postId: args.postId,
      });

      const explicitPostIds = new Set(args.postIds ?? []);
      const displayPosts =
        explicitPostIds.size > 0
          ? resolved.posts.filter((post) => explicitPostIds.has(post.id))
          : args.entity === "thread"
            ? (resolved.thread?.posts ?? resolved.posts)
            : resolved.posts;
      const primaryPost = displayPosts[0];
      const taskContext = await resolveTaskContextForPost({
        ctx,
        prospectId: resolved.prospect.id,
        platform: resolved.resolvedPlatform,
        post: primaryPost,
      });

      let artifact: AgentArtifactEnvelope | undefined;
      let openPayload: unknown;

      if (args.entity === "prospect_profile") {
        if (resolved.profile) {
          artifact = createProfilePreviewArtifact({
            variant: "prospect",
            prospectId: resolved.prospect.id,
            platform: resolved.prospect.platform,
            profileData: resolved.profile,
            label: "Prospect profile",
            context: args.context,
          });
        }
        openPayload = args.openPanel
          ? {
              kind: "prospect_profile",
              platform: resolved.prospect.platform,
              prospectId: resolved.prospect.id,
              profileData: resolved.profile,
            }
          : undefined;
      } else if (args.entity === "twitter_profile") {
        if (resolved.profile) {
          artifact = createProfilePreviewArtifact({
            variant: "twitter",
            prospectId: resolved.prospect.id,
            platform: "twitter",
            profileData: resolved.profile,
            label: "Twitter profile",
            context: args.context,
          });
        }
        openPayload = args.openPanel
          ? {
              kind: "twitter_profile",
              platform: "twitter",
              prospectId: resolved.prospect.id,
              profileData: resolved.profile,
            }
          : undefined;
      } else if (args.entity === "linkedin_profile") {
        if (resolved.profile) {
          artifact = createProfilePreviewArtifact({
            variant: "linkedin",
            prospectId: resolved.prospect.id,
            platform: "linkedin",
            profileData: resolved.profile,
            label: "LinkedIn profile",
            context: args.context,
          });
        }
        openPayload = args.openPanel
          ? {
              kind: "linkedin_profile",
              platform: "linkedin",
              prospectId: resolved.prospect.id,
              profileData: resolved.profile,
            }
          : undefined;
      } else if (args.entity === "post" && primaryPost) {
        artifact = createPostArtifact({
          platform: primaryPost.platform,
          prospectId: resolved.prospect.id,
          openKind: "post",
          postData:
            primaryPost.platform === "linkedin"
              ? primaryPost.rawData
              : undefined,
          postRef: primaryPost.ref,
          postSummary: primaryPost.summary ?? primaryPost.rawData,
          context: args.context ?? resolved.selection?.rationale,
          taskId: taskContext.taskId,
          taskStatus: taskContext.taskStatus,
          panelMode: taskContext.panelMode,
          targetTweetId: primaryPost.id,
        });
        openPayload = args.openPanel
          ? {
              kind: "post",
              platform: primaryPost.platform,
              prospectId: resolved.prospect.id,
              postData:
                primaryPost.platform === "linkedin"
                  ? primaryPost.rawData
                  : undefined,
              postRef: primaryPost.ref,
              postSummary: primaryPost.summary,
              context: args.context ?? resolved.selection?.rationale,
              taskId: taskContext.taskId,
              taskStatus: taskContext.taskStatus,
              panelMode: taskContext.panelMode,
              targetTweetId: primaryPost.id,
            }
          : undefined;
      } else if (
        (args.entity === "post_list" || args.entity === "thread") &&
        displayPosts.length > 0
      ) {
        const title = getPostListTitle({
          entity: args.entity,
          selection: args.selection,
          dateFrom: args.dateFrom,
          dateTo: args.dateTo,
        });
        artifact = createPostListArtifact({
          platform: resolved.resolvedPlatform,
          title,
          prospectId: resolved.prospect.id,
          context: args.context ?? resolved.selection?.rationale,
          posts: displayPosts.map((post) => ({
            id: post.id,
            platform: post.platform,
            textPreview: post.textPreview,
            createdAt: post.createdAt,
            rawData: post.rawData,
            ref: post.ref,
            summary: post.summary,
          })),
        });
        openPayload = args.openPanel
          ? {
              kind: "post_list",
              platform: resolved.resolvedPlatform,
              prospectId: resolved.prospect.id,
              title,
              posts: displayPosts.map((post) => post.rawData),
            }
          : undefined;
      }

      return {
        success: true,
        artifact,
        openPayload,
        prospect: resolved.prospect,
        profile: resolved.profile,
        posts: displayPosts,
        thread: resolved.thread,
        activitySummary: resolved.activitySummary,
        selection: resolved.selection,
        resolvedPlatform: resolved.resolvedPlatform,
      };
    } catch (error) {
      return {
        success: false,
        posts: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
