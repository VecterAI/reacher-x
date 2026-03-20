"use node";

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../../_generated/api";

export interface ApproveTwitterActionRequestResult {
  success: boolean;
  message: string;
  actionRequestId?: string;
  error?: string;
}

export const approveTwitterActionRequest = createTool({
  description:
    "Approve the pending Twitter action request for the current thread. " +
    "Use this when the user explicitly confirms a staged follow, repost, reply, or post.",
  args: z.object({}),
  handler: async (ctx): Promise<ApproveTwitterActionRequestResult> => {
    if (!ctx.threadId) {
      return {
        success: false,
        message: "No thread context available for approval.",
        error: "Missing thread context",
      };
    }

    const pendingRequest = await ctx.runQuery(
      internal.twitterActions.getPendingActionRequestForThread,
      {
        threadId: ctx.threadId,
      }
    );

    if (!pendingRequest) {
      return {
        success: false,
        message: "No pending Twitter action request was found for this thread.",
        error: "No pending request",
      };
    }

    await ctx.runMutation(
      internal.twitterActions.approveActionRequestInternal,
      {
        actionRequestId: pendingRequest._id,
      }
    );

    await ctx.scheduler.runAfter(
      0,
      internal.twitterActionExecutors.executeActionRequestInternal,
      {
        actionRequestId: pendingRequest._id,
      }
    );

    return {
      success: true,
      actionRequestId: pendingRequest._id,
      message: "Approval accepted. The Twitter action is now executing.",
    };
  },
});
