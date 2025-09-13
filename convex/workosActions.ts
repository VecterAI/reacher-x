"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { WorkOS } from "@workos-inc/node";
import { EventProcessingResult } from "./lib/types";
import { api, internal } from "./_generated/api";

// Initialize WorkOS client
const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Action to fetch WorkOS events
export const fetchWorkOSEvents = action({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { cursor, limit = 50 }
  ): Promise<EventProcessingResult> => {
    try {
      // Fetch events from WorkOS Events API
      const events = await workos.events.listEvents({
        events: [
          "dsync.user.created",
          "dsync.user.updated",
          "dsync.user.deleted",
        ],
        after: cursor,
        limit,
      });

      let latestCursor = cursor;
      let processedCount = 0;

      // Process each event
      for (const event of events.data) {
        try {
          // Only process directory sync user events
          if (!event.event.startsWith("dsync.user.")) {
            console.log(`Skipping non-user event: ${event.event}`);
            latestCursor = event.id;
            continue;
          }

          // Type guard to ensure data is WorkOSUserData
          if (
            !event.data ||
            typeof event.data !== "object" ||
            !("email" in event.data)
          ) {
            console.log(`Skipping non-user data for event: ${event.event}`);
            latestCursor = event.id;
            continue;
          }

          // Call the internal mutation to process the event
          await ctx.runMutation(
            internal.workosEventProcessor.processWorkOSEvent,
            {
              event: {
                id: event.id,
                event: event.event,
                data: event.data,
                created_at: event.createdAt,
              },
            }
          );
          latestCursor = event.id;
          processedCount++;
        } catch (error) {
          console.error(`Failed to process event ${event.id}:`, error);
          // Continue processing other events even if one fails
        }
      }

      // Update cursor if we processed any events
      if (processedCount > 0) {
        await ctx.runMutation(api.events.updateEventCursor, {
          cursor: latestCursor!,
        });
      }

      console.log(
        `Processed ${processedCount} events, latest cursor: ${latestCursor}`
      );

      return {
        processed: processedCount,
        latestCursor,
        hasMore: false, // WorkOS Events API doesn't have hasMore in listMetadata
      };
    } catch (error) {
      console.error("Failed to fetch WorkOS events:", error);
      throw new Error(`WorkOS events fetch failed: ${error}`);
    }
  },
});
