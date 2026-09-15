"use client";

import Link from "next/link";
import type { MouseEventHandler } from "react";
import type { VariantProps } from "class-variance-authority";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { cn } from "@/shared/lib/utils";
import {
  type AuthRouteHref,
  buildLoginHref,
  NEW_WORKSPACE_SETUP_AUTH_RETURN_TO,
} from "@/shared/lib/urls/authRoutes";
import { buttonVariants } from "@/shared/ui/components/Button";
import { ChangeHistoryIcon } from "@/shared/ui/components/icons";
import { LandingAuthLink } from "./LandingAuthLink";

interface LandingPrimaryCtaProps {
  anonymousHref?: AuthRouteHref;
  className?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}

export function LandingPrimaryCta({
  anonymousHref = buildLoginHref(NEW_WORKSPACE_SETUP_AUTH_RETURN_TO),
  className,
  variant = "default",
  size = "default",
  onClick,
}: LandingPrimaryCtaProps) {
  const { user, loading } = useAuth();
  const classNames = cn(
    buttonVariants({ variant, size }),
    "rounded-full",
    className
  );

  // AuthKit resolves the session asynchronously. Never guess that a loading
  // user is anonymous: an external OAuth redirect during Convex provisioning
  // can trigger Convex's native "unsaved changes" unload warning.
  if (loading) {
    return (
      <span className={classNames} aria-busy="true" aria-disabled="true">
        <ChangeHistoryIcon className="size-4 fill-current" aria-hidden="true" />
        Reach
      </span>
    );
  }

  if (user) {
    return (
      <Link href="/" className={classNames} onClick={onClick}>
        <ChangeHistoryIcon className="size-4 fill-current" aria-hidden="true" />
        Dashboard
      </Link>
    );
  }

  return (
    <LandingAuthLink
      href={anonymousHref}
      className={classNames}
      onClick={onClick}
    >
      <ChangeHistoryIcon className="size-4 fill-current" aria-hidden="true" />
      Reach
    </LandingAuthLink>
  );
}
