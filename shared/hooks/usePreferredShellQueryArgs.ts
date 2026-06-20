"use client";

import { useMemo } from "react";
import { usePreferredShellContext } from "@/shared/stores/preferredShellContext";

export function usePreferredShellQueryArgs() {
  const preferredShellContext = usePreferredShellContext();

  return useMemo(
    () =>
      preferredShellContext ? { preferredContext: preferredShellContext } : {},
    [preferredShellContext]
  );
}
