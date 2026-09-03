"use client";

import type { Tweet as TweetType } from "@/features/threads/types";
import {
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/webapp/ui/components";
import { Tweet, TweetSkeleton } from "@/features/webapp/ui/components/tweet";
import { useHydratedTwitterPosts } from "@/shared/hooks/useHydratedTwitterPosts";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { usePanelStack } from "../../contexts/PanelStackContext";

export interface TwitterPostPanelProps {
  tweetId: string;
  initialTweet?: TweetType | null;
  className?: string;
  onBack?: () => void;
}

export function TwitterPostPanel({
  tweetId,
  initialTweet,
  className,
  onBack,
}: TwitterPostPanelProps) {
  const { popPanel } = usePanelStack();
  const { tweetsById, resultsById, isLoading, error, refresh } =
    useHydratedTwitterPosts(tweetId ? [tweetId] : []);
  const tweet = tweetsById[tweetId] ?? initialTweet ?? null;
  const result = resultsById[tweetId];
  const isPending = !tweet && (isLoading || !result);
  const errorMessage =
    result?.status === "not_found"
      ? (result.message ?? "This post is no longer available.")
      : error || result?.message || "Unable to load this post.";

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full max-w-lg flex-1 overflow-hidden md:min-w-0",
        className
      )}
    >
      <PageLayout className="flex h-full flex-col md:w-full md:border-r-0">
        <PageHeader title="Post" onBack={onBack ?? popPanel} />
        <ScrollArea
          className="min-h-0 flex-1 overscroll-contain"
          viewportClassName="pb-6"
        >
          <PageContent className="px-4 py-4">
            {isPending ? (
              <TweetSkeleton showThread hideThreadLine />
            ) : tweet ? (
              <Tweet
                tweet={tweet}
                showFullContent
                showThread
                hideThreadLine
                openBehavior="none"
              />
            ) : (
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm">{errorMessage}</p>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => void refresh({ force: true })}
                >
                  Retry post
                </Button>
              </div>
            )}
          </PageContent>
        </ScrollArea>
      </PageLayout>
    </aside>
  );
}
