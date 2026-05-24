"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  areProspectListFiltersEqual,
  cloneProspectListFilters,
  getProspectListActiveFilterCount,
  getProspectListFilterSummaryTokens,
  type ProspectListFilters,
} from "../lib/prospectListFilters";

export function useProspectListFilters(defaultFilters: ProspectListFilters) {
  const [appliedFilters, setAppliedFilters] = useState(() =>
    cloneProspectListFilters(defaultFilters)
  );
  const [draftFilters, setDraftFilters] = useState(() =>
    cloneProspectListFilters(defaultFilters)
  );
  const [isOpen, setIsOpen] = useState(false);
  const previousDefaultsRef = useRef(defaultFilters);

  useEffect(() => {
    const previousDefaults = previousDefaultsRef.current;
    previousDefaultsRef.current = defaultFilters;

    setAppliedFilters((current) => {
      if (areProspectListFiltersEqual(current, previousDefaults)) {
        return cloneProspectListFilters(defaultFilters);
      }
      return current;
    });

    setDraftFilters((current) => {
      if (areProspectListFiltersEqual(current, previousDefaults) || !isOpen) {
        return cloneProspectListFilters(defaultFilters);
      }
      return current;
    });
  }, [defaultFilters, isOpen]);

  const open = useCallback(() => {
    setDraftFilters(cloneProspectListFilters(appliedFilters));
    setIsOpen(true);
  }, [appliedFilters]);

  const close = useCallback(() => {
    setDraftFilters(cloneProspectListFilters(appliedFilters));
    setIsOpen(false);
  }, [appliedFilters]);

  const apply = useCallback(() => {
    setAppliedFilters(cloneProspectListFilters(draftFilters));
    setIsOpen(false);
  }, [draftFilters]);

  const reset = useCallback(() => {
    const nextDefaults = cloneProspectListFilters(defaultFilters);
    setAppliedFilters(nextDefaults);
    setDraftFilters(cloneProspectListFilters(defaultFilters));
  }, [defaultFilters]);

  const canApply = useMemo(
    () => !areProspectListFiltersEqual(draftFilters, appliedFilters),
    [appliedFilters, draftFilters]
  );

  const canReset = useMemo(
    () =>
      !areProspectListFiltersEqual(draftFilters, defaultFilters) ||
      !areProspectListFiltersEqual(appliedFilters, defaultFilters),
    [appliedFilters, defaultFilters, draftFilters]
  );

  const activeFilterCount = useMemo(
    () => getProspectListActiveFilterCount(appliedFilters, defaultFilters),
    [appliedFilters, defaultFilters]
  );

  const draftSummaryTokens = useMemo(
    () => getProspectListFilterSummaryTokens(draftFilters, defaultFilters),
    [defaultFilters, draftFilters]
  );

  return {
    appliedFilters,
    draftFilters,
    setDraftFilters,
    isOpen,
    open,
    close,
    apply,
    reset,
    canApply,
    canReset,
    activeFilterCount,
    draftSummaryTokens,
  };
}
