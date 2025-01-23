// shared/ui/components/ThreadCard.tsx

"use client";

import * as React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const threadCardVariants = cva(
  "block w-full rounded-sm px-4 py-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background transition-colors hover:bg-muted/50",
  {
    variants: {
      size: {
        sm: "text-sm",
        md: "text-base",
        lg: "text-lg",
      },
      bordered: {
        true: "border-b border-muted",
        false: "",
      },
    },
    defaultVariants: {
      size: "md",
      bordered: false,
    },
  }
);

export interface ThreadCardProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children">,
    VariantProps<typeof threadCardVariants> {
  detailHref: string;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;

  displayName?: string;
  username?: string;
  pro?: boolean;
  dateTime?: string;
  /** The raw body if you want to store it, but you won't parse it here. */
  body?: string;
  /** The already-parsed HTML from server */
  parsedBody: string;

  repliesCount?: string;
  repostsCount?: string;
  likesCount?: string;
  bookmarksCount?: string;
  impressionsCount?: string;

  tweetUrl?: string;
}

export const ThreadCard = React.forwardRef<HTMLElement, ThreadCardProps>(
  (
    {
      detailHref,
      leftSlot,
      rightSlot,
      displayName,
      username,
      pro,
      dateTime,
      body,
      parsedBody,
      repliesCount,
      repostsCount,
      likesCount,
      bookmarksCount,
      impressionsCount,
      tweetUrl,
      size,
      bordered,
      className,
      ...props
    },
    ref
  ) => {
    const classes = threadCardVariants({ size, bordered, className });
    const tweetLink = tweetUrl || "https://twitter.com";

    return (
      <article ref={ref} {...props}>
        <Link href={detailHref} className={cn(classes, "group")}>
          <header className="flex items-start gap-3">
            {leftSlot && <div className="shrink-0">{leftSlot}</div>}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-1 text-sm font-semibold">
                {displayName && <span>{displayName}</span>}
                {pro && (
                  <span className="ml-1 rounded bg-blue-500 px-1 py-0.5 text-xs text-white">
                    PRO
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                {username && (
                  <span className="text-xs text-muted-foreground">
                    @{username}
                  </span>
                )}
                {dateTime && (
                  <time
                    className="text-xs text-muted-foreground"
                    dateTime={dateTime}
                  >
                    {dateTime}
                  </time>
                )}
              </div>
            </div>
            {rightSlot && <div>{rightSlot}</div>}
          </header>

          <section className="mt-2 text-sm leading-normal">
            {parsedBody ? (
              // Since parsedBody is pre-sanitized (via twitter.htmlEscape) and
              // turned into HTML on the server, we can now safely render it:
              <div
                dangerouslySetInnerHTML={{
                  __html: parsedBody,
                }}
              />
            ) : (
              // Fallback if parsedBody is missing
              body && <p>{body}</p>
            )}
          </section>

          <footer className="mt-3 flex items-center gap-6 text-xs text-muted-foreground">
            {repliesCount && (
              <a
                href={tweetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="i-[material-symbols:chat-bubble-outline] mr-1" />
                {repliesCount}
              </a>
            )}
            {repostsCount && (
              <a
                href={tweetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="i-[material-symbols:autorenew] mr-1" />
                {repostsCount}
              </a>
            )}
            {likesCount && (
              <a
                href={tweetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="i-[material-symbols:favorite-outline] mr-1" />
                {likesCount}
              </a>
            )}
            {bookmarksCount && (
              <a
                href={tweetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="i-[material-symbols:bookmark-outline] mr-1" />
                {bookmarksCount}
              </a>
            )}
            {impressionsCount && (
              <a
                href={tweetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="i-[material-symbols:analytics-outline] mr-1" />
                {impressionsCount}
              </a>
            )}
          </footer>
        </Link>
      </article>
    );
  }
);

ThreadCard.displayName = "ThreadCard";
