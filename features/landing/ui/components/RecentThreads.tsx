// features/landing/ui/components/RecentThreads.tsx
import { TweetCard } from "@/features/landing/ui/components/TweetCard";
import { Thread } from "@/app/(landing)/threads/types";
import { LinkWrapper } from "./LinkWrapper";

interface RecentThreadsProps {
  threads: Thread[]; // Changed to required prop
  bordered?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Removed async and direct data fetching
export function RecentThreads({
  threads,
  bordered = true,
  size = "md",
  className = "",
}: RecentThreadsProps) {
  if (threads.length === 0) {
    return <p>No recent threads available.</p>;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {threads.map((thread) => {
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
            />
          </LinkWrapper>
        );
      })}
    </div>
  );
}
