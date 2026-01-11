"use client";
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Thread } from "@/features/threads/types";
import { ThreadCard } from "@/features/threads/ui/components/ThreadCard";
import { Skeleton } from "@/shared/ui/components/Skeleton";

export function LiveThreadDetail({ threadId }: { threadId: string }) {
  const thread = useQuery(api.socialapiMutations.getThreadById, {
    threadId,
  }) as Thread | null | undefined;

  const tweets = useMemo(() => thread?.tweets ?? [], [thread]);

  if (thread === undefined) {
    return (
      <div className="pt-2">
        {Array.from({ length: 5 }).map((_, i, arr) => {
          const isLast = i === arr.length - 1;
          return (
            <div key={i} className="pt-2">
              <div className="group relative flex items-stretch gap-4">
                <div className="grid grid-rows-[auto_1fr] place-items-center gap-2">
                  <Skeleton className="h-9 w-9 rounded-full md:h-10 md:w-10" />
                  {!isLast && (
                    <div className="bg-muted h-full w-[2px] rounded-md" />
                  )}
                </div>
                <div className="grid w-full gap-4">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-40 md:h-5 md:w-56" />
                    <Skeleton className="h-4 w-16 md:h-4 md:w-20" />
                  </div>
                  <Skeleton className="h-5 w-[85%] md:h-6" />
                  <Skeleton className="h-5 w-[65%] md:h-6" />
                  <div className="mt-2 flex gap-4">
                    <Skeleton className="h-4 w-10" />
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  if (!thread) {
    return <p className="text-muted-foreground mt-2">Thread not found</p>;
  }

  return (
    <>
      {tweets.map((tweet, index) => (
        <ThreadCard
          className="pt-2"
          key={tweet.id_str}
          staticTweet={tweet}
          size="lg"
          showFullContent={true}
          showThread={index === tweets.length - 1}
        />
      ))}
    </>
  );
}
