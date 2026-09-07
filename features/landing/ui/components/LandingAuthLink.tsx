"use client";

import { forwardRef, type ComponentProps, type MouseEvent } from "react";
import Link from "next/link";
import { logout } from "@/shared/lib/auth/logout";
import { navigateDocumentIntentionally } from "@/shared/lib/convex/intentionalDocumentNavigation";
import type { AuthRouteHref } from "@/shared/lib/urls/authRoutes";

type LandingAuthLinkProps = Omit<
  ComponentProps<typeof Link>,
  "href" | "onClick"
> & {
  href: AuthRouteHref;
  onClick?: ComponentProps<typeof Link>["onClick"];
};

export const LandingAuthLink = forwardRef<
  HTMLAnchorElement,
  LandingAuthLinkProps
>(function LandingAuthLink({ children, href, onClick, ...props }, ref) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    if (href.split("?")[0] === "/logout") {
      void logout();
      return;
    }
    navigateDocumentIntentionally(href);
  };

  return (
    <Link
      {...props}
      ref={ref}
      href={href}
      prefetch={false}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
});
