import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { polar } from "./polar";
import {
  createConvexHttpWideEventLogger,
  createManualWideEventLogger,
  getWideEventLogger,
} from "./lib/wideEventLogger";
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
const internalLinkedIn = (internal as any).linkedin;

function withLoggedHttpAction(
  operation: string,
  handler: (ctx: any, request: Request) => Promise<Response>
) {
  return httpAction(async (ctx, request) => {
    const logEvent = createConvexHttpWideEventLogger({
      operation,
      request,
    });

    try {
      const response = await handler(
        {
          ...(ctx as unknown as Record<string, unknown>),
          logEvent,
        },
        request
      );
      logEvent.emitSuccess(undefined, {
        status_code: response.status,
      });
      return response;
    } catch (error) {
      logEvent.emitError(error);
      throw error;
    }
  });
}

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
    const logEvent = createManualWideEventLogger({
      kind: "manual",
      operation: "polar_subscription_created",
      context: {
        webhook: {
          provider: "polar",
        },
        subscription: {
          has_product: Boolean(event.data.product?.id),
          id: event.data.id,
          status: event.data.status,
        },
      },
    });

    // Get user by email from subscription
    const customerEmail = event.data.customer?.email;
    if (!customerEmail) {
      logEvent.warn("Ignored Polar subscription without customer email");
      logEvent.emitSuccess(undefined, {
        outcome_reason: "missing_customer_email",
      });
      return;
    }

    const user = await ctx.runQuery(internal.users.getUserByEmail, {
      email: customerEmail,
    });
    if (!user) {
      logEvent.warn("Ignored Polar subscription for unknown user", {
        customer: {
          has_email: true,
        },
      });
      logEvent.emitSuccess(undefined, {
        outcome_reason: "user_not_found",
      });
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

    logEvent.emitSuccess(undefined, {
      outcome_reason: "subscription_synced",
      user: {
        id: String(user._id),
      },
    });
  },

  // Handle subscription updates (renewals, cancellations, etc.)
  onSubscriptionUpdated: async (ctx, event) => {
    const logEvent = createManualWideEventLogger({
      kind: "manual",
      operation: "polar_subscription_updated",
      context: {
        webhook: {
          provider: "polar",
        },
        subscription: {
          cancellation_reason_present: Boolean(
            event.data.customerCancellationReason
          ),
          has_product: Boolean(event.data.product?.id),
          id: event.data.id,
          status: event.data.status,
        },
      },
    });

    // Get user by email from subscription
    const customerEmail = event.data.customer?.email;
    if (!customerEmail) {
      logEvent.warn("Ignored Polar subscription update without customer email");
      logEvent.emitSuccess(undefined, {
        outcome_reason: "missing_customer_email",
      });
      return;
    }

    const user = await ctx.runQuery(internal.users.getUserByEmail, {
      email: customerEmail,
    });
    if (!user) {
      logEvent.warn("Ignored Polar subscription update for unknown user", {
        customer: {
          has_email: true,
        },
      });
      logEvent.emitSuccess(undefined, {
        outcome_reason: "user_not_found",
      });
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

    logEvent.emitSuccess(undefined, {
      outcome_reason: "subscription_synced",
      subscription: {
        canceled: isCancelled,
      },
      user: {
        id: String(user._id),
      },
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
  handler: withLoggedHttpAction("socialapi_webhook", async (ctx, request) => {
    const logEvent = getWideEventLogger(ctx);
    try {
      const payload = await request.json();
      logEvent?.set({
        webhook: {
          event: payload?.event,
          monitor_type: payload?.meta?.monitor_type,
          provider: "socialapi",
        },
      });

      // Validate event type - we only handle new_tweet
      if (payload.event !== "new_tweet") {
        logEvent?.info("Ignored SocialAPI webhook event", {
          reason: "unsupported_event",
          webhook: {
            event: payload.event,
          },
        });
        return new Response(JSON.stringify({ status: "ignored" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const { data: tweet, meta } = payload;

      // Validate required fields
      if (!meta?.monitor_id) {
        logEvent?.warn("Missing monitor_id in SocialAPI webhook", {
          status_code: 400,
        });
        return new Response(
          JSON.stringify({ status: "error", message: "Missing monitor_id" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (!tweet?.id_str) {
        logEvent?.warn("Missing tweet id_str in SocialAPI webhook", {
          status_code: 400,
        });
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
          logEvent?.info("Ignored unknown SocialAPI search monitor", {
            monitor: {
              external_id: meta.monitor_id,
            },
          });
          return new Response(
            JSON.stringify({ status: "ignored", message: "Unknown monitor" }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        if (monitor.status !== "active") {
          logEvent?.info("Ignored inactive SocialAPI search monitor", {
            monitor: {
              external_id: meta.monitor_id,
              status: monitor.status,
            },
          });
          return new Response(JSON.stringify({ status: "ignored" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        const capacityWorkspace = await ctx.runQuery(
          internal.workspaces.getById,
          {
            workspaceId: monitor.workspaceId,
          }
        );
        const limitState = await ctx.runQuery(
          internal.workflows.prospecting.checkProspectLimitInternal,
          {
            workspaceId: monitor.workspaceId,
          }
        );
        if (
          capacityWorkspace?.prospectingWorkflowStatus === "limit_reached" ||
          limitState.limitReached
        ) {
          await ctx.runAction(
            internal.workspaces.reconcileWorkspaceCapacityStateInternal,
            {
              workspaceId: monitor.workspaceId,
            }
          );
          logEvent?.info("Ignored capacity-paused SocialAPI search monitor", {
            monitor: {
              external_id: meta.monitor_id,
            },
            workspace: {
              id: String(monitor.workspaceId),
            },
          });
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
            internal.xConversationDiscovery
              .processConversationSeedWebhookInternal,
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
                  ? (result.prospectsCreatedDelta ?? 0)
                  : 0,
            }
          );
        } else {
          // Use Twitter user ID as externalId to prevent duplicates
          // (same user from multiple tweets should create only one prospect)
          const externalId = tweet.user?.id_str;
          if (!externalId) {
            logEvent?.warn("Missing tweet user.id_str in SocialAPI webhook", {
              status_code: 400,
              tweet: {
                id: tweet.id_str,
              },
            });
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

        const workspaceForLog = await ctx.runQuery(
          internal.workspaces.getById,
          {
            workspaceId: monitor.workspaceId,
          }
        );
        const workspaceLogContext = formatWorkspaceLogContext({
          workspaceId: String(monitor.workspaceId),
          workspaceName: workspaceForLog?.name,
        });

        logEvent?.info("Processed SocialAPI search monitor webhook", {
          monitor: {
            external_id: meta.monitor_id,
            purpose: monitorPurpose,
          },
          tweet: {
            id: tweet.id_str,
          },
          workspace: workspaceLogContext
            ? {
                summary: workspaceLogContext,
              }
            : undefined,
        });

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

        if (
          styleMonitor &&
          styleMonitor.status === "active" &&
          typeof styleMonitor.sourceVersion === "number"
        ) {
          const tweetText = tweet.full_text || tweet.text || "";
          const isRetweet = !!tweet.retweeted_status;
          const isReply = !!tweet.in_reply_to_status_id_str;

          await ctx.runMutation(internal.styleAnalysis.ingestStyleContent, {
            userId: styleMonitor.userId,
            platform: "twitter",
            sourceVersion: styleMonitor.sourceVersion,
            sourceExternalUserId: styleMonitor.monitoredExternalUserId,
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
        } else if (styleMonitor?.status === "active") {
          logEvent?.warn("Skipped style monitor ingest without sourceVersion", {
            monitor: {
              external_id: meta.monitor_id,
            },
          });
        }

        // --- Existing: prospect monitor logic ---
        const monitor = await ctx.runQuery(
          internal.prospectMonitors.getMonitorByExternalId,
          { monitorId: meta.monitor_id }
        );

        if (!monitor) {
          logEvent?.info("Ignored unknown SocialAPI prospect monitor", {
            monitor: {
              external_id: meta.monitor_id,
            },
          });
          return new Response(
            JSON.stringify({ status: "ignored", message: "Unknown monitor" }),
            {
              status: 200,
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
          logEvent?.info("Prospect replied to monitored tweet", {
            prospect: {
              id: String(monitor.prospectId),
            },
            tweet: {
              id: tweet.id_str,
              reply_to_id: monitor.ourTweetId,
            },
          });

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

        if (monitor.planId) {
          const binding = await ctx.runMutation(
            internal.outreach.bindNextPostTweetToPlan,
            {
              planId: monitor.planId,
              tweetData: tweet,
            }
          );

          if (binding.waitTaskId && binding.workflowId) {
            await ctx.runAction(
              internal.workflows.outreach.sendProspectNextPostEvent,
              {
                workflowId: binding.workflowId,
                taskId: binding.waitTaskId,
              }
            );
          }
        }

        logEvent?.info("Prospect posted monitored tweet", {
          prospect: {
            id: String(monitor.prospectId),
          },
          tweet: {
            id: tweet.id_str,
          },
        });

        return new Response(
          JSON.stringify({ status: "success", event: "prospect_tweeted" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Unknown monitor type
      logEvent?.info("Ignored SocialAPI webhook with unknown monitor type", {
        monitor: {
          type: monitorType,
        },
      });
      return new Response(JSON.stringify({ status: "ignored" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      logEvent?.error(error, {
        status_code: 500,
      });
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
  handler: withLoggedHttpAction("x_webhook_crc", async (_ctx, request) => {
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
  path: "/unipile-webhook",
  method: "POST",
  handler: withLoggedHttpAction("unipile_webhook", async (ctx, request) => {
    const logEvent = getWideEventLogger(ctx);
    const rawBody = await request.text();
    const expectedSecret = process.env.UNIPILE_WEBHOOK_SECRET?.trim();
    const receivedSecret = request.headers.get("x-reacherx-webhook-secret");

    logEvent?.set({
      webhook: {
        has_secret_header: Boolean(receivedSecret),
        provider: "unipile",
      },
    });

    if (expectedSecret && receivedSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Invalid webhook secret",
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
        internalLinkedIn.handleUnipileWebhookPayloadInternal,
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
      logEvent?.error(error, {
        status_code: 500,
      });
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
  method: "POST",
  handler: withLoggedHttpAction("x_webhook_event", async (ctx, request) => {
    const logEvent = getWideEventLogger(ctx);
    const rawBody = await request.text();
    const signature = request.headers.get("x-twitter-webhooks-signature");

    logEvent?.set({
      webhook: {
        has_signature: Boolean(signature),
        provider: "x",
      },
    });

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
      logEvent?.error(error, {
        status_code: 500,
      });
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
