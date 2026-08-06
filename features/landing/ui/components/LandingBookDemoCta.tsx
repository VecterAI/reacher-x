"use client";

import { getCalApi } from "@calcom/embed-react";
import { useEffect, type Ref } from "react";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";
import { Button, buttonVariants } from "@/shared/ui/components/Button";
import { Separator } from "@/shared/ui/components/Separator";

const CAL_NAMESPACE = "reacherx-demo";
const CAL_LINK = "noobships/reacherx-demo";
const CAL_CONFIG =
  '{"layout":"month_view","useSlotsViewOnSmallScreen":"true","theme":"auto"}' as const;

let calApiPromise: Promise<void> | null = null;

function ensureCalDemoApi() {
  if (!calApiPromise) {
    calApiPromise = getCalApi({ namespace: CAL_NAMESPACE })
      .then((cal) => {
        cal("ui", {
          hideEventTypeDetails: false,
          layout: "month_view",
        });
      })
      .catch((error: unknown) => {
        console.error(
          "[LandingBookDemoCta] Failed to initialize Cal.com embed",
          error
        );
        calApiPromise = null;
      });
  }

  return calApiPromise;
}

function useCalDemoEmbed() {
  useEffect(() => {
    void ensureCalDemoApi();
  }, []);
}

const calTriggerProps = {
  "data-cal-namespace": CAL_NAMESPACE,
  "data-cal-link": CAL_LINK,
  "data-cal-config": CAL_CONFIG,
} as const;

type LandingBookDemoCtaProps = {
  className?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
};

/**
 * Opens the ReacherX Cal.com demo booking modal.
 * Label uses sentence case to match landing CTAs ("Reach people", "Sign up").
 */
export function LandingBookDemoCta({
  className,
  variant = "default",
  size = "default",
}: LandingBookDemoCtaProps) {
  useCalDemoEmbed();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(className)}
      {...calTriggerProps}
    >
      Book a demo
    </Button>
  );
}

type LandingBookDemoLinkProps = {
  className?: string;
  ref?: Ref<HTMLButtonElement>;
};

/** Text-style trigger for nav drawers and footer columns. */
export function LandingBookDemoLink({
  className,
  ref,
}: LandingBookDemoLinkProps) {
  useCalDemoEmbed();

  return (
    <button
      type="button"
      ref={ref}
      className={cn(className)}
      {...calTriggerProps}
    >
      Book a demo
    </button>
  );
}

/**
 * Secondary invite under landing composers. Width should match the composer
 * (`max-w-2xl`) — wrap both in the same width container at the call site.
 */
export function LandingBookDemoInvite({ className }: { className?: string }) {
  return (
    <div className={cn("mt-10 flex w-full flex-col gap-6", className)}>
      <Separator />
      <div className="flex items-center justify-center gap-3">
        <p className="font-pixel-square text-sm font-medium">
          Talk to founder →
        </p>
        <LandingBookDemoCta variant="outline" size="xs" className="shrink-0" />
      </div>
    </div>
  );
}
