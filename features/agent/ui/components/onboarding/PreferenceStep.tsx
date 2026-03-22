"use client";

import { RangeHistogramField } from "@/shared/ui/components/RangeHistogramField";
import { QUALIFICATION_THRESHOLD } from "@/shared/lib/qualificationConstants";
import type { WorkspaceUseCaseDefinition } from "@/shared/lib/workspaceUseCases";
import { PREFERENCE_FIT_SCORE_BIN_COUNTS } from "./preferenceFitScoreBins";

interface PreferenceStepProps {
  useCase: WorkspaceUseCaseDefinition;
}

export function PreferenceStep({ useCase }: PreferenceStepProps) {
  const helperId = "preference-fit-score-helper";
  const entityLower = useCase.promptContext.terminology.entityPlural;
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
          Fit score
        </h2>
        <p className="text-muted-foreground text-sm">
          Only show {entityLower} between these scores.
        </p>
      </header>

      <RangeHistogramField
        ariaLabel="Fit score range"
        defaultRange={[QUALIFICATION_THRESHOLD, 100]}
        describedBy={helperId}
        domainMax={100}
        domainMin={0}
        fieldLabel="Fit score range"
        binCounts={PREFERENCE_FIT_SCORE_BIN_COUNTS}
        maxLabel="Max"
        minLabel="Min"
        showPercentSuffix
        supportingText={`${useCase.entityPlural} below ${QUALIFICATION_THRESHOLD}% are unqualified.`}
        supportingTextId={helperId}
      />
    </section>
  );
}
