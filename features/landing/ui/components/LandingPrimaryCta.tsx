"use client";

import Link from "next/link";
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
  authenticatedHref?: string;
  anonymousHref?: AuthRouteHref;
  className?: string;
}

export function LandingPrimaryCta({
  authenticatedHref = NEW_WORKSPACE_SETUP_AUTH_RETURN_TO,
  anonymousHref = buildLoginHref(NEW_WORKSPACE_SETUP_AUTH_RETURN_TO),
  className,
}: LandingPrimaryCtaProps) {
  const { user, loading } = useAuth();
  const classNames = cn(
    buttonVariants({ variant: "default" }),
    "rounded-full",
    className
  );

  // AuthKit resolves the session asynchronously. Never guess that a loading
  // user is anonymous: an external OAuth redirect during Convex provisioning
  // can trigger Convex's native "unsaved changes" unload warning.
  if (loading) {
    return (
      <span className={classNames} aria-busy="true" aria-disabled="true">
        <ChangeHistoryIcon className="size-4 fill-current" />
        Reach people
      </span>
    );
  }

  if (user) {
    return (
      <Link href={authenticatedHref} className={classNames}>
        <ChangeHistoryIcon className="size-4 fill-current" />
        Reach people
      </Link>
    );
  }

  return (
    <LandingAuthLink href={anonymousHref} className={classNames}>
      <ChangeHistoryIcon className="size-4 fill-current" />
      Reach people
    </LandingAuthLink>
  );
}
