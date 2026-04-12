"use node";

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../../_generated/api";
import {
  createDmDraftArtifact,
  createTwitterActionArtifact,
  type AgentArtifactEnvelope,
} from "../../../../shared/lib/json-render/agentArtifacts";
import { X_LONG_FORM_POST_MAX_CHARS } from "../../../../shared/lib/twitter/xPostTextLimit";
import {
  ensureWorkspaceStyleReady,
  extractProspectThreadContext,
} from "./helpers";

const internalLinkedInApi = (internal as any).linkedin;

const twitterActionEnum = z.enum([
  "like_post",
  "unlike_post",
  "bookmark_post",
  "unbookmark_post",
  "retweet_post",
  "unretweet_post",
  "follow_user",
  "unfollow_user",
  "reply_to_post",
  "create_post",
  "send_dm",
  "send_dm_in_existing_conversation",
  "linkedin_send_message",
  "linkedin_send_message_existing_conversation",
  "linkedin_invite_user",
  "linkedin_react_to_post",
  "linkedin_comment_on_post",
]);

export interface TwitterActionToolResult {
  success: boolean;
  executed: boolean;
  pendingApproval: boolean;
  actionKey: string;
  actionRequestId?: string;
  prospectId?: string;
  title: string;
  message: string;
  approvalMode?: string;
  riskLevel?: string;
  targetTweetId?: string;
  sourcePostRef?: unknown;
  sourcePostSummary?: unknown;
  sourceContext?: string;
  draftContent?: string;
  createdTweetId?: string;
  artifact?: AgentArtifactEnvelope;
  error?: string;
}

const twitterActionArgsSchema = z.object({
  action: twitterActionEnum.describe(
    "The app-owned Twitter action to perform."
  ),
  tweetId: z
    .string()
    .optional()
    .describe(
      "Target X post id for Twitter actions. For LinkedIn actions, you may use this as a legacy alias for postId."
    ),
  postId: z
    .string()
    .optional()
    .describe(
      "Target platform post id for LinkedIn actions such as react or comment. Also accepted as an alias for tweetId."
    ),
  targetUserId: z
    .string()
    .optional()
    .describe(
      "Target Twitter user id for follow, unfollow, or X DMs. Optional in a prospect thread: the server resolves the recipient from prospect data."
    ),
  conversationId: z
    .string()
    .optional()
    .describe(
      "Existing conversation id for send_dm_in_existing_conversation or linkedin_send_message_existing_conversation."
    ),
  text: z
    .string()
    .max(X_LONG_FORM_POST_MAX_CHARS)
    .optional()
    .describe(
      "Draft text for create_post, reply_to_post, send_dm, send_dm_in_existing_conversation, linkedin_send_message, linkedin_send_message_existing_conversation, linkedin_invite_user, or linkedin_comment_on_post."
    ),
  mediaUrls: z
    .array(z.string())
    .optional()
    .describe(
      "Optional public media URLs. For create_post/reply_to_post: up to 4 photos or exactly 1 GIF/video. For X DMs: at most one URL. For LinkedIn messages/comments: pass the attachments you want staged with the draft."
    ),
  mediaDescriptions: z
    .array(z.string())
    .optional()
    .describe("Optional media descriptions/alt text aligned by index with mediaUrls."),
  mediaKinds: z
    .array(z.enum(["image", "gif", "video"]))
    .optional()
    .describe(
      "Optional media kinds aligned by index with mediaUrls. Use this when the URL does not make the attachment type obvious."
    ),
  reactionType: z
    .string()
    .optional()
    .describe(
      "Optional LinkedIn reaction type for linkedin_react_to_post, e.g. LIKE, PRAISE, APPRECIATION, INTEREST, or EMPATHY."
    ),
  replaceExistingPending: z
    .boolean()
    .optional()
    .describe(
      "Set true only after the user explicitly confirms replacing an existing pending DM draft on X or LinkedIn."
    ),
  targetLabel: z
    .string()
    .optional()
    .describe(
      "Human-readable label for the target, such as '@alice' or 'Alice\\'s launch tweet'."
    ),
  context: z
    .string()
    .optional()
    .describe(
      "Short explanation for why this action is being taken. This is shown to the user in review UI."
    ),
});

