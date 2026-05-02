"use client";

import { useCallback, useMemo } from "react";
import type { DateRange } from "react-day-picker";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { DateRangeInputPicker } from "@/features/analytics/ui/components/DateRangeInputPicker";
import {
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/webapp/ui/components";
import { useActiveUseCaseLabels, useQueryWithStatus } from "@/shared/hooks";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import { RangeHistogramField } from "@/shared/ui/components/RangeHistogramField";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/Select";
import { Separator } from "@/shared/ui/components/Separator";

import {
  getProspectListFilterArgs,
  getProspectListFilterSummaryTokens,
  type ProspectListDatePreset,
  type ProspectListFilters,
} from "../../lib/prospectListFilters";

interface ProspectListFilterPanelProps {
  open: boolean;
  onClose: () => void;
  onApply: () => void;
  onReset: () => void;
  canApply: boolean;
  canReset: boolean;
  workspaceId: Id<"workspaces"> | null;
  status: Doc<"prospectSummaries">["status"];
  defaultFilters: ProspectListFilters;
  draftFilters: ProspectListFilters;
  onDraftFiltersChange: (filters: ProspectListFilters) => void;
  className?: string;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 px-4 text-left">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-muted-foreground mt-1.5 text-xs">↳ {description}</p>
      </div>
      {children}
    </section>
  );
}

function SectionDivider() {
  return <Separator className="my-4" />;
}

