"use client";

import * as React from "react";
import { Card } from "@/shared/ui/components/Card";
import { cn } from "@/shared/lib/utils";

type UsageSummaryMetric = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  valueTitle?: string;
};

export interface UsageSummaryStripProps {
  metrics: UsageSummaryMetric[];
  className?: string;
}

export const UsageSummaryStrip = React.memo(function UsageSummaryStrip({
  metrics,
  className,
}: UsageSummaryStripProps) {
  return (
    <Card className={cn("shadow-none", className)}>
      <div className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
        {metrics.map((metric, index) => {
          const showVerticalDividerDesktop = index > 0;
          const showVerticalDividerTablet = index % 2 === 1;

          return (
            <article
              key={metric.id}
              className="relative flex min-h-[112px] flex-col justify-center p-4"
            >
              <div
                aria-hidden="true"
                className={cn(
                  "bg-border absolute top-4 bottom-4 left-0 w-px",
                  "hidden",
                  showVerticalDividerTablet && "sm:max-lg:block",
                  showVerticalDividerDesktop && "lg:block"
                )}
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground text-sm font-medium">
                  {metric.label}
                </span>
                <span className="text-muted-foreground shrink-0 [&_svg]:size-4">
                  <metric.icon className="fill-current" />
                </span>
              </div>
              <div
                className="mt-2 flex min-h-[58px] items-start"
                title={metric.valueTitle}
              >
                {metric.value}
              </div>
            </article>
          );
        })}
      </div>
    </Card>
  );
});
