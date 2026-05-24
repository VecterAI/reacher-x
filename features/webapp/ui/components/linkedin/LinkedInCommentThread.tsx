"use client";

import * as React from "react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
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
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { KeyboardArrowDownIcon } from "@/shared/ui/components/icons";
import { LinkedInReplyComposer } from "./LinkedInReplyComposer";
import { LinkedInCommentItem } from "./LinkedInCommentItem";
import { extractTextFromEditorState } from "@/shared/lib/utils";
import { toast } from "sonner";

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
  onResolvedPost?: (post: UnifiedPost) => void;
}

type RepliesState = Record<
  string,
  {
    page?: LinkedInCommentPage;
    loading: boolean;
    error: string | null;
  }
>;

function updateCommentInPage(
  page: LinkedInCommentPage | undefined,
  commentId: string,
  updater: (comment: LinkedInPostComment) => LinkedInPostComment
) {
  if (!page) {
    return page;
  }

  let changed = false;
  const items = page.items.map((comment) => {
    if (comment.id !== commentId) {
      return comment;
    }
    changed = true;
    return updater(comment);
  });

  return changed ? { ...page, items } : page;
}

function replaceCommentInPage(
  page: LinkedInCommentPage | undefined,
  commentId: string,
  nextComment: LinkedInPostComment
) {
  if (!page) {
    return page;
  }

  let changed = false;
  const items = page.items.map((comment) => {
    if (comment.id !== commentId) {
      return comment;
    }
    changed = true;
    return nextComment;
  });

  return changed ? { ...page, items } : page;
}

