"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { TweetCard } from "@/features/landing/ui/components/TweetCard";
import { useParams } from "next/navigation";
import { LinkWrapper } from "./LinkWrapper";

interface RecentThreadsProps {
  count?: number; // Number of threads to display (default: 3)
  bordered?: boolean; // Whether to apply borders to TweetCard (default: true)
  size?: "sm" | "md" | "lg"; // Size of the TweetCard (default: "md")
  className?: string; // Additional styling classes
}

export function RecentThreads({
  count = 3,
  bordered = true,
  size = "md",
  className = "",
}: RecentThreadsProps) {
  const params = useParams();
  const excludeThreadId = params.threadId as string | undefined;
  const threadIds = useQuery(api.socialdata.getThreadIds);
  const getThreadsAction = useAction(api.socialdata.getThreads);
  const [recentThreads, setRecentThreads] = useState<any[] | null>(null);

  useEffect(() => {
    if (threadIds) {
      let filteredIds = excludeThreadId
        ? threadIds.filter((id) => id !== excludeThreadId)
        : threadIds;
      const limitedIds = filteredIds.slice(0, count);
      if (limitedIds.length > 0) {
        getThreadsAction({ threadIds: limitedIds })
          .then((threads) => setRecentThreads(threads))
          .catch((error) => {
            console.error("Failed to fetch recent threads:", error);
            setRecentThreads([]); // Handle error gracefully
          });
      } else {
        setRecentThreads([]);
      }
    }
  }, [threadIds, excludeThreadId, count, getThreadsAction]);

  if (recentThreads === null) {
    return <div>Loading recent threads...</div>;
  }

  if (recentThreads.length === 0) {
    return <p>No recent threads available.</p>;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {recentThreads.map((thread) => {
        const firstTweet = thread.tweets[0];
        const user = firstTweet.user;
        const threadId = firstTweet.id_str;

        return (
          <LinkWrapper key={threadId} href={`/threads/${threadId}`}>
            <TweetCard
              className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 py-4 duration-300 md:px-0"
              profileImageUrlHttps={user.profile_image_url_https}
              name={user.name}
              screenName={user.screen_name}
              tweetCreatedAt={firstTweet.tweet_created_at}
              fullText={firstTweet.full_text}
              verified={user.verified}
              quoteCount={firstTweet.quote_count}
              replyCount={firstTweet.reply_count}
              retweetCount={firstTweet.retweet_count}
              favoriteCount={firstTweet.favorite_count}
              viewsCount={firstTweet.views_count}
              media={firstTweet.entities?.media || []}
              size={size}
              bordered={bordered}
            />
          </LinkWrapper>
        );
      })}
    </div>
  );
}
