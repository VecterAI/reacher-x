"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useState, useEffect } from "react";
import { PostCard } from "@/features/landing/ui/components/PostCard";
import { UserProfileCard } from "@/features/landing/ui/components/UserProfileCard";
import { Badge } from "@/shared/ui/components/Badge";
import { WaitlistDrawer } from "@/features/landing/ui/components/WaitlistDrawer";
import { mockWaitlistUsers } from "../page";
import { Separator } from "@/shared/ui/components/Separator";
import { WaitlistUsersMarquee } from "@/features/landing/ui/components/WaitlistUsersMarquee";

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
    large: { faces: unknown[] };
    medium: { faces: unknown[] };
    small: { faces: unknown[] };
    orig: { faces: unknown[] };
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
  user_mentions: unknown[];
  urls: unknown[];
  hashtags: unknown[];
  symbols: unknown[];
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
    <div className="mt-6 md:mt-12">
      <Link href="/" className="ml-4 block w-fit bg-fuchsia-500 md:ml-28">
        <h1 className="text-3xl font-medium md:text-5xl">⇽ Threads.</h1>
      </Link>
      <div className="mt-6 grid grid-cols-1 md:mt-12 md:grid-cols-[66.47%_33.53%] md:px-28">
        <section className="@container">
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
                    className="p-4 md:px-0 md:py-6"
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
                    media={firstTweet.entities?.media}
                    detailHref={`/threads/${threadId}`}
                    size="lg"
                  />
                </Link>
              );
            })
          )}
        </section>
        <aside className="space-y-6 bg-orange-500 pt-12 md:pt-0">
          <section
            aria-labelledby="hero-heading"
            className="bg-green-500 px-4 md:px-0"
          >
            <Badge variant="outline">
              ✶&nbsp;&nbsp;Launching March/April 2025
            </Badge>
            <hgroup className="mt-4 max-w-2xl space-y-4">
              <h2 id="hero-heading" className="text-3xl font-medium">
                A search engine—to find customers.
              </h2>
              <p>Join the wait-list for early access and updates!</p>
            </hgroup>

            <WaitlistDrawer waitlistUsers={mockWaitlistUsers} />

            <WaitlistUsersMarquee />
          </section>
          <Separator orientation="horizontal" />
          <section className="px-4 md:px-0">
            <h3 className="text-2xl font-medium">Author.</h3>
            <UserProfileCard
              className="mt-4 bg-pink-500"
              avatarUrl="https://avatars.githubusercontent.com/u/85483006?v=4"
              displayName="ReacherX founder"
              username="ReacherXfounder"
              pro={true}
              bio="Building ReacherX, a search engine that finds your customers. Open Source Design and Development advocate."
              link="reacherx.com"
            />
          </section>
        </aside>
      </div>
      <section
        id="join-waitlist"
        aria-labelledby="waitlist-heading"
        className="bg-lime-500 px-4 py-12 md:px-28 md:py-52"
      >
        <h2 id="waitlist-heading" className="text-3xl font-medium">
          Join over 50 people already on the wait-list!
        </h2>

        <WaitlistDrawer waitlistUsers={mockWaitlistUsers} />

        <WaitlistUsersMarquee className="mt-6 md:mt-12" />
      </section>
    </div>
  );
}
