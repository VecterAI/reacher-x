"use client";

import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { TweetCard } from "@/features/landing/ui/components/TweetCard";
import Link from "next/link";
import { UserProfileCard } from "@/features/landing/ui/components/UserProfileCard";
import { Separator } from "@/shared/ui/components/Separator";
import { WaitlistDrawer } from "@/features/landing/ui/components/WaitlistDrawer";
import { WaitlistUsers } from "@/features/landing/ui/components/WaitlistUsers";
import { Badge } from "@/shared/ui/components/Badge";
import { Thread } from "../types";
import { RecentThreads } from "@/features/landing/ui/components/RecentThreads";
import { useRouter } from "next/navigation";

export default function ThreadDetailPage() {
  // Get threadId from route parameters
  const { threadId } = useParams();
  const getThreadsAction = useAction(api.socialdata.getThreads);
  const threadIds = useQuery(api.socialdata.getThreadIds);
  const router = useRouter();

  // State for the current thread
  const [thread, setThread] = useState<Thread[] | null>(null);

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

  // Loading state for initial render
  if (thread === null || threadIds === undefined) {
    return <div>Loading...</div>;
  }

  // Compute thread number
  const index =
    threadIds && threadId ? threadIds.indexOf(threadId as string) : -1;
  const threadNumber = index !== -1 ? threadIds.length - index : null;

  // Thread not found state
  if (thread.length === 0) {
    return <div>Thread not found</div>;
  }

  const handleGoBack = () => {
    // Try to go back
    router.back();

    // Set a fallback timeout in case there's no history
    const fallbackTimer = setTimeout(() => {
      // Check if we're still on the same page (navigation didn't happen)
      if (window.location.pathname.includes(`/threads/${threadId}`)) {
        router.push("/threads");
      }
    }, 100);

    return () => clearTimeout(fallbackTimer);
  };

  const singleThread = thread[0];
  const tweets = singleThread.tweets;
  const author = tweets[0].user;

  return (
    <div className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] mt-6 duration-300 md:mt-12">
      <Link
        href=""
        onClick={handleGoBack}
        className="ml-4 block w-fit bg-green-500 md:ml-28"
      >
        <h1 className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] text-3xl font-medium duration-300 md:text-5xl">
          <span className="inline-block rotate-180">➞</span> Thread #
          {threadNumber !== null && threadNumber > 0
            ? threadNumber
            : "Loading..."}
        </h1>
      </Link>
      <div className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] mt-6 grid grid-cols-1 gap-12 duration-300 md:mt-12 md:grid-cols-[calc(66.47%-1.5rem)_calc(33.53%-1.5rem)] md:px-28">
        <section className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 duration-300 @container md:px-0">
          {tweets.map((tweet, index) => (
            <TweetCard
              key={tweet.id_str}
              showFullContent={true}
              profileImageUrlHttps={tweet.user.profile_image_url_https}
              name={tweet.user.name}
              screenName={tweet.user.screen_name}
              verified={tweet.user.verified}
              tweetCreatedAt={tweet.tweet_created_at}
              fullText={tweet.full_text}
              entities={tweet.entities}
              quoteCount={tweet.quote_count}
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
        <aside className="space-y-6">
          <section
            aria-labelledby="hero-heading"
            className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 duration-300 md:px-0"
          >
            <Badge variant="outline">✶ Launching April 2025</Badge>
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
              className="mt-4"
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
            <RecentThreads count={5} />
          </section>
        </aside>
      </div>
      <section
        id="join-waitlist"
        aria-labelledby="waitlist-heading"
        className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 py-12 duration-300 md:px-28 md:py-52"
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
