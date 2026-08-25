import type {
  Entities,
  Media,
  Tweet,
  User,
} from "../../features/threads/types";
import { mapSocialApiTweet } from "./socialApiTwitterMap";
import { sanitizeTwitterProfileForWorkflow } from "./workflowSafeProspect";

export const MAX_TWITTER_RETRIER_POSTS = 20;
const MAX_TWITTER_MEDIA_ITEMS = 4;
const MAX_TWITTER_VIDEO_VARIANTS = 8;
const MAX_TWITTER_ENTITY_ITEMS = 20;

export type TwitterUser = User & {
  entities?: Record<string, unknown>;
};

export type TwitterPost = Tweet & {
  id_str: string;
  user: TwitterUser;
};

export function normalizeTwitterSearchCursor(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const cursor = value.trim();
  return cursor || undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compactMediaSize(
  value: { h: number; w: number; resize?: string } | undefined
) {
  return value
    ? {
        h: value.h,
        w: value.w,
        resize: value.resize,
      }
    : undefined;
}

function compactTwitterMedia(media: Media): Media {
  const sizes = media.sizes
    ? {
        large: compactMediaSize(media.sizes.large),
        medium: compactMediaSize(media.sizes.medium),
        small: compactMediaSize(media.sizes.small),
        thumb: compactMediaSize(media.sizes.thumb),
      }
    : undefined;
  const focusRects = Array.isArray(media.original_info?.focus_rects)
    ? media.original_info.focus_rects.slice(0, 4).map((rect) => ({
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h,
      }))
    : [];
  const originalInfo = media.original_info
    ? {
        height: media.original_info.height,
        width: media.original_info.width,
        focus_rects: focusRects,
      }
    : undefined;
  const videoInfo = media.video_info
    ? {
        aspect_ratio: media.video_info.aspect_ratio.slice(0, 2),
        duration_millis: media.video_info.duration_millis,
        variants: media.video_info.variants
          .slice(0, MAX_TWITTER_VIDEO_VARIANTS)
          .map((variant) => ({
            content_type: variant.content_type,
            url: variant.url,
            bitrate: variant.bitrate,
          })),
      }
    : undefined;

  return {
    display_url: media.display_url,
    expanded_url: media.expanded_url,
    id_str: media.id_str,
    indices: media.indices?.slice(0, 2),
    media_key: media.media_key,
    media_url_https: media.media_url_https,
    type: media.type,
    url: media.url,
    ext_alt_text: media.ext_alt_text,
    ext_media_availability: media.ext_media_availability
      ? { status: media.ext_media_availability.status }
      : undefined,
    sizes,
    original_info: originalInfo,
    video_info: videoInfo,
    additional_media_info: media.additional_media_info
      ? { monetizable: media.additional_media_info.monetizable }
      : undefined,
  };
}

function compactTwitterEntities(
  entities: Entities | undefined
): Entities | undefined {
  if (!entities) {
    return undefined;
  }

  return {
    media: entities.media
      ?.slice(0, MAX_TWITTER_MEDIA_ITEMS)
      .map(compactTwitterMedia),
    timestamps: entities.timestamps?.slice(0, MAX_TWITTER_ENTITY_ITEMS),
    user_mentions: entities.user_mentions?.slice(0, MAX_TWITTER_ENTITY_ITEMS),
    urls: entities.urls?.slice(0, MAX_TWITTER_ENTITY_ITEMS),
    hashtags: entities.hashtags?.slice(0, MAX_TWITTER_ENTITY_ITEMS),
    symbols: entities.symbols?.slice(0, MAX_TWITTER_ENTITY_ITEMS),
  };
}

function compactMappedTwitterPost(tweet: Tweet): Tweet {
  return {
    ...tweet,
    entities: compactTwitterEntities(tweet.entities),
    quoted_status: tweet.quoted_status
      ? compactMappedTwitterPost(tweet.quoted_status)
      : undefined,
    retweeted_status: tweet.retweeted_status
      ? compactMappedTwitterPost(tweet.retweeted_status)
      : undefined,
  };
}

export function compactTwitterSearchPost(value: unknown): TwitterPost | null {
  const mapped = mapSocialApiTweet(value);
  if (!mapped?.id_str || !mapped.user) {
    return null;
  }

  const rawUser = isRecord(value) && isRecord(value.user) ? value.user : null;
  const sanitizedProfile = rawUser
    ? sanitizeTwitterProfileForWorkflow(rawUser)
    : null;
  const userEntities =
    sanitizedProfile && isRecord(sanitizedProfile.entities)
      ? sanitizedProfile.entities
      : undefined;
  const compacted = compactMappedTwitterPost(mapped);

  return {
    ...compacted,
    id_str: mapped.id_str,
    user: {
      ...mapped.user,
      entities: userEntities,
    },
  };
}

export function compactTwitterSearchResults(
  values: unknown[],
  maxPosts = MAX_TWITTER_RETRIER_POSTS
): TwitterPost[] {
  const posts: TwitterPost[] = [];
  const boundedLimit = Math.max(
    0,
    Math.min(maxPosts, MAX_TWITTER_RETRIER_POSTS)
  );

  if (boundedLimit === 0) {
    return posts;
  }

  for (const value of values) {
    const post = compactTwitterSearchPost(value);
    if (post) {
      posts.push(post);
    }
    if (posts.length >= boundedLimit) {
      break;
    }
  }

  return posts;
}