function removeCommentFromPage(
  page: LinkedInCommentPage | undefined,
  commentId: string
) {
  if (!page) {
    return page;
  }

  const items = page.items.filter((comment) => comment.id !== commentId);
  if (items.length === page.items.length) {
    return page;
  }

  return { ...page, items };
}

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
  onResolvedPost,
}: LinkedInCommentThreadProps) {
  const router = useRouter();
  const getThreadContext = useAction(
    (api as any).linkedin.getLinkedInPostThreadContext
  );
  const getReplies = useAction((api as any).linkedin.getLinkedInCommentReplies);
  const sendComment = useAction((api as any).linkedin.sendLinkedInPostComment);
  const likeComment = useAction((api as any).linkedin.likeLinkedInComment);
  const [sort, setSort] = React.useState<LinkedInCommentSort>("MOST_RELEVANT");
  const [thread, setThread] = React.useState<LinkedInPostThreadContext | null>(
    previewScenario?.thread ?? null
  );
  const [loading, setLoading] = React.useState(
    Boolean(previewScenario?.loading)
  );
  const [error, setError] = React.useState<string | null>(
    previewScenario?.error ?? null
  );
  const [isPostingTopLevel, setIsPostingTopLevel] = React.useState(false);
  const [topLevelComposerVersion, setTopLevelComposerVersion] =
    React.useState(0);
  const [topLevelInitialValue, setTopLevelInitialValue] = React.useState("");
  const [openReplyComposerId, setOpenReplyComposerId] = React.useState<
    string | null
  >(null);
  const [pendingReactionCommentId, setPendingReactionCommentId] =
    React.useState<string | null>(null);
  const [replyComposerVersions, setReplyComposerVersions] = React.useState<
    Record<string, number>
  >({});
  const [replyComposerInitialValues, setReplyComposerInitialValues] =
    React.useState<Record<string, string>>({});
  const [repliesState, setRepliesState] = React.useState<RepliesState>(() => {
    const entries = Object.entries(previewScenario?.repliesByCommentId ?? {});
    return Object.fromEntries(
      entries.map(([commentId, page]) => [
        commentId,
        { page, loading: false, error: null },
      ])
    );
  });
  const threadRef = React.useRef<LinkedInPostThreadContext | null>(
    previewScenario?.thread ?? null
  );

  const loadThread = React.useCallback(
    async (opts?: {
      cursor?: string;
      replace?: boolean;
      nextSort?: LinkedInCommentSort;
    }) => {
      if (previewScenario) {
        return;
      }
      try {
        setLoading(true);
        const nextSort = opts?.nextSort ?? sort;
        const result = (await getThreadContext({
          prospectId: prospectId ? (prospectId as Id<"prospects">) : undefined,
          postId: threadRef.current?.resolvedPostId ?? post.id,
          postData: threadRef.current?.resolvedPost ?? post,
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
        setError(
          err instanceof Error ? err.message : "Unable to load comments."
        );
      } finally {
        setLoading(false);
      }
    },
    [getThreadContext, post, previewScenario, prospectId, sort]
  );

  React.useEffect(() => {
    void loadThread({ replace: true });
  }, [loadThread]);

  React.useEffect(() => {
    threadRef.current = thread;
  }, [thread]);

  React.useEffect(() => {
    if (thread?.resolvedPost) {
      onResolvedPost?.(thread.resolvedPost);
    }
  }, [onResolvedPost, thread?.resolvedPost]);

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
          postId: threadRef.current?.resolvedPostId ?? post.id,
          postData: threadRef.current?.resolvedPost ?? post,
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
    [getReplies, post, previewScenario, prospectId, sort]
  );

  const applyCommentUpdate = React.useCallback(
    (
      commentId: string,
      updater: (comment: LinkedInPostComment) => LinkedInPostComment
    ) => {
      setThread((previous) =>
        previous
          ? {
              ...previous,
              topLevelComments:
                updateCommentInPage(
                  previous.topLevelComments,
                  commentId,
                  updater
                ) ?? previous.topLevelComments,
            }
          : previous
      );
      setRepliesState((previous) => {
        let changed = false;
        const nextEntries = Object.entries(previous).map(([key, state]) => {
          const page = updateCommentInPage(state.page, commentId, updater);
          if (page !== state.page) {
            changed = true;
          }
          return [
            key,
            page === state.page ? state : { ...state, page },
          ] as const;
        });
        return changed ? Object.fromEntries(nextEntries) : previous;
      });
    },
    []
  );

  const handleLikeComment = React.useCallback(
    async (comment: LinkedInPostComment) => {
      if (previewScenario || pendingReactionCommentId || !comment.canReact) {
        return;
      }

      const previousReaction = comment.viewerReacted;
      const previousCount = comment.reactionCount;
      const requestedReactionType = comment.viewerReacted ?? "like";
      const isRemovingReaction = Boolean(comment.viewerReacted);
      setPendingReactionCommentId(comment.id);
      applyCommentUpdate(comment.id, (current) => ({
        ...current,
        viewerReacted: current.viewerReacted
          ? undefined
          : requestedReactionType,
        reactionCount: Math.max(
          0,
          current.reactionCount + (isRemovingReaction ? -1 : 1)
        ),
      }));

      try {
        const result = await likeComment({
          ...(prospectId ? { prospectId: prospectId as Id<"prospects"> } : {}),
          postId: thread?.resolvedPostId ?? post.id,
          postData: thread?.resolvedPost ?? post,
          commentId: comment.id,
          parentCommentId: comment.parentCommentId,
          reactionType: requestedReactionType,
          currentViewerReaction: previousReaction,
        });
        applyCommentUpdate(comment.id, (current) => ({
          ...current,
          viewerReacted:
            typeof result?.viewerReaction === "string" &&
            result.viewerReaction.trim().length > 0
              ? result.viewerReaction.trim().toLowerCase()
              : undefined,
          reactionCount:
            typeof result?.reactionCount === "number"
              ? result.reactionCount
              : current.reactionCount,
        }));
        const nextViewerReaction =
          typeof result?.viewerReaction === "string" &&
          result.viewerReaction.trim().length > 0
            ? result.viewerReaction.trim().toLowerCase()
            : undefined;
        toast.success(
          previousReaction && !nextViewerReaction
            ? "Like removed from LinkedIn comment"
            : !previousReaction && nextViewerReaction
              ? "Liked comment on LinkedIn"
              : "LinkedIn comment reaction updated"
        );
        if (comment.parentCommentId) {
          void loadRepliesForComment(comment.parentCommentId);
        } else {
          void loadThread({ replace: true });
        }
      } catch (likeError) {
        applyCommentUpdate(comment.id, (current) => ({
          ...current,
          viewerReacted: previousReaction,
          reactionCount: previousCount,
        }));
        toast.error(
          isRemovingReaction
            ? "Unable to remove like from LinkedIn comment"
            : "Unable to like LinkedIn comment",
          {
            description:
              likeError instanceof Error
                ? likeError.message
                : "Please try again.",
          }
        );
      } finally {
        setPendingReactionCommentId(null);
      }
    },
    [
      applyCommentUpdate,
      likeComment,
      loadRepliesForComment,
      loadThread,
      pendingReactionCommentId,
      post,
      previewScenario,
      prospectId,
      thread?.resolvedPost,
      thread?.resolvedPostId,
    ]
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

      const resolvedPostId =
        thread?.resolvedSocialId ?? thread?.resolvedPostId ?? post.id;
      const optimistic = buildOptimisticComment({
        postId: resolvedPostId,
        text,
      });
      const optimisticId = optimistic.id;
      setThread((previous) =>
        previous
          ? {
              ...previous,
              topLevelComments: {
                ...previous.topLevelComments,
                items: [optimistic, ...previous.topLevelComments.items],
                totalItems:
                  typeof previous.topLevelComments.totalItems === "number"
                    ? previous.topLevelComments.totalItems + 1
                    : previous.topLevelComments.totalItems,
              },
            }
          : previous
      );
      setTopLevelInitialValue("");

      if (previewScenario) {
        return;
      }

      setIsPostingTopLevel(true);
      void sendComment({
        prospectId: prospectId ? (prospectId as Id<"prospects">) : undefined,
        postId: thread?.resolvedPostId ?? post.id,
        postData: thread?.resolvedPost ?? post,
        text,
        mediaUrls,
      })
        .then((result) => {
          setThread((previous) =>
            previous
              ? {
                  ...previous,
                  topLevelComments:
                    replaceCommentInPage(
                      previous.topLevelComments,
                      optimisticId,
                      {
                        ...optimistic,
                        id: result.commentId ?? optimisticId,
                        postId: result.resolvedSocialId ?? optimistic.postId,
                        createdAt: result.postedAt,
                        source: "unipile",
                      }
                    ) ?? previous.topLevelComments,
                }
              : previous
          );
          void loadThread({ replace: true });
        })
        .catch((sendError) => {
          setThread((previous) =>
            previous
              ? {
                  ...previous,
                  topLevelComments: (() => {
                    const nextPage = removeCommentFromPage(
                      previous.topLevelComments,
                      optimisticId
                    );
                    return nextPage
                      ? {
                          ...nextPage,
                          totalItems:
                            typeof previous.topLevelComments.totalItems ===
                            "number"
                              ? Math.max(
                                  0,
                                  previous.topLevelComments.totalItems - 1
                                )
                              : nextPage.totalItems,
                        }
                      : previous.topLevelComments;
                  })(),
                }
              : previous
          );
          setTopLevelInitialValue(text);
          setTopLevelComposerVersion((previous) => previous + 1);
          toast.error("Unable to comment on LinkedIn", {
            description:
              sendError instanceof Error
                ? sendError.message
                : "Please try again.",
          });
        })
        .finally(() => {
          setIsPostingTopLevel(false);
        });
      void mediaDescriptions;
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
      const optimisticId = optimistic.id;

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
      setReplyComposerInitialValues((previous) => ({
        ...previous,
        [comment.id]: "",
      }));

      if (previewScenario) {
        return;
      }

      void sendComment({
        prospectId: prospectId ? (prospectId as Id<"prospects">) : undefined,
        postId: thread?.resolvedPostId ?? post.id,
        postData: thread?.resolvedPost ?? post,
        text,
        parentCommentId: comment.id,
        mediaUrls,
      })
        .then((result) => {
          setRepliesState((previous) => {
            const existingPage = previous[comment.id]?.page;
            return {
              ...previous,
              [comment.id]: {
                page:
                  replaceCommentInPage(existingPage, optimisticId, {
                    ...optimistic,
                    id: result.commentId ?? optimisticId,
                    postId: result.resolvedSocialId ?? optimistic.postId,
                    createdAt: result.postedAt,
                    source: "unipile",
                  }) ?? existingPage,
                loading: false,
                error: null,
              },
            };
          });
          void Promise.all([
            loadRepliesForComment(comment.id),
            loadThread({ replace: true }),
          ]);
        })
        .catch((sendError) => {
          setRepliesState((previous) => {
            const existingPage = previous[comment.id]?.page;
            return {
              ...previous,
              [comment.id]: {
                page:
                  removeCommentFromPage(existingPage, optimisticId) ??
                  existingPage,
                loading: false,
                error: null,
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
                        ? {
                            ...item,
                            replyCount: Math.max(0, item.replyCount - 1),
                          }
                        : item
                    ),
                  },
                }
              : previous
          );
          setReplyComposerInitialValues((previous) => ({
            ...previous,
            [comment.id]: text,
          }));
          setReplyComposerVersions((previous) => ({
            ...previous,
            [comment.id]: (previous[comment.id] ?? 0) + 1,
          }));
          setOpenReplyComposerId(comment.id);
          toast.error("Unable to reply on LinkedIn", {
            description:
              sendError instanceof Error
                ? sendError.message
                : "Please try again.",
          });
        });
      void mediaDescriptions;
    },
    [
      loadRepliesForComment,
      loadThread,
      post,
      previewScenario,
      prospectId,
      sendComment,
      sort,
      thread,
    ]
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
                    void loadThread({
                      replace: true,
                      nextSort: "MOST_RELEVANT",
                    });
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
              key={`linkedin-top-level-${topLevelComposerVersion}`}
              prospectId={prospectId}
              placeholder="Add a comment..."
              submitLabel={isPostingTopLevel ? "Posting..." : "Comment"}
              initialValue={topLevelInitialValue}
              disabled={isPostingTopLevel}
              onSubmit={handleTopLevelSubmit}
            />
          ) : thread?.eligibility.reasonCode === "missing_connection" ? (
            <Alert>
              <AlertTitle>LinkedIn account not connected</AlertTitle>
              <AlertDescription>
                Connect LinkedIn in Settings → Connected accounts to comment or
                reply.
                <div className="mt-3 flex gap-1">
                  <Button
                    size="xs"
                    onClick={() => router.push("/settings/connected-accounts")}
                  >
                    Connect account
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : thread?.eligibility.reasonLabel ? (
            <Alert>
              <AlertTitle>Commenting unavailable</AlertTitle>
              <AlertDescription>
                {thread.eligibility.reasonLabel}
              </AlertDescription>
            </Alert>
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

              {topLevelComments.length > 0 ? (
                <div className="space-y-5">
                  {topLevelComments.map((comment) => {
                    const replyState = repliesState[comment.id];
                    const isReplyComposerOpen =
                      openReplyComposerId === comment.id;
                    return (
                      <LinkedInCommentItem
                        key={comment.id}
                        comment={comment}
                        prospectId={prospectId}
                        showReplyComposer={isReplyComposerOpen}
                        replyComposerKey={`linkedin-reply-${comment.id}-${replyComposerVersions[comment.id] ?? 0}`}
                        replyComposerInitialValue={
                          replyComposerInitialValues[comment.id]
                        }
                        repliesPage={replyState?.page}
                        repliesLoading={replyState?.loading}
                        repliesError={replyState?.error}
                        disabled={!showComposer}
                        likePending={pendingReactionCommentId === comment.id}
                        onLike={
                          previewScenario
                            ? undefined
                            : () => void handleLikeComment(comment)
                        }
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
                        onReplySubmit={(
                          content,
                          mediaUrls,
                          mediaDescriptions
                        ) =>
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
                            likePending={pendingReactionCommentId === reply.id}
                            onLike={
                              previewScenario
                                ? undefined
                                : () => void handleLikeComment(reply)
                            }
                          />
                        ))}
                      </LinkedInCommentItem>
                    );
                  })}
                </div>
              ) : null}

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
