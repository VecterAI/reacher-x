"use client";

import * as React from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Tweet } from "@/features/threads/types";
import type { HydratedTwitterPostsFromSocialApiPayload } from "@/shared/lib/twitter/hydration";
import { useTwitterTimelineEngagementMerge } from "./useTwitterTimelineEngagementMerge";

type CachedTweet = {
  tweet: Tweet;
  fetchedAt: number;
  result: HydratedTwitterPostsFromSocialApiPayload["resultsById"][string];
};

const CACHE_TTL_MS = 30_000;
const MAX_BATCH_SIZE = 10;
const cache = new Map<string, CachedTweet>();
const inFlight = new Map<string, Promise<HydratedTwitterPostsFromSocialApiPayload>>();

function isFresh(entry: CachedTweet | undefined) {
  return entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

function dedupeSortedTweetIds(tweetIds: string[]): string[] {
  return Array.from(
    new Set(tweetIds.map((id) => String(id).trim()).filter(Boolean))
  ).sort();
}

function chunkTweetIds(tweetIds: string[]): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < tweetIds.length; index += MAX_BATCH_SIZE) {
    chunks.push(tweetIds.slice(index, index + MAX_BATCH_SIZE));
  }
  return chunks;
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
  const hydrateTweets = useAction(api.socialapi.getTwitterPostsByIdsFromSocialApi);
  const hydrateTweetsRef = React.useRef(hydrateTweets);
  const [rawTweetsById, setRawTweetsById] = React.useState<Record<string, Tweet>>(
    {}
  );
  const [resultsById, setResultsById] = React.useState<
    HydratedTwitterPostsFromSocialApiPayload["resultsById"]
  >({});
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    hydrateTweetsRef.current = hydrateTweets;
  }, [hydrateTweets]);

  const tweetIdsFingerprint = JSON.stringify(dedupeSortedTweetIds(tweetIds));

  const dedupedIds = React.useMemo(
    () =>
      tweetIdsFingerprint === "[]"
        ? []
        : (JSON.parse(tweetIdsFingerprint) as string[]),
    [tweetIdsFingerprint]
  );

  const mergedTweets = useTwitterTimelineEngagementMerge(
    React.useMemo(
      () =>
        dedupedIds
          .map((tweetId) => rawTweetsById[tweetId])
          .filter((tweet): tweet is Tweet => Boolean(tweet?.id_str)),
      [dedupedIds, rawTweetsById]
    )
  );

  const tweetsById = React.useMemo(
    () =>
      Object.fromEntries(
        mergedTweets
          .filter((tweet): tweet is Tweet & { id_str: string } => Boolean(tweet.id_str))
          .map((tweet) => [tweet.id_str, tweet] as const)
      ),
    [mergedTweets]
  );

  const refresh = React.useCallback(
    async (options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      if (dedupedIds.length === 0) {
        setRawTweetsById({});
        setResultsById({});
        setError(null);
        return;
      }

      const cachedEntries = Object.fromEntries(
        force
          ? []
          : dedupedIds
              .map((tweetId) => {
                const entry = cache.get(tweetId);
                return isFresh(entry) && entry ? ([tweetId, entry] as const) : null;
              })
              .filter(
                (
                  entry
                ): entry is readonly [string, CachedTweet] => entry !== null
              )
      );

      const cachedTweets = Object.fromEntries(
        Object.entries(cachedEntries).map(([tweetId, entry]) => [tweetId, entry.tweet])
      );
      const cachedResults = Object.fromEntries(
        Object.entries(cachedEntries).map(([tweetId, entry]) => [tweetId, entry.result])
      );

      const missingIds = force
        ? dedupedIds
        : dedupedIds.filter((tweetId) => !cachedEntries[tweetId]);

      if (force) {
        setRawTweetsById({});
        setResultsById({});
      } else {
        setRawTweetsById(cachedTweets);
        setResultsById(cachedResults);
      }

      if (missingIds.length === 0) {
        setError(null);
        return;
      }

      setIsLoading(true);
      try {
        const batchResults = await Promise.all(
          chunkTweetIds(missingIds).map(async (batchIds) => {
            const requestKey = batchIds.join(",");
            const existingRequest = inFlight.get(requestKey);
            const requestPromise =
              existingRequest ??
              hydrateTweetsRef.current({
                tweetIds: batchIds,
              });

            if (!existingRequest) {
              inFlight.set(
                requestKey,
                requestPromise.finally(() => {
                  inFlight.delete(requestKey);
                })
              );
            }

            return await requestPromise;
          })
        );

        const nextTweetsById: Record<string, Tweet> = {};
        const nextResultsById: HydratedTwitterPostsFromSocialApiPayload["resultsById"] =
          {};

        for (const batch of batchResults) {
          for (const tweet of batch.tweets ?? []) {
            if (!tweet.id_str) {
              continue;
            }
            const result =
              batch.resultsById[tweet.id_str] ??
              ({
                status: "ok",
                provider: "socialapi",
              } as const);
            cache.set(tweet.id_str, {
              tweet,
              fetchedAt: batch.fetchedAt,
              result,
            });
            nextTweetsById[tweet.id_str] = tweet;
          }

          Object.assign(nextResultsById, batch.resultsById);
        }

        setRawTweetsById((current) =>
          force ? nextTweetsById : { ...current, ...cachedTweets, ...nextTweetsById }
        );
        setResultsById((current) =>
          force ? nextResultsById : { ...current, ...cachedResults, ...nextResultsById }
        );

        const nextError = Object.values(nextResultsById).find(
          (result) => result.status === "error"
        )?.message;
        setError(nextError ?? null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load posts from SocialAPI."
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
    resultsById,
    isLoading,
    error,
    refresh,
  };
}
