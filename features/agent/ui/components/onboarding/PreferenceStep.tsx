"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQueryWithStatus } from "@/shared/hooks";
import { RangeHistogramField } from "@/shared/ui/components/RangeHistogramField";
import { QUALIFICATION_THRESHOLD } from "@/shared/lib/qualificationConstants";
import type { WorkspaceUseCaseDefinition } from "@/shared/lib/workspaceUseCases";

interface PreferenceStepProps {
  useCase: WorkspaceUseCaseDefinition;
  workspaceId: Id<"workspaces"> | null;
  defaultRange: [number, number];
  onRangeChange: (range: [number, number]) => void;
}

export function PreferenceStep({
  useCase,
  workspaceId,
  defaultRange,
  onRangeChange,
}: PreferenceStepProps) {
  const helperId = "preference-match-score-helper";
  const entityLower = useCase.promptContext.terminology.entityPlural;
  const histogramQuery = useQueryWithStatus(
    api.prospectSummaries.getWorkspaceFitScoreHistogram,
    workspaceId ? { workspaceId } : "skip"
  );
  const binCounts = histogramQuery.data?.binCounts ?? Array(10).fill(0);
  const supportingText = histogramQuery.isError
    ? `Agent couldn't load the current match-score distribution, but your range will still be saved. ${useCase.entityPlural} below ${QUALIFICATION_THRESHOLD}% are not a match.`
    : `${useCase.entityPlural} below ${QUALIFICATION_THRESHOLD}% are not a match.`;

  return (
    <section
      aria-labelledby="preference-fit-heading"
      className="min-w-0 space-y-4"
    >
      <header className="space-y-1">
        <h2
          className="text-xl font-semibold tracking-tight"
          id="preference-fit-heading"
        >
          Match score
        </h2>
        <p className="text-muted-foreground text-sm">
          Only show {entityLower} between these scores.
        </p>
      </header>

      <RangeHistogramField
        ariaLabel="Match score range"
        defaultRange={defaultRange}
        describedBy={helperId}
        domainMax={100}
        domainMin={0}
        fieldLabel="Match score range"
        binCounts={binCounts}
        maxLabel="Max"
        minLabel="Min"
        showPercentSuffix
        supportingText={supportingText}
        supportingTextId={helperId}
        onRangeChange={onRangeChange}
      />
    </section>
  );
}
