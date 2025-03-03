"use client";

import * as React from "react";
import Link from "next/link";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/shared/lib/utils/utils";
import { Button } from "@/shared/ui/components/Button";
import {
  XIcon,
  DiscordIcon,
  RedditIcon,
  ThreadsIcon,
  InstagramIcon,
  YoutubeIcon,
} from "@/shared/ui/components/icons";
import { NavLink } from "./NavLink";

export interface FooterProps extends React.HTMLAttributes<HTMLElement> {
  /** If true, renders the footer inside a Radix <Slot> instead of a <footer> tag. */
  asChild?: boolean;
}

// Optional cva for sub-elements if you want them standardized as well:
const brandLinkVariants = cva("text-base font-medium font-mono");

export const Footer = React.forwardRef<HTMLElement, FooterProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "footer";

    const currentYear = React.useMemo(() => new Date().getFullYear(), []);

    const handleScrollToTop = React.useCallback(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, []);

    return (
      <Comp
        ref={ref}
        role="contentinfo"
        className={cn(
          "ease-[cubic-bezier(0.25, 1, 0.5, 1)] flex flex-col gap-6 border-t border-border px-4 pb-12 pt-6 duration-300 md:gap-12 md:px-28 md:py-12",
          className
        )}
        {...props}
      >
        <section className="flex w-fit flex-col gap-1">
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
              className="font-mono text-sm font-medium text-muted-foreground hover:underline"
            >
              support@reacherx.com
            </Link>
          </address>
        </section>

        <section className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] flex flex-col gap-6 duration-300 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-4">
            <small className="text-sm font-medium text-muted-foreground">
              Links
            </small>
            <menu>
              <li>
                <NavLink href="/threads" activeClassName="underline">
                  Threads
                </NavLink>
              </li>
            </menu>
          </div>

          <div className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] flex flex-col gap-4 duration-300">
            <small className="text-sm font-medium text-muted-foreground">
              Follow on
            </small>
            <div className="flex">
              <Button
                aria-label="ReacherX on X"
                variant="ghost"
                size="icon"
                className="[&_svg]:size-8 md:[&_svg]:size-6"
              >
                <XIcon className="fill-current" />
              </Button>
              <Button
                aria-label="ReacherX on Discord"
                variant="ghost"
                size="icon"
                className="[&_svg]:size-8 md:[&_svg]:size-6"
              >
                <DiscordIcon className="fill-current" />
              </Button>
              <Button
                aria-label="ReacherX on Threads"
                variant="ghost"
                size="icon"
                className="[&_svg]:size-8 md:[&_svg]:size-6"
              >
                <ThreadsIcon className="fill-current" />
              </Button>
              <Button
                aria-label="ReacherX on Instagram"
                variant="ghost"
                size="icon"
                className="[&_svg]:size-8 md:[&_svg]:size-6"
              >
                <InstagramIcon className="fill-current" />
              </Button>
              <Button
                aria-label="ReacherX on YouTube"
                variant="ghost"
                size="icon"
                className="[&_svg]:size-8 md:[&_svg]:size-6"
              >
                <YoutubeIcon className="fill-current" />
              </Button>
              <Button
                aria-label="ReacherX on Reddit"
                variant="ghost"
                size="icon"
                className="[&_svg]:size-8 md:[&_svg]:size-6"
              >
                <RedditIcon className="fill-current" />
              </Button>
            </div>
          </div>
        </section>

        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={handleScrollToTop}
        >
          Go to top
        </Button>

        <section className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] flex flex-col-reverse gap-2 duration-300 md:flex-row md:items-center md:justify-between">
          <small className="text-sm text-muted-foreground">
            Copyright &copy; {currentYear} ReacherX. All rights reserved.
          </small>
          <div className="flex items-center space-x-2">
            <Button variant="link" className="px-0">
              Privacy policy
            </Button>
            <span className="text-muted-foreground">|</span>
            <Button variant="link" className="px-0">
              Terms of service
            </Button>
          </div>
        </section>
      </Comp>
    );
  }
);

Footer.displayName = "Footer";
