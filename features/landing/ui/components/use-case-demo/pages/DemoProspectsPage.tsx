/**
 * DemoProspectsPage
 * Faithful replica of the real prospects home (app/(webapp)/page.tsx):
 * ProspectsToolbar with stage tabs (labels adapt to the demo use case),
 * the pending prospects feed bar in its desktop presentation, ProspectCard
 * grid fed by summary read-model records (so plan-state badges render like
 * the real list), and an in-flow profile panel that pushes the grid aside.
 * Prospects with a demo plan also show the OutreachPlanSection-equivalent
 * inside the panel (the real OutreachPlanSection is Convex-wired).
 * Omitted vs real: WorkspacePlanLimitAlert and WorkspaceSystemStatusFeedBar
 * (Convex-wired), filter/sort side panels (wired), InfiniteScrollTrigger.
 */
"use client";

import * as React from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { getProspectDisplayData } from "@/features/prospects/lib/getProspectDisplayData";
import { normalizeProspectProfileData } from "@/features/prospects/lib/normalizeProspectProfileData";
import {
  PendingProspectsFeedBar,
  ProspectCard,
  ProspectListFilterPanel,
  ProspectListSortPanel,
  ProspectProfilePanel,
  ProspectsToolbar,
  type ProspectsToolbarStageCounts,
  type ProspectsToolbarTab,
} from "@/features/prospects";
import {
  createDefaultProspectListFilters,
  type ProspectListFilters,
} from "@/features/prospects/lib/prospectListFilters";
import {
  DEFAULT_PROSPECT_LIST_SORT,
  type ProspectListSortOption,
} from "@/features/prospects/lib/prospectListSort";
import {
  DESKTOP_PANEL_BORDER_CLASS_NAME,
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/webapp/ui/components";
import { useDemoShell } from "../demoShellContext";
import { toDemoProspectSummary, USE_CASE_DEMO_PLANS } from "../useCaseDemoData";
import { DemoOutreachPlanSection } from "./DemoOutreachPlanSection";
import {
  DEMO_PROSPECT_GRID_STYLE,
  matchesProspectSearch,
} from "./prospectListShared";

const NO_TAB_ATTENTION: Record<ProspectsToolbarTab, boolean> = {
  new: false,
  contacted: false,
  in_progress: false,
};

// Same desktop presentation the real page applies to the feed bar
// (app/(webapp)/page.tsx DESKTOP_FEED_BAR_CLASS_NAME).
const DESKTOP_FEED_BAR_CLASS_NAME =
  "md:inline-flex md:w-auto md:max-w-full md:self-start md:border-0 md:bg-transparent md:p-0 md:[&>div:first-child]:flex-none md:[&>div:first-child]:min-w-0";

export function DemoProspectsPage({
  prospects,
}: {
  prospects: Doc<"prospects">[];
}) {
  const { labels } = useDemoShell();
  const entityPluralLower = labels.entityPlural.toLowerCase();
  const [activeTab, setActiveTab] = React.useState<ProspectsToolbarTab>("new");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [feedMerged, setFeedMerged] = React.useState(false);

  // Filter/sort state mirrors the real page (useProspectListFilters /
  // useProspectListSort) but stays local: draft edits apply on Apply.
  const defaultFilters = React.useMemo(
    () => createDefaultProspectListFilters([0, 100]),
    []
  );
  const [appliedFilters, setAppliedFilters] =
    React.useState<ProspectListFilters>(defaultFilters);
  const [draftFilters, setDraftFilters] =
    React.useState<ProspectListFilters>(defaultFilters);
  const [filterPanelOpen, setFilterPanelOpen] = React.useState(false);
  const [sortPanelOpen, setSortPanelOpen] = React.useState(false);
  const [appliedSort, setAppliedSort] = React.useState<ProspectListSortOption>(
    DEFAULT_PROSPECT_LIST_SORT
  );
  const [draftSort, setDraftSort] = React.useState<ProspectListSortOption>(
    DEFAULT_PROSPECT_LIST_SORT
  );

  const stageTabs = React.useMemo(
    () => [
      { id: "new" as const, label: labels.stageLabels.new },
      { id: "contacted" as const, label: labels.stageLabels.contacted },
      { id: "in_progress" as const, label: labels.stageLabels.in_progress },
    ],
    [labels]
  );

  const trimmedQuery = searchQuery.trim().toLowerCase();

  const searchFiltered = React.useMemo(
    () =>
      prospects.filter((prospect) => {
        if (
          appliedFilters.platform !== "all" &&
          prospect.platform !== appliedFilters.platform
        ) {
          return false;
        }
        if (
          appliedFilters.prospectType !== "both" &&
          (prospect.prospectType ?? "individual") !==
            appliedFilters.prospectType
        ) {
          return false;
        }
        const score = prospect.qualificationScore ?? 0;
        if (
          score < appliedFilters.fitScoreRange[0] ||
          score > appliedFilters.fitScoreRange[1]
        ) {
          return false;
        }
        return (
          trimmedQuery === "" || matchesProspectSearch(prospect, trimmedQuery)
        );
      }),
    [prospects, appliedFilters, trimmedQuery]
  );

  const tabCounts = React.useMemo<ProspectsToolbarStageCounts>(
    () => ({
      new: searchFiltered.filter((prospect) => prospect.status === "new")
        .length,
      contacted: searchFiltered.filter(
        (prospect) => prospect.status === "contacted"
      ).length,
      in_progress: searchFiltered.filter(
        (prospect) => prospect.status === "in_progress"
      ).length,
    }),
    [searchFiltered]
  );

  const visibleProspects = React.useMemo(() => {
    const filtered = searchFiltered.filter(
      (prospect) => prospect.status === activeTab
    );
    const sorted = [...filtered];
    switch (appliedSort) {
      case "best_fit_first":
        sorted.sort(
          (a, b) => (b.qualificationScore ?? 0) - (a.qualificationScore ?? 0)
        );
        break;
      case "lowest_fit_first":
        sorted.sort(
          (a, b) => (a.qualificationScore ?? 0) - (b.qualificationScore ?? 0)
        );
        break;
      case "newest_first":
        sorted.sort((a, b) => b._creationTime - a._creationTime);
        break;
      case "oldest_first":
        sorted.sort((a, b) => a._creationTime - b._creationTime);
        break;
      default:
        break;
    }
    return sorted;
  }, [activeTab, searchFiltered, appliedSort]);

  const filtersEqual = (a: ProspectListFilters, b: ProspectListFilters) =>
    JSON.stringify(a) === JSON.stringify(b);
  const activeFilterCount =
    (appliedFilters.platform !== "all" ? 1 : 0) +
    (appliedFilters.prospectType !== "both" ? 1 : 0) +
    (appliedFilters.datePreset !== "all_time" ? 1 : 0) +
    (appliedFilters.fitScoreRange[0] !== defaultFilters.fitScoreRange[0] ||
    appliedFilters.fitScoreRange[1] !== defaultFilters.fitScoreRange[1]
      ? 1
      : 0);

  const selectedProspect = selectedId
    ? (prospects.find((prospect) => prospect._id === selectedId) ?? null)
    : null;
  const selectedProfileData = selectedProspect
    ? normalizeProspectProfileData(selectedProspect)
    : null;
  const selectedPlan = selectedProspect
    ? USE_CASE_DEMO_PLANS[selectedProspect._id]
    : undefined;

  const pendingPreview = React.useMemo(
    () =>
      prospects.slice(0, 2).map((prospect) => ({
        prospectId: prospect._id as string,
        displayName: getProspectDisplayData(prospect).displayName,
        avatarUrl: getProspectDisplayData(prospect).avatarUrl,
      })),
    [prospects]
  );

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 md:flex-row md:items-stretch">
      <PageLayout className="flex h-full min-h-0 w-full max-w-none flex-1 basis-0 flex-col overflow-hidden border-none">
        <PageHeader title={labels.pageLabels.entities} />
        <PageContent className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-0">
          <ProspectsToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={stageTabs}
            tabCounts={tabCounts}
            tabAttention={NO_TAB_ATTENTION}
            searchPlaceholder={`Search ${entityPluralLower}...`}
            filterActiveCount={activeFilterCount}
            sortActive={appliedSort !== DEFAULT_PROSPECT_LIST_SORT}
            onOpenFilters={() => {
              setDraftFilters(appliedFilters);
              setFilterPanelOpen(true);
            }}
            onOpenSort={() => {
              setDraftSort(appliedSort);
              setSortPanelOpen(true);
            }}
            disabled={false}
            className="px-4 pt-4"
          />

          <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
            {!feedMerged ? (
              <div className="flex w-full flex-col gap-4 md:max-w-lg">
                <PendingProspectsFeedBar
                  pendingCount={2}
                  pendingCountCapped={false}
                  preview={pendingPreview}
                  entityPluralLower={entityPluralLower}
                  onMerge={() => setFeedMerged(true)}
                  className={DESKTOP_FEED_BAR_CLASS_NAME}
                />
              </div>
            ) : null}

            {visibleProspects.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No {entityPluralLower} match your search
              </p>
            ) : (
              <ul
                className="grid min-w-0 gap-3"
                style={DEMO_PROSPECT_GRID_STYLE}
              >
                {visibleProspects.map((prospect) => (
                  <li key={prospect._id} className="min-w-0">
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
            )}
          </div>
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

      <ProspectListFilterPanel
        open={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        onApply={() => {
          setAppliedFilters(draftFilters);
          setFilterPanelOpen(false);
        }}
        onReset={() => {
          setDraftFilters(defaultFilters);
          setAppliedFilters(defaultFilters);
          setFilterPanelOpen(false);
        }}
        canApply={!filtersEqual(draftFilters, appliedFilters)}
        canReset={!filtersEqual(draftFilters, defaultFilters)}
        workspaceId={null}
        status={activeTab}
        defaultFilters={defaultFilters}
        draftFilters={draftFilters}
        onDraftFiltersChange={setDraftFilters}
        className={DESKTOP_PANEL_BORDER_CLASS_NAME}
      />
      <ProspectListSortPanel
        open={sortPanelOpen}
        onClose={() => setSortPanelOpen(false)}
        onApply={() => {
          setAppliedSort(draftSort);
          setSortPanelOpen(false);
        }}
        onReset={() => {
          setDraftSort(DEFAULT_PROSPECT_LIST_SORT);
          setAppliedSort(DEFAULT_PROSPECT_LIST_SORT);
          setSortPanelOpen(false);
        }}
        canApply={draftSort !== appliedSort}
        canReset={draftSort !== DEFAULT_PROSPECT_LIST_SORT}
        draftSort={draftSort}
        onDraftSortChange={setDraftSort}
        className={DESKTOP_PANEL_BORDER_CLASS_NAME}
      />
    </div>
  );
}