export function ProspectListFilterPanel({
  open,
  onClose,
  onApply,
  onReset,
  canApply,
  canReset,
  workspaceId,
  status,
  defaultFilters,
  draftFilters,
  onDraftFiltersChange,
  className,
}: ProspectListFilterPanelProps) {
  const helperId = "prospect-list-fit-score-helper";
  const { entityPlural } = useActiveUseCaseLabels();
  const entityPluralLower = entityPlural.toLowerCase();
  const summaryTokens = useMemo(
    () => getProspectListFilterSummaryTokens(draftFilters, defaultFilters),
    [defaultFilters, draftFilters]
  );
  const histogramFilterArgs = useMemo(() => {
    const {
      fitScoreMin: _fitScoreMin,
      fitScoreMax: _fitScoreMax,
      ...rest
    } = getProspectListFilterArgs(draftFilters);
    return rest;
  }, [draftFilters]);

  const histogramFilteredQuery = useQueryWithStatus(
    api.prospectSummaries.getWorkspaceFitScoreHistogram,
    workspaceId
      ? {
          workspaceId,
          status,
          platform:
            draftFilters.platform === "all" ? undefined : draftFilters.platform,
          prospectType:
            draftFilters.prospectType === "both"
              ? undefined
              : draftFilters.prospectType,
          createdAfterMs: histogramFilterArgs.createdAfterMs,
          createdBeforeMs: histogramFilterArgs.createdBeforeMs,
        }
      : "skip"
  );

  const binCounts = histogramFilteredQuery.data?.binCounts ?? Array(10).fill(0);
  const supportingText = histogramFilteredQuery.isError
    ? "We couldn't load the current fit-score distribution, but your range will still be applied."
    : `Drag to narrow ${entityPluralLower} by fit score.`;

  const updateDraftFilters = useCallback(
    (nextFilters: ProspectListFilters) => {
      onDraftFiltersChange(nextFilters);
    },
    [onDraftFiltersChange]
  );

  const handleFitScoreChange = useCallback(
    (fitScoreRange: [number, number]) => {
      if (
        draftFilters.fitScoreRange[0] === fitScoreRange[0] &&
        draftFilters.fitScoreRange[1] === fitScoreRange[1]
      ) {
        return;
      }
      updateDraftFilters({
        ...draftFilters,
        fitScoreRange,
      });
    },
    [draftFilters, updateDraftFilters]
  );

  const handleDatePresetChange = useCallback(
    (value: string) => {
      const nextPreset = value as ProspectListDatePreset;
      updateDraftFilters({
        ...draftFilters,
        datePreset: nextPreset,
        customDateRange:
          nextPreset === "custom" ? draftFilters.customDateRange : undefined,
      });
    },
    [draftFilters, updateDraftFilters]
  );

  const handleCustomDateChange = useCallback(
    (range: DateRange | undefined) => {
      updateDraftFilters({
        ...draftFilters,
        customDateRange: range
          ? {
              from: range.from,
              to: range.to,
            }
          : undefined,
      });
    },
    [draftFilters, updateDraftFilters]
  );

  const handleTypeChange = useCallback(
    (value: string) => {
      updateDraftFilters({
        ...draftFilters,
        prospectType: value as ProspectListFilters["prospectType"],
      });
    },
    [draftFilters, updateDraftFilters]
  );

  const handlePlatformChange = useCallback(
    (value: string) => {
      updateDraftFilters({
        ...draftFilters,
        platform: value as ProspectListFilters["platform"],
      });
    },
    [draftFilters, updateDraftFilters]
  );

  if (!open) {
    return null;
  }

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full max-w-lg flex-1 overflow-hidden md:min-w-0",
        className
      )}
    >
      <PageLayout className="flex h-full flex-col md:w-full">
        <PageHeader
          title="Filter"
          titleSuffix={
            summaryTokens.length > 0 ? (
              <span className="text-muted-foreground max-w-44 truncate font-mono text-xs font-medium">
                · {summaryTokens.join(" · ")}
              </span>
            ) : null
          }
          onBack={onClose}
          actions={
            <>
              <Button
                variant="ghost"
                size="xs"
                onClick={onReset}
                type="button"
                disabled={!canReset}
              >
                Reset
              </Button>
              <Button
                size="xs"
                onClick={onApply}
                type="button"
                disabled={!canApply}
              >
                Apply
              </Button>
            </>
          }
        />
        <ScrollArea className="min-h-0 flex-1 overscroll-contain">
          <PageContent className="space-y-0 py-4">
            <Section
              title="Fit score"
              description={`Focus on ${entityPluralLower} within the fit-score range you want.`}
            >
              <RangeHistogramField
                ariaLabel="Fit score range"
                defaultRange={draftFilters.fitScoreRange}
                describedBy={helperId}
                domainMax={100}
                domainMin={0}
                fieldLabel="Fit score range"
                binCounts={binCounts}
                maxLabel="Max"
                minLabel="Min"
                supportingText={supportingText}
                supportingTextId={helperId}
                onRangeChange={handleFitScoreChange}
              />
            </Section>

            <SectionDivider />

            <Section
              title="Date"
              description={`Show ${entityPluralLower} found within a specific window.`}
            >
              <Select
                value={draftFilters.datePreset}
                onValueChange={handleDatePresetChange}
              >
                <SelectTrigger
                  size="default"
                  className="[&>span]:justify-start [&>span]:text-left"
                >
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_time">All time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="1d">24 hours</SelectItem>
                  <SelectItem value="7d">7 days</SelectItem>
                  <SelectItem value="30d">30 days</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>

              {draftFilters.datePreset === "custom" ? (
                <DateRangeInputPicker
                  value={draftFilters.customDateRange as DateRange | undefined}
                  onChange={handleCustomDateChange}
                  inputSize="default"
                  className="w-full min-w-0"
                />
              ) : null}
            </Section>

            <SectionDivider />

            <Section
              title="Type"
              description="Choose whether to show individual profiles, organization profiles, or both."
            >
              <Select
                value={draftFilters.prospectType}
                onValueChange={handleTypeChange}
              >
                <SelectTrigger
                  size="default"
                  className="[&>span]:justify-start [&>span]:text-left"
                >
                  <SelectValue placeholder="Both" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both</SelectItem>
                  <SelectItem value="individual">Individuals</SelectItem>
                  <SelectItem value="organization">Organizations</SelectItem>
                </SelectContent>
              </Select>
            </Section>

            <SectionDivider />

            <Section
              title="Platform(s)"
              description={`Show ${entityPluralLower} found on a specific platform.`}
            >
              <Select
                value={draftFilters.platform}
                onValueChange={handlePlatformChange}
              >
                <SelectTrigger
                  size="default"
                  className="[&>span]:justify-start [&>span]:text-left"
                >
                  <SelectValue placeholder="All platforms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All platforms</SelectItem>
                  <SelectItem value="twitter">X/Twitter</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                </SelectContent>
              </Select>
            </Section>
          </PageContent>
        </ScrollArea>
      </PageLayout>
    </aside>
  );
}
