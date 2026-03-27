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
      "Target tweet/post id for tweet actions such as like, repost, or reply."
    ),
  targetUserId: z
    .string()
    .optional()
    .describe(
      "Target Twitter user id for follow, unfollow, or send_dm. Optional in a prospect thread: the server resolves the recipient from prospect data."
    ),
  conversationId: z
    .string()
    .optional()
    .describe(
      "Existing DM conversation id for send_dm_in_existing_conversation."
    ),
  text: z
    .string()
    .max(X_LONG_FORM_POST_MAX_CHARS)
    .optional()
    .describe(
      "Draft text for create_post, reply_to_post, send_dm, or send_dm_in_existing_conversation. For DMs, provide text and/or mediaUrls (X allows media-only DMs)."
    ),
  mediaUrls: z
    .array(z.string())
    .optional()
    .describe(
      "Optional public media URLs. For DMs: at most one URL (X limit); use with or without text. Not used for create_post/reply in this path."
    ),
  mediaDescriptions: z
    .array(z.string())
    .optional()
    .describe("Optional alt text per media URL (DM attachments)."),
  replaceExistingPending: z
    .boolean()
    .optional()
    .describe(
      "Set true only after the user explicitly confirms replacing an existing pending DM draft."
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
    "Execute or stage a curated X/Twitter action using ReacherX policy controls. " +
    "Use this for likes, bookmarks, reposts, follows, replies, posts, and DMs (text and/or a single media URL per DM). " +
    "Low-risk actions execute immediately. Medium and high-risk actions create an approval request instead of executing directly.",
  args: twitterActionArgsSchema,
  handler: async (ctx, args): Promise<TwitterActionToolResult> => {
    if (!ctx.threadId) {
      return {
        success: false,
        executed: false,
        pendingApproval: false,
        actionKey: args.action,
        title: "Twitter action unavailable",
        message: "Twitter actions require an agent thread with context.",
        error: "No thread context available",
      };
    }

    const result = await ctx.runAction(
      internal.twitterActionExecutors.submitTwitterActionForThread,
      {
        threadId: ctx.threadId,
        actionKey: args.action,
        tweetId: args.tweetId,
        targetUserId: args.targetUserId,
        conversationId: args.conversationId,
        text: args.text,
        mediaUrls: args.mediaUrls,
        mediaDescriptions: args.mediaDescriptions,
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
    const artifact =
      (result.actionKey === "send_dm" ||
        result.actionKey === "send_dm_in_existing_conversation") &&
      result.actionRequestId &&
      result.prospectId
        ? createDmDraftArtifact({
            prospectId: result.prospectId,
            actionRequestId: result.actionRequestId,
            title: result.title,
            message: result.message,
            status,
            draftContent: result.draftContent,
          })
        : createTwitterActionArtifact({
            actionKey: result.actionKey,
            actionRequestId: result.actionRequestId,
            title: result.title,
            message: result.message,
            status,
            approvalMode: result.approvalMode,
            riskLevel: result.riskLevel,
            targetTweetId: result.targetTweetId,
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
