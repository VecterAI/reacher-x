/** Production status-list components with local filtering and prospect actions. */
"use client";
import {
  useDemoProspectList,
  DemoProspectListPanels,
} from "./useDemoProspectList";

import * as React from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { SearchInput } from "@/features/search/ui/components/SearchInput";
import { DemoProspectPanel } from "./DemoProspectPanel";
import {
  useDemoProspectActions,
  type DemoProspectView,
} from "./useDemoProspectActions";
import { useDemoShell } from "../demoShellContext";
import type { DemoEditorialScenario } from "../demoEditorialHelpers";
import { ProspectCard, ProspectListEmptyState } from "@/features/prospects";
import { IconButtonWithIndicator } from "@/shared/ui/components/IconButtonWithIndicator";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { FilterAltIcon, SwapVertIcon } from "@/shared/ui/components/icons";
import {
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/webapp/ui/components";
import { toDemoProspectSummary, USE_CASE_DEMO_PLANS } from "../useCaseDemoData";
import { DEMO_PROSPECT_GRID_STYLE } from "./prospectListShared";

export interface DemoProspectStatusListPageProps {
  status: "converted" | "archived";
  onStatusChange: (id: string, status: Doc<"prospects">["status"]) => void;
  onOpenAgent: (prospect: Doc<"prospects">) => void;
  editorialScenario?: DemoEditorialScenario;
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
  status,
  title,
  searchPlaceholder,
  emptyState,
  entityLabelLower,
  onStatusChange,
  onOpenAgent,
  editorialScenario,
}: DemoProspectStatusListPageProps) {
  const { labels } = useDemoShell();
  const [panelView, setPanelView] = React.useState<DemoProspectView>("profile");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const trimmedQuery = searchQuery.trim().toLowerCase();

  const list = useDemoProspectList(prospects, searchQuery, status);
  const visibleProspects = list.prospects;

  const selectedProspect = selectedId
    ? (prospects.find((prospect) => prospect._id === selectedId) ?? null)
    : null;
  const actionsFor = useDemoProspectActions({
    onStatusChange,
    onOpenAgent,
    onOpen: (id, view) => {
      list.closePanels();
      setSelectedId(id);
      setPanelView(view);
    },
  });

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
                    showIndicator={list.activeFilterCount > 0}
                    onClick={() => {
                      setSelectedId(null);
                      list.openFilters();
                    }}
                    type="button"
                    className="h-9 w-9"
                  >
                    <FilterAltIcon className="fill-current" />
                  </IconButtonWithIndicator>
                  <IconButtonWithIndicator
                    aria-label="Open sort"
                    showIndicator={list.sortActive}
                    onClick={() => {
                      setSelectedId(null);
                      list.openSort();
                    }}
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
                  showIndicator={list.activeFilterCount > 0}
                  onClick={() => {
                    setSelectedId(null);
                    list.openFilters();
                  }}
                  type="button"
                  size="xs"
                  className="w-full justify-center gap-1.5"
                >
                  <FilterAltIcon className="fill-current" />
                  <span>Filter</span>
                </IconButtonWithIndicator>
                <IconButtonWithIndicator
                  aria-label="Open sort"
                  showIndicator={list.sortActive}
                  onClick={() => {
                    setSelectedId(null);
                    list.openSort();
                  }}
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
                          actions={actionsFor(prospect)}
                          entityLabel={labels.entitySingular}
                          onClick={() => {
                            list.closePanels();
                            setPanelView("profile");
                            setSelectedId(prospect._id);
                          }}
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

      {selectedProspect ? (
        <DemoProspectPanel
          key={`${selectedId}:${panelView}`}
          prospect={selectedProspect}
          actions={actionsFor(selectedProspect)}
          initialView={panelView}
          editorialScenario={editorialScenario}
          onBack={() => setSelectedId(null)}
        />
      ) : null}
      <DemoProspectListPanels list={list} />
    </div>
  );
}
