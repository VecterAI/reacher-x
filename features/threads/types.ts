import { Id } from "../../convex/_generated/dataModel";

export interface User {
  id: number;
  id_str: string;
  name: string;
  screen_name: string;
  location?: string;
  url?: string;
  description?: string;
  protected: boolean;
  verified: boolean;
  followers_count: number;
  friends_count: number;
  listed_count: number;
  favourites_count: number;
  statuses_count: number;
  created_at: string;
  profile_banner_url?: string;
  profile_image_url_https: string;
  can_dm: boolean;
}

export interface Media {
  display_url?: string;
  expanded_url?: string;
  id_str?: string;
  indices?: number[];
  media_key?: string;
  media_url_https: string;
  type: string;
  url?: string;
  ext_alt_text?: string;
  ext_media_availability?: {
    status: string;
  };
  features?: {
    large?: { faces: unknown[] };
    medium?: { faces: unknown[] };
    small?: { faces: unknown[] };
    orig?: { faces: unknown };
  };
  sizes?: {
    large?: { h: number; w: number; resize?: string };
    medium?: { h: number; w: number; resize?: string };
    small?: { h: number; w: number; resize?: string };
    thumb?: { h: number; w: number; resize?: string };
  };
  original_info?: {
    height: number;
    width: number;
    focus_rects: { x: number; y: number; w: number; h: number }[];
  };
  video_info?: {
    aspect_ratio: number[];
    duration_millis?: number; // Made optional with `?`
    variants: { content_type: string; url: string; bitrate?: number }[];
  };
  additional_media_info?: {
    monetizable: boolean;
  };
}

export interface UserMention {
  id?: number;
  id_str: string;
  name: string;
  screen_name: string;
  indices: number[];
}

export interface Hashtag {
  text: string;
  indices: number[];
}

export interface Symbol {
  text: string;
  indices: number[];
}

export interface Entities {
  media?: Media[];
  timestamps?: string[];
  user_mentions?: UserMention[];
  urls?: Array<{
    url: string;
    expanded_url: string;
    display_url: string;
    indices: [number, number];
  }>;
  hashtags?: Hashtag[];
  symbols?: Symbol[];
}

export interface Tweet {
  tweet_created_at?: string;
  id?: number;
  id_str?: string;
  conversation_id_str?: string;
  text?: string | null;
  full_text?: string;
  source?: string;
  truncated?: boolean;
  in_reply_to_status_id?: number;
  in_reply_to_status_id_str?: string;
  in_reply_to_user_id?: number;
  in_reply_to_user_id_str?: string;
  in_reply_to_screen_name?: string;
  user?: User;
  quoted_status_id?: number;
  quoted_status_id_str?: string;
  is_quote_status?: boolean;
  quoted_status?: Tweet;
  retweeted_status?: Tweet;
  quote_count?: number;
  reply_count?: number;
  retweet_count?: number;
  favorite_count?: number;
  views_count?: number;
  bookmark_count?: number;
  lang?: string;
  entities?: Entities;
  is_pinned?: boolean;
  // New: display text range inferred from entities to match visible content
  display_text_range?: [number, number];
}

export interface Thread {
  _id: Id<"threads">;
  _creationTime: number;
  postedAt: number;
  threadId: string;
  tweets: Tweet[];
}
