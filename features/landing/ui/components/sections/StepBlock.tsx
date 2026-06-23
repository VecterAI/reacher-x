import Link from "next/link";
import { buttonVariants } from "@/shared/ui/components/Button";
import { cn } from "@/shared/lib/utils";
import {
  ArrowOutwardIcon,
  ChangeHistoryIcon,
} from "@/shared/ui/components/icons";
import { InteractiveMockupFigure } from "../InteractiveMockupFigure";
import type { LandingMockupAssetKey } from "../../../lib/mockupAssets";

interface StepBlockProps {
  stepLabel?: string;
  heading: string;
  description: string | React.ReactNode;
  mockupAssetKey: LandingMockupAssetKey;
  ctaLabel?: string;
  ctaHref?: string;
  learnMoreLabel?: string;
  learnMoreHref?: string;
  reversed?: boolean;
  className?: string;
}

export function StepBlock({
  stepLabel,
  heading,
  description,
  mockupAssetKey,
  ctaLabel = "Start reaching",
  ctaHref = "/login",
  learnMoreLabel = "Learn more",
  learnMoreHref = "#",
  reversed = false,
  className,
}: StepBlockProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 items-center gap-8 md:grid-cols-12 md:gap-12 lg:gap-14",
        className
      )}
    >
      <div
        className={cn(
          "max-w-2xl md:col-span-4 md:max-w-[24rem] lg:max-w-[25rem]",
          reversed ? "md:order-2" : "md:order-1"
        )}
      >
        {stepLabel && (
          <p className="text-muted-foreground mb-3 text-sm font-medium">
            {stepLabel}
          </p>
        )}
        <h3 className="text-2xl font-medium md:text-3xl">{heading}</h3>
        <p className="mt-3 text-base">{description}</p>
        <div className="mt-6 flex items-center gap-3">
          <Link
            href={ctaHref}
            className={cn(
              buttonVariants({ variant: "default", size: "sm" }),
              "rounded-full"
            )}
          >
            <ChangeHistoryIcon className="size-4 fill-current" />
            {ctaLabel}
          </Link>
          <Link
            href={learnMoreHref}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "rounded-full"
            )}
          >
            {learnMoreLabel}
            <ArrowOutwardIcon className="size-4 fill-current" />
          </Link>
        </div>
      </div>

      <div
        className={cn(
          "md:col-span-8 md:min-w-0",
          reversed ? "md:order-1" : "md:order-2"
        )}
      >
        <InteractiveMockupFigure
          mockupAssetKey={mockupAssetKey}
          ariaLabel={heading}
          figureClassName="aspect-[4/3] w-full"
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
