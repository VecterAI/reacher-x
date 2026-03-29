import type { Tweet, User } from "../../features/threads/types";
import type {
  HydratedTwitterProfile,
  HydratedTwitterRelationshipDisplay,
} from "../../shared/lib/twitter/hydration";

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapSocialApiUser(
  rawUser: unknown
): User | undefined {
  if (!isRecord(rawUser)) {
    return undefined;
  }

  const idStr = asString(rawUser.id_str ?? rawUser.id);
  const name = asString(rawUser.name);
  const screenName = asString(rawUser.screen_name);
  const createdAt = asString(rawUser.created_at);
  const profileImageUrl = asString(rawUser.profile_image_url_https);

  if (!idStr || !name || !screenName || !createdAt || !profileImageUrl) {
    return undefined;
  }

  return {
    id: asNumber(rawUser.id) ?? Number(idStr),
    id_str: idStr,
    name,
    screen_name: screenName,
    location: asString(rawUser.location),
    url: asString(rawUser.url),
    description: asString(rawUser.description),
    protected: asBoolean(rawUser.protected),
    verified: asBoolean(rawUser.verified),
    followers_count: asNumber(rawUser.followers_count) ?? 0,
    friends_count: asNumber(rawUser.friends_count) ?? 0,
    listed_count: asNumber(rawUser.listed_count) ?? 0,
    favourites_count: asNumber(rawUser.favourites_count) ?? 0,
    statuses_count: asNumber(rawUser.statuses_count) ?? 0,
    created_at: createdAt,
    profile_banner_url: asString(rawUser.profile_banner_url),
    profile_image_url_https: profileImageUrl,
    can_dm: asBoolean(rawUser.can_dm),
  };
}

function mapSocialApiUrlEntity(
  rawEntity: unknown
): {
  url: string;
  expanded_url: string;
  display_url: string;
  indices: [number, number];
} | undefined {
  if (!isRecord(rawEntity)) {
    return undefined;
  }

  const url = asString(rawEntity.url);
  const expandedUrl = asString(rawEntity.expanded_url);
  const displayUrl = asString(rawEntity.display_url);
  const indices = Array.isArray(rawEntity.indices)
    ? rawEntity.indices.filter((value): value is number => typeof value === "number")
    : [];

  if (!url || !expandedUrl || !displayUrl || indices.length < 2) {
    return undefined;
  }

  return {
    url,
    expanded_url: expandedUrl,
    display_url: displayUrl,
    indices: [indices[0], indices[1]],
  };
}

