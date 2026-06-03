import Link from "next/link";
import { buttonVariants } from "@/shared/ui/components/Button";
import { cn } from "@/shared/lib/utils";
import {
  ArrowOutwardIcon,
  ChangeHistoryIcon,
} from "@/shared/ui/components/icons";
import { ThemedFigureVideo } from "../ThemedFigureVideo";
import type { VideoAssetKey } from "../../../lib/videoAssets";

interface StepBlockProps {
  stepLabel?: string;
  heading: string;
  description: string | React.ReactNode;
  videoAssetKey: VideoAssetKey;
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
  videoAssetKey,
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
        "grid grid-cols-1 items-center gap-8 md:grid-cols-12 md:gap-12",
        className
      )}
    >
      {/* Text — 5 columns */}
      <div
        className={cn("md:col-span-5", reversed ? "md:order-2" : "md:order-1")}
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
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "rounded-full")}
          >
            <ChangeHistoryIcon className="size-4 fill-current" />
            {ctaLabel}
          </Link>
          <Link
            href={learnMoreHref}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}
          >
            {learnMoreLabel}
            <ArrowOutwardIcon className="size-4 fill-current" />
          </Link>
        </div>
      </div>

      {/* Video — 7 columns */}
      <div
        className={cn("md:col-span-7", reversed ? "md:order-1" : "md:order-2")}
      >
        <ThemedFigureVideo
          videoAssetKey={videoAssetKey}
          ariaLabel={heading}
          figureClassName="aspect-[4/3] w-full"
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
