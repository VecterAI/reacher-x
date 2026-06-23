import { cn } from "@/shared/lib/utils";
import { InteractiveMockupFigure } from "../InteractiveMockupFigure";
import type { LandingMockupAssetKey } from "../../../lib/mockupAssets";

interface StepBlockProps {
  stepLabel?: string;
  heading: string;
  description: string | React.ReactNode;
  mockupAssetKey: LandingMockupAssetKey;
  reversed?: boolean;
  className?: string;
}

export function StepBlock({
  stepLabel,
  heading,
  description,
  mockupAssetKey,
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
