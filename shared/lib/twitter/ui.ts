import type { Tweet } from "@/features/threads/types";
import type {
  TwitterMediaSummary,
  TwitterPostSummary,
  TwitterViewerState,
} from "./contracts";

function mapMedia(
  media?: TwitterMediaSummary[]
): Tweet["entities"] | undefined {
  if (!media || media.length === 0) {
    return undefined;
  }

  return {
    media: media.map((item) => ({
      type: item.type,
      media_url_https: item.url,
      display_url: item.previewUrl,
      expanded_url: item.previewUrl ?? item.url,
      ext_alt_text: item.altText,
      original_info:
        item.width && item.height
          ? {
              width: item.width,
              height: item.height,
              focus_rects: [],
            }
          : undefined,
    })),
  };
}

export function toFallbackTweetFromSummary(summary: TwitterPostSummary): Tweet {
  return {
    id_str: summary.ref.postId,
    conversation_id_str: summary.ref.conversationId ?? summary.ref.postId,
    full_text: summary.textPreview,
    text: summary.textPreview,
    tweet_created_at: summary.createdAt
      ? new Date(summary.createdAt).toISOString()
      : undefined,
    source: summary.source,
    in_reply_to_status_id_str: summary.inReplyToPostId,
    in_reply_to_screen_name: summary.inReplyToHandle,
    quoted_status_id_str: summary.quotePostId,
    quote_count: summary.metrics?.quotes ?? 0,
    reply_count: summary.metrics?.replies ?? 0,
    retweet_count: summary.metrics?.reposts ?? 0,
    favorite_count: summary.metrics?.likes ?? 0,
    views_count: summary.metrics?.views ?? 0,
    bookmark_count: summary.metrics?.bookmarks ?? 0,
    lang: summary.lang,
    entities: mapMedia(summary.media),
    user: summary.author
      ? {
          id: summary.author.id ? Number(summary.author.id) || 0 : 0,
          id_str: summary.author.id ?? "",
          name: summary.author.name ?? summary.author.handle ?? "Unknown",
          screen_name: summary.author.handle ?? "unknown",
          protected: false,
          verified: false,
          followers_count: 0,
          friends_count: 0,
          listed_count: 0,
          favourites_count: 0,
          statuses_count: 0,
          created_at: "",
          profile_image_url_https: summary.author.avatarUrl ?? "",
          can_dm: false,
        }
      : undefined,
  };
}

export function applyViewerStateToTweet(
  tweet: Tweet,
  viewerState?: TwitterViewerState
): Tweet {
  if (!viewerState) {
    return tweet;
  }

  return {
    ...tweet,
    viewerState,
    favorite_count:
      typeof tweet.favorite_count === "number"
        ? tweet.favorite_count
        : (tweet.favorite_count ?? 0),
    retweet_count:
      typeof tweet.retweet_count === "number"
        ? tweet.retweet_count
        : (tweet.retweet_count ?? 0),
    bookmark_count:
      typeof tweet.bookmark_count === "number"
        ? tweet.bookmark_count
        : (tweet.bookmark_count ?? 0),
  };
}

export function indexTwitterViewerStates(
  states: TwitterViewerState[]
): Record<string, TwitterViewerState> {
  return states.reduce<Record<string, TwitterViewerState>>((acc, state) => {
    acc[state.postId] = state;
    return acc;
  }, {});
}
