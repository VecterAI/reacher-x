"use client";

import { useCallback, useMemo, useState } from "react";

import {
  areProspectListSortsEqual,
  DEFAULT_PROSPECT_LIST_SORT,
  hasActiveProspectListSort,
  type ProspectListSortOption,
} from "../lib/prospectListSort";

export function useProspectListSort(
  defaultSort: ProspectListSortOption = DEFAULT_PROSPECT_LIST_SORT
) {
  const [appliedSort, setAppliedSort] =
    useState<ProspectListSortOption>(defaultSort);
  const [draftSort, setDraftSort] =
    useState<ProspectListSortOption>(defaultSort);
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    setDraftSort(appliedSort);
    setIsOpen(true);
  }, [appliedSort]);

  const close = useCallback(() => {
    setDraftSort(appliedSort);
    setIsOpen(false);
  }, [appliedSort]);

  const apply = useCallback(() => {
    setAppliedSort(draftSort);
    setIsOpen(false);
  }, [draftSort]);

  const reset = useCallback(() => {
    setAppliedSort(defaultSort);
    setDraftSort(defaultSort);
  }, [defaultSort]);

  const canApply = useMemo(
    () => !areProspectListSortsEqual(draftSort, appliedSort),
    [appliedSort, draftSort]
  );

  const canReset = useMemo(
    () =>
      !areProspectListSortsEqual(draftSort, defaultSort) ||
      !areProspectListSortsEqual(appliedSort, defaultSort),
    [appliedSort, defaultSort, draftSort]
  );

  const isActive = useMemo(
    () => hasActiveProspectListSort(appliedSort),
    [appliedSort]
  );

  return {
    appliedSort,
    draftSort,
    setDraftSort,
    isOpen,
    open,
    close,
    apply,
    reset,
    canApply,
    canReset,
    isActive,
  };
}
