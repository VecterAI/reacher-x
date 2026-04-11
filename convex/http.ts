import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { polar } from "./polar";
import { formatWorkspaceLogContext } from "./lib/logHelpers";
import {
  buildXWebhookCrcResponse,
  verifyXWebhookSignature,
} from "./lib/xActivity";
import {
  X_POST_WEIGHTED_MAX,
  getXPostWeightedLength,
} from "../shared/lib/twitter/xPostTextLimit";

const http = httpRouter();

// ============================================================================
// Polar Webhook - Handles subscription events
// @see https://www.convex.dev/components/polar#set-up-polar-webhooks
//
// NOTE: If a subscription webhook arrives for an email that doesn't exist in
// our users table, the event is logged and silently ignored. This is
// intentional: users must sign up before purchasing. If a user purchases
// without signing up first, they will need to contact support.
// ============================================================================

polar.registerRoutes(http, {
  // Webhook path matches Polar dashboard configuration
  path: "/polar/events",

  // Handle new subscriptions
  onSubscriptionCreated: async (ctx, event) => {
    console.info("[Polar Webhook] Subscription created:", event.data.id);

    // Get user by email from subscription
    const customerEmail = event.data.customer?.email;
    if (!customerEmail) {
      console.error("[Polar Webhook] No customer email in subscription event");
      return;
    }

    const user = await ctx.runQuery(internal.users.getUserByEmail, {
      email: customerEmail,
    });
    if (!user) {
      console.error(
        `[Polar Webhook] User not found for email: ${customerEmail}`
      );
      return;
    }

    // Sync subscription to userPlans
    // Note: We pass the product ID (UUID) - the syncSubscriptionToUserPlan
    // function maps it to a tier using environment variables.
    await ctx.runMutation(internal.polar.syncSubscriptionToUserPlan, {
      userId: user._id,
      productId: event.data.product?.id,
      subscriptionId: event.data.id,
      status: event.data.status,
      currentPeriodEnd: event.data.currentPeriodEnd?.toISOString(),
      polarCustomerId: event.data.customer?.id,
    });
  },

  // Handle subscription updates (renewals, cancellations, etc.)
  onSubscriptionUpdated: async (ctx, event) => {
    console.info("[Polar Webhook] Subscription updated:", event.data.id);

    if (event.data.customerCancellationReason) {
      console.info(
        "[Polar Webhook] Cancellation reason:",
        event.data.customerCancellationReason
      );
    }

    // Get user by email from subscription
    const customerEmail = event.data.customer?.email;
    if (!customerEmail) {
      console.error("[Polar Webhook] No customer email in subscription event");
      return;
    }

    const user = await ctx.runQuery(internal.users.getUserByEmail, {
      email: customerEmail,
    });
    if (!user) {
      console.error(
        `[Polar Webhook] User not found for email: ${customerEmail}`
      );
      return;
    }

    // If cancelled, revert to free tier (no productId)
    const isCancelled = event.data.status === "canceled";

    await ctx.runMutation(internal.polar.syncSubscriptionToUserPlan, {
      userId: user._id,
      productId: isCancelled ? undefined : event.data.product?.id,
      subscriptionId: event.data.id,
      status: event.data.status,
      currentPeriodEnd: event.data.currentPeriodEnd?.toISOString(),
      polarCustomerId: event.data.customer?.id,
    });
  },
});

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

        const monitorPurpose = monitor.purpose ?? "workspace_query";
        let result:
          | { created?: boolean; prospectId?: string }
          | { repliesSeenDelta?: number; prospectsCreatedDelta?: number };

        if (
          monitorPurpose === "conversation_seed" &&
          monitor.conversationSeedId
        ) {
          result = await ctx.runAction(
            internal.xConversationDiscovery.processConversationSeedWebhookInternal,
            {
              seedId: monitor.conversationSeedId,
              tweet,
              matchedQuery: meta.monitored_query,
              monitorId: meta.monitor_id,
            }
          );
          await ctx.runMutation(
            internal.socialapiMonitors.recordSearchMonitorWebhook,
            {
              monitorId: meta.monitor_id,
              prospectsFoundDelta:
                "prospectsCreatedDelta" in result
                  ? result.prospectsCreatedDelta ?? 0
                  : 0,
            }
          );
        } else {
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

          result = await ctx.runAction(
            internal.prospects.saveProspectFromWebhookWithRetry,
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
          await ctx.runMutation(
            internal.socialapiMonitors.recordSearchMonitorWebhook,
            {
              monitorId: meta.monitor_id,
              prospectsFoundDelta:
                "created" in result && result.created ? 1 : 0,
            }
          );
        }

        const workspace = await ctx.runQuery(internal.workspaces.getById, {
          workspaceId: monitor.workspaceId,
        });
        const workspaceLogContext = formatWorkspaceLogContext({
          workspaceId: String(monitor.workspaceId),
          workspaceName: workspace?.name,
        });

        console.info(
          `[SocialAPI Webhook] ${workspaceLogContext} processed ${monitorPurpose} webhook for tweet ${tweet.id_str}`
        );

        return new Response(
          JSON.stringify({
            status: "success",
            created: "created" in result ? result.created : undefined,
            prospectId: "prospectId" in result ? result.prospectId : undefined,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // ========================================================================
      // Handle User Tweets Monitors (style learning + outreach response detection)
      // ========================================================================
      if (monitorType === "user_tweets") {
        // --- Check if this is a STYLE monitor (user's own tweets) ---
        const styleMonitor = await ctx.runQuery(
          internal.styleMonitors.getMonitorByExternalId,
          { monitorId: meta.monitor_id }
        );

        if (styleMonitor && styleMonitor.status === "active") {
          const tweetText = tweet.full_text || tweet.text || "";
          const isRetweet = !!tweet.retweeted_status;
          const isReply = !!tweet.in_reply_to_status_id_str;

          await ctx.runMutation(internal.styleAnalysis.ingestStyleContent, {
            userId: styleMonitor.userId,
            platform: "twitter",
            externalContentId: tweet.id_str,
            fullText: tweetText,
            contentType: isRetweet
              ? "repost"
              : isReply
                ? "reply"
                : "original_post",
            postedAt: new Date(
              tweet.tweet_created_at || tweet.created_at || Date.now()
            ).getTime(),
            source: "monitor_webhook",
          });

          await ctx.runMutation(internal.styleMonitors.recordWebhook, {
            monitorId: meta.monitor_id,
          });

          return new Response(
            JSON.stringify({ status: "success", type: "style_tweet" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        // --- Existing: prospect monitor logic ---
        const monitor = await ctx.runQuery(
          internal.prospectMonitors.getMonitorByExternalId,
          { monitorId: meta.monitor_id }
        );

        if (!monitor) {
          console.error(
            `[SocialAPI Webhook] Unknown monitor: ${meta.monitor_id}`
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

          if (monitor.ourTweetId) {
            await ctx.runAction(
              internal.interactionsActions.recordWebhookInteractionInternal,
              {
                prospectId: monitor.prospectId,
                sourcePostId: monitor.ourTweetId,
                replyTweet: tweet,
              }
            );
          }

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

        // Not a reply to our tweet - record activity in timeline
        const nonReplyText = String(tweet.full_text || tweet.text || "").trim();
        // Activity log preview: use X weighted length for "too long"; truncation is a rough heuristic.
        const activityDescription = nonReplyText
          ? getXPostWeightedLength(nonReplyText) > X_POST_WEIGHTED_MAX
            ? `${nonReplyText.slice(0, X_POST_WEIGHTED_MAX)}...`
            : nonReplyText
          : undefined;

        await ctx.runMutation(internal.outreach.logActivity, {
          prospectId: monitor.prospectId,
          workspaceId: monitor.workspaceId,
          type: "posted",
          title: "Prospect posted update",
          description: activityDescription,
        });

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

http.route({
  path: "/x-webhook",
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    const crcToken = new URL(request.url).searchParams.get("crc_token");
    if (!crcToken) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Missing crc_token",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        response_token: await buildXWebhookCrcResponse(crcToken),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }),
});

http.route({
  path: "/x-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();
    const signature = request.headers.get("x-twitter-webhooks-signature");

    if (!(await verifyXWebhookSignature(rawBody, signature))) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Invalid webhook signature",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    try {
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const result = await ctx.runAction(
        internal.xActivity.handleWebhookPayloadInternal,
        {
          payload,
        }
      );

      return new Response(
        JSON.stringify({
          status: "success",
          processed: result.processed,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("[X Webhook] Error processing payload:", error);
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
