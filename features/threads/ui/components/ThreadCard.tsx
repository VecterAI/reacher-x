"use client";
// features/landing/ui/components/ThreadCard.tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { formatRelativeTime } from "@/shared/lib/utils";
import { cn } from "@/shared/lib/utils";
import { Separator } from "@/shared/ui/components/Separator";
import { TweetMedia } from "@/features/threads/ui/components/TweetMedia";
import { parseText } from "@/shared/lib/utils";
import { ThreadHeader } from "./ThreadHeader";
import { ThreadFooter } from "./ThreadFooter";
import { ThreadMenu } from "./ThreadMenu";
import { Tweet, Entities } from "@/features/threads/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
// Removed LinkWrapper in favor of next/link for external profile links
import { QuoteThreadCard } from "./QuoteThreadCard";
import { useQuotedTweets } from "@/features/threads/hooks/useQuotedTweets";
import { getVisibleTweetPlainText } from "@/shared/lib/utils";

const ThreadCardVariants = cva(
  "flex gap-4 w-full cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background transition-colors",
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

export interface ThreadCardProps
  extends
    Omit<React.HTMLAttributes<HTMLElement>, "children">,
    VariantProps<typeof ThreadCardVariants> {
  size?: "sm" | "md" | "lg";
  staticTweet: Tweet;
  bordered?: boolean;
  className?: string;
  characterLimit?: number;
  showFullContent?: boolean;
  showThread?: boolean;
  // When provided, renders an overlay link to make the whole card clickable
  clickHref?: string;
}

export const ThreadCard = React.forwardRef<HTMLElement, ThreadCardProps>(
  (
    {
      staticTweet,
      size = "md",
      bordered = false,
      className,
      characterLimit = 168,
      showFullContent = false,
      showThread = false,
      clickHref,
      ...props
    },
    ref
  ) => {
    const router = useRouter();
    const visibleText = getVisibleTweetPlainText(staticTweet, {
      characterLimit,
      showFullContent,
    });
    // When this tweet quotes another tweet, suppress the quoted permalink URL from body
    let textForParsing = visibleText;
    let entitiesForParsing: Entities | undefined = staticTweet?.entities;
    const hasQuoted = Boolean(
      staticTweet?.is_quote_status && staticTweet?.quoted_status
    );
    type WithPermalink = { quoted_status_permalink?: { url?: string } };
    const permalinkUrl =
      (staticTweet as WithPermalink)?.quoted_status_permalink?.url || undefined;
    if (hasQuoted && permalinkUrl) {
      // Remove raw permalink text
      textForParsing = textForParsing.replace(permalinkUrl, "").trim();
      // Remove URL entity if present
      if (entitiesForParsing?.urls?.length) {
        entitiesForParsing = {
          ...entitiesForParsing,
          urls: entitiesForParsing.urls.filter((u) => u?.url !== permalinkUrl),
        };
      }
    }

    // Detect pasted status URLs (x.com/twitter.com) and strip them from text/entities
    const STATUS_URL_RE =
      /^(?:https?:\/\/)?(?:mobile\.)?(?:x\.com|twitter\.com)\/[^/]+\/status\/(\d+)/i;

    const statusUrlEntities = (entitiesForParsing?.urls || []).filter(
      (u) => STATUS_URL_RE.test(u.expanded_url) || STATUS_URL_RE.test(u.url)
    );

    const statusIdsFromUrls = statusUrlEntities
      .map((u) => {
        const src = u.expanded_url || u.url;
        const m = src.match(STATUS_URL_RE);
        return m ? m[1] : null;
      })
      .filter((v): v is string => Boolean(v));

    // Avoid double-render when the tweet already has a quoted_status
    const quotedStatusId = staticTweet?.quoted_status?.id_str || null;
    const statusIdsFiltered = quotedStatusId
      ? statusIdsFromUrls.filter((id) => id !== quotedStatusId)
      : statusIdsFromUrls;

    if (statusUrlEntities.length > 0) {
      // Remove the short URLs from text to avoid showing raw links
      for (const u of statusUrlEntities) {
        if (u.url) textForParsing = textForParsing.replace(u.url, "");
        if (u.expanded_url)
          textForParsing = textForParsing.replace(u.expanded_url, "");
      }
      textForParsing = textForParsing.trim();

      // Filter out URL entities that point to status URLs
      entitiesForParsing = {
        ...entitiesForParsing,
        urls: (entitiesForParsing?.urls || []).filter(
          (u) =>
            !(STATUS_URL_RE.test(u.expanded_url) || STATUS_URL_RE.test(u.url))
        ),
      };
    }

    const parsedBody = parseText(textForParsing, entitiesForParsing);
    const highlightedBody = parsedBody;
    const media = staticTweet?.entities?.media;
    const tweetUrl = `https://x.com/${staticTweet?.user?.screen_name}/status/${staticTweet?.id_str}`;
    const profileUrl = `https://x.com/${staticTweet?.user?.screen_name}`;

    const avatarClass = cn(
      "h-8 w-8",
      size === "sm" && "md:h-8 md:w-8",
      size === "md" && "md:h-9 md:w-9",
      size === "lg" && "md:h-10 md:w-10"
    );

    const rightColumnClass = cn(
      bordered ? "pb-0" : "pb-4",
      !bordered && "pb-4",
      !bordered && size === "sm" && "md:pb-4",
      !bordered && size === "md" && "md:pb-6",
      !bordered && size === "lg" && "md:pb-12"
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

    const hasAdditionalContent = Boolean(media);

    const uniqueStatusIdsKey = useMemo(
      () =>
        Array.from(new Set(statusIdsFiltered || []))
          .filter(Boolean)
          .join(","),
      [statusIdsFiltered]
    );
    const resolvedUrlQuotes = useQuotedTweets(uniqueStatusIdsKey);

    const handleCardActivate = (
      event: React.MouseEvent | React.KeyboardEvent
    ) => {
      if (!clickHref) return;
      const target = event.target as HTMLElement;
      const root = event.currentTarget as HTMLElement;
      const interactiveAncestor = target.closest(
        "a, button, [role='button'], [role='link']"
      ) as HTMLElement | null;
      if (interactiveAncestor && interactiveAncestor !== root) return;
      router.push(clickHref);
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
      if (!clickHref) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        router.push(clickHref);
      }
    };

    return (
      <article
        ref={ref}
        {...props}
        role={clickHref ? "link" : undefined}
        tabIndex={clickHref ? 0 : undefined}
        onClick={handleCardActivate}
        onKeyDown={handleKeyDown}
      >
        <div
          className={cn(
            ThreadCardVariants({ bordered }),
            className,
            "group relative"
          )}
          aria-label={`View post by ${staticTweet?.user?.name ?? staticTweet?.user?.screen_name ?? "user"}`}
        >
          <div className="grid grid-rows-[auto_1fr] place-items-center gap-2">
            <Link
              href={`https://x.com/${staticTweet?.user?.screen_name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-20"
              onClick={(e) => e.stopPropagation()}
            >
              <Avatar className={cn(avatarClass, "ring-border ring-1")}>
                <AvatarImage
                  src={staticTweet?.user?.profile_image_url_https}
                  alt={`Avatar of ${staticTweet?.user?.name}`}
                />
                <AvatarFallback>
                  {staticTweet?.user?.name?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            </Link>

            {!showThread && bordered === false && (
              <Separator orientation="vertical" className="w-[2px]" />
            )}
          </div>

          <div
            className={cn(
              "grid w-full gap-12",
              hasAdditionalContent
                ? "grid-cols-1 @[1100px]:grid-cols-[calc(33.53%-1.5rem)_calc(66.47%-1.5rem)]"
                : "grid-cols-1"
            )}
          >
            <section
              className={cn(rightColumnClass, "flex min-w-0 flex-col gap-4")}
            >
              <header className="mt-1 flex min-w-0 items-center gap-4">
                <ThreadHeader
                  size="lg"
                  name={staticTweet?.user?.name}
                  screenName={staticTweet?.user?.screen_name}
                  verified={Boolean(staticTweet?.user?.verified)}
                  className={undefined}
                >
                  <time
                    className={cn(
                      timeClass,
                      "ease-[cubic-bezier(0.25, 1, 0.5, 1)] text-muted-foreground shrink-0 duration-300"
                    )}
                    dateTime={staticTweet?.tweet_created_at}
                    title={
                      staticTweet?.tweet_created_at
                        ? new Date(
                            staticTweet.tweet_created_at
                          ).toLocaleString()
                        : undefined
                    }
                  >
                    · {formatRelativeTime(staticTweet?.tweet_created_at)}
                  </time>
                </ThreadHeader>

                <ThreadMenu
                  tweetUrl={tweetUrl}
                  profileUrl={profileUrl}
                  className="ml-auto shrink-0"
                />
              </header>

              {staticTweet?.in_reply_to_screen_name && (
                <p
                  className={cn(
                    inReplyingToScreenNameClass,
                    "ease-[cubic-bezier(0.25, 1, 0.5, 1)] text-muted-foreground font-medium whitespace-pre-line duration-300"
                  )}
                >
                  Replying to{" "}
                  <Link
                    className="text-foreground relative z-20 font-mono hover:underline"
                    onClick={(e) => e.stopPropagation()}
                    href={`https://x.com/${staticTweet?.in_reply_to_screen_name}`}
                  >
                    @{staticTweet?.in_reply_to_screen_name}
                  </Link>
                </p>
              )}

              <p
                lang="auto"
                className={cn(
                  bodyClass,
                  "word-break [&_a]:text-muted-foreground hyphens-auto whitespace-pre-line [&_a]:hover:underline dark:[&_a]:text-neutral-400"
                )}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest("a")) {
                    e.stopPropagation();
                  }
                }}
              >
                {highlightedBody}
              </p>

              {hasAdditionalContent && (
                <div className="block shrink-0 @[1100px]:hidden">
                  {media && <TweetMedia media={media} />}
                </div>
              )}

              {/* Quoted Thread */}
              {hasQuoted && staticTweet.quoted_status && (
                <div className="mt-2">
                  <QuoteThreadCard
                    tweet={staticTweet.quoted_status}
                    size={size}
                    characterLimit={characterLimit}
                    showFullContent={false}
                  />
                </div>
              )}

              {/* Quoted threads resolved from pasted URLs */}
              {resolvedUrlQuotes.length > 0 && (
                <>
                  {resolvedUrlQuotes.map((qt) => (
                    <QuoteThreadCard
                      key={qt.id_str}
                      tweet={qt}
                      size={size}
                      characterLimit={characterLimit}
                      showFullContent={false}
                    />
                  ))}
                </>
              )}

              <ThreadFooter
                replies={staticTweet?.reply_count}
                repeats={
                  Number(staticTweet?.quote_count ?? 0) +
                    Number(staticTweet?.retweet_count ?? 0) || 0
                }
                likes={staticTweet?.favorite_count}
                views={staticTweet?.views_count}
                screenName={staticTweet?.user?.screen_name}
                tweetId={staticTweet?.id_str}
              />
            </section>

            {hasAdditionalContent && (
              <aside className="mt-4 hidden @[1100px]:block">
                {media && <TweetMedia media={media} />}
              </aside>
            )}
          </div>
        </div>
      </article>
    );
  }
);

ThreadCard.displayName = "ThreadCard";
