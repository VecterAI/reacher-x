"use client";

import * as React from "react";
import Link from "next/link";
import twitter from "twitter-text";
import { useToast } from "@/shared/ui/hooks/useToast";
import { cva, type VariantProps } from "class-variance-authority";
import {
  formatRelativeTime,
  formatLargeNumber,
} from "@/shared/lib/utils/format";
import { cn } from "@/shared/lib/utils/utils";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { Separator } from "@/shared/ui/components/Separator";
import PostMedia from "./PostMedia";
import {
  BookmarkIcon,
  FavoriteIcon,
  InsertChartIcon,
  MoreHorizIcon,
  QuickPhrasesIcon,
  RepeatIcon,
  NewReleasesIcon,
  LinkIcon,
  ExitToAppIcon,
  AccountCircleIcon,
} from "@/shared/ui/components/icons";
import { Button } from "@/shared/ui/components/Button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/shared/ui/components/DropdownMenu";

const postCardVariants = cva(
  "flex gap-4 w-full px-4 pt-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background transition-colors bg-violet-500",
  {
    variants: {
      bordered: {
        true: "border-b border-muted",
        false: "",
      },
    },
    defaultVariants: {
      bordered: false,
    },
  }
);

export interface PostCardProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children">,
    VariantProps<typeof postCardVariants> {
  size?: "sm" | "md" | "lg";
  detailHref: string;
  cardSlot?: React.ReactNode;
  avatarUrl?: string;
  thread?: boolean;
  displayName?: string;
  username?: string;
  pro?: boolean;
  dateTime?: string;
  replyingTo?: string | null;
  body: string;
  media?: any[];
  replies?: string | number;
  reposts?: string | number;
  likes?: string | number;
  bookmarks?: string | number;
  impressions?: string | number;
  postUrl?: string;
}

