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
import { WaitlistUsersMarquee } from "@/features/landing/ui/components/WaitlistUsersMarquee";
import { mockWaitlistUsers } from "../../page";
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

  return (
    <div className="mt-6 md:mt-12">
      <Link
        href="/threads"
        className="ml-4 block w-fit bg-fuchsia-500 md:ml-28"
      >
        <h1 className="text-3xl font-medium md:text-5xl">
          ⇽ Thread #
          {threadNumber !== null && threadNumber > 0
            ? threadNumber
            : "Loading..."}
        </h1>
      </Link>
      <div className="mt-6 grid grid-cols-1 bg-red-500 md:mt-12 md:grid-cols-[66.47%_33.53%] md:px-28">
        <section className="bg-yellow-500 @container">
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
        <aside className="space-y-6 bg-orange-500 pt-12 md:pt-0">
          <section aria-labelledby="hero-heading" className="mx-4 bg-green-500">
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

            <WaitlistUsersMarquee className="mt-6 md:mt-12" />
          </section>
          <Separator orientation="horizontal" />
          <section>
            <h3 className="px-4 text-2xl font-medium">Author.</h3>
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
          <Separator orientation="horizontal" />
          <section>
            <h3 className="px-4 text-2xl font-medium">Recent threads.</h3>
            <div className="mt-4">
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
                        size="md"
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
        className="mx-4 my-12 bg-lime-500 md:mx-28 md:my-52"
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
