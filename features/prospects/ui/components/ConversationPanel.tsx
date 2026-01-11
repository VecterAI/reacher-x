/**
 * ConversationPanel
 * Displays a full Twitter thread conversation.
 * Uses SocialAPI thread endpoint to fetch all tweets in a thread.
 * Opens as a sub-panel in the panel stack (like EvidencePostsPanel pattern).
 */
"use client";

import * as React from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/shared/lib/utils";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { usePanelStack } from "../../contexts/PanelStackContext";
import { Tweet } from "@/features/webapp/ui/components/tweet";
import type { Tweet as TweetType } from "@/features/threads/types";

// ============================================================================
// Types
// ============================================================================

export interface ConversationPanelProps {
  /** Thread ID to fetch (Twitter conversation thread ID) */
  threadId: string;
  /** Additional className */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ConversationPanel({
  threadId,
  className,
}: ConversationPanelProps) {
  const { popPanel } = usePanelStack();
  const fetchThread = useAction(
    api.integrations.twitter.getThread.fetchTwitterThread
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const [tweets, setTweets] = React.useState<TweetType[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch real thread data
  React.useEffect(() => {
    async function loadThread() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchThread({ threadId });
        if (result.success && result.tweets) {
          setTweets(result.tweets as TweetType[]);
        } else {
          setError(result.error || "Failed to load thread");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load thread");
      } finally {
        setIsLoading(false);
      }
    }
    loadThread();
  }, [threadId, fetchThread]);

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full max-w-lg flex-1 overflow-hidden md:min-w-0",
        className
      )}
    >
      <PageLayout className="md:w-full">
        <PageHeader title="Conversation" onBack={popPanel} />
        <ScrollArea className="h-[calc(100dvh-3rem)] overscroll-contain">
          <PageContent className="pt-4">
            {isLoading ? (
              <ConversationSkeleton />
            ) : tweets.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                Could not load conversation.
              </div>
            ) : (
              <section>
                {tweets.map((tweet) => (
                  <article key={tweet.id_str} className="px-4">
                    <Tweet
                      tweet={tweet}
                      characterLimit={280}
                      showThread={false}
                    />
                  </article>
                ))}
              </section>
            )}
          </PageContent>
        </ScrollArea>
      </PageLayout>
    </aside>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

function ConversationSkeleton() {
  return (
    <div className="divide-y">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-3 px-4 py-3">
          <div className="flex items-start gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-12 w-full" />
          <div className="flex gap-4">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}
