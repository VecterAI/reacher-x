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

export const marketingPageWidth = "mx-auto w-full max-w-[1440px] px-6 lg:px-10";
export const marketingSectionTitle =
  "max-w-3xl text-3xl leading-tight font-normal text-balance sm:text-5xl lg:text-6xl";

export function MarketingHero({
  title,
  children,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  children: ReactNode;
  actions: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <section
      id="get-started"
      className={cn(
        marketingPageWidth,
        "flex scroll-mt-24 flex-col justify-center py-20 lg:min-h-[620px] lg:py-28"
      )}
    >
      {eyebrow && (
        <div className="text-muted-foreground mb-10 text-sm">{eyebrow}</div>
      )}
      <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-32">
        <div>
          <h1 className="text-4xl leading-[1.05] font-normal tracking-tight text-balance sm:text-6xl lg:text-7xl">
            {title}
          </h1>
          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm">
            {actions}
          </div>
        </div>
        <div className="w-full max-w-md lg:justify-self-end">{children}</div>
      </div>
    </section>
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
      className={cn(marketingPageWidth, "scroll-mt-24 pb-24 lg:pb-36")}
    >
      <div
        className={cn(
          "grid gap-8 lg:gap-x-14 lg:gap-y-10",
          reverse
            ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]"
            : "lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]"
        )}
      >
        <h2 className={cn(marketingSectionTitle, reverse && "lg:col-start-2")}>
          {title}
        </h2>
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
            "max-w-md self-center lg:max-w-xs",
            reverse
              ? "lg:col-start-1 lg:row-start-2"
              : "lg:col-start-2 lg:row-start-2"
          )}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
