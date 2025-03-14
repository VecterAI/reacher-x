// features/landing/ui/components/RecentThreads.tsx
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { TweetCard } from "@/features/landing/ui/components/TweetCard";
import { Thread } from "@/app/(landing)/threads/types";
import { LinkWrapper } from "./LinkWrapper";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");

interface RecentThreadsProps {
  count?: number;
  excludeThreadId?: string;
  bordered?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export async function RecentThreads({
  count = 3,
  excludeThreadId,
  bordered = true,
  size = "md",
  className = "",
}: RecentThreadsProps) {
  const recentThreads = (await convex.query(api.socialdata.getRecentThreads, {
    count,
    excludeThreadId,
  })) as Thread[];

  if (recentThreads.length === 0) {
    return <p>No recent threads available.</p>;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {recentThreads.map((thread) => {
        const firstTweet = thread.tweets[0];
        return (
          <LinkWrapper
            href={`/threads/${thread.threadId}`}
            key={thread.threadId}
          >
            <TweetCard
              className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 py-4 duration-300 md:px-0"
              threadId={thread.threadId}
              staticTweet={firstTweet}
              size={size}
              bordered={bordered}
              isLast={true}
            />
          </LinkWrapper>
        );
      })}
    </div>
  );
}
