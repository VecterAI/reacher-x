import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// ============================================================================
// SocialAPI Webhook - Receives events from Search Query & User Tweets Monitors
// ============================================================================

/**
 * SocialAPI webhook payload structure for new_tweet events.
 * Handles two monitor types:
 * 1. search_keyword - New prospects from search queries
 * 2. user_tweets - Responses from monitored prospects (outreach detection)
 */
http.route({
  path: "/socialapi-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const payload = await request.json();

      // Validate event type - we only handle new_tweet
      if (payload.event !== "new_tweet") {
        console.info(
          `[SocialAPI Webhook] Ignoring event type: ${payload.event}`
        );
        return new Response(JSON.stringify({ status: "ignored" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const { data: tweet, meta } = payload;

      // Validate required fields
      if (!meta?.monitor_id) {
        console.error("[SocialAPI Webhook] Missing monitor_id in meta");
        return new Response(
          JSON.stringify({ status: "error", message: "Missing monitor_id" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (!tweet?.id_str) {
        console.error("[SocialAPI Webhook] Missing tweet id_str");
        return new Response(
          JSON.stringify({ status: "error", message: "Missing tweet id_str" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Route based on monitor type
      const monitorType = meta.monitor_type;

      // ========================================================================
      // Handle Search Query Monitors (prospecting)
      // ========================================================================
      if (monitorType === "search_keyword") {
        const monitor = await ctx.runQuery(
          internal.socialapiMonitors.getMonitorByExternalId,
          { monitorId: meta.monitor_id }
        );

        if (!monitor) {
          console.error(
            `[SocialAPI Webhook] Unknown search monitor: ${meta.monitor_id}`
          );
          return new Response(
            JSON.stringify({ status: "error", message: "Unknown monitor" }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        if (monitor.status !== "active") {
          console.info(
            `[SocialAPI Webhook] Monitor ${meta.monitor_id} is ${monitor.status}, ignoring`
          );
          return new Response(JSON.stringify({ status: "ignored" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Use Twitter user ID as externalId to prevent duplicates
        // (same user from multiple tweets should create only one prospect)
        const externalId = tweet.user?.id_str;
        if (!externalId) {
          console.error(
            "[SocialAPI Webhook] Missing user.id_str in tweet data:",
            tweet.id_str
          );
          return new Response(
            JSON.stringify({
              status: "error",
              message: "Missing user.id_str in tweet data",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Save the prospect
        const result = await ctx.runMutation(
          internal.prospects.saveProspectFromWebhook,
          {
            workspaceId: monitor.workspaceId,
            userId: monitor.userId,
            monitorId: meta.monitor_id,
            platform: "twitter",
            externalId,
            data: tweet,
            matchedQuery: meta.monitored_query,
          }
        );

        console.info(
          `[SocialAPI Webhook] ${result.created ? "Created" : "Updated"} prospect ${result.prospectId} for tweet ${tweet.id_str}`
        );

        return new Response(
          JSON.stringify({
            status: "success",
            created: result.created,
            prospectId: result.prospectId,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // ========================================================================
      // Handle User Tweets Monitors (outreach response detection)
      // ========================================================================
      if (monitorType === "user_tweets") {
        const monitor = await ctx.runQuery(
          internal.prospectMonitors.getMonitorByExternalId,
          { monitorId: meta.monitor_id }
        );

        if (!monitor) {
          console.error(
            `[SocialAPI Webhook] Unknown prospect monitor: ${meta.monitor_id}`
          );
          return new Response(
            JSON.stringify({ status: "error", message: "Unknown monitor" }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        if (monitor.status !== "active") {
          return new Response(JSON.stringify({ status: "ignored" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Record webhook received
        await ctx.runMutation(internal.prospectMonitors.recordWebhook, {
          monitorId: meta.monitor_id,
        });

        // Check if this is a reply to our tweet
        const isReplyToUs =
          monitor.ourTweetId &&
          tweet.in_reply_to_status_id_str === monitor.ourTweetId;

        if (isReplyToUs) {
          console.info(
            `[SocialAPI Webhook] 🎉 Prospect ${monitor.prospectId} replied to our tweet ${monitor.ourTweetId}!`
          );

          // Create notification and update task status
          await ctx.runMutation(internal.outreach.onProspectResponse, {
            prospectId: monitor.prospectId,
            planId: monitor.planId,
            responseTweetId: tweet.id_str,
            responseText: tweet.full_text || tweet.text,
            responseData: tweet,
          });

          return new Response(
            JSON.stringify({
              status: "success",
              event: "prospect_replied",
              prospectId: monitor.prospectId,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        // Not a reply to our tweet - just log activity
        console.info(
          `[SocialAPI Webhook] Prospect ${monitor.prospectId} posted (not a reply to us)`
        );

        return new Response(
          JSON.stringify({ status: "success", event: "prospect_tweeted" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Unknown monitor type
      console.warn(`[SocialAPI Webhook] Unknown monitor type: ${monitorType}`);
      return new Response(JSON.stringify({ status: "ignored" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("[SocialAPI Webhook] Error:", error);
      return new Response(
        JSON.stringify({
          status: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

export default http;
