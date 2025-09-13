import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { EventProcessingResult } from "./lib/types";

// Internal mutation to process WorkOS events for cron jobs
// This is a placeholder that will be replaced by the actual action call
export const processWorkOSEventsCron = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, { cursor }): Promise<EventProcessingResult> => {
    // Note: Internal mutations cannot call actions directly
    // The cron job should call the action directly instead
    console.log(
      "Cron job triggered - WorkOS events processing should be handled by action"
    );

    return {
      processed: 0,
      latestCursor: cursor,
      hasMore: false,
    };
  },
});
