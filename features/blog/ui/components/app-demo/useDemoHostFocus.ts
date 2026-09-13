"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

/** Keep scripted app controls from taking focus away from a website overlay. */
export function useDemoHostFocus(
  root: RefObject<HTMLElement | null>,
  send: (type: string, extra: { active: boolean }) => void
) {
  const previous = useRef<boolean | undefined>(undefined);
  const sync = useCallback(
    (force = false) => {
      const active = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[role="menu"], [role="listbox"], [role="dialog"], [role="alertdialog"]'
        )
      ).some(
        (overlay) =>
          !root.current?.contains(overlay) &&
          overlay.dataset.state !== "closed" &&
          !overlay.closest('[hidden], [aria-hidden="true"], [inert]') &&
          overlay.getClientRects().length > 0
      );
      if (force || previous.current !== active) {
        previous.current = active;
        send("reacherx:host-focus", { active });
      }
    },
    [root, send]
  );
  useEffect(() => {
    const observer = new MutationObserver(() => sync());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["role", "data-state", "hidden", "aria-hidden", "inert"],
    });
    sync(true);
    return () => observer.disconnect();
  }, [sync]);
  return sync;
}