export const PostCard = React.forwardRef<HTMLElement, PostCardProps>(
  (
    {
      detailHref,
      cardSlot,
      avatarUrl,
      thread,
      displayName,
      username,
      pro,
      dateTime,
      replyingTo,
      body = "",
      media,
      replies,
      reposts,
      likes,
      bookmarks,
      impressions,
      postUrl,
      size = "md",
      bordered,
      className,
      ...props
    },
    ref
  ) => {
    const parsedBody = React.useMemo(() => {
      if (!body) return "";
      const escaped = twitter.htmlEscape(body);
      return twitter.autoLink(escaped, {
        hashtagUrlBase: "https://x.com/hashtag/",
        usernameUrlBase: "https://x.com/",
        usernameIncludeSymbol: true,
        targetBlank: true,
      });
    }, [body]);

    const avatarClass = cn(
      "h-8 w-8",
      size === "sm" && "md:h-8 md:w-8",
      size === "md" && "md:h-9 md:w-9",
      size === "lg" && "md:h-10 md:w-10"
    );

    const rightColumnClass = cn(
      "pb-4",
      size === "sm" && "md:pb-4",
      size === "md" && "md:pb-6",
      size === "lg" && "md:pb-6"
    );

    const displayNameClass = cn(
      "text-base",
      size === "sm" && "md:text-base",
      size === "md" && "md:text-lg",
      size === "lg" && "md:text-xl"
    );

    const newReleasesIconClass = cn(
      "w-[14px] h-[14px]",
      size === "sm" && "md:w-[14px] md:h-[14px]",
      size === "md" && "md:w-4 md:h-4",
      size === "lg" && "md:w-4 md:h-4"
    );

    const usernameClass = cn(
      "text-sm",
      size === "sm" && "md:text-sm",
      size === "md" && "md:text-base",
      size === "lg" && "md:text-lg"
    );

    const timeClass = cn(
      "text-sm",
      size === "sm" && "md:text-sm",
      size === "md" && "md:text-base",
      size === "lg" && "md:text-lg"
    );

    const replyingToClass = cn(
      "text-sm",
      size === "sm" && "md:text-sm",
      size === "md" && "md:text-sm",
      size === "lg" && "md:text-base"
    );

    const bodyClass = cn(
      "text-base",
      size === "sm" && "md:text-base",
      size === "md" && "md:text-xl",
      size === "lg" && "md:text-2xl"
    );

    const containerClasses = cn(postCardVariants({ bordered }), className);
    const { toast } = useToast();
    const postLink = postUrl || "https://x.com";

    const displayTime = formatRelativeTime(dateTime);

    const repliesCount = formatLargeNumber(Number(replies ?? 0));
    const repostsCount = formatLargeNumber(Number(reposts ?? 0));
    const likesCount = formatLargeNumber(Number(likes ?? 0));
    const bookmarksCount = formatLargeNumber(Number(bookmarks ?? 0));
    const impressionsCount = formatLargeNumber(Number(impressions ?? 0));

    const handleCopyLink = (event: React.MouseEvent) => {
      event.stopPropagation();
      navigator.clipboard.writeText(postLink).then(
        () => {
          toast({
            title: "☑︎ Copied!",
            description: "Link copied to clipboard.",
          });
        },
        (error) => {
          console.error("Failed to copy to clipboard:", error);
          toast({
            variant: "destructive",
            title: "☒ Error!",
            description: "Unable to copy link. Please try again.",
          });
        }
      );
    };

    const handleViewOnX = (event: React.MouseEvent) => {
      event.stopPropagation();
      window.open(postLink, "_blank");
    };

    // Combine media and cardSlot into additional content
    const hasAdditionalContent = Boolean(media || cardSlot);
    const additionalContent = (
      <>
        {media && <PostMedia media={media} />}
        {cardSlot}
      </>
    );

    return (
      <article ref={ref} {...props}>
        <div
          className={cn(containerClasses, "group")}
          aria-label={`View post by ${displayName ?? username ?? "user"}`}
        >
          <div className="grid grid-rows-[auto_1fr] place-items-center gap-2">
            <Link
              href={`https://x.com/${username}`}
              aria-label={`View ${displayName ?? username}'s profile`}
            >
              <Avatar
                className={cn(
                  avatarClass,
                  "ease-[cubic-bezier(0.25, 1, 0.5, 1)] duration-300"
                )}
              >
                <AvatarImage
                  src={avatarUrl}
                  alt={displayName ? `Avatar of ${displayName}` : "User avatar"}
                />
                <AvatarFallback>
                  {displayName?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            </Link>
            {thread && <Separator orientation="vertical" className="w-[2px]" />}
          </div>

          <div
            className={cn(
              "grid w-full gap-12",
              hasAdditionalContent
                ? "grid-cols-1 @[1300px]:grid-cols-[33.53%_66.47%]"
                : "grid-cols-1"
            )}
          >
            <section className={cn(rightColumnClass, "flex flex-col gap-4")}>
              <header className="mt-1 flex items-center justify-between gap-4">
                <div className="grid grid-cols-[auto,auto] items-center gap-1">
                  <address className="grid grid-cols-[auto_auto_auto] items-center not-italic">
                    {displayName && (
                      <Link
                        href={`https://x.com/${username}`}
                        className={cn(
                          displayNameClass,
                          "ease-[cubic-bezier(0.25, 1, 0.5, 1)] mr-1 whitespace-nowrap font-medium duration-300 hover:underline"
                        )}
                        aria-label={`View ${displayName}'s profile`}
                      >
                        {displayName}
                      </Link>
                    )}
                    {pro && (
                      <NewReleasesIcon
                        className={cn(
                          newReleasesIconClass,
                          "ease-[cubic-bezier(0.25, 1, 0.5, 1)] mr-1 fill-current duration-300"
                        )}
                        aria-hidden="true"
                      />
                    )}
                    {username && (
                      <Link
                        href={`https://x.com/${username}`}
                        className={cn(
                          usernameClass,
                          "ease-[cubic-bezier(0.25, 1, 0.5, 1)] truncate font-mono font-medium text-muted-foreground duration-300 hover:underline"
                        )}
                        aria-label={`View @${username}'s profile`}
                      >
                        @{username}
                      </Link>
                    )}
                  </address>
                  {dateTime && (
                    <time
                      className={cn(
                        timeClass,
                        "ease-[cubic-bezier(0.25, 1, 0.5, 1)] truncate text-muted-foreground duration-300"
                      )}
                      dateTime={dateTime}
                    >
                      · {displayTime}
                    </time>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="More options"
                    >
                      <MoreHorizIcon
                        className="fill-muted-foreground"
                        aria-hidden="true"
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>↳ Menu</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleViewOnX}>
                      <ExitToAppIcon
                        className="fill-current"
                        aria-hidden="true"
                      />
                      Open on 𝕏
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCopyLink}>
                      <LinkIcon className="fill-current" aria-hidden="true" />
                      Copy link
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleViewOnX}>
                      <AccountCircleIcon
                        className="fill-current"
                        aria-hidden="true"
                      />
                      View profile
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </header>

              {replyingTo && (
                <p
                  className={cn(
                    replyingToClass,
                    "ease-[cubic-bezier(0.25, 1, 0.5, 1)] whitespace-pre-line font-medium text-muted-foreground duration-300"
                  )}
                >
                  Replying to{" "}
                  <Link
                    href={`https://x.com/${replyingTo}`}
                    className="font-mono text-foreground hover:underline"
                  >
                    @{replyingTo}
                  </Link>
                </p>
              )}

              <p
                lang="auto"
                className={cn(
                  bodyClass,
                  "word-break ease-[cubic-bezier(0.25, 1, 0.5, 1)] hyphens-auto whitespace-pre-line duration-300 [&_a]:text-muted-foreground hover:[&_a]:underline dark:[&_a]:text-neutral-400"
                )}
                dangerouslySetInnerHTML={{ __html: parsedBody }}
              />

              {/* Render additional content inline when container is small */}
              {additionalContent && (
                <div className="mt-4 block shrink-0 @[1300px]:hidden">
                  {additionalContent}
                </div>
              )}

              <footer className="flex items-center justify-between gap-6 text-xs">
                {replies !== undefined && (
                  <Link
                    href={postLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-mono text-muted-foreground hover:underline"
                    aria-label={`View replies (${repliesCount})`}
                    title={`View replies (${repliesCount})`}
                  >
                    <QuickPhrasesIcon
                      className="fill-current"
                      aria-hidden="true"
                    />
                    {repliesCount}
                  </Link>
                )}
                {reposts !== undefined && (
                  <Link
                    href={postLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-mono text-muted-foreground hover:underline"
                    aria-label={`View reposts (${repostsCount})`}
                    title={`View reposts (${repostsCount})`}
                  >
                    <RepeatIcon className="fill-current" aria-hidden="true" />
                    {repostsCount}
                  </Link>
                )}
                {likes !== undefined && (
                  <Link
                    href={postLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-mono text-muted-foreground hover:underline"
                    aria-label={`View likes (${likesCount})`}
                    title={`View likes (${likesCount})`}
                  >
                    <FavoriteIcon className="fill-current" aria-hidden="true" />
                    {likesCount}
                  </Link>
                )}
                {bookmarks !== undefined && (
                  <Link
                    href={postLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-mono text-muted-foreground hover:underline"
                    aria-label={`View bookmarks (${bookmarksCount})`}
                    title={`View bookmarks (${bookmarksCount})`}
                  >
                    <BookmarkIcon className="fill-current" aria-hidden="true" />
                    {bookmarksCount}
                  </Link>
                )}
                {impressions !== undefined && (
                  <Link
                    href={postLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-mono text-muted-foreground hover:underline"
                    aria-label={`View impressions (${impressionsCount})`}
                    title={`View impressions (${impressionsCount})`}
                  >
                    <InsertChartIcon
                      className="fill-current"
                      aria-hidden="true"
                    />
                    {impressionsCount}
                  </Link>
                )}
              </footer>
            </section>

            {/* Render additional content in right column when container is large */}
            {hasAdditionalContent && (
              <aside className="mt-4 hidden @[1300px]:block">
                {additionalContent}
              </aside>
            )}
          </div>
        </div>
      </article>
    );
  }
);

PostCard.displayName = "PostCard";
