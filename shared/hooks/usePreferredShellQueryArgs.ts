"use client";

import { useMemo } from "react";
import { useStore } from "@nanostores/react";
import { $preferredShellContext } from "@/shared/stores/preferredShellContext";

export function usePreferredShellQueryArgs() {
  const preferredShellContext = useStore($preferredShellContext);

  return useMemo(
    () =>
      preferredShellContext
        ? { preferredContext: preferredShellContext }
        : {},
    [preferredShellContext]
  );
}
