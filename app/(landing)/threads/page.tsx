"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useState, useEffect } from "react";
import { TweetCard } from "@/features/landing/ui/components/TweetCard";
import { UserProfileCard } from "@/features/landing/ui/components/UserProfileCard";
import { Badge } from "@/shared/ui/components/Badge";
import { WaitlistDrawer } from "@/features/landing/ui/components/WaitlistDrawer";
import { Separator } from "@/shared/ui/components/Separator";
import { WaitlistUsers } from "@/features/landing/ui/components/WaitlistUsers";
import { Thread } from "./types";

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
      <div className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] mt-6 grid grid-cols-1 gap-12 bg-red-500 duration-300 md:mt-12 md:grid-cols-[calc(66.47%-1.5rem)_calc(33.53%-1.5rem)] md:px-28">
        <section className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] bg-yellow-500 px-4 duration-300 @container md:px-0">
          {threads.length === 0 ? (
            <p>No threads available yet.</p>
          ) : (
            threads.map((thread, index) => {
              const threadId = threadIds[index];
              const firstTweet = thread.tweets[0];
              const user = firstTweet.user;

              return (
                <Link key={threadId} href={`/threads/${threadId}`}>
                  <TweetCard
                    className="p-4 md:px-0 md:py-6"
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
                    size="lg"
                  />
                </Link>
              );
            })
          )}
        </section>
        <aside className="space-y-6 bg-orange-500">
          <section
            aria-labelledby="hero-heading"
            className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] bg-green-500 px-4 duration-300 md:px-0"
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

            <WaitlistDrawer />

            <WaitlistUsers className="mt-6 md:mt-12" />
          </section>
          <Separator orientation="horizontal" />
          <section className="px-4 md:px-0">
            <h3 className="text-2xl font-medium">Author.</h3>
            <UserProfileCard
              className="mt-4 bg-pink-500"
              profileImageUrlHttps="https://avatars.githubusercontent.com/u/85483006?v=4"
              name="ReacherX founder"
              screenName="ReacherXfounder"
              verified={true}
              description="Building @ReacherX, #OpenSourceDesign and #OpenSourceDev advocate. Reach: salman.crco@reacherx.com | Visit: reacherx.com"
              url="reacherx.com"
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

        <WaitlistDrawer />

        <WaitlistUsers className="mt-6 md:mt-12" />
      </section>
    </div>
  );
}
