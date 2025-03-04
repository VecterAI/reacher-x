"use client";

import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { PostCard } from "@/features/landing/ui/components/PostCard";
import Link from "next/link";
import { UserProfileCard } from "@/features/landing/ui/components/UserProfileCard";
import { Separator } from "@/shared/ui/components/Separator";
import { WaitlistDrawer } from "@/features/landing/ui/components/WaitlistDrawer";
import { ResponsiveWaitlistUsers } from "@/features/landing/ui/components/ResponsiveWaitlistUsers";
import { Badge } from "@/shared/ui/components/Badge";

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

interface UserMention {
  id: number;
  id_str: string;
  name: string;
  screen_name: string;
  indices: [number, number];
}

interface Hashtag {
  text: string;
  indices: [number, number];
}

interface Symbol {
  text: string;
  indices: [number, number];
}

interface Entities {
  media: Media[];
  user_mentions: UserMention[];
  urls: Array<{
    url: string;
    expanded_url: string;
    display_url: string;
    indices: [number, number];
  }>;
  hashtags: Hashtag[];
  symbols: Symbol[];
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

export default function ThreadDetailPage() {
  // Get threadId from route parameters
  const { threadId } = useParams();
  const getThreadsAction = useAction(api.socialdata.getThreads);
  const threadIds = useQuery(api.socialdata.getThreadIds);

  // State for the current thread and recent threads
  const [thread, setThread] = useState<Thread[] | null>(null);
  const [recentThreads, setRecentThreads] = useState<Thread[] | null>(null);

  // Fetch the current thread
  useEffect(() => {
    if (threadId && typeof threadId === "string") {
      getThreadsAction({ threadIds: [threadId] })
        .then((fetchedThreads) => setThread(fetchedThreads))
        .catch((error) => {
          console.error("Failed to fetch thread:", error);
          setThread([]); // Indicate no data
        });
    }
  }, [threadId, getThreadsAction]);

  // Compute thread number based on position in threadIds
  const threadNumber =
    threadIds && threadId ? threadIds.indexOf(threadId as string) + 1 : null;

  // Compute recent thread IDs (excluding current thread, taking last 2)
  const recentCount = 2; // Adjustable number of recent threads
  const recentThreadIds = useMemo(() => {
    if (!threadIds || !threadId) return [];
    return threadIds.filter((id) => id !== threadId).slice(-recentCount);
  }, [threadIds, threadId]);

  // Fetch recent threads when recentThreadIds changes
  useEffect(() => {
    if (recentThreadIds.length > 0) {
      getThreadsAction({ threadIds: recentThreadIds })
        .then(setRecentThreads)
        .catch((error) => {
          console.error("Failed to fetch recent threads:", error);
          setRecentThreads([]); // Indicate no data or error
        });
    } else {
      setRecentThreads([]);
    }
  }, [recentThreadIds, getThreadsAction]);

  // Loading state for initial render
  if (thread === null || threadIds === undefined) {
    return <div>Loading...</div>;
  }

  // Thread not found state
  if (thread.length === 0) {
    return <div>Thread not found</div>;
  }

  const singleThread = thread[0];
  const tweets = singleThread.tweets;
  const author = tweets[0].user; // Use this directly

  return (
    <div className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] mt-6 duration-300 md:mt-12">
      <Link
        href="/threads"
        className="ml-4 block w-fit bg-fuchsia-500 md:ml-28"
      >
        <h1 className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] text-3xl font-medium duration-300 md:text-5xl">
          ⇽ Thread #
          {threadNumber !== null && threadNumber > 0
            ? threadNumber
            : "Loading..."}
        </h1>
      </Link>
      <div className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] mt-6 grid grid-cols-1 gap-12 bg-red-500 duration-300 md:mt-12 md:grid-cols-[calc(66.47%-1.5rem)_calc(33.53%-1.5rem)] md:px-28">
        <section className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] bg-yellow-500 px-4 duration-300 @container md:px-0">
          {tweets.map((tweet, index) => (
            <PostCard
              key={tweet.id_str}
              detailHref={`https://x.com/${tweet.user.screen_name}/status/${tweet.id_str}`}
              avatarUrl={tweet.user.profile_image_url_https}
              displayName={tweet.user.name}
              username={tweet.user.screen_name}
              pro={tweet.user.verified}
              dateTime={tweet.tweet_created_at}
              body={tweet.full_text}
              entities={tweet.entities}
              replies={tweet.reply_count}
              reposts={tweet.retweet_count}
              likes={tweet.favorite_count}
              impressions={tweet.views_count}
              media={tweet.entities?.media}
              postUrl={`https://x.com/${tweet.user.screen_name}/status/${tweet.id_str}`}
              thread={index < tweets.length - 1} // Only true for non-last posts
              size="lg"
            />
          ))}
        </section>
        <aside className="space-y-6 bg-orange-500">
          <section
            aria-labelledby="hero-heading"
            className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] bg-green-500 px-4 duration-300 md:px-0"
          >
            <Badge variant="outline">
              ✶&nbsp;&nbsp;Launching March/April 2025
            </Badge>
            <hgroup className="mt-4 space-y-4">
              <h2 id="hero-heading" className="text-3xl font-medium">
                A search engine—to find customers.
              </h2>
              <p>Join the wait-list for early access and updates!</p>
            </hgroup>

            <WaitlistDrawer />

            <ResponsiveWaitlistUsers className="mt-6 md:mt-12" />
          </section>
          <Separator orientation="horizontal" />
          <section className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 duration-300 md:px-0">
            <h3 className="text-2xl font-medium">Author.</h3>
            <UserProfileCard
              className="mt-4 bg-pink-500"
              avatarUrl={author.profile_image_url_https}
              displayName={author.name}
              username={author.screen_name}
              pro={author.verified}
              bio={author.description}
              followers={author.followers_count}
              following={author.friends_count}
              link={author.url}
            />
          </section>
          <Separator orientation="horizontal" />
          <section>
            <h3 className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 text-2xl font-medium duration-300 md:px-0">
              Recent threads.
            </h3>
            <div>
              {recentThreads === null ? (
                <div>Loading recent threads...</div>
              ) : recentThreads.length === 0 ? (
                <p>No recent threads available.</p>
              ) : (
                recentThreads.map((recentThread, index) => {
                  const firstTweet = recentThread.tweets[0];
                  const user = firstTweet.user;
                  const postUrl = `https://x.com/${user.screen_name}/status/${firstTweet.id_str}`;
                  return (
                    <Link
                      key={recentThreadIds[index]}
                      href={`/threads/${recentThreadIds[index]}`}
                    >
                      <PostCard
                        className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 py-4 duration-300 md:px-0"
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
                        detailHref={`/threads/${recentThreadIds[index]}`}
                      />
                    </Link>
                  );
                })
              )}
            </div>
          </section>
        </aside>
      </div>
      <section
        id="join-waitlist"
        aria-labelledby="waitlist-heading"
        className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] bg-lime-500 px-4 py-12 duration-300 md:px-28 md:py-52"
      >
        <h2 id="waitlist-heading" className="text-3xl font-medium">
          Join over 50 people already on the wait-list!
        </h2>

        <WaitlistDrawer />

        <ResponsiveWaitlistUsers className="mt-6 md:mt-12" />
      </section>
    </div>
  );
}
