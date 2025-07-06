// features/search/lib/sortUtils.ts
import type { Tweet } from "@/features/threads/types";
import type { SortOption } from "./schemas";

/**
 * Sort tweets based on the specified sort option
 * This function handles all the different sort orders defined in the schema
 */
export function sortTweets(tweets: Tweet[], sortBy: SortOption): Tweet[] {
  if (!tweets || tweets.length === 0) {
    return [];
  }

  // Create a copy to avoid mutating the original array
  const sortedTweets = [...tweets];

  switch (sortBy) {
    // Date/Time sorting
    case "newest_first":
      return sortedTweets.sort((a, b) => {
        const dateA = new Date(a.tweet_created_at || 0).getTime();
        const dateB = new Date(b.tweet_created_at || 0).getTime();
        return dateB - dateA; // Newest first
      });

    case "oldest_first":
      return sortedTweets.sort((a, b) => {
        const dateA = new Date(a.tweet_created_at || 0).getTime();
        const dateB = new Date(b.tweet_created_at || 0).getTime();
        return dateA - dateB; // Oldest first
      });

    // Impressions sorting
    case "most_viewed_first":
      return sortedTweets.sort((a, b) => {
        const viewsA = a.views_count || 0;
        const viewsB = b.views_count || 0;
        return viewsB - viewsA; // Most viewed first
      });

    case "least_viewed_first":
      return sortedTweets.sort((a, b) => {
        const viewsA = a.views_count || 0;
        const viewsB = b.views_count || 0;
        return viewsA - viewsB; // Least viewed first
      });

    // Likes sorting
    case "most_liked_first":
      return sortedTweets.sort((a, b) => {
        const likesA = a.favorite_count || 0;
        const likesB = b.favorite_count || 0;
        return likesB - likesA; // Most liked first
      });

    case "least_liked_first":
      return sortedTweets.sort((a, b) => {
        const likesA = a.favorite_count || 0;
        const likesB = b.favorite_count || 0;
        return likesA - likesB; // Least liked first
      });

    // Replies sorting
    case "most_replied_first":
      return sortedTweets.sort((a, b) => {
        const repliesA = a.reply_count || 0;
        const repliesB = b.reply_count || 0;
        return repliesB - repliesA; // Most replied first
      });

    case "least_replied_first":
      return sortedTweets.sort((a, b) => {
        const repliesA = a.reply_count || 0;
        const repliesB = b.reply_count || 0;
        return repliesA - repliesB; // Least replied first
      });

    // Retweets sorting
    case "most_retweeted_first":
      return sortedTweets.sort((a, b) => {
        const retweetsA = a.retweet_count || 0;
        const retweetsB = b.retweet_count || 0;
        return retweetsB - retweetsA; // Most retweeted first
      });

    case "least_retweeted_first":
      return sortedTweets.sort((a, b) => {
        const retweetsA = a.retweet_count || 0;
        const retweetsB = b.retweet_count || 0;
        return retweetsA - retweetsB; // Least retweeted first
      });

    // Quotes sorting
    case "most_quoted_first":
      return sortedTweets.sort((a, b) => {
        const quotesA = a.quote_count || 0;
        const quotesB = b.quote_count || 0;
        return quotesB - quotesA; // Most quoted first
      });

    case "least_quoted_first":
      return sortedTweets.sort((a, b) => {
        const quotesA = a.quote_count || 0;
        const quotesB = b.quote_count || 0;
        return quotesA - quotesB; // Least quoted first
      });

    // Bookmarks sorting
    case "most_bookmarked_first":
      return sortedTweets.sort((a, b) => {
        const bookmarksA = a.bookmark_count || 0;
        const bookmarksB = b.bookmark_count || 0;
        return bookmarksB - bookmarksA; // Most bookmarked first
      });

    case "least_bookmarked_first":
      return sortedTweets.sort((a, b) => {
        const bookmarksA = a.bookmark_count || 0;
        const bookmarksB = b.bookmark_count || 0;
        return bookmarksA - bookmarksB; // Least bookmarked first
      });

    // Verification sorting
    case "verified_first":
      return sortedTweets.sort((a, b) => {
        const verifiedA = a.user?.verified || false;
        const verifiedB = b.user?.verified || false;
        // Sort verified users first, then by date (newest first) for tie-breaking
        if (verifiedA !== verifiedB) {
          return verifiedA ? -1 : 1;
        }
        const dateA = new Date(a.tweet_created_at || 0).getTime();
        const dateB = new Date(b.tweet_created_at || 0).getTime();
        return dateB - dateA;
      });

    case "unverified_first":
      return sortedTweets.sort((a, b) => {
        const verifiedA = a.user?.verified || false;
        const verifiedB = b.user?.verified || false;
        // Sort unverified users first, then by date (newest first) for tie-breaking
        if (verifiedA !== verifiedB) {
          return verifiedA ? 1 : -1;
        }
        const dateA = new Date(a.tweet_created_at || 0).getTime();
        const dateB = new Date(b.tweet_created_at || 0).getTime();
        return dateB - dateA;
      });

    // Default case - newest first
    default:
      return sortedTweets.sort((a, b) => {
        const dateA = new Date(a.tweet_created_at || 0).getTime();
        const dateB = new Date(b.tweet_created_at || 0).getTime();
        return dateB - dateA; // Newest first
      });
  }
}

/**
 * Get a human-readable description of the current sort order
 */
export function getSortDescription(sortBy: SortOption): string {
  switch (sortBy) {
    case "newest_first":
      return "Newest first";
    case "oldest_first":
      return "Oldest first";
    case "most_viewed_first":
      return "Most viewed first";
    case "least_viewed_first":
      return "Least viewed first";
    case "most_liked_first":
      return "Most liked first";
    case "least_liked_first":
      return "Least liked first";
    case "most_replied_first":
      return "Most replied first";
    case "least_replied_first":
      return "Least replied first";
    case "most_retweeted_first":
      return "Most retweeted first";
    case "least_retweeted_first":
      return "Least retweeted first";
    case "most_quoted_first":
      return "Most quoted first";
    case "least_quoted_first":
      return "Least quoted first";
    case "most_bookmarked_first":
      return "Most bookmarked first";
    case "least_bookmarked_first":
      return "Least bookmarked first";
    case "verified_first":
      return "Verified first";
    case "unverified_first":
      return "Unverified first";
    default:
      return "Newest first";
  }
}

/**
 * Check if a sort option is the default (newest_first)
 */
export function isDefaultSort(sortBy: SortOption): boolean {
  return sortBy === "newest_first";
}
