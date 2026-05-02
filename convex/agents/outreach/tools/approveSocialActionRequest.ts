"use node";

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../../_generated/api";

export interface ApproveSocialActionRequestResult {
  success: boolean;
  message: string;
  actionRequestId?: string;
  error?: string;
}

export const approveSocialActionRequest = createTool({
  description:
    "Approve the pending social action request for the current thread. Use this when the user explicitly confirms a staged X or LinkedIn action.",
  args: z.object({}),
  handler: async (ctx): Promise<ApproveSocialActionRequestResult> => {
    if (!ctx.threadId) {
      return {
        success: false,
        message: "No thread context available for approval.",
        error: "Missing thread context",
      };
    }

    const pendingRequest = await ctx.runQuery(
      internal.socialActions.getPendingActionRequestForThread,
      {
        threadId: ctx.threadId,
      }
    );

    if (!pendingRequest) {
      return {
        success: false,
        message: "No pending social action request was found for this thread.",
        error: "No pending request",
      };
    }

    await ctx.runMutation(internal.socialActions.approveActionRequestInternal, {
      actionRequestId: pendingRequest._id,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.socialActionExecutors.executeActionRequestInternal,
      {
        actionRequestId: pendingRequest._id,
      }
    );

    return {
      success: true,
      actionRequestId: pendingRequest._id,
      message: "Approval accepted. The action is now executing.",
    };
  },
});
