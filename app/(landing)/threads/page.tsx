"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useState, useEffect } from "react";
import { PostCard } from "@/features/landing/ui/components/PostCardClient"; // Adjust import path as needed

interface User {
  id: number;
  id_str: string;
  name: string;
  screen_name: string;
  location: string;
  url: string;
  description: string;
  protected: boolean;
  verified: boolean;
  followers_count: number;
  friends_count: number;
  listed_count: number;
  favourites_count: number;
  statuses_count: number;
  created_at: string;
  profile_banner_url: string;
  profile_image_url_https: string;
  can_dm: boolean;
}

interface Media {
  display_url: string;
  expanded_url: string;
  id_str: string;
  indices: number[];
  media_key: string;
  media_url_https: string;
  type: string;
  url: string;
  ext_media_availability: {
    status: string;
  };
  features?: {
    large: { faces: any[] };
    medium: { faces: any[] };
    small: { faces: any[] };
    orig: { faces: any[] };
  };
  sizes: {
    large: { h: number; w: number; resize: string };
    medium: { h: number; w: number; resize: string };
    small: { h: number; w: number; resize: string };
    thumb: { h: number; w: number; resize: string };
  };
  original_info: {
    height: number;
    width: number;
    focus_rects: { x: number; y: number; w: number; h: number }[];
  };
  video_info?: {
    aspect_ratio: number[];
    duration_millis: number;
    variants: { content_type: string; url: string; bitrate?: number }[];
  };
  additional_media_info?: {
    monetizable: boolean;
  };
}

interface Entities {
  media: Media[];
  user_mentions: any[]; // Can be expanded with a specific UserMention interface if needed
  urls: any[]; // Can be expanded with a specific Url interface if needed
  hashtags: any[]; // Can be expanded with a specific Hashtag interface if needed
  symbols: any[]; // Can be expanded with a specific Symbol interface if needed
}

interface Tweet {
  tweet_created_at: string;
  id: number;
  id_str: string;
  conversation_id_str: string;
  text: string | null;
  full_text: string;
  source: string;
  truncated: boolean;
  in_reply_to_status_id: number | null;
  in_reply_to_status_id_str: string | null;
  in_reply_to_user_id: number | null;
  in_reply_to_user_id_str: string | null;
  in_reply_to_screen_name: string | null;
  user: User;
  quoted_status_id: number | null;
  quoted_status_id_str: string | null;
  is_quote_status: boolean;
  quoted_status: Tweet | null;
  retweeted_status: Tweet | null;
  quote_count: number;
  reply_count: number;
  retweet_count: number;
  favorite_count: number;
  views_count: number;
  bookmark_count: number;
  lang: string;
  entities: Entities;
  is_pinned: boolean;
}

interface Thread {
  tweets: Tweet[];
}

export default function ThreadsPage() {
  const threadIds = useQuery(api.socialdata.getThreadIds);
  const getThreadsAction = useAction(api.socialdata.getThreads);

  const [threads, setThreads] = useState<Thread[] | null>(null);

  useEffect(() => {
    if (threadIds !== undefined) {
      getThreadsAction({ threadIds })
        .then((fetchedThreads) => setThreads(fetchedThreads))
        .catch((error) => {
          console.error("Failed to fetch threads:", error);
        });
    }
  }, [threadIds, getThreadsAction]);

  if (threadIds === undefined || threads === null) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-8 p-4">
      <h1 className="text-2xl font-bold">Threads</h1>
      {threads.length === 0 ? (
        <p>No threads available yet.</p>
      ) : (
        threads.map((thread, index) => {
          const threadId = threadIds[index];
          const firstTweet = thread.tweets[0];
          const user = firstTweet.user;
          const postUrl = `https://x.com/${user.screen_name}/status/${firstTweet.id_str}`;

          return (
            <Link key={threadId} href={`/threads/${threadId}`}>
              <PostCard
                bordered={true}
                avatarUrl={user.profile_image_url_https}
                displayName={user.name}
                username={user.screen_name}
                dateTime={firstTweet.tweet_created_at}
                body={firstTweet.full_text}
                postUrl={postUrl}
                pro={firstTweet.user.verified}
                replies={firstTweet.reply_count}
                reposts={firstTweet.retweet_count}
                likes={firstTweet.favorite_count}
                impressions={firstTweet.views_count}
                bookmarks={firstTweet.bookmark_count}
                detailHref={`/threads/${threadId}`}
                truncateLength={237} // Truncate at 237 characters
              />
            </Link>
          );
        })
      )}
    </div>
  );
}
