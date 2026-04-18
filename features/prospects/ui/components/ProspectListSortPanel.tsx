"use client";

import { useCallback, useMemo } from "react";

import {
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/webapp/ui/components";
import { useActiveUseCaseLabels } from "@/shared/hooks";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/components/RadioGroup";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { Separator } from "@/shared/ui/components/Separator";

import {
  getProspectListSortLabel,
  getProspectListSortSummary,
  type ProspectListSortOption,
} from "../../lib/prospectListSort";

interface ProspectListSortPanelProps {
  open: boolean;
  onClose: () => void;
  onApply: () => void;
  onReset: () => void;
  canApply: boolean;
  canReset: boolean;
  draftSort: ProspectListSortOption;
  onDraftSortChange: (sort: ProspectListSortOption) => void;
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

type SortOptionConfig = {
  value: ProspectListSortOption;
  description?: string;
};

function SortOption({
  option,
  checked,
  onChange,
}: {
  option: SortOptionConfig;
  checked: boolean;
  onChange: (value: ProspectListSortOption) => void;
}) {
  return (
    <label
      className="flex cursor-pointer items-start gap-2.5"
      htmlFor={option.value}
    >
      <RadioGroupItem
        id={option.value}
        value={option.value}
        checked={checked}
        onClick={() => onChange(option.value)}
      />
      <div className="space-y-1">
        <div className="text-sm font-medium">
          {getProspectListSortLabel(option.value)}
        </div>
        {option.description ? (
          <p className="text-muted-foreground text-xs">
            ↳ {option.description}
          </p>
        ) : null}
      </div>
    </label>
  );
}

export function ProspectListSortPanel({
  open,
  onClose,
  onApply,
  onReset,
  canApply,
  canReset,
  draftSort,
  onDraftSortChange,
  className,
}: ProspectListSortPanelProps) {
  const { entityPlural, entitySingular } = useActiveUseCaseLabels();
  const entityPluralLower = entityPlural.toLowerCase();
  const entitySingularLower = entitySingular.toLowerCase();
  const summary = useMemo(
    () => getProspectListSortSummary(draftSort),
    [draftSort]
  );

  const handleValueChange = useCallback(
    (value: string) => {
      onDraftSortChange(value as ProspectListSortOption);
    },
    [onDraftSortChange]
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
          title="Sort"
          titleSuffix={
            summary ? (
              <span className="text-muted-foreground max-w-44 truncate font-mono text-xs font-medium">
                · {summary}
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
            <RadioGroup
              value={draftSort}
              onValueChange={handleValueChange}
              className="gap-0 space-y-0"
            >
              <Section
                title="Fit score"
                description={`Sort by how closely each ${entitySingularLower} matches your target.`}
              >
                <div className="space-y-3">
                  <SortOption
                    option={{
                      value: "best_fit_first",
                      description: `Show the best-matching ${entityPluralLower} first.`,
                    }}
                    checked={draftSort === "best_fit_first"}
                    onChange={onDraftSortChange}
                  />
                  <SortOption
                    option={{
                      value: "lowest_fit_first",
                      description: `Show the lowest-scoring ${entityPluralLower} first.`,
                    }}
                    checked={draftSort === "lowest_fit_first"}
                    onChange={onDraftSortChange}
                  />
                </div>
              </Section>

              <SectionDivider />

              <Section
                title="Date/Time"
                description={`Sort by when each ${entitySingularLower} was found.`}
              >
                <div className="space-y-3">
                  <SortOption
                    option={{ value: "newest_first" }}
                    checked={draftSort === "newest_first"}
                    onChange={onDraftSortChange}
                  />
                  <SortOption
                    option={{ value: "oldest_first" }}
                    checked={draftSort === "oldest_first"}
                    onChange={onDraftSortChange}
                  />
                </div>
              </Section>

              <SectionDivider />

              <Section
                title="Type"
                description="Choose whether individual or organization profiles appear first."
              >
                <div className="space-y-3">
                  <SortOption
                    option={{
                      value: "individuals_first",
                      description: "Show individual profiles first.",
                    }}
                    checked={draftSort === "individuals_first"}
                    onChange={onDraftSortChange}
                  />
                  <SortOption
                    option={{
                      value: "organizations_first",
                      description: "Show organization profiles first.",
                    }}
                    checked={draftSort === "organizations_first"}
                    onChange={onDraftSortChange}
                  />
                </div>
              </Section>
            </RadioGroup>
          </PageContent>
        </ScrollArea>
      </PageLayout>
    </aside>
  );
}
