"use client";

import Link from "next/link";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { cn } from "@/shared/lib/utils";
import { buttonVariants } from "@/shared/ui/components/Button";
import { ChangeHistoryIcon } from "@/shared/ui/components/icons";

interface LandingPrimaryCtaProps {
  authenticatedHref?: string;
  anonymousHref?: string;
  className?: string;
}

export function LandingPrimaryCta({
  authenticatedHref = "/",
  anonymousHref = "/login",
  className,
}: LandingPrimaryCtaProps) {
  const { user, loading } = useAuth();
  const href = !loading && user ? authenticatedHref : anonymousHref;

  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: "default" }),
        "rounded-full",
        className
      )}
    >
      <ChangeHistoryIcon className="size-4 fill-current" />
      Reach people
    </Link>
  );
}
