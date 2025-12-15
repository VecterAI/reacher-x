import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// ============================================================================
// SocialAPI Webhook - Receives new tweets from Search Query Monitors
// ============================================================================

/**
 * SocialAPI webhook payload structure for new_tweet events:
 * {
 *   event: "new_tweet",
 *   data: {
 *     id_str: string,
 *     full_text: string,
 *     user: { screen_name: string, ... },
 *     ...full tweet object
 *   },
 *   meta: {
 *     monitor_id: string,
 *     monitor_type: "search_keyword",
 *     monitored_query: string
 *   }
 * }
 */
http.route({
  path: "/socialapi-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const payload = await request.json();

      // Validate event type - we only handle new_tweet for search monitors
      if (payload.event !== "new_tweet") {
        console.log(
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

      // Look up the monitor to get workspace and user info
      const monitor = await ctx.runQuery(
        internal.socialapiMonitors.getMonitorByExternalId,
        {
          monitorId: meta.monitor_id,
        }
      );

      if (!monitor) {
        console.error(
          `[SocialAPI Webhook] Unknown monitor_id: ${meta.monitor_id}`
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
        console.log(
          `[SocialAPI Webhook] Monitor ${meta.monitor_id} is ${monitor.status}, ignoring`
        );
        return new Response(JSON.stringify({ status: "ignored" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Save the prospect
      const result = await ctx.runMutation(
        internal.prospects.saveProspectFromWebhook,
        {
          workspaceId: monitor.workspaceId,
          userId: monitor.userId,
          monitorId: meta.monitor_id,
          platform: "twitter",
          externalId: tweet.id_str,
          data: tweet,
          matchedQuery: meta.monitored_query,
        }
      );

      console.log(
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
