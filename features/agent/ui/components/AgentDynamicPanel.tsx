"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { useAuth as useWorkosAuth } from "@workos-inc/authkit-nextjs/components";
import { SerializedEditorState } from "lexical";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn, extractTextFromEditorState } from "@/shared/lib/utils";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { ReplyComposer } from "@/features/composer/ui/components/ReplyComposer";
import { Tweet } from "@/features/webapp/ui/components/tweet";
import { LinkedInPostCard } from "@/features/webapp/ui/components/linkedin/LinkedInPostCard";
import type { Tweet as TweetType } from "@/features/threads/types";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import type { AgentPanelMode } from "../../lib";
import {
  useActiveUseCaseLabels,
  useConvexReady,
  useQueryWithStatus,
} from "@/shared/hooks";

export interface AgentDynamicPanelProps {
  prospectId: string;
  taskId?: string | null;
  targetTweetId?: string | null;
  requestedMode?: AgentPanelMode | null;
  /** Post data passed from the inline card click, used as fallback when the
   *  backend query hasn't resolved a task yet. */
  fallbackPost?: { platform: "twitter" | "linkedin"; postData: unknown };
  onClose: () => void;
  onResolvedTaskId?: (taskId: string) => void;
  onResolvedMode?: (mode: AgentPanelMode) => void;
  className?: string;
}

function buildSerializedTextState(
  text: string
): SerializedEditorState | undefined {
  const value = text.trim();
  if (!value) return undefined;

  return {
    root: {
      type: "root",
      format: "",
      indent: 0,
      version: 1,
      direction: "ltr",
      children: [
        {
          type: "paragraph",
          format: "",
          indent: 0,
          version: 1,
          direction: "ltr",
          children: [
            {
              type: "text",
              detail: 0,
              format: 0,
              mode: "normal",
              style: "",
              version: 1,
              text: value,
            },
          ],
        },
      ],
    },
  } as unknown as SerializedEditorState;
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|m4v|webm)$/i.test(url);
}

