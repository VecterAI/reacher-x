"use node";

import type { Id } from "../_generated/dataModel";
import {
  createEmptyTwitterViewerState,
  type TwitterPostRef,
  type TwitterViewerState,
} from "../../shared/lib/twitter/contracts";
import {
  getXConnectionStatusForUser,
  getXProviderContextForUser,
} from "./xdkAuth";
import {
  getBookmarks,
  getFollowing,
  getLikedPosts,
  getRepostedBy,
} from "./xdkTwitterProvider";

type XStoreRefs = {
  getXAccountForUserInternal: unknown;
  upsertXAccountInternal: unknown;
  patchXAccountInternal: unknown;
  deleteXAccountInternal: unknown;
  createXAuthSessionInternal: unknown;
  getXAuthSessionByStateInternal: unknown;
  completeXAuthSessionInternal: unknown;
};

const VIEWER_STATE_REQUIRED_SCOPES = [
  "tweet.read",
  "users.read",
  "like.read",
  "bookmark.read",
  "follows.read",
] as const;

const MAX_RESULTS = 100;

function nextToken(meta: any): string | undefined {
  return meta?.nextToken ?? meta?.next_token ?? meta?.paginationToken;
}

async function collectPagedIds<T>(args: {
  targetIds: string[];
  loadPage: (paginationToken?: string) => Promise<{ data?: T[]; meta?: any }>;
  extractId: (item: T) => string | undefined;
}): Promise<Set<string>> {
  const remaining = new Set(args.targetIds);
  const found = new Set<string>();
  let paginationToken: string | undefined;
  const seenPaginationTokens = new Set<string>();

  while (remaining.size > 0) {
    const response = await args.loadPage(paginationToken);
    for (const item of response.data ?? []) {
      const id = args.extractId(item);
      if (id && remaining.has(id)) {
        found.add(id);
        remaining.delete(id);
      }
    }

    paginationToken = nextToken(response.meta);
    if (!paginationToken || seenPaginationTokens.has(paginationToken)) {
      break;
    }
    seenPaginationTokens.add(paginationToken);
  }

  return found;
}

async function collectLikedPostIds(
  context: Awaited<ReturnType<typeof getXProviderContextForUser>>,
  targetIds: string[]
) {
  return await collectPagedIds({
    targetIds,
    loadPage: (paginationToken) =>
      getLikedPosts(context, {
        maxResults: MAX_RESULTS,
        paginationToken,
      }),
    extractId: (item: any) => item?.id,
  });
}

async function collectBookmarkedPostIds(
  context: Awaited<ReturnType<typeof getXProviderContextForUser>>,
  targetIds: string[]
) {
  return await collectPagedIds({
    targetIds,
    loadPage: (paginationToken) =>
      getBookmarks(context, {
        maxResults: MAX_RESULTS,
        paginationToken,
      }),
    extractId: (item: any) => item?.id,
  });
}

async function collectFollowingUserIds(
  context: Awaited<ReturnType<typeof getXProviderContextForUser>>,
  targetIds: string[]
) {
  return await collectPagedIds({
    targetIds,
    loadPage: (paginationToken) =>
      getFollowing(context, {
        maxResults: MAX_RESULTS,
        paginationToken,
      }),
    extractId: (item: any) => item?.id,
  });
}

async function collectRepostedPostIds(
  context: Awaited<ReturnType<typeof getXProviderContextForUser>>,
  viewerUserId: string,
  targetPostIds: string[]
) {
  const found = new Set<string>();

  for (const postId of targetPostIds) {
    let paginationToken: string | undefined;
    const seenPaginationTokens = new Set<string>();

    while (true) {
      const response = await getRepostedBy(context, postId, {
        maxResults: MAX_RESULTS,
        paginationToken,
      });
      const viewerHasReposted = (response.data ?? []).some(
        (user: any) => user?.id === viewerUserId
      );
      if (viewerHasReposted) {
        found.add(postId);
        break;
      }

      paginationToken = nextToken(response.meta);
      if (!paginationToken || seenPaginationTokens.has(paginationToken)) {
        break;
      }
      seenPaginationTokens.add(paginationToken);
    }
  }

  return found;
}

export async function getTwitterViewerStatesForUser(
  ctx: any,
  store: XStoreRefs,
  args: {
    userId: Id<"users">;
    postRefs: TwitterPostRef[];
  }
): Promise<TwitterViewerState[]> {
  const postRefs = Array.from(
    new Map(
      args.postRefs
        .filter((postRef) => Boolean(postRef?.postId))
        .map((postRef) => [postRef.postId, postRef] as const)
    ).values()
  ).slice(0, 24);

  if (postRefs.length === 0) {
    return [];
  }

  const connectionStatus = await getXConnectionStatusForUser(
    ctx,
    store,
    args.userId
  );
  const now = Date.now();
  if (!connectionStatus.isConnected) {
    return postRefs.map((postRef) =>
      createEmptyTwitterViewerState({
        postId: postRef.postId,
        requiresConnection: true,
        connectedAccountId: connectionStatus.connectedAccountId,
        resolution: "requires_connection",
        lastSyncedAt: now,
      })
    );
  }

  const providerContext = await getXProviderContextForUser(ctx, store, {
    userId: args.userId,
    requiredScopes: [...VIEWER_STATE_REQUIRED_SCOPES],
  });

  const targetPostIds = postRefs.map((postRef) => postRef.postId);
  const targetAuthorIds = Array.from(
    new Set(
      postRefs
        .map((postRef) => postRef.authorId)
        .filter((authorId): authorId is string => Boolean(authorId))
    )
  );
  let likedVerified = true;
  let bookmarkedVerified = true;
  let followingVerified = true;
  let repostedVerified = true;

  const [likedPostIds, bookmarkedPostIds, followingUserIds, repostedPostIds] =
    await Promise.all([
      collectLikedPostIds(providerContext, targetPostIds).catch(() => {
        likedVerified = false;
        return new Set<string>();
      }),
      collectBookmarkedPostIds(providerContext, targetPostIds).catch(() => {
        bookmarkedVerified = false;
        return new Set<string>();
      }),
      targetAuthorIds.length > 0
        ? collectFollowingUserIds(providerContext, targetAuthorIds).catch(
            () => {
              followingVerified = false;
              return new Set<string>();
            }
          )
        : Promise.resolve(new Set<string>()),
      collectRepostedPostIds(
        providerContext,
        providerContext.xUserId,
        targetPostIds
      ).catch(() => {
        repostedVerified = false;
        return new Set<string>();
      }),
    ]);

  return postRefs.map((postRef) => {
    const resolution =
      likedVerified &&
      bookmarkedVerified &&
      followingVerified &&
      repostedVerified
        ? "verified"
        : "unknown";

    return {
      ...createEmptyTwitterViewerState({
        postId: postRef.postId,
        connectedAccountId: connectionStatus.connectedAccountId,
        resolution,
        lastSyncedAt: now,
      }),
      liked: likedPostIds.has(postRef.postId),
      retweeted: repostedPostIds.has(postRef.postId),
      bookmarked: bookmarkedPostIds.has(postRef.postId),
      followingAuthor: postRef.authorId
        ? followingUserIds.has(postRef.authorId)
        : false,
    };
  });
}
