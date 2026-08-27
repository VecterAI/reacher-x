"use node";

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { action, internalAction } from "./lib/functionBuilders";
import { api, internal } from "./_generated/api";
import { fetchSocialApi } from "./lib/socialApiFetch";
import {
  getTwitterPostId,
  getTwitterPostRef,
  summarizeTwitterPost,
} from "../shared/lib/twitter/contracts";
import { resolveProspectTwitterIdentity } from "../shared/lib/twitter/prospectTwitterIdentity";
import {
  getCurrentUTCTimestamp,
  parseIsoToTimestamp,
} from "../shared/lib/utils/time/timeUtils";
import { getXConnectionStatusForUser } from "./lib/xdkAuth";
import {
  listLinkedInPostComments,
  listLinkedInUserComments,
  listLinkedInUserPosts,
  type LinkedInUnipileComment,
  type LinkedInUnipilePost,
} from "./lib/unipileClient";
import { resolveLinkedInProspectProfileIdentifiers } from "./integrations/linkedin/profileIdentity";
import {
  getNestedRecord,
  getNumberProperty,
  getStringProperty,
  isRecord,
} from "./lib/typeGuards";
import {
  buildTwitterInteractionSearchQueries,
  getLinkedInCommentAuthorIdentifiers,
  getLinkedInPostIdentifiers,
  getStoredLinkedInInteractionCandidateMetadata,
  isReciprocalTwitterReply,
  normalizeLinkedInActorIdentifier,
} from "./lib/prospectInteractionSyncCore";

const SOCIALAPI_BASE_URL = "https://api.socialapi.me";
const INTERACTION_REFRESH_COOLDOWN_MS = 60_000;
const SOCIALAPI_SEARCH_PAGE_LIMIT = 2;
const SOCIALAPI_TIMELINE_PAGE_LIMIT = 2;
const LINKEDIN_PAGE_LIMIT = 100;
const LINKEDIN_MAX_PAGES = 3;
const LINKEDIN_REPLY_THREAD_LIMIT = 30;

type SocialApiSearchResponse = {
  next_cursor?: string;
  tweets?: unknown[];
  status?: string;
  message?: string;
};

type SyncStateDoc = Doc<"prospectInteractionSyncStates">;

type ProspectInteractionRefreshResult = {
  createdCount: number;
  trackingStartedAt: number;
  lastSuccessAt: number | null;
  skipped: boolean;
};

type LinkedInInteractionCandidate = {
  commentId: string;
  postId: string;
  text: string;
  createdAt: number;
  replyCount?: number;
  interactionType: "comment_posted" | "comment_reply_posted";
  direction: "outgoing";
  sourcePostData?: unknown;
  sourceUrl?: string;
};

