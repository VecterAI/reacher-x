"use client";

import * as React from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Tweet } from "@/features/threads/types";

type CachedTweet = {
  tweet: Tweet;
  fetchedAt: number;
};

type HydratedTweetsResult = {
  tweets: Tweet[];
  fetchedAt: number;
};

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CachedTweet>();
const inFlight = new Map<string, Promise<HydratedTweetsResult>>();

function isFresh(entry: CachedTweet | undefined) {
  return entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

/** Sorted unique ids; used to build a stable fingerprint regardless of array reference/order. */
function dedupeSortedTweetIds(tweetIds: string[]): string[] {
  return Array.from(
    new Set(tweetIds.map((id) => String(id).trim()).filter(Boolean))
  ).sort();
}

export function invalidateHydratedTwitterPostsCache(tweetIds?: string[]) {
  if (!tweetIds) {
    cache.clear();
    return;
  }

  for (const tweetId of tweetIds) {
    const normalized = String(tweetId).trim();
    if (normalized) {
      cache.delete(normalized);
    }
  }
}

export function useHydratedTwitterPosts(tweetIds: string[]) {
  const hydrateTweets = useAction(api.x.getHydratedTwitterPostsByIds);
  const hydrateTweetsRef = React.useRef(hydrateTweets);
  const [tweetsById, setTweetsById] = React.useState<Record<string, Tweet>>({});
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    hydrateTweetsRef.current = hydrateTweets;
  }, [hydrateTweets]);

  // Primitive fingerprint so callers can pass a new array each render (e.g. slice(), literals).
  const tweetIdsFingerprint = JSON.stringify(dedupeSortedTweetIds(tweetIds));

  const dedupedIds = React.useMemo(
    () =>
      tweetIdsFingerprint === "[]"
        ? []
        : (JSON.parse(tweetIdsFingerprint) as string[]),
    [tweetIdsFingerprint]
  );

  const refresh = React.useCallback(
    async (options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      if (dedupedIds.length === 0) {
        setTweetsById({});
        setError(null);
        return;
      }

      const cachedTweets = Object.fromEntries(
        force
          ? []
          : dedupedIds
              .map((id) => {
                const entry = cache.get(id);
                return isFresh(entry) && entry
                  ? ([id, entry.tweet] as const)
                  : null;
              })
              .filter(
                (entry): entry is readonly [string, Tweet] => entry !== null
              )
      );

      const missingIds = force
        ? dedupedIds
        : dedupedIds.filter((id) => !cachedTweets[id]);

      if (missingIds.length > 0) {
        // Same as before: partial cache only while the network request runs.
        if (!force) {
          setTweetsById(cachedTweets);
        }
      } else {
        setTweetsById((prev) => {
          const keys = Object.keys(cachedTweets);
          const sameRefs =
            keys.length === Object.keys(prev).length &&
            keys.every((id) => prev[id] === cachedTweets[id]);
          return sameRefs ? prev : cachedTweets;
        });
      }

      if (missingIds.length === 0) {
        setError(null);
        return;
      }

      setIsLoading(true);
      try {
        const requestKey = missingIds.join(",");
        const existingRequest = inFlight.get(requestKey);
        const requestPromise =
          existingRequest ??
          hydrateTweetsRef.current({ tweetIds: missingIds }).finally(() => {
            inFlight.delete(requestKey);
          });
        if (!existingRequest) {
          inFlight.set(requestKey, requestPromise);
        }

        const result = await requestPromise;
        const nextEntries = Object.fromEntries(
          (result.tweets ?? [])
            .filter((tweet): tweet is Tweet => Boolean(tweet?.id_str))
            .map((tweet) => {
              cache.set(tweet.id_str!, {
                tweet,
                fetchedAt: result.fetchedAt,
              });
              return [tweet.id_str!, tweet] as const;
            })
        );

        setTweetsById((current) => ({
          ...current,
          ...cachedTweets,
          ...nextEntries,
        }));
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load posts from X."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [dedupedIds]
  );

  React.useEffect(() => {
    void refresh();
  }, [tweetIdsFingerprint, refresh]);

  return {
    tweetsById,
    isLoading,
    error,
    refresh,
  };
}
