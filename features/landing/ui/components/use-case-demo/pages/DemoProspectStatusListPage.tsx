/**
 * DemoProspectStatusListPage
 * Faithful replica of the real Converts page (UseCaseSuccessPage) and
 * Archives page (app/(webapp)/archives/page.tsx), which share the same
 * structure: page header, search row with filter/sort icon buttons,
 * ProspectCard grid, and an in-flow profile panel. Runs on mock data.
 * Omitted vs real: WorkspacePlanLimitAlert (Convex-wired), filter/sort
 * side panels (wired), InfiniteScrollTrigger (no pagination in mock).
 */
"use client";

import * as React from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { SearchInput } from "@/features/search/ui/components/SearchInput";
import { normalizeProspectProfileData } from "@/features/prospects/lib/normalizeProspectProfileData";
import {
  ProspectCard,
  ProspectListEmptyState,
  ProspectProfilePanel,
} from "@/features/prospects";
import { IconButtonWithIndicator } from "@/shared/ui/components/IconButtonWithIndicator";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { FilterAltIcon, SwapVertIcon } from "@/shared/ui/components/icons";
import {
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/webapp/ui/components";
import { toDemoProspectSummary, USE_CASE_DEMO_PLANS } from "../useCaseDemoData";
import { DemoOutreachPlanSection } from "./DemoOutreachPlanSection";
import {
  DEMO_PROSPECT_GRID_STYLE,
  matchesProspectSearch,
} from "./prospectListShared";

type PlatformFilter = "all" | "twitter" | "linkedin";

export interface DemoProspectStatusListPageProps {
  /** Status-filtered prospects to list (converted or archived). */
  prospects: Doc<"prospects">[];
  /** Page header title (pageLabels.converts / pageLabels.archives). */
  title: string;
  /** Search input placeholder, copied from the real page. */
  searchPlaceholder: string;
  /** Empty state content (copy from the real page). */
  emptyState: { title: string; description?: string; icon: React.ReactNode };
  /** Lowercase entity label for the search no-match message. */
  entityLabelLower: string;
}

export function DemoProspectStatusListPage({
  prospects,
  title,
  searchPlaceholder,
  emptyState,
  entityLabelLower,
}: DemoProspectStatusListPageProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortByScore, setSortByScore] = React.useState(false);
  const [platformFilter, setPlatformFilter] =
    React.useState<PlatformFilter>("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const trimmedQuery = searchQuery.trim().toLowerCase();

  const visibleProspects = React.useMemo(() => {
    const filtered = prospects.filter((prospect) => {
      if (platformFilter !== "all" && prospect.platform !== platformFilter) {
        return false;
      }
      return (
        trimmedQuery === "" || matchesProspectSearch(prospect, trimmedQuery)
      );
    });
    if (!sortByScore) {
      return filtered;
    }
    return [...filtered].sort(
      (a, b) => (b.qualificationScore ?? 0) - (a.qualificationScore ?? 0)
    );
  }, [prospects, platformFilter, sortByScore, trimmedQuery]);

  const selectedProspect = selectedId
    ? (prospects.find((prospect) => prospect._id === selectedId) ?? null)
    : null;
  const selectedProfileData = selectedProspect
    ? normalizeProspectProfileData(selectedProspect)
    : null;
  const selectedPlan = selectedProspect
    ? USE_CASE_DEMO_PLANS[selectedProspect._id]
    : undefined;

  const handleOpenFilters = () => {
    setPlatformFilter((current) =>
      current === "all" ? "twitter" : current === "twitter" ? "linkedin" : "all"
    );
  };

  const browseMode = trimmedQuery === "";
  const showEmptyState = browseMode && visibleProspects.length === 0;
  const showSearchNoMatch = !browseMode && visibleProspects.length === 0;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 md:flex-row md:items-stretch">
      <PageLayout className="flex h-full min-h-0 w-full max-w-none flex-1 basis-0 flex-col overflow-hidden border-none">
        <PageHeader title={title} />
        <PageContent className="flex min-h-0 flex-1 flex-col p-0">
          <ScrollArea className="min-w-0 flex-1">
            <div className="mb-0 px-4 pt-4">
              <div className="md:hidden">
                <SearchInput
                  defaultValue={searchQuery}
                  onQueryChange={setSearchQuery}
                  placeholder={searchPlaceholder}
                  showExactMatch={false}
                />
              </div>
              <div className="hidden items-center justify-between gap-3 md:flex">
                <div className="w-72 lg:w-80">
                  <SearchInput
                    defaultValue={searchQuery}
                    onQueryChange={setSearchQuery}
                    placeholder={searchPlaceholder}
                    showExactMatch={false}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <IconButtonWithIndicator
                    aria-label="Open filters"
                    showIndicator={platformFilter !== "all"}
                    onClick={handleOpenFilters}
                    type="button"
                    className="h-9 w-9"
                  >
                    <FilterAltIcon className="fill-current" />
                  </IconButtonWithIndicator>
                  <IconButtonWithIndicator
                    aria-label="Open sort"
                    showIndicator={sortByScore}
                    onClick={() => setSortByScore((current) => !current)}
                    type="button"
                    className="h-9 w-9"
                  >
                    <SwapVertIcon className="h-4 w-4 fill-current" />
                  </IconButtonWithIndicator>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 md:hidden">
                <IconButtonWithIndicator
                  aria-label="Open filters"
                  showIndicator={platformFilter !== "all"}
                  onClick={handleOpenFilters}
                  type="button"
                  size="xs"
                  className="w-full justify-center gap-1.5"
                >
                  <FilterAltIcon className="fill-current" />
                  <span>Filter</span>
                </IconButtonWithIndicator>
                <IconButtonWithIndicator
                  aria-label="Open sort"
                  showIndicator={sortByScore}
                  onClick={() => setSortByScore((current) => !current)}
                  type="button"
                  size="xs"
                  className="w-full justify-center gap-1.5"
                >
                  <SwapVertIcon className="h-4 w-4 fill-current" />
                  <span>Sort</span>
                </IconButtonWithIndicator>
              </div>
            </div>

            <div className="px-4 pt-4 pb-4">
              {showEmptyState ? (
                <ProspectListEmptyState
                  title={emptyState.title}
                  description={emptyState.description}
                  icon={emptyState.icon}
                />
              ) : showSearchNoMatch ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No {entityLabelLower} match your search
                </p>
              ) : (
                <div className="pb-8">
                  <ul
                    className="grid min-w-0 gap-3"
                    style={DEMO_PROSPECT_GRID_STYLE}
                  >
                    {visibleProspects.map((prospect) => (
                      <li key={prospect._id}>
                        <ProspectCard
                          prospect={toDemoProspectSummary(
                            prospect,
                            USE_CASE_DEMO_PLANS[prospect._id]
                          )}
                          highlightKeywords={prospect.matchedKeywords}
                          mode="ui_preview"
                          showMenu={false}
                          onClick={() => setSelectedId(prospect._id)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </ScrollArea>
        </PageContent>
      </PageLayout>

      {selectedProspect && selectedProfileData ? (
        <aside className="border-border flex h-full w-[380px] shrink-0 flex-col border-l">
          <ProspectProfilePanel
            prospect={selectedProfileData}
            mode="ui_preview"
            onBack={() => setSelectedId(null)}
            disableMobileDrawer
            className="max-w-none"
            renderOutreachPlanSection={
              selectedPlan
                ? () => (
                    <DemoOutreachPlanSection
                      plan={selectedPlan}
                      prospectId={selectedProspect._id}
                    />
                  )
                : undefined
            }
          />
        </aside>
      ) : null}
    </div>
  );
}
