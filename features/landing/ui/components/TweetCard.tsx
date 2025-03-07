"use client";

import * as React from "react";
import Link from "next/link";
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
import PostMedia from "./TweetMedia";
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
import { parseText } from "@/shared/lib/utils/parseText";
import { Entities, Media } from "@/app/(landing)/threads/types";

const tweetCardVariants = cva(
  "flex gap-4 w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background transition-colors ",
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

export interface TweetCardProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children">,
    VariantProps<typeof tweetCardVariants> {
  size?: "sm" | "md" | "lg";
  idStr?: string;
  cardSlot?: React.ReactNode;
  profileImageUrlHttps?: string;
  thread?: boolean;
  name?: string;
  screenName?: string;
  verified?: boolean;
  tweetCreatedAt?: string;
  inReplyingToScreenName?: string | null;
  fullText?: string;
  entities?: Entities;
  media?: Media[];
  replyCount?: string | number;
  retweetCount?: string | number;
  favoriteCount?: string | number;
  bookmarkCount?: string | number;
  viewsCount?: string | number;
  characterLimit?: number; // Configurable character limit
  showFullContent?: boolean; // Control whether to show full content
}

export const TweetCard = React.forwardRef<HTMLElement, TweetCardProps>(
  (
    {
      idStr,
      cardSlot,
      profileImageUrlHttps,
      thread,
      name,
      screenName,
      verified,
      tweetCreatedAt,
      inReplyingToScreenName,
      fullText = "",
      entities,
      media,
      replyCount,
      retweetCount,
      favoriteCount,
      bookmarkCount,
      viewsCount,
      size = "md",
      bordered,
      className,
      characterLimit = 250,
      showFullContent = false,
      ...props
    },
    ref
  ) => {
    const isTextLong = fullText.length > characterLimit;

    // If showFullContent is true, always display the full text
    // Otherwise, truncate if it's too long
    // To this:
    const displayText =
      showFullContent || !isTextLong
        ? fullText
        : fullText.substring(0, characterLimit) + ".... Read full ↗";

    const parsedBody = React.useMemo(() => {
      return parseText(displayText, entities);
    }, [displayText, entities]);

    const avatarClass = cn(
      "h-8 w-8",
      size === "sm" && "md:h-8 md:w-8",
      size === "md" && "md:h-9 md:w-9",
      size === "lg" && "md:h-10 md:w-10"
    );

    const rightColumnClass = cn(
      bordered ? "pb-0" : "pb-4", // Base padding for all screen sizes if bordered
      // For non-bordered cards:
      !bordered && "pb-4", // Default base padding for smaller screens
      // Size-specific padding only applied on medium screens and up
      !bordered && size === "sm" && "md:pb-4",
      !bordered && size === "md" && "md:pb-6",
      !bordered && size === "lg" && "md:pb-12"
    );

    const nameClass = cn(
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

    const screenNameClass = cn(
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

    const inReplyingToScreenNameClass = cn(
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

    const containerClasses = cn(tweetCardVariants({ bordered }), className);
    const { toast } = useToast();
    const tweetUrl = `https://x.com/${screenName}/${idStr}`;

    const displayTime = formatRelativeTime(tweetCreatedAt);

    const formattedReplyCount = formatLargeNumber(Number(replyCount ?? 0));
    const formattedRetweetCount = formatLargeNumber(Number(retweetCount ?? 0));
    const formattedFavoriteCount = formatLargeNumber(
      Number(favoriteCount ?? 0)
    );
    const formattedBookmarkCount = formatLargeNumber(
      Number(bookmarkCount ?? 0)
    );
    const formattedViewsCount = formatLargeNumber(Number(viewsCount ?? 0));

    const handleCopyLink = (event: React.MouseEvent) => {
      event.stopPropagation();
      navigator.clipboard.writeText(tweetUrl).then(
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
      window.open(tweetUrl, "_blank");
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
          aria-label={`View post by ${name ?? screenName ?? "user"}`}
        >
          <div className="grid grid-rows-[auto_1fr] place-items-center gap-2">
            <Link
              href={`https://x.com/${screenName}`}
              aria-label={`View ${name ?? screenName}'s profile`}
              onClick={(e) => e.stopPropagation()}
            >
              <Avatar
                className={cn(
                  avatarClass,
                  "ease-[cubic-bezier(0.25, 1, 0.5, 1)] duration-300"
                )}
              >
                <AvatarImage
                  src={profileImageUrlHttps}
                  alt={name ? `Avatar of ${name}` : "User avatar"}
                />
                <AvatarFallback>
                  {name?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            </Link>
            {thread && <Separator orientation="vertical" className="w-[2px]" />}
          </div>

          <div
            className={cn(
              "grid w-full gap-12",
              hasAdditionalContent
                ? "grid-cols-1 @[1300px]:grid-cols-[calc(33.53%-1.5rem)_calc(66.47%-1.5rem)]"
                : "grid-cols-1"
            )}
          >
            <section className={cn(rightColumnClass, "flex flex-col gap-4")}>
              <header className="mt-1 flex items-center justify-between gap-4">
                <div className="grid grid-cols-[auto,auto] items-center gap-1">
                  <address className="grid grid-cols-[auto_auto_auto] items-center not-italic">
                    {name && (
                      <Link
                        href={`https://x.com/${screenName}`}
                        className={cn(
                          nameClass,
                          "ease-[cubic-bezier(0.25, 1, 0.5, 1)] mr-1 whitespace-nowrap font-medium duration-300 hover:underline"
                        )}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`View ${name}'s profile`}
                      >
                        {name}
                      </Link>
                    )}
                    {verified && (
                      <NewReleasesIcon
                        className={cn(
                          newReleasesIconClass,
                          "ease-[cubic-bezier(0.25, 1, 0.5, 1)] mr-1 fill-current duration-300"
                        )}
                        aria-hidden="true"
                      />
                    )}
                    {screenName && (
                      <Link
                        href={`https://x.com/${screenName}`}
                        className={cn(
                          screenNameClass,
                          "ease-[cubic-bezier(0.25, 1, 0.5, 1)] truncate font-mono font-medium text-muted-foreground duration-300 hover:underline"
                        )}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`View @${screenName}'s profile`}
                      >
                        @{screenName}
                      </Link>
                    )}
                  </address>
                  {tweetCreatedAt && (
                    <time
                      className={cn(
                        timeClass,
                        "ease-[cubic-bezier(0.25, 1, 0.5, 1)] truncate text-muted-foreground duration-300"
                      )}
                      dateTime={tweetCreatedAt}
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
                      Open on 𝕏 (formerly Twitter)
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

              {inReplyingToScreenName && (
                <p
                  className={cn(
                    inReplyingToScreenNameClass,
                    "ease-[cubic-bezier(0.25, 1, 0.5, 1)] whitespace-pre-line font-medium text-muted-foreground duration-300"
                  )}
                >
                  Replying to{" "}
                  <Link
                    href={`https://x.com/${inReplyingToScreenName}`}
                    className="font-mono text-foreground hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    @{inReplyingToScreenName}
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
                <div className="block shrink-0 @[1300px]:hidden">
                  {additionalContent}
                </div>
              )}

              <footer className="flex items-center justify-between gap-6 text-xs">
                {replyCount !== undefined && (
                  <Link
                    href={tweetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-mono text-muted-foreground hover:underline"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`View replies (${formattedReplyCount})`}
                    title={`View replies (${formattedReplyCount})`}
                  >
                    <QuickPhrasesIcon
                      className="fill-current"
                      aria-hidden="true"
                    />
                    {formattedReplyCount}
                  </Link>
                )}
                {retweetCount !== undefined && (
                  <Link
                    href={tweetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-mono text-muted-foreground hover:underline"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`View reposts (${formattedRetweetCount})`}
                    title={`View reposts (${formattedRetweetCount})`}
                  >
                    <RepeatIcon className="fill-current" aria-hidden="true" />
                    {formattedRetweetCount}
                  </Link>
                )}
                {favoriteCount !== undefined && (
                  <Link
                    href={tweetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-mono text-muted-foreground hover:underline"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`View likes (${formattedFavoriteCount})`}
                    title={`View likes (${formattedFavoriteCount})`}
                  >
                    <FavoriteIcon className="fill-current" aria-hidden="true" />
                    {formattedFavoriteCount}
                  </Link>
                )}
                {bookmarkCount !== undefined && (
                  <Link
                    href={tweetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-mono text-muted-foreground hover:underline"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`View bookmarks (${formattedBookmarkCount})`}
                    title={`View bookmarks (${formattedBookmarkCount})`}
                  >
                    <BookmarkIcon className="fill-current" aria-hidden="true" />
                    {formattedBookmarkCount}
                  </Link>
                )}
                {viewsCount !== undefined && (
                  <Link
                    href={tweetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-mono text-muted-foreground hover:underline"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`View impressions (${formattedViewsCount})`}
                    title={`View impressions (${formattedViewsCount})`}
                  >
                    <InsertChartIcon
                      className="fill-current"
                      aria-hidden="true"
                    />
                    {formattedViewsCount}
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

TweetCard.displayName = "TweetCard";
