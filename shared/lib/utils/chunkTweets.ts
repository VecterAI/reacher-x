import { Tweet } from "@/features/threads/types";

/**
 * Chunks an array of tweets into smaller groups for parallel LLM processing
 * @param tweets - Array of tweets to chunk
 * @param chunkSize - Maximum number of tweets per chunk (default: 5)
 * @returns Array of tweet chunks
 */
export function chunkTweets(tweets: Tweet[], chunkSize: number = 5): Tweet[][] {
  if (!Array.isArray(tweets) || tweets.length === 0) {
    return [];
  }

  const chunks: Tweet[][] = [];
  for (let i = 0; i < tweets.length; i += chunkSize) {
    chunks.push(tweets.slice(i, i + chunkSize));
  }

  return chunks;
}

/**
 * Merges multiple chunks of tweets back into a single array
 * @param chunks - Array of tweet chunks
 * @returns Flattened array of tweets
 */
export function mergeChunks(chunks: Tweet[][]): Tweet[] {
  return chunks.flat();
}

/**
 * Gets the total number of tweets across all chunks
 * @param chunks - Array of tweet chunks
 * @returns Total tweet count
 */
export function getTotalTweetCount(chunks: Tweet[][]): number {
  return chunks.reduce((total, chunk) => total + chunk.length, 0);
}
