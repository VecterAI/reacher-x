"use client";
import {
  useDemoProspectList,
  DemoProspectListPanels,
} from "./useDemoProspectList";
import { DemoProspectPanel } from "./DemoProspectPanel";
import {
  useDemoProspectActions,
  type DemoProspectView,
} from "./useDemoProspectActions";
/**
 * Production list components backed by a local dataset and local action adapters.
 * Subscription-driven limits, discovery updates, and pagination are not simulated.
 */

import * as React from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { getProspectDisplayData } from "@/features/prospects/lib/getProspectDisplayData";
import {
  PendingProspectsFeedBar,
  ProspectCard,
  ProspectsToolbar,
  type ProspectsToolbarStageCounts,
  type ProspectsToolbarTab,
} from "@/features/prospects";
import {
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/webapp/ui/components";
import { type DemoEditorialScenario } from "../demoEditorialHelpers";
import type { DemoPresentation } from "../demoPresentationHelpers";
import { useDemoShell } from "../demoShellContext";
import { toDemoProspectSummary, USE_CASE_DEMO_PLANS } from "../useCaseDemoData";
import { DEMO_PROSPECT_GRID_STYLE } from "./prospectListShared";

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
  presentation,
  onStatusChange,
  editorialScenario,
  onViewChange,
  onOpenAgent,
}: {
  prospects: Doc<"prospects">[];
  onOpenAgent: (prospect: Doc<"prospects">) => void;
  presentation?: DemoPresentation;
  onStatusChange: (id: string, status: Doc<"prospects">["status"]) => void;
  editorialScenario?: DemoEditorialScenario;
  onViewChange?: (view: string) => void;
}) {
  const { labels } = useDemoShell();
  const [panelView, setPanelView] = React.useState<DemoProspectView>(
    presentation?.conversation ? "conversation" : "profile"
  );
  const entityPluralLower = labels.entityPlural.toLowerCase();
  const [activeTab, setActiveTab] = React.useState<ProspectsToolbarTab>(
    presentation?.listTab ?? "new"
  );
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(
    presentation?.selected ? (prospects[0]?._id ?? null) : null
  );
  const [feedMerged, setFeedMerged] = React.useState(false);

  const list = useDemoProspectList(prospects, searchQuery, activeTab);
  const stageTabs = React.useMemo(
    () => [
      { id: "new" as const, label: labels.stageLabels.new },
      { id: "contacted" as const, label: labels.stageLabels.contacted },
      { id: "in_progress" as const, label: labels.stageLabels.in_progress },
    ],
    [labels]
  );

  const searchFiltered = list.prospects;

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

  const visibleProspects = searchFiltered.filter((p) => p.status === activeTab);

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
      onViewChange?.(view);
    },
  });
  const openedShare = React.useRef<string | null>(null);
  React.useEffect(() => {
    const id = new URLSearchParams(window.location.hash.slice(1)).get(
      "prospect"
    );
    if (
      id &&
      openedShare.current !== id &&
      prospects.some((p) => p._id === id)
    ) {
      openedShare.current = id;
      setSelectedId(id);
    }
  }, [prospects]);

  const pendingPreview = React.useMemo(
    () =>
      (editorialScenario ? [] : prospects.slice(0, 2)).map((prospect) => ({
        prospectId: prospect._id as string,
        displayName: getProspectDisplayData(prospect).displayName,
        avatarUrl: getProspectDisplayData(prospect).avatarUrl,
      })),
    [prospects, editorialScenario]
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
            filterActiveCount={list.activeFilterCount}
            sortActive={list.sortActive}
            onOpenFilters={() => {
              setSelectedId(null);
              list.openFilters();
            }}
            onOpenSort={() => {
              setSelectedId(null);
              list.openSort();
            }}
            disabled={false}
            className="px-4 pt-4"
          />

          <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
            {!feedMerged && pendingPreview.length > 0 ? (
              <div className="flex w-full flex-col gap-4 md:max-w-lg">
                <PendingProspectsFeedBar
                  pendingCount={pendingPreview.length}
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
                      actions={actionsFor(prospect)}
                      entityLabel={labels.entitySingular}
                      onClick={() => {
                        list.closePanels();
                        setPanelView("profile");
                        setSelectedId(prospect._id);
                        onViewChange?.("profile");
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </PageContent>
      </PageLayout>

      {selectedProspect ? (
        <DemoProspectPanel
          key={`${selectedId}:${panelView}`}
          prospect={selectedProspect}
          actions={actionsFor(selectedProspect)}
          initialView={panelView}
          presentation={presentation}
          editorialScenario={editorialScenario}
          onBack={() => {
            setSelectedId(null);
            onViewChange?.("prospects");
          }}
        />
      ) : null}

      <DemoProspectListPanels list={list} />
    </div>
  );
}