function mapSocialApiEntities(rawEntities: unknown): Tweet["entities"] | undefined {
  if (!isRecord(rawEntities)) {
    return undefined;
  }

  const media = Array.isArray(rawEntities.media)
    ? rawEntities.media
        .filter(isRecord)
        .map((item) => ({
          display_url: asString(item.display_url),
          expanded_url: asString(item.expanded_url),
          id_str: asString(item.id_str),
          indices: Array.isArray(item.indices)
            ? item.indices.filter((value): value is number => typeof value === "number")
            : undefined,
          media_key: asString(item.media_key),
          media_url_https: asString(item.media_url_https) ?? "",
          type: asString(item.type) ?? "photo",
          url: asString(item.url),
          ext_alt_text: asString(item.ext_alt_text),
          ext_media_availability: isRecord(item.ext_media_availability)
            ? {
                status: asString(item.ext_media_availability.status) ?? "available",
              }
            : undefined,
          features: isRecord(item.features) ? (item.features as any) : undefined,
          sizes: isRecord(item.sizes) ? (item.sizes as any) : undefined,
          original_info: isRecord(item.original_info)
            ? (item.original_info as any)
            : undefined,
          video_info: isRecord(item.video_info) ? (item.video_info as any) : undefined,
          additional_media_info: isRecord(item.additional_media_info)
            ? {
                monetizable:
                  typeof item.additional_media_info.monetizable === "boolean"
                    ? item.additional_media_info.monetizable
                    : undefined,
              }
            : undefined,
        }))
        .filter((item) => Boolean(item.media_url_https))
    : undefined;

  const userMentions = Array.isArray(rawEntities.user_mentions)
    ? rawEntities.user_mentions
        .filter(isRecord)
        .map((item): NonNullable<NonNullable<Tweet["entities"]>["user_mentions"]>[number] | undefined => {
          const idStr = asString(item.id_str);
          const name = asString(item.name);
          const screenName = asString(item.screen_name);
          const indices = Array.isArray(item.indices)
            ? item.indices.filter((value): value is number => typeof value === "number")
            : [];
          if (!idStr || !name || !screenName || indices.length < 2) {
            return undefined;
          }
          return {
            ...(asNumber(item.id) !== undefined ? { id: asNumber(item.id) } : {}),
            id_str: idStr,
            name,
            screen_name: screenName,
            indices,
          };
        })
        .filter(
          (
            item
          ): item is NonNullable<NonNullable<Tweet["entities"]>["user_mentions"]>[number] =>
            item !== undefined
        )
    : undefined;

  const urls = Array.isArray(rawEntities.urls)
    ? rawEntities.urls
        .map(mapSocialApiUrlEntity)
        .filter((item): item is NonNullable<NonNullable<Tweet["entities"]>["urls"]>[number] => item !== undefined)
    : undefined;

  const hashtags = Array.isArray(rawEntities.hashtags)
    ? rawEntities.hashtags
        .filter(isRecord)
        .map((item) => {
          const text = asString(item.text);
          const indices = Array.isArray(item.indices)
            ? item.indices.filter((value): value is number => typeof value === "number")
            : [];
          if (!text || indices.length < 2) {
            return undefined;
          }
          return { text, indices };
        })
        .filter((item): item is NonNullable<NonNullable<Tweet["entities"]>["hashtags"]>[number] => item !== undefined)
    : undefined;

  const symbols = Array.isArray(rawEntities.symbols)
    ? rawEntities.symbols
        .filter(isRecord)
        .map((item) => {
          const text = asString(item.text);
          const indices = Array.isArray(item.indices)
            ? item.indices.filter((value): value is number => typeof value === "number")
            : [];
          if (!text || indices.length < 2) {
            return undefined;
          }
          return { text, indices };
        })
        .filter((item): item is NonNullable<NonNullable<Tweet["entities"]>["symbols"]>[number] => item !== undefined)
    : undefined;

  return {
    media,
    timestamps: Array.isArray(rawEntities.timestamps)
      ? rawEntities.timestamps.filter((value): value is string => typeof value === "string")
      : undefined,
    user_mentions: userMentions,
    urls,
    hashtags,
    symbols,
  };
}

