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
  ThreadsIcon,
  LinkedinIcon,
  BlueskyIcon,
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
          "ease-[cubic-bezier(0.25, 1, 0.5, 1)] flex flex-col gap-0 border-t border-border px-0 pb-0 pt-0 duration-300",
          className
        )}
        {...props}
      >
        <div className="mx-auto flex w-full max-w-[1288px] flex-col gap-6 px-4 pb-12 pt-6 md:gap-12 md:pb-12 md:pt-12">
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
                  <NavLink href="/home/threads" activeClassName="underline">
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
                <Link
                  href="https://x.com/ReacherXfounder"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    aria-label="ReacherX on X (formerly Twitter)"
                    variant="ghost"
                    size="icon"
                    className="[&_svg]:size-8 md:[&_svg]:size-6"
                  >
                    <XIcon className="fill-current" />
                  </Button>
                </Link>
                <Link
                  href="https://discord.gg/76dF9NPH"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    aria-label="ReacherX on Discord"
                    variant="ghost"
                    size="icon"
                    className="[&_svg]:size-8 md:[&_svg]:size-6"
                  >
                    <DiscordIcon className="fill-current" />
                  </Button>
                </Link>
                <Link
                  href="https://www.linkedin.com/in/noobships"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    aria-label="ReacherX on LinkedIn"
                    variant="ghost"
                    size="icon"
                    className="[&_svg]:size-8 md:[&_svg]:size-6"
                  >
                    <LinkedinIcon className="fill-current" />
                  </Button>
                </Link>
                <Link
                  href="https://bsky.app/profile/reacherxfounder.bsky.social"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    aria-label="ReacherX on Bluesky"
                    variant="ghost"
                    size="icon"
                    className="[&_svg]:size-8 md:[&_svg]:size-6"
                  >
                    <BlueskyIcon className="stroke-current" />
                  </Button>
                </Link>
                <Link
                  href="https://threads.net/@reacherxfounder"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    aria-label="ReacherX on Threads"
                    variant="ghost"
                    size="icon"
                    className="[&_svg]:size-8 md:[&_svg]:size-6"
                  >
                    <ThreadsIcon className="fill-current" />
                  </Button>
                </Link>
                {/* <Link
                  href="https://instagram.com/reacherxfounder/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    aria-label="ReacherX on Instagram"
                    variant="ghost"
                    size="xsIcon"
                    className="[&_svg]:size-8 md:[&_svg]:size-6"
                  >
                    <InstagramIcon className="fill-current" />
                  </Button>
                </Link> */}
              </div>
            </div>
          </section>

          <Button
            variant="outline"
            size="xs"
            className="w-fit"
            onClick={handleScrollToTop}
          >
            Get to top
          </Button>

          <section className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] flex flex-col-reverse gap-2 duration-300 md:flex-row md:items-center md:justify-between">
            <small className="text-sm text-muted-foreground">
              Copyright &copy; {currentYear} ReacherX. All rights reserved.
            </small>
            <div className="flex items-center space-x-2">
              <Link
                href="/"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Privacy policy
              </Link>
              <span className="text-muted-foreground">|</span>
              <Link
                href="/"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Terms of service
              </Link>
            </div>
          </section>
        </div>
      </Comp>
    );
  }
);

Footer.displayName = "Footer";
