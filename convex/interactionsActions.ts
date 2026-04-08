"use node";

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { action, internalAction } from "./lib/functionBuilders";
import { api, internal } from "./_generated/api";
import { acquireSocialApiBudget } from "./lib/socialApiBudget";
import {
  getTwitterPostId,
  getTwitterPostRef,
  summarizeTwitterPost,
} from "../shared/lib/twitter/contracts";
import { resolveProspectTwitterIdentity } from "../shared/lib/twitter/prospectTwitterIdentity";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { getXConnectionStatusForUser } from "./lib/xdkAuth";

const SOCIALAPI_BASE_URL = "https://api.socialapi.me";
const INTERACTION_REFRESH_COOLDOWN_MS = 60_000;

type SocialApiSearchResponse = {
  next_cursor?: string;
  tweets?: unknown[];
  status?: string;
  message?: string;
};

type SyncStateDoc = Doc<"twitterInteractionSyncStates">;

type ProspectInteractionRefreshResult = {
  createdCount: number;
  trackingStartedAt: number;
  lastSuccessAt: number | null;
  skipped: boolean;
};

function normalizeHandle(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().replace(/^@/, "");
  return normalized.length > 0 ? normalized : undefined;
}

function buildSinceTimeOperator(timestampMs: number) {
  return `since_time:${Math.floor(timestampMs / 1000)}`;
}

function getSyncCheckpoint(
  syncState: SyncStateDoc | null,
  fallbackStartAt: number
) {
  if (typeof syncState?.lastSeenCreatedAt === "number") {
    return syncState.lastSeenCreatedAt;
  }
  return syncState?.trackingStartedAt ?? fallbackStartAt;
}

function getSourceSummaryAndRef(tweet: unknown) {
  const record =
    tweet && typeof tweet === "object" ? (tweet as Record<string, unknown>) : {};
  const quotedStatus = record.quoted_status;
  const quotedRef = getTwitterPostRef(quotedStatus);
  if (quotedRef) {
    return {
      sourcePostRef: quotedRef,
      sourcePostSummary: summarizeTwitterPost(quotedStatus) ?? null,
    };
  }

  const inReplyToStatusId =
    typeof record.in_reply_to_status_id_str === "string"
      ? record.in_reply_to_status_id_str
      : undefined;
  const conversationId =
    typeof record.conversation_id_str === "string"
      ? record.conversation_id_str
      : undefined;
  const inReplyToScreenName =
    typeof record.in_reply_to_screen_name === "string"
      ? normalizeHandle(record.in_reply_to_screen_name)
      : undefined;

  if (inReplyToStatusId) {
    return {
      sourcePostRef: {
        platform: "twitter" as const,
        postId: inReplyToStatusId,
        conversationId: conversationId ?? inReplyToStatusId,
        authorHandle: inReplyToScreenName,
      },
      sourcePostSummary: null,
    };
  }

  if (conversationId && conversationId !== getTwitterPostId(tweet)) {
    return {
      sourcePostRef: {
        platform: "twitter" as const,
        postId: conversationId,
        conversationId,
      },
      sourcePostSummary: null,
    };
  }

  const sourcePostRef = getTwitterPostRef(tweet);
  return {
    sourcePostRef: sourcePostRef ?? null,
    sourcePostSummary: summarizeTwitterPost(tweet) ?? null,
  };
}

function buildParticipants(args: {
  prospect: ReturnType<typeof resolveProspectTwitterIdentity>;
  viewerHandle?: string;
  viewerName?: string;
  viewerAvatarUrl?: string;
  tweet?: unknown;
}) {
  const participants = new Map<
    string,
    { handle?: string; name?: string; avatarUrl?: string; isViewer?: boolean }
  >();

  if (args.prospect.username || args.prospect.displayName) {
    participants.set(args.prospect.username ?? "prospect", {
      handle: args.prospect.username,
      name: args.prospect.displayName,
      avatarUrl: args.prospect.avatarUrl,
    });
  }

  if (args.viewerHandle || args.viewerName) {
    participants.set(args.viewerHandle ?? "viewer", {
      handle: args.viewerHandle,
      name: args.viewerName ?? "You",
      avatarUrl: args.viewerAvatarUrl,
      isViewer: true,
    });
  }

  const author =
    args.tweet &&
    typeof args.tweet === "object" &&
    (args.tweet as Record<string, unknown>).user &&
    typeof (args.tweet as Record<string, unknown>).user === "object"
      ? ((args.tweet as Record<string, unknown>).user as Record<string, unknown>)
      : undefined;
  const authorHandle =
    typeof author?.screen_name === "string"
      ? normalizeHandle(author.screen_name)
      : undefined;
  const authorName =
    typeof author?.name === "string" ? author.name : undefined;
  const authorAvatar =
    typeof author?.profile_image_url_https === "string"
      ? author.profile_image_url_https
      : undefined;
  if (authorHandle || authorName) {
    participants.set(authorHandle ?? authorName ?? "author", {
      handle: authorHandle,
      name: authorName,
      avatarUrl: authorAvatar,
      isViewer: authorHandle === args.viewerHandle,
    });
  }

  return Array.from(participants.values());
}

