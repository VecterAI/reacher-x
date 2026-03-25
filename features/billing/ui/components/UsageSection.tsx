"use client";

import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/Select";
import { FolderIcon, FramePersonIcon } from "@/shared/ui/components/icons";
import { AnimatedFitBar } from "@/features/prospects/ui/components/ProspectDetailsCard";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import { useActiveUseCaseLabels } from "@/shared/hooks";
import type { Id } from "@/convex/_generated/dataModel";

export interface UsageSectionProps {
  resetLabel: string;
  cycleOptions: Array<{
    id: Id<"planUsageCycles">;
    label: string;
    isCurrent: boolean;
  }>;
  selectedCycleId: Id<"planUsageCycles"> | null | undefined;
  onCycleChange: (id: Id<"planUsageCycles">) => void;
  prospects: {
    used: number;
    limit: number;
    unlimited: boolean;
    percentUsed: number;
  };
  workspaces: {
    used: number;
    limit: number;
    percentUsed: number;
  };
  isLoading?: boolean;
}

function UsageMetricRow({
  icon,
  label,
  percentage,
  used,
  limit,
  unlimited,
}: {
  icon: ReactNode;
  label: string;
  percentage: number;
  used: number;
  limit: number;
  unlimited: boolean;
}) {
  const pct = unlimited ? 100 : Math.min(100, Math.max(0, percentage));

  const valueSlot = unlimited ? (
    <span className="text-foreground inline-flex shrink-0 items-baseline gap-1 font-mono text-xs tabular-nums">
      <AnimatedNumber value={used} decimals={0} animateOnMount />
      <span aria-hidden>/</span>
      <span>Unlimited</span>
    </span>
  ) : (
    <span className="text-foreground inline-flex shrink-0 items-baseline gap-0.5 font-mono text-xs tabular-nums">
      <AnimatedNumber value={used} decimals={0} animateOnMount />
      <span aria-hidden>/</span>
      <AnimatedNumber value={limit} decimals={0} animateOnMount />
    </span>
  );

  return (
    <>
      <div className="text-foreground flex min-w-0 items-center gap-2 overflow-hidden py-1.5">
        <span className="shrink-0 [&_svg]:size-4">{icon}</span>
        <span className="min-w-0 truncate" title={label}>
          {label}
        </span>
      </div>
      <div className="flex items-center justify-start gap-2 py-1.5">
        <AnimatedFitBar percentage={pct} className="shrink-0" />
        {valueSlot}
      </div>
    </>
  );
}

export function UsageSection({
  resetLabel,
  cycleOptions,
  selectedCycleId,
  onCycleChange,
  prospects,
  workspaces,
  isLoading = false,
}: UsageSectionProps) {
  const { entityPlural } = useActiveUseCaseLabels();
  const qualifiedLabel = `Qualified ${entityPlural}`;
  const selectValue =
    !isLoading && selectedCycleId != null ? selectedCycleId : undefined;

  return (
    <section className="border-border min-w-0 border-b px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">Usage</h2>
          <p className="text-muted-foreground text-sm">Resets {resetLabel}</p>
        </div>
        <Select
          value={selectValue}
          onValueChange={(v) => onCycleChange(v as Id<"planUsageCycles">)}
          disabled={isLoading || cycleOptions.length === 0}
        >
          <SelectTrigger size="xs" className="w-[220px] max-w-full">
            <SelectValue placeholder={isLoading ? "Loading cycle" : "Cycle"} />
          </SelectTrigger>
          <SelectContent>
            {cycleOptions.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.isCurrent ? `${opt.label} (current)` : opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 text-sm sm:gap-x-4">
        <UsageMetricRow
          icon={<FramePersonIcon className="shrink-0 fill-current" />}
          label={qualifiedLabel}
          percentage={prospects.unlimited ? 0 : prospects.percentUsed}
          used={prospects.used}
          limit={prospects.limit}
          unlimited={prospects.unlimited}
        />
        <UsageMetricRow
          icon={<FolderIcon className="shrink-0 fill-current" />}
          label="Workspaces"
          percentage={workspaces.percentUsed}
          used={workspaces.used}
          limit={workspaces.limit}
          unlimited={false}
        />
      </div>
    </section>
  );
}