export const twitterAction = createTool({
  description:
    "Execute or stage a curated social action using ReacherX policy controls. " +
    "Use this for X/Twitter likes, bookmarks, reposts, follows, replies, posts, and DMs, plus LinkedIn messages, invitations, reactions, and comments. " +
    "Low-risk actions may execute immediately. Medium and high-risk actions create a durable approval request instead of executing directly.",
  args: twitterActionArgsSchema,
  handler: async (ctx, args): Promise<TwitterActionToolResult> => {
    if (!ctx.threadId) {
      return {
        success: false,
        executed: false,
        pendingApproval: false,
        actionKey: args.action,
        title: "Social action unavailable",
        message: "Social actions require an agent thread with context.",
        error: "No thread context available",
      };
    }

    const requiresStyleReady =
      args.action === "reply_to_post" ||
      args.action === "create_post" ||
      args.action === "send_dm" ||
      args.action === "send_dm_in_existing_conversation" ||
      args.action === "linkedin_send_message" ||
      args.action === "linkedin_send_message_existing_conversation" ||
      args.action === "linkedin_invite_user" ||
      args.action === "linkedin_comment_on_post";

    if (requiresStyleReady) {
      const threadContext = await extractProspectThreadContext(
        ctx,
        "twitterAction"
      );
      const styleReady = await ensureWorkspaceStyleReady(
        ctx,
        "twitterAction",
        threadContext.workspaceId
      );
      if (!styleReady.ready) {
        return {
          success: false,
          executed: false,
          pendingApproval: false,
          actionKey: args.action,
          title: "Writing style not ready",
          message: styleReady.message,
          error: styleReady.error,
        };
      }
    }

    const isLinkedInAction = args.action.startsWith("linkedin_");
    const result = isLinkedInAction
      ? await ctx.runAction(internalLinkedInApi.submitLinkedInActionForThread, {
          threadId: ctx.threadId,
          actionKey: args.action,
          postId: args.postId ?? args.tweetId,
          text: args.text,
          mediaUrls: args.mediaUrls,
          mediaDescriptions: args.mediaDescriptions,
          mediaKinds: args.mediaKinds,
          reactionType: args.reactionType,
          replaceExistingPending: args.replaceExistingPending,
          targetLabel: args.targetLabel,
          context: args.context,
        })
      : await ctx.runAction(
          internal.twitterActionExecutors.submitTwitterActionForThread,
          {
            threadId: ctx.threadId,
            actionKey: args.action as any,
            tweetId: args.tweetId ?? args.postId,
            targetUserId: args.targetUserId,
            conversationId: args.conversationId,
            text: args.text,
            mediaUrls: args.mediaUrls,
            mediaDescriptions: args.mediaDescriptions,
            mediaKinds: args.mediaKinds,
            replaceExistingPending: args.replaceExistingPending,
            targetLabel: args.targetLabel,
            context: args.context,
          }
        );

    const status = result.pendingApproval
      ? "pending_approval"
      : result.executed
        ? "completed"
        : result.success
          ? "approved"
          : "failed";
    const actionPlatform = isLinkedInAction ? "linkedin" : "twitter";
    const artifact =
      (result.actionKey === "send_dm" ||
        result.actionKey === "send_dm_in_existing_conversation" ||
        result.actionKey === "linkedin_send_message" ||
        result.actionKey === "linkedin_send_message_existing_conversation") &&
      result.actionRequestId &&
      result.prospectId
        ? createDmDraftArtifact({
            platform: actionPlatform,
            prospectId: result.prospectId,
            actionRequestId: result.actionRequestId,
            title: result.title,
            message: result.message,
            status,
            draftContent: result.draftContent,
          })
        : createTwitterActionArtifact({
            platform: actionPlatform,
            actionKey: result.actionKey,
            actionRequestId: result.actionRequestId,
            title: result.title,
            message: result.message,
            status,
            approvalMode: result.approvalMode,
            riskLevel: result.riskLevel,
            targetTweetId: result.targetTweetId,
            sourcePostData:
              "sourcePostData" in result ? result.sourcePostData : undefined,
            sourcePostRef: result.sourcePostRef,
            sourcePostSummary: result.sourcePostSummary,
            sourceContext: result.sourceContext,
            draftContent: result.draftContent,
            createdTweetId: result.createdTweetId,
          });

    return {
      ...result,
      artifact,
    };
  },
});