export function mapSocialApiTweet(
  rawTweet: unknown,
  depth = 0
): Tweet | null {
  if (!isRecord(rawTweet)) {
    return null;
  }

  const idStr = asString(rawTweet.id_str ?? rawTweet.id);
  if (!idStr) {
    return null;
  }

  return {
    tweet_created_at: asString(rawTweet.tweet_created_at ?? rawTweet.created_at),
    id: asNumber(rawTweet.id) ?? Number(idStr),
    id_str: idStr,
    conversation_id_str: asString(rawTweet.conversation_id_str) ?? idStr,
    text:
      rawTweet.text === null
        ? null
        : (asString(rawTweet.text) ?? null),
    full_text: asString(rawTweet.full_text) ?? asString(rawTweet.text),
    source: asString(rawTweet.source),
    truncated: typeof rawTweet.truncated === "boolean" ? rawTweet.truncated : undefined,
    in_reply_to_status_id: asNumber(rawTweet.in_reply_to_status_id),
    in_reply_to_status_id_str: asString(rawTweet.in_reply_to_status_id_str),
    in_reply_to_user_id: asNumber(rawTweet.in_reply_to_user_id),
    in_reply_to_user_id_str: asString(rawTweet.in_reply_to_user_id_str),
    in_reply_to_screen_name: asString(rawTweet.in_reply_to_screen_name),
    user: mapSocialApiUser(rawTweet.user),
    quoted_status_id: asNumber(rawTweet.quoted_status_id),
    quoted_status_id_str: asString(rawTweet.quoted_status_id_str),
    is_quote_status:
      typeof rawTweet.is_quote_status === "boolean"
        ? rawTweet.is_quote_status
        : undefined,
    quoted_status:
      depth < 1 ? mapSocialApiTweet(rawTweet.quoted_status, depth + 1) ?? undefined : undefined,
    retweeted_status:
      depth < 1
        ? mapSocialApiTweet(rawTweet.retweeted_status, depth + 1) ?? undefined
        : undefined,
    quote_count: asNumber(rawTweet.quote_count),
    reply_count: asNumber(rawTweet.reply_count),
    retweet_count: asNumber(rawTweet.retweet_count),
    favorite_count: asNumber(rawTweet.favorite_count),
    views_count: asNumber(rawTweet.views_count),
    bookmark_count: asNumber(rawTweet.bookmark_count),
    lang: asString(rawTweet.lang),
    entities: mapSocialApiEntities(rawTweet.entities),
    is_pinned:
      typeof rawTweet.is_pinned === "boolean" ? rawTweet.is_pinned : undefined,
  };
}

export function mapSocialApiProfile(
  rawProfile: unknown
): HydratedTwitterProfile | null {
  const user = mapSocialApiUser(rawProfile);
  if (!user || !isRecord(rawProfile)) {
    return null;
  }

  const profileEntities = isRecord(rawProfile.entities) ? rawProfile.entities : undefined;
  const descriptionEntity = isRecord(profileEntities?.description)
    ? profileEntities.description
    : undefined;
  const urlEntity = isRecord(profileEntities?.url) ? profileEntities.url : undefined;

  const descriptionUrls = Array.isArray(descriptionEntity?.urls)
    ? descriptionEntity.urls
        .map(mapSocialApiUrlEntity)
        .filter(
          (
            item
          ): item is NonNullable<
            NonNullable<NonNullable<HydratedTwitterProfile["entities"]>["description"]>["urls"]
          >[number] => item !== undefined
        )
    : undefined;

  const websiteUrls = Array.isArray(urlEntity?.urls)
    ? urlEntity.urls
        .map(mapSocialApiUrlEntity)
        .filter(
          (
            item
          ): item is NonNullable<
            NonNullable<NonNullable<HydratedTwitterProfile["entities"]>["url"]>["urls"]
          >[number] => item !== undefined
        )
    : undefined;

  return {
    ...user,
    username: user.screen_name,
    banner_url: asString(rawProfile.banner_url) ?? user.profile_banner_url,
    entities:
      descriptionUrls || websiteUrls
        ? {
            description: descriptionUrls ? { urls: descriptionUrls } : undefined,
            url: websiteUrls ? { urls: websiteUrls } : undefined,
          }
        : undefined,
  };
}

export function buildRelationshipDisplay(args: {
  resolution: HydratedTwitterRelationshipDisplay["resolution"];
  viewerFollowsTarget: boolean;
  targetFollowsViewer: boolean;
  message?: string;
}): HydratedTwitterRelationshipDisplay {
  const { viewerFollowsTarget, targetFollowsViewer } = args;

  let badge: HydratedTwitterRelationshipDisplay["badge"] = "none";
  if (viewerFollowsTarget && targetFollowsViewer) {
    badge = "mutual";
  } else if (viewerFollowsTarget) {
    badge = "you_following";
  } else if (targetFollowsViewer) {
    badge = "follows_you";
  }

  return {
    resolution: args.resolution,
    viewerFollowsTarget,
    targetFollowsViewer,
    badge,
    primaryAction: viewerFollowsTarget ? "unfollow" : "follow",
    primaryLabel: viewerFollowsTarget ? "Unfollow" : "Follow",
    message: args.message,
  };
}
