"use client";

import * as React from "react";
import { useAction } from "convex/react";
import type { SerializedEditorState } from "lexical";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type {
  LinkedInCommentPage,
  LinkedInCommentSort,
  LinkedInPostComment,
  LinkedInPostThreadContext,
} from "@/shared/lib/linkedin/comments";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { Button } from "@/shared/ui/components/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { KeyboardArrowDownIcon } from "@/shared/ui/components/icons";
import { LinkedInReplyComposer } from "./LinkedInReplyComposer";
import { LinkedInCommentItem } from "./LinkedInCommentItem";
import { extractTextFromEditorState } from "@/shared/lib/utils";

const INITIAL_COMMENT_LIMIT = 10;

export interface LinkedInCommentThreadPreviewScenario {
  thread: LinkedInPostThreadContext;
  repliesByCommentId?: Record<string, LinkedInCommentPage>;
  loading?: boolean;
  error?: string;
}

export interface LinkedInCommentThreadProps {
  post: UnifiedPost;
  prospectId?: string;
  previewScenario?: LinkedInCommentThreadPreviewScenario;
  className?: string;
}

type RepliesState = Record<
  string,
  {
    page?: LinkedInCommentPage;
    loading: boolean;
    error: string | null;
  }
>;

function buildOptimisticComment(args: {
  postId: string;
  parentCommentId?: string;
  text: string;
}): LinkedInPostComment {
  return {
    id: `optimistic:${args.postId}:${Date.now()}`,
    postId: args.postId,
    parentCommentId: args.parentCommentId,
    text: args.text,
    createdAt: new Date().toISOString(),
    reactionCount: 0,
    replyCount: 0,
    author: {
      name: "You",
      isViewer: true,
    },
    canReply: true,
    canReact: true,
    source: "optimistic",
  };
}

