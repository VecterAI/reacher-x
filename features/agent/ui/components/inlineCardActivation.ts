"use client";

import * as React from "react";

export function shouldIgnoreInlineCardClick(
  event: React.MouseEvent<HTMLElement>
): boolean {
  const hasSelection =
    typeof window !== "undefined" && !!window.getSelection()?.toString();

  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    hasSelection ||
    event.detail > 1
  );
}