type SocialApiSearchPage = {
  tweets: unknown[];
  nextCursor?: string;
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
    tweet && typeof tweet === "object"
      ? (tweet as Record<string, unknown>)
      : {};
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
      ? ((args.tweet as Record<string, unknown>).user as Record<
          string,
          unknown
        >)
      : undefined;
  const authorHandle =
    typeof author?.screen_name === "string"
      ? normalizeHandle(author.screen_name)
      : undefined;
  const authorName = typeof author?.name === "string" ? author.name : undefined;
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
  cursor?: string;
}): Promise<SocialApiSearchPage> {
  const apiKey = process.env.SOCIALAPI_API_KEY;
  if (!apiKey) {
    throw new Error("SOCIALAPI_API_KEY is not set");
  }

  const params = new URLSearchParams({
    query: args.query,
    type: "Latest",
  });
  if (args.cursor) {
    params.set("cursor", args.cursor);
  }
  const response = await fetchSocialApi(
    args.ctx,
    "interactions.searchSocialApiTweets",
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

  return {
    tweets: Array.isArray(payload.tweets) ? payload.tweets : [],
    nextCursor:
      typeof payload.next_cursor === "string" && payload.next_cursor.length > 0
        ? payload.next_cursor
        : undefined,
  };
}

async function searchSocialApiTweetPages(args: {
  ctx: ActionCtx;
  query: string;
}): Promise<unknown[]> {
  const tweets: unknown[] = [];
  let cursor: string | undefined;

  for (
    let pageIndex = 0;
    pageIndex < SOCIALAPI_SEARCH_PAGE_LIMIT;
    pageIndex++
  ) {
    const page = await searchSocialApiTweets({ ...args, cursor });
    tweets.push(...page.tweets);
    if (!page.nextCursor || page.nextCursor === cursor) {
      break;
    }
    cursor = page.nextCursor;
  }

  return tweets;
}

async function listSocialApiUserTweetReplyPages(args: {
  ctx: ActionCtx;
  xUserId: string;
}): Promise<unknown[]> {
  const apiKey = process.env.SOCIALAPI_API_KEY;
  if (!apiKey) {
    throw new Error("SOCIALAPI_API_KEY is not set");
  }

  const tweets: unknown[] = [];
  let cursor: string | undefined;

  for (
    let pageIndex = 0;
    pageIndex < SOCIALAPI_TIMELINE_PAGE_LIMIT;
    pageIndex++
  ) {
    const url = new URL(
      `${SOCIALAPI_BASE_URL}/twitter/user/${args.xUserId}/tweets-and-replies`
    );
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const response = await fetchSocialApi(
      args.ctx,
      "interactions.listSocialApiUserTweetReplies",
      url,
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

    tweets.push(...(Array.isArray(payload.tweets) ? payload.tweets : []));
    const nextCursor =
      typeof payload.next_cursor === "string" && payload.next_cursor.length > 0
        ? payload.next_cursor
        : undefined;
    if (!nextCursor || nextCursor === cursor) {
      break;
    }
    cursor = nextCursor;
  }

  return tweets;
}

function getLinkedInCommentTimestamp(comment: LinkedInUnipileComment): number {
  return comment.date
    ? (parseIsoToTimestamp(comment.date) ?? getCurrentUTCTimestamp())
    : getCurrentUTCTimestamp();
}

async function listLinkedInUserPostPages(args: {
  accountId: string;
  userId: string;
}): Promise<LinkedInUnipilePost[]> {
  const posts: LinkedInUnipilePost[] = [];
  let cursor: string | undefined;

  for (let pageIndex = 0; pageIndex < LINKEDIN_MAX_PAGES; pageIndex++) {
    const page = await listLinkedInUserPosts({
      ...args,
      cursor,
      limit: LINKEDIN_PAGE_LIMIT,
    });
    const pageItems = Array.isArray(page.items) ? page.items : [];
    posts.push(...pageItems);
    if (pageItems.length < LINKEDIN_PAGE_LIMIT) {
      break;
    }
    if (!page.cursor || page.cursor === cursor) {
      break;
    }
    cursor = page.cursor;
  }

  return posts;
}

async function listLinkedInUserCommentPages(args: {
  accountId: string;
  userId: string;
}): Promise<LinkedInUnipileComment[]> {
  const comments: LinkedInUnipileComment[] = [];
  let cursor: string | undefined;

  for (let pageIndex = 0; pageIndex < LINKEDIN_MAX_PAGES; pageIndex++) {
    const page = await listLinkedInUserComments({
      ...args,
      cursor,
      limit: LINKEDIN_PAGE_LIMIT,
    });
    const pageItems = Array.isArray(page.items) ? page.items : [];
    comments.push(...pageItems);
    if (pageItems.length < LINKEDIN_PAGE_LIMIT) {
      break;
    }
    if (!page.cursor || page.cursor === cursor) {
      break;
    }
    cursor = page.cursor;
  }

  return comments;
}

async function listLinkedInCommentReplyPages(args: {
  accountId: string;
  postId: string;
  commentId: string;
}): Promise<LinkedInUnipileComment[]> {
  const comments: LinkedInUnipileComment[] = [];
  let cursor: string | undefined;

  for (let pageIndex = 0; pageIndex < LINKEDIN_MAX_PAGES; pageIndex++) {
    const page = await listLinkedInPostComments({
      ...args,
      cursor,
      limit: LINKEDIN_PAGE_LIMIT,
      sortBy: "MOST_RECENT",
    });
    const pageItems = Array.isArray(page.items) ? page.items : [];
    comments.push(...pageItems);
    if (pageItems.length < LINKEDIN_PAGE_LIMIT) {
      break;
    }
    if (!page.cursor || page.cursor === cursor) {
      break;
    }
    cursor = page.cursor;
  }

  return comments;
}

export const runTwitterProspectInteractionDiscovery = internalAction({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ProspectInteractionRefreshResult> => {
    const prospect = await ctx.runQuery(
      internal.prospects.getProspectInternal,
      {
        prospectId: args.prospectId,
      }
    );
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
      getCurrentUTCTimestamp();

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

    const now = getCurrentUTCTimestamp();

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
    const { outgoing: outgoingQuery, incoming: incomingQuery } =
      buildTwitterInteractionSearchQueries({
        viewerHandle,
        prospectHandle,
        sinceTimeOperator: sinceTime,
      });

    try {
      const [outgoingTweets, incomingTweets] = await Promise.all([
        searchSocialApiTweetPages({ ctx, query: outgoingQuery }),
        searchSocialApiTweetPages({ ctx, query: incomingQuery }),
      ]);

      const prospectXUserId = prospectIdentity.userId;
      const shouldCheckProspectTimeline =
        incomingTweets.length === 0 &&
        Boolean(prospectXUserId) &&
        outgoingTweets.some(
          (tweet) =>
            isRecord(tweet) &&
            (getNumberProperty(tweet, "reply_count") ?? 0) > 0
        );
      const prospectTimelineTweets =
        shouldCheckProspectTimeline && prospectXUserId
          ? await listSocialApiUserTweetReplyPages({
              ctx,
              xUserId: prospectXUserId,
            })
          : [];

      const reciprocalTimelineTweets = prospectTimelineTweets.filter((tweet) =>
        isReciprocalTwitterReply({
          tweet,
          viewerHandle,
          viewerUserId: connectionStatus.xUserId,
          prospectHandle,
          prospectUserId: prospectIdentity.userId,
        })
      );

      const allTweets = [
        ...outgoingTweets,
        ...incomingTweets,
        ...reciprocalTimelineTweets,
      ];
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
        const { sourcePostRef, sourcePostSummary } =
          getSourceSummaryAndRef(tweet);
        if (!sourcePostRef) {
          continue;
        }

        const direction =
          replyPostSummary?.author?.handle === viewerHandle
            ? "outgoing"
            : "incoming";
        const createdAt =
          replyPostSummary?.createdAt ?? getCurrentUTCTimestamp();
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

export const runLinkedInProspectInteractionDiscovery = internalAction({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, args): Promise<ProspectInteractionRefreshResult> => {
    const prospect: Doc<"prospects"> | null = await ctx.runQuery(
      internal.prospects.getProspectInternal,
      { prospectId: args.prospectId }
    );
    if (
      !prospect ||
      prospect.userId !== args.userId ||
      prospect.platform !== "linkedin"
    ) {
      throw new Error("LinkedIn prospect not found");
    }

    const account: Doc<"linkedinAccounts"> | null = await ctx.runQuery(
      internal.linkedinStore.getLinkedInAccountForUserInternal,
      { userId: args.userId }
    );
    if (!account?.accountId || !account.providerId) {
      throw new Error("Connect LinkedIn before syncing public interactions.");
    }

    const prospectIdentity = resolveLinkedInProspectProfileIdentifiers(
      prospect as unknown as Record<string, unknown>
    );
    if (!prospectIdentity.profileUrn) {
      throw new Error("This prospect is missing a LinkedIn provider id.");
    }

    const now = getCurrentUTCTimestamp();
    const [prospectPosts, viewerComments, storedInteractions] =
      await Promise.all([
        listLinkedInUserPostPages({
          accountId: account.accountId,
          userId: prospectIdentity.profileUrn,
        }),
        listLinkedInUserCommentPages({
          accountId: account.accountId,
          userId: account.providerId,
        }),
        ctx.runQuery(internal.interactions.getProspectInteractionsInternal, {
          userId: args.userId,
          prospectId: args.prospectId,
          platform: "linkedin",
          limit: LINKEDIN_REPLY_THREAD_LIMIT,
        }),
      ]);

    const sourcePostsById = new Map<string, LinkedInUnipilePost>();
    for (const post of prospectPosts) {
      for (const postId of getLinkedInPostIdentifiers(post)) {
        sourcePostsById.set(postId, post);
      }
    }

    const candidates = new Map<string, LinkedInInteractionCandidate>();
    for (const comment of viewerComments) {
      const sourcePost = sourcePostsById.get(comment.post_id);
      if (!sourcePost || !comment.id) {
        continue;
      }
      candidates.set(comment.id, {
        commentId: comment.id,
        postId: comment.post_id,
        text: comment.text?.trim() ?? "",
        createdAt: getLinkedInCommentTimestamp(comment),
        replyCount: comment.reply_counter,
        interactionType: "comment_posted",
        direction: "outgoing",
        sourcePostData: sourcePost,
        sourceUrl: sourcePost.share_url,
      });
    }

    for (const interaction of storedInteractions) {
      const metadata = getStoredLinkedInInteractionCandidateMetadata({
        interactionType: interaction.interactionType,
        direction: interaction.direction,
      });
      if (!metadata || candidates.has(interaction.replyPostId)) {
        continue;
      }
      candidates.set(interaction.replyPostId, {
        commentId: interaction.replyPostId,
        postId: interaction.sourcePostId,
        text: interaction.replyText ?? "",
        createdAt: interaction.repliedAt,
        sourcePostData: interaction.sourcePostData,
        sourceUrl: interaction.sourceUrl,
        ...metadata,
      });
    }

    const prospectActorIds = new Set(
      [prospectIdentity.profileUrn, prospectIdentity.username]
        .map(normalizeLinkedInActorIdentifier)
        .filter((value): value is string => Boolean(value))
    );
    const prospectAuthor = getNestedRecord(
      getNestedRecord(prospect, "data"),
      "author"
    );
    const participants = [
      {
        id: prospectIdentity.profileUrn,
        handle: prospectIdentity.username,
        name: prospect.displayName ?? prospectIdentity.username,
        avatarUrl: getStringProperty(prospectAuthor, "profilePictureURL"),
      },
      {
        id: account.providerId,
        handle: account.publicIdentifier ?? account.username,
        name: account.displayName ?? "You",
        avatarUrl: account.profileImageUrl,
        isViewer: true,
      },
    ];

    let syncedCount = 0;
    for (const candidate of candidates.values()) {
      await ctx.runMutation(
        internal.interactions.upsertLinkedInCommentInteractionInternal,
        {
          userId: args.userId,
          prospectId: args.prospectId,
          sourcePostId: candidate.postId,
          replyPostId: candidate.commentId,
          threadId: candidate.postId,
          sourcePostData: candidate.sourcePostData,
          sourceUrl: candidate.sourceUrl,
          replyText: candidate.text,
          interactionType: candidate.interactionType,
          origin: "unknown",
          discoveredVia: "live_reconcile",
          status: "active",
          direction: candidate.direction,
          discoveredAt: candidate.createdAt,
          lastSeenAt: now,
          participants,
        }
      );
      syncedCount++;
    }

    const replyCandidates = Array.from(candidates.values())
      .filter((candidate) => candidate.replyCount !== 0)
      .slice(0, LINKEDIN_REPLY_THREAD_LIMIT);
    for (const candidate of replyCandidates) {
      const replies = await listLinkedInCommentReplyPages({
        accountId: account.accountId,
        postId: candidate.postId,
        commentId: candidate.commentId,
      });

      for (const reply of replies) {
        const isProspectReply = getLinkedInCommentAuthorIdentifiers(reply).some(
          (identifier) => prospectActorIds.has(identifier)
        );
        if (!isProspectReply || !reply.id) {
          continue;
        }

        const repliedAt = getLinkedInCommentTimestamp(reply);
        await ctx.runMutation(
          internal.interactions.upsertLinkedInCommentInteractionInternal,
          {
            userId: args.userId,
            prospectId: args.prospectId,
            sourcePostId: candidate.postId,
            replyPostId: reply.id,
            threadId: candidate.postId,
            sourcePostData: candidate.sourcePostData,
            sourceUrl: candidate.sourceUrl,
            replyText: reply.text?.trim() ?? "",
            interactionType: "comment_reply_posted",
            origin: "unknown",
            discoveredVia: "live_reconcile",
            status: "active",
            direction: "incoming",
            discoveredAt: repliedAt,
            lastSeenAt: now,
            participants,
          }
        );
        syncedCount++;
      }
    }

    return {
      createdCount: syncedCount,
      trackingStartedAt: now,
      lastSuccessAt: now,
      skipped: false,
    };
  },
});

export const runProspectInteractionDiscovery = internalAction({
  args: {
    userId: v.id("users"),
    prospectId: v.id("prospects"),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ProspectInteractionRefreshResult> => {
    const prospect = await ctx.runQuery(
      internal.prospects.getProspectInternal,
      { prospectId: args.prospectId }
    );
    if (!prospect || prospect.userId !== args.userId) {
      throw new Error("Prospect not found");
    }

    if (prospect.platform === "linkedin") {
      return await ctx.runAction(
        internal.interactionsActions.runLinkedInProspectInteractionDiscovery,
        {
          userId: args.userId,
          prospectId: args.prospectId,
        }
      );
    }

    return await ctx.runAction(
      internal.interactionsActions.runTwitterProspectInteractionDiscovery,
      args
    );
  },
});

export const refreshProspectInteractions = action({
  args: {
    prospectId: v.id("prospects"),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ProspectInteractionRefreshResult> => {
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
  handler: async (ctx, args): Promise<Id<"prospectInteractions"> | null> => {
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
