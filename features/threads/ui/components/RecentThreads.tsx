// features/landing/ui/components/RecentThreads.tsx
import { TweetCard as ThreadCard } from "@/features/threads/ui/components/TweetCard";
import { Thread } from "@/features/threads/types";
import { LinkWrapper } from "../../../landing/ui/components/LinkWrapper";

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
    return (
      <p className="mt-4 px-4 text-muted-foreground md:px-0">
        No recent threads available.
      </p>
    );
  }

  return (
    <div className={className}>
      {threads.map((thread) => {
        const firstTweet = thread.tweets[0];
        return (
          <LinkWrapper
            href={`/home/threads/${thread.threadId}`}
            key={thread.threadId}
          >
            <ThreadCard
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
