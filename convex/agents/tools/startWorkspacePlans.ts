"use node";

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { getUserSafeErrorMessage } from "../../lib/errorHelpers";
import {
  resolveWorkspaceMemoryContext,
  type ToolContext,
} from "./workspaceMemoryHelpers";

type StartWorkspacePlansResult = {
  success: boolean;
  message: string;
  draftPlanCount?: number;
  draftPlanCountIsCapped?: boolean;
  error?: string;
};

function formatPlanCount(count: number, isCapped: boolean): string {
  return `${count.toLocaleString()}${isCapped ? "+" : ""}`;
}

export const startWorkspacePlans = createTool({
  description:
    "Prepare or confirm starting every existing draft outreach plan in the current workspace. Use action=prepare when the user first asks to approve, start, run, or let all draft/generated plans proceed. The backend returns the exact impact and asks for confirmation. Use action=confirm only after the user explicitly confirms that pending request. This tool starts existing plans; it does not create or edit plans, and it never accepts IDs.",
  inputSchema: z.object({
    action: z.enum(["prepare", "confirm"]),
  }),
  strict: true,
  execute: async (
    ctx: ToolContext,
    args
  ): Promise<StartWorkspacePlansResult> => {
    try {
      const context = await resolveWorkspaceMemoryContext(
        ctx,
        "startWorkspacePlans",
        null
      );
      const userId = context.userId;
      const workspaceId = context.workspaceId as Id<"workspaces"> | null;
      const sourceThreadId = ctx.threadId;
      if (!userId || !workspaceId || !sourceThreadId) {
        return {
          success: false,
          message: "Could not resolve this workspace conversation.",
          error: "Missing workspace, user, or thread context",
        };
      }

      if (args.action === "confirm") {
        const run = await ctx.runMutation(
          internal.workspacePlanStarts
            .confirmLatestWorkspacePlanStartRunInternal,
          {
            workspaceId,
            userId,
            sourceThreadId,
          }
        );
        if (!run) {
          return {
            success: false,
            message:
              "There are no draft outreach plans waiting for confirmation.",
            error: "No pending workspace plan start request",
          };
        }

        const count = formatPlanCount(
          run.targetPlanCount,
          run.targetPlanCountIsCapped
        );
        return {
          success: true,
          draftPlanCount: run.targetPlanCount,
          draftPlanCountIsCapped: run.targetPlanCountIsCapped,
          message:
            run.autonomyMode === "autonomous"
              ? `Starting ${count} draft outreach plan${run.targetPlanCount === 1 ? "" : "s"} gradually. Replies and DMs can send without further approval.`
              : `Starting ${count} draft outreach plan${run.targetPlanCount === 1 ? "" : "s"} gradually. Each reply and DM will still require approval.`,
        };
      }

      const prepared = await ctx.runMutation(
        internal.workspacePlanStarts.prepareWorkspacePlanStartRunInternal,
        {
          workspaceId,
          userId,
          sourceThreadId,
        }
      );
      if (!prepared.runId) {
        return {
          success: true,
          draftPlanCount: 0,
          draftPlanCountIsCapped: false,
          message: "There are no draft outreach plans to start.",
        };
      }

      const count = formatPlanCount(
        prepared.draftPlanCount,
        prepared.draftPlanCountIsCapped
      );
      return {
        success: true,
        draftPlanCount: prepared.draftPlanCount,
        draftPlanCountIsCapped: prepared.draftPlanCountIsCapped,
        message:
          prepared.autonomyMode === "autonomous"
            ? `This will start ${count} draft outreach plan${prepared.draftPlanCount === 1 ? "" : "s"} gradually. Replies and DMs may send without further approval. Continue?`
            : `This will start ${count} draft outreach plan${prepared.draftPlanCount === 1 ? "" : "s"} gradually. You will still approve each reply and DM before it sends. Continue?`,
      };
    } catch (error) {
      const message = getUserSafeErrorMessage(
        error,
        "Could not start the outreach plans"
      );
      return {
        success: false,
        message,
        error: message,
      };
    }
  },
});