export function AgentDynamicPanel({
  prospectId,
  taskId,
  targetTweetId,
  requestedMode,
  fallbackPost,
  onClose,
  onResolvedTaskId,
  onResolvedMode,
  className,
}: AgentDynamicPanelProps) {
  const { entitySingular } = useActiveUseCaseLabels();
  const entitySingularLower = entitySingular.toLowerCase();
  const { user } = useWorkosAuth();
  const {
    isReady: isConvexReady,
    isLoading: isConvexReadyLoading,
    error: convexReadyError,
  } = useConvexReady();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const panelDataQuery = useQueryWithStatus(
    api.outreach.getAgentPanelContext,
    isConvexReady && prospectId
      ? {
          prospectId: prospectId as Id<"prospects">,
          taskId: taskId ? (taskId as Id<"outreachTasks">) : undefined,
          targetTweetId: targetTweetId || undefined,
        }
      : "skip"
  );
  const panelData = panelDataQuery.data;

  const xAccount = useQueryWithStatus(
    api.socialAccountsMutations.getXAccount,
    isConvexReady ? {} : "skip"
  ).data;
  const approveTaskWithEdits = useMutation(api.outreach.approveTaskWithEdits);
  const isPanelLoading =
    isConvexReadyLoading || (isConvexReady && panelDataQuery.isPending);

  useEffect(() => {
    if (panelData?.resolvedTaskId && onResolvedTaskId) {
      onResolvedTaskId(panelData.resolvedTaskId);
    }
  }, [panelData?.resolvedTaskId, onResolvedTaskId]);

  useEffect(() => {
    if (panelData?.mode && onResolvedMode) {
      onResolvedMode(panelData.mode);
    }
  }, [onResolvedMode, panelData?.mode]);

  const mode: AgentPanelMode = panelData?.mode || requestedMode || "approval";

  const currentUser = useMemo(
    () => ({
      name: xAccount?.name || user?.firstName || user?.email || "You",
      screenName: xAccount?.screenName || "user",
      profileImageUrl:
        xAccount?.profileImageUrl || user?.profilePictureUrl || undefined,
    }),
    [
      xAccount?.name,
      xAccount?.profileImageUrl,
      xAccount?.screenName,
      user?.email,
      user?.firstName,
      user?.profilePictureUrl,
    ]
  );

  const replyUsers = useMemo(() => {
    const rawPostData =
      panelData?.originalPost && typeof panelData.originalPost === "object"
        ? (panelData.originalPost.postData as Record<string, unknown>)
        : fallbackPost?.postData && typeof fallbackPost.postData === "object"
          ? (fallbackPost.postData as Record<string, unknown>)
          : undefined;
    const postUser =
      rawPostData?.user && typeof rawPostData.user === "object"
        ? (rawPostData.user as Record<string, unknown>)
        : undefined;

    const screenName =
      (typeof postUser?.screen_name === "string" && postUser.screen_name) ||
      entitySingularLower;
    const name =
      (typeof postUser?.name === "string" && postUser.name) || screenName;

    return [{ screenName, name }];
  }, [entitySingularLower, panelData?.originalPost, fallbackPost?.postData]);

  const initialContent = useMemo(
    () => buildSerializedTextState(panelData?.draft?.content || ""),
    [panelData?.draft?.content]
  );

  const postedReplyTweet = useMemo(() => {
    if (!panelData?.posted) return null;

    const mediaUrls = panelData.posted.mediaUrls || [];
    const mediaDescriptions = panelData.posted.mediaDescriptions || [];
    const media =
      mediaUrls.length > 0
        ? mediaUrls.map((url: string, index: number) => {
            const video = isVideoUrl(url);
            return {
              id_str: `posted-media-${index}`,
              media_url_https: url,
              type: video ? "video" : "photo",
              ext_alt_text: mediaDescriptions[index] || undefined,
              video_info: video
                ? {
                    variants: [{ content_type: "video/mp4", url }],
                  }
                : undefined,
            };
          })
        : undefined;

    const createdAt =
      typeof panelData.posted.postedAt === "number"
        ? new Date(panelData.posted.postedAt).toISOString()
        : undefined;

    return {
      id_str: panelData.posted.tweetId || `posted-${panelData.resolvedTaskId}`,
      full_text: panelData.posted.text || "",
      tweet_created_at: createdAt,
      user: {
        name: panelData.posted.author?.name || currentUser.name,
        screen_name:
          panelData.posted.author?.screenName || currentUser.screenName,
        profile_image_url_https:
          panelData.posted.author?.profileImageUrl ||
          currentUser.profileImageUrl,
      },
      entities: media ? { media } : undefined,
    };
  }, [panelData, currentUser]);

  const handleSubmit = useCallback(
    async (
      content: SerializedEditorState,
      mediaUrls?: string[],
      mediaDescriptions?: string[]
    ) => {
      if (!panelData?.resolvedTaskId) {
        toast.error("Unable to submit", {
          description: "Task context not loaded yet. Please try again.",
        });
        return;
      }
      setIsSubmitting(true);
      try {
        const editedText = extractTextFromEditorState(content).trim();
        const fallbackText = panelData.draft?.content || "";

        const result = await approveTaskWithEdits({
          taskId: panelData.resolvedTaskId as Id<"outreachTasks">,
          content: editedText || fallbackText,
          mediaUrls,
          mediaDescriptions,
          approvalContext: panelData.originalPost
            ? {
                panelMode: "approval",
                platform: panelData.originalPost.platform,
                sourcePostId: panelData.originalPost.postId || undefined,
                sourcePostData: panelData.originalPost.postData,
                sourceContext: panelData.originalPost.context || undefined,
              }
            : undefined,
        });
        if (result?.duplicate) {
          toast.success("Reply already approved.");
        } else {
          toast.success("Reply approved.", {
            description: "Posting in background...",
          });
        }
      } catch (error) {
        toast.error("Failed to approve reply", {
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [approveTaskWithEdits, panelData]
  );

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full max-w-lg flex-1 overflow-hidden md:min-w-0",
        className
      )}
    >
      <PageLayout className="flex flex-col md:w-full">
        <PageHeader
          title={mode === "posted" ? "Posted reply" : "Post"}
          onBack={onClose}
        />
        <ScrollArea className="min-h-0 flex-1" viewportClassName="pb-8">
          <PageContent className="space-y-4 py-4">
            {isPanelLoading ? (
              <div className="space-y-3 px-4">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : convexReadyError || panelDataQuery.isError ? (
              <div className="px-4">
                <p className="text-sm font-medium">
                  Could not load panel context
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {convexReadyError?.message ||
                    panelDataQuery.error?.message ||
                    "Please try again."}
                </p>
              </div>
            ) : !panelData && !fallbackPost ? (
              <p className="text-muted-foreground text-sm">
                No panel context was found for this card yet.
              </p>
            ) : !panelData && fallbackPost ? (
              <div className="px-4">
                {fallbackPost.platform === "twitter" ? (
                  <Tweet
                    tweet={fallbackPost.postData as TweetType}
                    showFullContent
                    showThread={false}
                  />
                ) : (
                  <LinkedInPostCard
                    post={fallbackPost.postData as UnifiedPost}
                    showFullContent
                  />
                )}
                <ReplyComposer
                  replyTo={{
                    tweet: fallbackPost.postData as any,
                    users: replyUsers,
                  }}
                  currentUser={currentUser}
                  placeholder="Ask the agent to draft a reply first..."
                  disabled
                />
              </div>
            ) : (
              (() => {
                const data = panelData!;
                const platform = data.originalPost?.platform || "twitter";
                const hasReplyBelow =
                  mode === "approval" ||
                  (mode === "posted" && !!postedReplyTweet);

                return (
                  <div className="px-4">
                    {data.originalPost &&
                      (platform === "twitter" ? (
                        <Tweet
                          tweet={data.originalPost.postData as TweetType}
                          showFullContent
                          showThread={!hasReplyBelow}
                        />
                      ) : (
                        <LinkedInPostCard
                          post={data.originalPost.postData as UnifiedPost}
                          showFullContent
                        />
                      ))}

                    {mode === "approval" ? (
                      <div>
                        <ReplyComposer
                          key={`${data.resolvedTaskId}-${data.draft?.content || ""}`}
                          initialContent={initialContent}
                          replyTo={{
                            tweet:
                              (data.originalPost?.postData as any) ||
                              ({ id_str: data.targetTweetId } as any),
                            users: replyUsers,
                          }}
                          currentUser={currentUser}
                          placeholder="Edit reply before posting"
                          disabled={isSubmitting}
                          onSubmit={handleSubmit}
                        />
                      </div>
                    ) : (
                      <div>
                        {postedReplyTweet ? (
                          <Tweet
                            tweet={postedReplyTweet as TweetType}
                            showFullContent
                            showThread
                          />
                        ) : (
                          <p className="text-muted-foreground text-sm">
                            Reply was posted, but preview data is unavailable.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </PageContent>
        </ScrollArea>
      </PageLayout>
    </aside>
  );
}
