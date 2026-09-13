"use client";

import * as React from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  areProspectListFiltersEqual,
  cloneProspectListFilters,
  createDefaultProspectListFilters,
  getProspectListActiveFilterCount,
} from "@/features/prospects/lib/prospectListFilters";
import {
  DEFAULT_PROSPECT_LIST_SORT,
  type ProspectListSortOption,
} from "@/features/prospects/lib/prospectListSort";
import {
  ProspectListFilterPanel,
  ProspectListSortPanel,
} from "@/features/prospects";
import { DESKTOP_PANEL_BORDER_CLASS_NAME } from "@/features/webapp/ui/components";
import { USE_CASE_DEMO_REFERENCE_TIME } from "../useCaseDemoData";
import { filterAndSortDemoProspects } from "./prospectListShared";

export function useDemoProspectList(
  prospects: Doc<"prospects">[],
  query: string,
  status: Doc<"prospects">["status"]
) {
  const defaults = React.useMemo(
    () => createDefaultProspectListFilters([0, 100]),
    []
  );
  const [filters, setFilters] = React.useState(defaults);
  const [draft, setDraft] = React.useState(defaults);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [sortOpen, setSortOpen] = React.useState(false);
  const [sort, setSort] = React.useState<ProspectListSortOption>(
    DEFAULT_PROSPECT_LIST_SORT
  );
  const [draftSort, setDraftSort] = React.useState(sort);
  return {
    prospects: React.useMemo(
      () =>
        filterAndSortDemoProspects(
          prospects,
          query,
          filters,
          sort,
          new Date(USE_CASE_DEMO_REFERENCE_TIME)
        ),
      [prospects, query, filters, sort]
    ),
    activeFilterCount: getProspectListActiveFilterCount(filters, defaults),
    sortActive: sort !== DEFAULT_PROSPECT_LIST_SORT,
    closePanels: () => {
      setFilterOpen(false);
      setSortOpen(false);
    },
    openFilters: () => {
      setSortOpen(false);
      setDraft(cloneProspectListFilters(filters));
      setFilterOpen(true);
    },
    openSort: () => {
      setFilterOpen(false);
      setDraftSort(sort);
      setSortOpen(true);
    },
    filterProps: {
      open: filterOpen,
      onClose: () => setFilterOpen(false),
      onApply: () => {
        setFilters(cloneProspectListFilters(draft));
        setFilterOpen(false);
      },
      onReset: () => {
        setDraft(defaults);
        setFilters(defaults);
        setFilterOpen(false);
      },
      canApply: !areProspectListFiltersEqual(draft, filters),
      canReset: !areProspectListFiltersEqual(draft, defaults),
      workspaceId: null,
      status,
      defaultFilters: defaults,
      draftFilters: draft,
      onDraftFiltersChange: setDraft,
      className: DESKTOP_PANEL_BORDER_CLASS_NAME,
    },
    sortProps: {
      open: sortOpen,
      onClose: () => setSortOpen(false),
      onApply: () => {
        setSort(draftSort);
        setSortOpen(false);
      },
      onReset: () => {
        setDraftSort(DEFAULT_PROSPECT_LIST_SORT);
        setSort(DEFAULT_PROSPECT_LIST_SORT);
        setSortOpen(false);
      },
      canApply: draftSort !== sort,
      canReset: draftSort !== DEFAULT_PROSPECT_LIST_SORT,
      draftSort,
      onDraftSortChange: setDraftSort,
      className: DESKTOP_PANEL_BORDER_CLASS_NAME,
    },
  };
}

export function DemoProspectListPanels({
  list,
}: {
  list: ReturnType<typeof useDemoProspectList>;
}) {
  return (
    <>
      <ProspectListFilterPanel {...list.filterProps} />
      <ProspectListSortPanel {...list.sortProps} />
    </>
  );
}
