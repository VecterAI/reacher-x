import type { Tweet } from "@/features/threads/types";

function nonEmpty(value: string | null | undefined): string | undefined {
  return value?.trim() ? value : undefined;
}

export function mergeConversationTweetWithFallback(
  fallback: Tweet | null | undefined,
  hydrated: Tweet | null | undefined
): Tweet | null {
  if (!hydrated) {
    return fallback ?? null;
  }
  if (!fallback) {
    return hydrated;
  }

  const fallbackUser = fallback.user;
  const hydratedUser = hydrated.user;

  return {
    ...fallback,
    ...hydrated,
    id_str: nonEmpty(hydrated.id_str) ?? fallback.id_str,
    full_text:
      nonEmpty(hydrated.full_text) ??
      nonEmpty(hydrated.text) ??
      nonEmpty(fallback.full_text) ??
      nonEmpty(fallback.text),
    text:
      nonEmpty(hydrated.text) ??
      nonEmpty(hydrated.full_text) ??
      nonEmpty(fallback.text) ??
      nonEmpty(fallback.full_text),
    tweet_created_at:
      nonEmpty(hydrated.tweet_created_at) ?? fallback.tweet_created_at,
    conversation_id_str:
      nonEmpty(hydrated.conversation_id_str) ?? fallback.conversation_id_str,
    in_reply_to_status_id_str:
      nonEmpty(hydrated.in_reply_to_status_id_str) ??
      fallback.in_reply_to_status_id_str,
    in_reply_to_screen_name:
      nonEmpty(hydrated.in_reply_to_screen_name) ??
      fallback.in_reply_to_screen_name,
    source: nonEmpty(hydrated.source) ?? fallback.source,
    entities: hydrated.entities ?? fallback.entities,
    user: hydratedUser
      ? {
          ...fallbackUser,
          ...hydratedUser,
          name: nonEmpty(hydratedUser.name) ?? fallbackUser?.name ?? "Unknown",
          screen_name:
            nonEmpty(hydratedUser.screen_name) ??
            fallbackUser?.screen_name ??
            "unknown",
          profile_image_url_https:
            nonEmpty(hydratedUser.profile_image_url_https) ??
            fallbackUser?.profile_image_url_https ??
            "",
        }
      : fallbackUser,
  };
}

export function hasRenderableTweetContent(tweet: Tweet): boolean {
  return Boolean(nonEmpty(tweet.full_text) ?? nonEmpty(tweet.text));
}

function getTweetTimestamp(tweet: Tweet): number | null {
  if (!tweet.tweet_created_at) {
    return null;
  }

  const timestamp = Date.parse(tweet.tweet_created_at);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function dedupeAndSortConversationTweets(
  tweets: Array<Tweet | null | undefined>
): Tweet[] {
  const byId = new Map<string, { tweet: Tweet; order: number }>();
  let order = 0;

  for (const tweet of tweets) {
    const tweetId = tweet?.id_str;
    if (!tweetId) {
      continue;
    }

    const prior = byId.get(tweetId);
    byId.set(tweetId, {
      tweet: prior
        ? (mergeConversationTweetWithFallback(prior.tweet, tweet) ?? tweet)
        : tweet,
      order: prior?.order ?? order,
    });
    order += 1;
  }

  return Array.from(byId.values())
    .sort((left, right) => {
      const leftTimestamp = getTweetTimestamp(left.tweet);
      const rightTimestamp = getTweetTimestamp(right.tweet);

      if (isTweetAncestor(left.tweet, right.tweet, byId)) {
        return -1;
      }
      if (isTweetAncestor(right.tweet, left.tweet, byId)) {
        return 1;
      }

      if (leftTimestamp != null && rightTimestamp != null) {
        if (leftTimestamp !== rightTimestamp) {
          return leftTimestamp - rightTimestamp;
        }
      }

      return left.order - right.order;
    })
    .map((entry) => entry.tweet);
}

function isTweetAncestor(
  possibleAncestor: Tweet,
  tweet: Tweet,
  tweetsById: Map<string, { tweet: Tweet }>
): boolean {
  const ancestorId = possibleAncestor.id_str;
  let parentId = nonEmpty(tweet.in_reply_to_status_id_str);
  const visited = new Set<string>();

  while (parentId && !visited.has(parentId)) {
    if (parentId === ancestorId) {
      return true;
    }
    visited.add(parentId);
    parentId = nonEmpty(
      tweetsById.get(parentId)?.tweet.in_reply_to_status_id_str
    );
  }

  return false;
}

/**
 * Enriches an already-rendered conversation without changing the relative
 * order of its existing posts. Newly discovered posts are inserted around the
 * stable posts according to the canonical conversation sort.
 */
export function mergeConversationTweetsPreservingOrder(
  stableTweets: Array<Tweet | null | undefined>,
  updates: Array<Tweet | null | undefined>
): Tweet[] {
  const stable = dedupeAndSortConversationTweets(stableTweets);
  const dedupedUpdates = dedupeAndSortConversationTweets(updates);
  const updatesById = new Map(
    dedupedUpdates.map((tweet) => [tweet.id_str, tweet])
  );
  const stableIds = new Set(stable.map((tweet) => tweet.id_str));
  const enrichedStable = stable.map(
    (tweet) =>
      mergeConversationTweetWithFallback(
        tweet,
        updatesById.get(tweet.id_str)
      ) ?? tweet
  );
  const additions = dedupedUpdates.filter(
    (tweet) => !stableIds.has(tweet.id_str)
  );

  if (additions.length === 0) {
    return enrichedStable;
  }
  if (enrichedStable.length === 0) {
    return additions;
  }

  const canonical = dedupeAndSortConversationTweets([
    ...enrichedStable,
    ...additions,
  ]);
  const additionsBeforeStableId = new Map<string, Tweet[]>();
  const trailingAdditions: Tweet[] = [];

  for (let index = 0; index < canonical.length; index += 1) {
    const tweet = canonical[index];
    const tweetId = nonEmpty(tweet.id_str);
    if (!tweetId || stableIds.has(tweetId)) {
      continue;
    }

    const nextStableTweet = canonical
      .slice(index + 1)
      .find((candidate) => stableIds.has(nonEmpty(candidate.id_str) ?? ""));
    const nextStableTweetId = nonEmpty(nextStableTweet?.id_str);
    if (!nextStableTweetId) {
      trailingAdditions.push(tweet);
      continue;
    }

    const existing = additionsBeforeStableId.get(nextStableTweetId) ?? [];
    existing.push(tweet);
    additionsBeforeStableId.set(nextStableTweetId, existing);
  }

  return enrichedStable.flatMap((tweet, index) => {
    const tweetId = nonEmpty(tweet.id_str);
    return [
      ...(tweetId ? (additionsBeforeStableId.get(tweetId) ?? []) : []),
      tweet,
      ...(index === enrichedStable.length - 1 ? trailingAdditions : []),
    ];
  });
}
