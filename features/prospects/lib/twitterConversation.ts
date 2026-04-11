import type { Tweet } from "@/features/threads/types";

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
      tweet,
      order: prior?.order ?? order,
    });
    order += 1;
  }

  return Array.from(byId.values())
    .sort((left, right) => {
      const leftTimestamp = getTweetTimestamp(left.tweet);
      const rightTimestamp = getTweetTimestamp(right.tweet);

      if (leftTimestamp != null && rightTimestamp != null) {
        if (leftTimestamp !== rightTimestamp) {
          return leftTimestamp - rightTimestamp;
        }
      } else if (leftTimestamp != null) {
        return -1;
      } else if (rightTimestamp != null) {
        return 1;
      }

      return left.order - right.order;
    })
    .map((entry) => entry.tweet);
}
