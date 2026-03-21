/**
 * YourInteractionsTab
 * Displays posts where the user/agent has interacted with the prospect.
 * Shows original post with avatar stack of participants and "Show conversation" button.
 */
"use client";

import * as React from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/shared/ui/components/Button";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { Tweet, TweetSkeleton } from "@/features/webapp/ui/components/tweet";
import { AvatarStack } from "@/shared/ui/components/AvatarStack";
import { usePanelStack } from "../../../contexts/PanelStackContext";
import type { ProspectInteraction } from "@/features/prospects/types";
import { getTwitterPostId } from "@/shared/lib/twitter/contracts";
import { useHydratedTwitterPosts } from "@/shared/hooks/useHydratedTwitterPosts";

// ============================================================================
// Types
// ============================================================================

export interface YourInteractionsTabProps {
  /** Prospect ID to fetch interactions for */
  prospectId: string;
  /** Platform for rendering posts */
  platform: "twitter" | "linkedin";
}

// ============================================================================
// Component
// ============================================================================

export function YourInteractionsTab({
  prospectId,
  platform,
}: YourInteractionsTabProps) {
  const { pushPanel } = usePanelStack();
  const fetchInteractions = useAction(
    api.outreachActions.fetchProspectInteractions
  );
  const [interactions, setInteractions] = React.useState<ProspectInteraction[]>(
    []
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const twitterPostIds = React.useMemo(
    () =>
      platform === "twitter"
        ? interactions
            .map((interaction) => getTwitterPostId(interaction.originalPost))
            .filter((postId): postId is string => Boolean(postId))
        : [],
    [interactions, platform]
  );
  const {
    tweetsById,
    isLoading: isHydratingTweets,
    error: hydrateError,
  } = useHydratedTwitterPosts(twitterPostIds);

  // Fetch interactions on mount
  const loadInteractions = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchInteractions({
        prospectId: prospectId as Id<"prospects">,
      });
      setInteractions(result as ProspectInteraction[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load interactions"
      );
    } finally {
      setIsLoading(false);
    }
  }, [fetchInteractions, prospectId]);

  React.useEffect(() => {
    void loadInteractions();
  }, [loadInteractions]);

  const handleShowConversation = (threadId: string) => {
    pushPanel("conversation", { threadId });
  };

  if (isLoading) {
    return <YourInteractionsTabSkeleton />;
  }

  if (error) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        Failed to load interactions.
      </div>
    );
  }

  if (interactions.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        No interactions yet.
      </div>
    );
  }

  return (
    <section className="divide-y">
      {interactions.map((interaction) => (
        <article key={interaction.id} className="space-y-3 p-4">
          {/* Original Post */}
          {platform === "twitter"
            ? (() => {
                const postId = getTwitterPostId(interaction.originalPost);
                const hydratedTweet = postId ? tweetsById[postId] : undefined;
                if (hydratedTweet) {
                  return (
                    <Tweet
                      tweet={hydratedTweet}
                      characterLimit={280}
                      showThread={false}
                    />
                  );
                }

                if (isHydratingTweets || !hydrateError) {
                  return <TweetSkeleton showThread={false} />;
                }

                return (
                  <div className="text-muted-foreground text-sm">
                    Could not load this post from X.
                  </div>
                );
              })()
            : null}

          {/* Interaction Footer: Avatar Stack + Show Conversation */}
          <footer className="flex flex-wrap items-center gap-2 pl-1">
            <AvatarStack
              participants={interaction.participants.map((p) => ({
                name: p.name,
                avatarUrl: p.avatarUrl,
              }))}
              maxVisible={5}
              size="sm"
            />

            <Button
              variant="outline"
              size="xs"
              onClick={() => handleShowConversation(interaction.threadId)}
            >
              Show conversation
            </Button>
          </footer>
        </article>
      ))}
    </section>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

export function YourInteractionsTabSkeleton() {
  return (
    <div className="divide-y">
      {[1, 2].map((i) => (
        <div key={i} className="space-y-3 px-4 py-3">
          {/* Post skeleton */}
          <div className="flex items-start gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-16 w-full" />

          {/* Footer skeleton */}
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {[1, 2, 3].map((j) => (
                <Skeleton
                  key={j}
                  className="ring-background size-6 rounded-full ring-2"
                />
              ))}
            </div>
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
