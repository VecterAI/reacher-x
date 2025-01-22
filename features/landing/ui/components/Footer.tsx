"use client";

import * as React from "react";
import Link from "next/link";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import {
  XIcon,
  DiscordIcon,
  RedditIcon,
  ThreadsIcon,
  InstagramIcon,
  YoutubeIcon,
} from "@/shared/ui/components/icons";

export interface FooterProps extends React.HTMLAttributes<HTMLElement> {
  /** If true, renders the footer inside a Radix <Slot> instead of a <footer> tag. */
  asChild?: boolean;
}

// Optional cva for sub-elements if you want them standardized as well:
const brandLinkVariants = cva("text-base font-medium font-mono");

export const Footer = React.forwardRef<HTMLElement, FooterProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "footer";

    const handleScrollToTop = React.useCallback(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, []);

    return (
      <Comp
        ref={ref}
        className={cn(
          "flex flex-col gap-6 border-t border-border px-4 pb-12 pt-6 md:gap-12 md:px-28 md:py-12",
          className
        )}
        {...props}
      >
        {/* Brand & contact */}
        <div className="flex w-fit flex-col gap-1">
          {/* Minimal brand block — replace with your actual logo */}
          <Link
            href="/"
            aria-label="ReacherX Home"
            className={cn(brandLinkVariants())}
          >
            🆁 ReacherX
          </Link>
          <address className="not-italic">
            <Link
              href="mailto:support@reacherx.com"
              className="font-mono text-sm font-medium text-neutral-500 hover:underline"
            >
              support@reacherx.com
            </Link>
          </address>
        </div>

        {/* Main content row(s) */}
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          {/* Quick links */}
          <div className="flex flex-col gap-4">
            <small className="text-sm font-medium text-neutral-500">
              Links
            </small>
            <menu>
              <li>
                <Button variant="link" className="px-0">
                  Vision
                </Button>
              </li>
              <li>
                <Button variant="link" className="px-0">
                  Threads
                </Button>
              </li>
            </menu>
          </div>

          {/* Social icons + Go to top */}
          <div className="flex flex-col gap-4">
            <small className="text-sm font-medium text-neutral-500">
              Follow on
            </small>
            <div className="flex">
              <Button
                variant="ghost"
                size="icon"
                className="[&_svg]:size-8 md:[&_svg]:size-6"
              >
                <XIcon className="fill-current" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="[&_svg]:size-8 md:[&_svg]:size-6"
              >
                <DiscordIcon className="fill-current" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="[&_svg]:size-8 md:[&_svg]:size-6"
              >
                <ThreadsIcon className="fill-current" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="[&_svg]:size-8 md:[&_svg]:size-6"
              >
                <InstagramIcon className="fill-current" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="[&_svg]:size-8 md:[&_svg]:size-6"
              >
                <YoutubeIcon className="fill-current" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="[&_svg]:size-8 md:[&_svg]:size-6"
              >
                <RedditIcon className="fill-current" />
              </Button>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size={"sm"}
          className="w-fit"
          onClick={handleScrollToTop}
        >
          Go to top
        </Button>

        {/* Footer bottom row */}

        <div className="flex flex-col-reverse gap-2 md:flex-row md:items-center md:justify-between">
          <small className="text-sm text-neutral-500">
            Copyright © 2024 ReacherX. All rights reserved.
          </small>
          <div className="flex items-center space-x-2">
            <Button variant="link" className="px-0">
              Privacy policy
            </Button>
            <span className="text-neutral-500">|</span>
            <Button variant="link" className="px-0">
              Terms of service
            </Button>
          </div>
        </div>
      </Comp>
    );
  }
);

Footer.displayName = "Footer";