export function LinkedInCommentThread({
  post,
  prospectId,
  previewScenario,
  className,
}: LinkedInCommentThreadProps) {
  const getThreadContext = useAction((api as any).linkedin.getLinkedInPostThreadContext);
  const getReplies = useAction((api as any).linkedin.getLinkedInCommentReplies);
  const sendComment = useAction((api as any).linkedin.sendLinkedInPostComment);
  const [sort, setSort] = React.useState<LinkedInCommentSort>("MOST_RELEVANT");
  const [thread, setThread] = React.useState<LinkedInPostThreadContext | null>(
    previewScenario?.thread ?? null
  );
  const [loading, setLoading] = React.useState(Boolean(previewScenario?.loading));
  const [error, setError] = React.useState<string | null>(
    previewScenario?.error ?? null
  );
  const [isPostingTopLevel, setIsPostingTopLevel] = React.useState(false);
  const [openReplyComposerId, setOpenReplyComposerId] = React.useState<
    string | null
  >(null);
  const [repliesState, setRepliesState] = React.useState<RepliesState>(() => {
    const entries = Object.entries(previewScenario?.repliesByCommentId ?? {});
    return Object.fromEntries(
      entries.map(([commentId, page]) => [
        commentId,
        { page, loading: false, error: null },
      ])
    );
  });

  const loadThread = React.useCallback(
    async (opts?: { cursor?: string; replace?: boolean; nextSort?: LinkedInCommentSort }) => {
      if (previewScenario) {
        return;
      }
      try {
        setLoading(true);
        const nextSort = opts?.nextSort ?? sort;
        const result = (await getThreadContext({
          prospectId: prospectId ? (prospectId as Id<"prospects">) : undefined,
          postId: post.id,
          postData: post,
          sort: nextSort,
          cursor: opts?.cursor,
          limit: INITIAL_COMMENT_LIMIT,
        })) as LinkedInPostThreadContext;
        setThread((previous) => {
          if (!previous || !opts?.cursor || opts.replace) {
            return result;
          }
          return {
            ...result,
            topLevelComments: {
              ...result.topLevelComments,
              items: [
                ...previous.topLevelComments.items,
                ...result.topLevelComments.items,
              ],
            },
          };
        });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load comments.");
      } finally {
        setLoading(false);
      }
    },
    [getThreadContext, post, previewScenario, prospectId, sort]
  );

  React.useEffect(() => {
    void loadThread({ replace: true });
  }, [loadThread]);

  const loadRepliesForComment = React.useCallback(
    async (commentId: string, cursor?: string) => {
      if (previewScenario) {
        setRepliesState((previous) => ({
          ...previous,
          [commentId]: {
            page: previous[commentId]?.page,
            loading: false,
            error: null,
          },
        }));
        return;
      }

      setRepliesState((previous) => ({
        ...previous,
        [commentId]: {
          page: previous[commentId]?.page,
          loading: true,
          error: null,
        },
      }));

      try {
        const result = await getReplies({
          prospectId: prospectId ? (prospectId as Id<"prospects">) : undefined,
          postId: thread?.resolvedPostId ?? post.id,
          postData: post,
          commentId,
          sort,
          cursor,
          limit: INITIAL_COMMENT_LIMIT,
        });
        setRepliesState((previous) => {
          const existing = previous[commentId]?.page;
          return {
            ...previous,
            [commentId]: {
              loading: false,
              error: null,
              page:
                cursor && existing
                  ? {
                      ...result.page,
                      items: [...existing.items, ...result.page.items],
                    }
                  : result.page,
            },
          };
        });
      } catch (err) {
        setRepliesState((previous) => ({
          ...previous,
          [commentId]: {
            page: previous[commentId]?.page,
            loading: false,
            error:
              err instanceof Error ? err.message : "Unable to load replies.",
          },
        }));
      }
    },
    [getReplies, post, previewScenario, prospectId, sort, thread?.resolvedPostId]
  );

  const handleTopLevelSubmit = React.useCallback(
    async (
      content: SerializedEditorState,
      mediaUrls?: string[],
      mediaDescriptions?: string[]
    ) => {
      const text = extractTextFromEditorState(content).trim();
      if (!text && (mediaUrls?.length ?? 0) === 0) {
        return;
      }

      const resolvedPostId = thread?.resolvedSocialId ?? thread?.resolvedPostId ?? post.id;
      const optimistic = buildOptimisticComment({
        postId: resolvedPostId,
        text,
      });
      setThread((previous) =>
        previous
          ? {
              ...previous,
              topLevelComments: {
                ...previous.topLevelComments,
                items: [optimistic, ...previous.topLevelComments.items],
              },
            }
          : previous
      );

      if (previewScenario) {
        return;
      }

      try {
        setIsPostingTopLevel(true);
        await sendComment({
          prospectId: prospectId ? (prospectId as Id<"prospects">) : undefined,
          postId: thread?.resolvedPostId ?? post.id,
          postData: post,
          text,
          mediaUrls,
        });
        await loadThread({ replace: true });
      } finally {
        setIsPostingTopLevel(false);
        void mediaDescriptions;
      }
    },
    [loadThread, post, previewScenario, prospectId, sendComment, thread]
  );

  const handleReplySubmit = React.useCallback(
    async (
      comment: LinkedInPostComment,
      content: SerializedEditorState,
      mediaUrls?: string[],
      mediaDescriptions?: string[]
    ) => {
      const text = extractTextFromEditorState(content).trim();
      if (!text && (mediaUrls?.length ?? 0) === 0) {
        return;
      }

      const optimistic = buildOptimisticComment({
        postId: thread?.resolvedSocialId ?? thread?.resolvedPostId ?? post.id,
        parentCommentId: comment.id,
        text,
      });

      setRepliesState((previous) => {
        const existingPage = previous[comment.id]?.page;
        return {
          ...previous,
          [comment.id]: {
            loading: false,
            error: null,
            page: existingPage
              ? {
                  ...existingPage,
                  items: [optimistic, ...existingPage.items],
                }
              : {
                  items: [optimistic],
                  cursor: null,
                  totalItems: 1,
                  sort,
                  source: "preview",
                },
          },
        };
      });
      setThread((previous) =>
        previous
          ? {
              ...previous,
              topLevelComments: {
                ...previous.topLevelComments,
                items: previous.topLevelComments.items.map((item) =>
                  item.id === comment.id
                    ? { ...item, replyCount: item.replyCount + 1 }
                    : item
                ),
              },
            }
          : previous
      );
      setOpenReplyComposerId(null);

      if (previewScenario) {
        return;
      }

      try {
        await sendComment({
          prospectId: prospectId ? (prospectId as Id<"prospects">) : undefined,
          postId: thread?.resolvedPostId ?? post.id,
          postData: post,
          text,
          parentCommentId: comment.id,
          mediaUrls,
        });
        await loadRepliesForComment(comment.id);
        await loadThread({ replace: true });
      } finally {
        void mediaDescriptions;
      }
    },
    [loadRepliesForComment, loadThread, post, previewScenario, prospectId, sendComment, sort, thread]
  );

  const topLevelComments = thread?.topLevelComments.items ?? [];
  const showComposer = thread?.eligibility.enabled === true;

  return (
    <section className={className}>
      <div className="border-border/70 mt-3 border-l pl-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">Comments</div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="xs" className="gap-1">
                  {sort === "MOST_RELEVANT" ? "Most relevant" : "Most recent"}
                  <KeyboardArrowDownIcon className="fill-current" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setSort("MOST_RELEVANT");
                    void loadThread({ replace: true, nextSort: "MOST_RELEVANT" });
                  }}
                >
                  Most relevant
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSort("MOST_RECENT");
                    void loadThread({ replace: true, nextSort: "MOST_RECENT" });
                  }}
                >
                  Most recent
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {showComposer ? (
            <LinkedInReplyComposer
              prospectId={prospectId}
              placeholder="Add a comment..."
              submitLabel={isPostingTopLevel ? "Posting..." : "Comment"}
              disabled={isPostingTopLevel}
              onSubmit={handleTopLevelSubmit}
            />
          ) : thread?.eligibility.reasonLabel ? (
            <div className="rounded-[20px] border px-4 py-3 text-sm">
              <p className="font-medium">Commenting unavailable</p>
              <p className="text-muted-foreground mt-1">
                {thread.eligibility.reasonLabel}
              </p>
            </div>
          ) : null}

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full rounded-[20px]" />
              <Skeleton className="h-20 w-full rounded-[20px]" />
            </div>
          ) : error ? (
            <div className="rounded-[20px] border px-4 py-3 text-sm">
              <p className="font-medium">Could not load comments</p>
              <p className="text-muted-foreground mt-1">{error}</p>
            </div>
          ) : (
            <>
              {thread?.warning ? (
                <div className="rounded-[20px] border px-4 py-3 text-sm">
                  <p className="font-medium">Limited thread sync</p>
                  <p className="text-muted-foreground mt-1">
                    {thread.warning.message}
                  </p>
                </div>
              ) : null}

              {topLevelComments.length === 0 ? (
                <div className="text-muted-foreground rounded-[20px] border px-4 py-3 text-sm">
                  No comments yet.
                </div>
              ) : (
                <div className="space-y-5">
                  {topLevelComments.map((comment) => {
                    const replyState = repliesState[comment.id];
                    const isReplyComposerOpen = openReplyComposerId === comment.id;
                    return (
                      <LinkedInCommentItem
                        key={comment.id}
                        comment={comment}
                        prospectId={prospectId}
                        showReplyComposer={isReplyComposerOpen}
                        repliesPage={replyState?.page}
                        repliesLoading={replyState?.loading}
                        repliesError={replyState?.error}
                        disabled={!showComposer}
                        onToggleReplies={() => {
                          if (replyState?.page) {
                            setRepliesState((previous) => {
                              const next = { ...previous };
                              delete next[comment.id];
                              return next;
                            });
                            return;
                          }
                          void loadRepliesForComment(comment.id);
                        }}
                        onLoadMoreReplies={() => {
                          if (replyState?.page?.cursor) {
                            void loadRepliesForComment(
                              comment.id,
                              replyState.page.cursor
                            );
                          }
                        }}
                        onToggleReplyComposer={() =>
                          setOpenReplyComposerId((previous) =>
                            previous === comment.id ? null : comment.id
                          )
                        }
                        onReplySubmit={(content, mediaUrls, mediaDescriptions) =>
                          handleReplySubmit(
                            comment,
                            content,
                            mediaUrls,
                            mediaDescriptions
                          )
                        }
                      >
                        {(replyState?.page?.items ?? []).map((reply) => (
                          <LinkedInCommentItem
                            key={reply.id}
                            comment={reply}
                            prospectId={prospectId}
                            disabled
                          />
                        ))}
                      </LinkedInCommentItem>
                    );
                  })}
                </div>
              )}

              {thread?.topLevelComments.cursor ? (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    void loadThread({
                      cursor: thread.topLevelComments.cursor ?? undefined,
                    })
                  }
                >
                  Load more comments
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
