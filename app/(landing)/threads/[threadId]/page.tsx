"use client";

import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { PostCard } from "@/features/landing/ui/components/PostCard";

// Define interfaces for type safety
interface Tweet {
  id_str: string;
  full_text: string;
  user: {
    screen_name: string;
    profile_image_url_https: string;
    name: string;
    verified: boolean;
  };
  tweet_created_at: string;
  reply_count: number;
  retweet_count: number;
  favorite_count: number;
  bookmark_count: number;
  views_count: number;
}

interface Thread {
  tweets: Tweet[];
}

export default function ThreadDetailPage() {
  // Get threadId from route parameters
  const { threadId } = useParams();

  // Get the action function
  const getThreadsAction = useAction(api.socialdata.getThreads);

  // State to hold the fetched thread data
  const [thread, setThread] = useState<Thread[] | null>(null);

  // Fetch thread data when threadId changes
  useEffect(() => {
    if (threadId && typeof threadId === "string") {
      getThreadsAction({ threadIds: [threadId] })
        .then((fetchedThreads) => setThread(fetchedThreads))
        .catch((error) => {
          console.error("Failed to fetch thread:", error);
          setThread([]); // Set empty array to indicate no data
        });
    }
  }, [threadId, getThreadsAction]);

  // Loading state
  if (thread === null) {
    return <div>Loading...</div>;
  }

  // Thread not found state
  if (thread.length === 0) {
    return <div>Thread not found</div>;
  }

  // Extract the single thread (since we passed one threadId)
  const singleThread = thread[0];
  const tweets = singleThread.tweets;

  // Render the thread
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-bold">Thread</h1>
      {tweets.map((tweet) => (
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
          bookmarks={tweet.bookmark_count}
          impressions={tweet.views_count}
          postUrl={`https://x.com/${tweet.user.screen_name}/status/${tweet.id_str}`}
          thread={tweets.length > 1}
        />
      ))}
    </div>
  );
}
