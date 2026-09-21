import { cn } from "@/shared/lib/utils";
import type { ReactNode } from "react";
import { buttonVariants } from "@/shared/ui/components/Button";

export function marketingButton(
  options: Parameters<typeof buttonVariants>[0] = {}
) {
  return cn(
    buttonVariants(options),
    options?.size !== "xs" && options?.size !== "xsIcon" && "rounded-full"
  );
}

/**
 * Single source of truth for marketing layout tokens.
 * Every section consumes these; never introduce ad-hoc padding or type scales.
 */
export const marketingPageWidth = "mx-auto w-full max-w-[1440px] px-6 lg:px-10";
export const marketingSection = "py-20 lg:py-28";
export const marketingSectionTitle =
  "max-w-3xl text-4xl leading-[1.1] font-normal tracking-[-0.03em] text-balance sm:text-5xl lg:text-6xl";
export const marketingTextColumn = "max-w-md";

export function MarketingSection({
  id,
  className,
  children,
  labelledBy,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
  labelledBy?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(
        marketingPageWidth,
        marketingSection,
        "scroll-mt-24",
        className
      )}
    >
      {children}
    </section>
  );
}

export function MarketingHero({
  title,
  children,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <section
      id="get-started"
      className={cn(
        marketingPageWidth,
        "flex scroll-mt-24 flex-col justify-center py-20 lg:py-28"
      )}
    >
      {eyebrow && (
        <div className="text-muted-foreground mb-6 text-sm">{eyebrow}</div>
      )}
      <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-32">
        <div>
          <h1 className="text-4xl leading-[1.05] font-normal tracking-tight text-balance sm:text-6xl lg:text-7xl">
            {title}
          </h1>
          {actions && (
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {actions}
            </div>
          )}
        </div>
        <div className={cn(marketingTextColumn, "w-full lg:justify-self-end")}>
          {children}
        </div>
      </div>
    </section>
  );
}

/**
 * The shared two-column feature layout: big title, demo on one side, copy on
 * the other. MarketingFeature wraps it in a section; tabbed panels reuse the
 * same columns so every two-column block on the page reads identically.
 */
export function MarketingFeatureColumns({
  title,
  children,
  demo,
  reverse = false,
  titleAs: Title = "h2",
}: {
  title: ReactNode;
  children: ReactNode;
  demo: ReactNode;
  reverse?: boolean;
  titleAs?: "h2" | "h3";
}) {
  return (
    <div
      className={cn(
        "grid gap-8 lg:gap-x-14 lg:gap-y-10",
        reverse
          ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]"
          : "lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]"
      )}
    >
      <Title className={cn(marketingSectionTitle, reverse && "lg:col-start-2")}>
        {title}
      </Title>
      <div
        className={cn(
          "min-w-0",
          reverse
            ? "lg:col-start-2 lg:row-start-2"
            : "lg:col-start-1 lg:row-start-2"
        )}
      >
        {demo}
      </div>
      <div
        className={cn(
          marketingTextColumn,
          "self-center lg:max-w-xs",
          reverse
            ? "lg:col-start-1 lg:row-start-2"
            : "lg:col-start-2 lg:row-start-2"
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function MarketingFeature({
  title,
  children,
  demo,
  reverse = false,
  id,
}: {
  title: ReactNode;
  children: ReactNode;
  demo: ReactNode;
  reverse?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(marketingPageWidth, marketingSection, "scroll-mt-24")}
    >
      <MarketingFeatureColumns
        title={title}
        demo={demo}
        reverse={reverse}
      >
        {children}
      </MarketingFeatureColumns>
    </section>
  );
}
