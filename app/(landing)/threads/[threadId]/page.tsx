"use client";

import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { TweetCard } from "@/features/landing/ui/components/TweetCard";
import Link from "next/link";
import { UserProfileCard } from "@/features/landing/ui/components/UserProfileCard";
import { Separator } from "@/shared/ui/components/Separator";
import { WaitlistDrawer } from "@/features/landing/ui/components/WaitlistDrawer";
import { WaitlistUsers } from "@/features/landing/ui/components/WaitlistUsers";
import { Badge } from "@/shared/ui/components/Badge";
import { Thread } from "../types";

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
  const author = tweets[0].user;

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
            <TweetCard
              key={tweet.id_str}
              profileImageUrlHttps={tweet.user.profile_image_url_https}
              name={tweet.user.name}
              screenName={tweet.user.screen_name}
              verified={tweet.user.verified}
              tweetCreatedAt={tweet.tweet_created_at}
              fullText={tweet.full_text}
              entities={tweet.entities}
              replyCount={tweet.reply_count}
              retweetCount={tweet.retweet_count}
              favoriteCount={tweet.favorite_count}
              viewsCount={tweet.views_count}
              media={tweet.entities?.media}
              thread={index < tweets.length - 1}
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

            <WaitlistUsers className="mt-6 md:mt-12" />
          </section>
          <Separator orientation="horizontal" />
          <section className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 duration-300 md:px-0">
            <h3 className="text-2xl font-medium">Author.</h3>
            <UserProfileCard
              className="mt-4 bg-pink-500"
              profileImageUrlHttps={author.profile_image_url_https}
              name={author.name}
              screenName={author.screen_name}
              verified={author.verified}
              description={author.description}
              followersCount={author.followers_count}
              friendsCount={author.friends_count}
              url={author.url}
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

                  return (
                    <Link
                      key={recentThreadIds[index]}
                      href={`/threads/${recentThreadIds[index]}`}
                    >
                      <TweetCard
                        className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 py-4 duration-300 md:px-0"
                        bordered={true}
                        profileImageUrlHttps={user.profile_image_url_https}
                        name={user.name}
                        screenName={user.screen_name}
                        tweetCreatedAt={firstTweet.tweet_created_at}
                        fullText={firstTweet.full_text}
                        verified={firstTweet.user.verified}
                        replyCount={firstTweet.reply_count}
                        retweetCount={firstTweet.retweet_count}
                        favoriteCount={firstTweet.favorite_count}
                        viewsCount={firstTweet.views_count}
                        media={firstTweet.entities?.media}
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

        <WaitlistUsers className="mt-6 md:mt-12" />
      </section>
    </div>
  );
}