async function searchSocialApiTweets(args: {
  ctx: ActionCtx;
  query: string;
}): Promise<unknown[]> {
  const apiKey = process.env.SOCIALAPI_API_KEY;
  if (!apiKey) {
    throw new Error("SOCIALAPI_API_KEY is not set");
  }

  const params = new URLSearchParams({
    query: args.query,
    type: "Latest",
  });
  await acquireSocialApiBudget(args.ctx, "interactions.searchSocialApiTweets");
  const response = await fetch(
    `${SOCIALAPI_BASE_URL}/twitter/search?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    }
  );

  const payload = (await response.json()) as SocialApiSearchResponse;
  if (!response.ok) {
    throw new Error(payload.message ?? `HTTP ${response.status}`);
  }

  return Array.isArray(payload.tweets) ? payload.tweets : [];
}

export const runProspectInteractionDiscovery = internalAction({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    force: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<ProspectInteractionRefreshResult> => {
    const prospect = await ctx.runQuery(internal.prospects.getProspectInternal, {
      prospectId: args.prospectId,
    });
    if (!prospect || prospect.platform !== "twitter") {
      throw new Error("Prospect not found");
    }

    const connectionStatus = await getXConnectionStatusForUser(
      ctx,
      internal.xStore,
      args.userId
    );
    const existingSyncState: SyncStateDoc | null = await ctx.runQuery(
      internal.interactions.getProspectInteractionSyncStateInternal,
      {
        userId: args.userId,
        prospectId: args.prospectId,
      }
    );
    const trackingStartedAt =
      connectionStatus.connectedAt ??
      existingSyncState?.trackingStartedAt ??
      Date.now();

    if (!connectionStatus.isConnected || !connectionStatus.screenName) {
      return {
        createdCount: 0,
        trackingStartedAt,
        lastSuccessAt: existingSyncState?.lastSuccessAt ?? null,
        skipped: true,
      };
    }

    const viewerHandle = normalizeHandle(connectionStatus.screenName);
    const prospectIdentity = resolveProspectTwitterIdentity(prospect);
    const prospectHandle = normalizeHandle(prospectIdentity.username);

    if (!viewerHandle || !prospectHandle) {
      throw new Error("Prospect or viewer handle is unavailable.");
    }

    const now = Date.now();

    if (
      !args.force &&
      typeof existingSyncState?.nextAllowedSyncAt === "number" &&
      existingSyncState.nextAllowedSyncAt > now
    ) {
      return {
        createdCount: 0,
        trackingStartedAt,
        lastSuccessAt: existingSyncState.lastSuccessAt ?? null,
        skipped: true,
      };
    }

    await ctx.runMutation(
      internal.interactions.upsertProspectInteractionSyncStateInternal,
      {
        userId: args.userId,
        prospectId: args.prospectId,
        trackingStartedAt,
        lastAttemptAt: now,
        nextAllowedSyncAt: now + INTERACTION_REFRESH_COOLDOWN_MS,
        failureCount: existingSyncState?.failureCount ?? 0,
      }
    );

    const checkpoint = getSyncCheckpoint(existingSyncState, trackingStartedAt);
    const sinceTime = buildSinceTimeOperator(checkpoint);
    const outgoingQuery = `from:${viewerHandle} @${prospectHandle} ${sinceTime}`;
    const incomingQuery = `from:${prospectHandle} @${viewerHandle} ${sinceTime}`;

    try {
      const [outgoingTweets, incomingTweets] = await Promise.all([
        searchSocialApiTweets({ ctx, query: outgoingQuery }),
        searchSocialApiTweets({ ctx, query: incomingQuery }),
      ]);

      const allTweets = [...outgoingTweets, ...incomingTweets];
      const seenReplyIds = new Set<string>();
      let createdCount = 0;
      let newestCreatedAt = existingSyncState?.lastSeenCreatedAt ?? checkpoint;
      let newestPostId = existingSyncState?.lastSeenPostId;

      for (const tweet of allTweets) {
        const replyPostRef = getTwitterPostRef(tweet);
        if (!replyPostRef?.postId || seenReplyIds.has(replyPostRef.postId)) {
          continue;
        }
        seenReplyIds.add(replyPostRef.postId);

        const replyPostSummary = summarizeTwitterPost(tweet) ?? null;
        const { sourcePostRef, sourcePostSummary } = getSourceSummaryAndRef(tweet);
        if (!sourcePostRef) {
          continue;
        }

        const direction =
          replyPostSummary?.author?.handle === viewerHandle
            ? "outgoing"
            : "incoming";
        const createdAt = replyPostSummary?.createdAt ?? getCurrentUTCTimestamp();
        if (createdAt > newestCreatedAt) {
          newestCreatedAt = createdAt;
          newestPostId = replyPostRef.postId;
        }

        await ctx.runMutation(internal.outreach.upsertTwitterInteraction, {
          userId: args.userId,
          prospectId: args.prospectId,
          sourcePostRef,
          sourcePostSummary: sourcePostSummary ?? undefined,
          replyPostRef,
          replyPostSummary: replyPostSummary ?? undefined,
          threadId:
            sourcePostRef.conversationId ??
            replyPostRef.conversationId ??
            sourcePostRef.postId,
          repliedAt: createdAt,
          origin: direction === "outgoing" ? "external_x" : "unknown",
          discoveredVia: "socialapi_incremental",
          status: "active",
          direction,
          discoveredAt: createdAt,
          lastSeenAt: now,
          participants: buildParticipants({
            prospect: prospectIdentity,
            viewerHandle,
            viewerName: connectionStatus.name,
            viewerAvatarUrl: connectionStatus.profileImageUrl,
            tweet,
          }),
        });
        createdCount += 1;
      }

      await ctx.runMutation(
        internal.interactions.upsertProspectInteractionSyncStateInternal,
        {
          userId: args.userId,
          prospectId: args.prospectId,
          trackingStartedAt,
          lastAttemptAt: now,
          lastSuccessAt: now,
          lastSeenPostId: newestPostId,
          lastSeenCreatedAt: newestCreatedAt,
          nextAllowedSyncAt: now + INTERACTION_REFRESH_COOLDOWN_MS,
          failureCount: 0,
          lastErrorMessage: "",
        }
      );

      return {
        createdCount,
        trackingStartedAt,
        lastSuccessAt: now,
        skipped: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await ctx.runMutation(
        internal.interactions.upsertProspectInteractionSyncStateInternal,
        {
          userId: args.userId,
          prospectId: args.prospectId,
          trackingStartedAt,
          lastAttemptAt: now,
          nextAllowedSyncAt: now + INTERACTION_REFRESH_COOLDOWN_MS,
          failureCount: (existingSyncState?.failureCount ?? 0) + 1,
          lastErrorMessage: message,
        }
      );
      throw error;
    }
  },
});

export const refreshProspectInteractions = action({
  args: {
    prospectId: v.id("prospects"),
    force: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<ProspectInteractionRefreshResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const user = await ctx.runQuery(api.users.getUserByWorkosId, {
      workosUserId: identity.subject,
    });
    if (!user) {
      throw new Error("User not found");
    }
    const prospect = await ctx.runQuery(api.prospects.getProspect, {
      prospectId: args.prospectId,
    });
    if (!prospect) {
      throw new Error("Prospect not found");
    }
    return await ctx.runAction(
      internal.interactionsActions.runProspectInteractionDiscovery,
      {
        userId: user._id,
        prospectId: args.prospectId,
        force: args.force,
      }
    );
  },
});

export const recordWebhookInteractionInternal = internalAction({
  args: {
    prospectId: v.id("prospects"),
    sourcePostId: v.string(),
    replyTweet: v.any(),
  },
  handler: async (
    ctx,
    args
  ): Promise<Id<"twitterInteractions"> | null> => {
    const prospect: Doc<"prospects"> | null = await ctx.runQuery(
      internal.prospects.getProspectInternal,
      { prospectId: args.prospectId }
    );
    if (!prospect) {
      return null;
    }

    const prospectIdentity = resolveProspectTwitterIdentity(prospect);
    const replyPostRef = getTwitterPostRef(args.replyTweet);
    if (!replyPostRef?.postId) {
      return null;
    }

    const replySummary = summarizeTwitterPost(args.replyTweet);
    const sourcePostRef = {
      platform: "twitter" as const,
      postId: args.sourcePostId,
      conversationId: replyPostRef.conversationId ?? args.sourcePostId,
    };

    return await ctx.runMutation(internal.outreach.upsertTwitterInteraction, {
      userId: prospect.userId,
      prospectId: args.prospectId,
      sourcePostRef,
      replyPostRef,
      replyPostSummary: replySummary ?? undefined,
      threadId: sourcePostRef.conversationId ?? sourcePostRef.postId,
      repliedAt: replySummary?.createdAt ?? getCurrentUTCTimestamp(),
      origin: "external_x",
      discoveredVia: "socialapi_webhook",
      status: "active",
      direction: "incoming",
      discoveredAt: replySummary?.createdAt ?? getCurrentUTCTimestamp(),
      lastSeenAt: getCurrentUTCTimestamp(),
      participants: buildParticipants({
        prospect: prospectIdentity,
        tweet: args.replyTweet,
      }),
    });
  },
});
