// src/features/landing/ui/components/WaitlistSection.tsx
"use client";

import { useWaitlistUsers } from "../../hooks/useWaitlistUsers";
import { cn } from "@/shared/lib/utils";
import { WaitlistFormWrapper } from "./WaitlistFormWrapper";
import { WaitlistUsers } from "./WaitlistUsers";

interface WaitlistSectionProps {
  className?: string;
}

export function WaitlistSection({ className }: WaitlistSectionProps) {
  const { totalCount, isCountLoading } = useWaitlistUsers();
  const waitlistUsersCount = totalCount + 39;
  return (
    <section
      aria-labelledby="waitlist-heading"
      className={cn(
        "ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 py-6 duration-300 md:px-28 md:py-52",
        className
      )}
    >
      <h2 id="waitlist-heading" className="text-2xl font-medium md:text-3xl">
        Join over{" "}
        {isCountLoading ? (
          <span className="text-muted-foreground inline-block animate-spin">
            ⟳
          </span>
        ) : (
          waitlistUsersCount
        )}{" "}
        people already on the wait-list!
      </h2>
      <WaitlistUsers className="mt-4" />
      <WaitlistFormWrapper className="mt-4 max-w-md" />
    </section>
  );
}
