"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

/** Keep scripted controls from taking focus while the host owns navigation. */
export function useDemoHostFocus(
  root: RefObject<HTMLElement | null>,
  send: (type: string, extra: { active: boolean }) => void,
  suppressFocus = false,
  observedRoot?: HTMLElement | null,
  expanded = false
) {
  const previous = useRef<boolean | undefined>(undefined);
  const visible = useRef(true);
  const scrolling = useRef(false);
  const sync = useCallback(
    (force = false) => {
      const active =
        suppressFocus ||
        (!expanded && !visible.current) ||
        scrolling.current ||
        Array.from(
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
    [root, send, suppressFocus, expanded]
  );
  useEffect(() => {
    // A visibility/fullscreen change disposes the previous scroll-end timer.
    // Do not carry its temporary focus lock into the new observer lifecycle.
    scrolling.current = false;
    let scrollEnd: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      scrolling.current = true;
      sync();
      clearTimeout(scrollEnd);
      scrollEnd = setTimeout(() => {
        scrolling.current = false;
        sync();
      }, 200);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const observer = new MutationObserver(() => sync());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["role", "data-state", "hidden", "aria-hidden", "inert"],
    });
    const visibility = new IntersectionObserver((entries) => {
      visible.current = entries.at(-1)?.isIntersecting ?? false;
      sync();
    });
    const node = observedRoot ?? root.current;
    if (node) visibility.observe(node);
    sync(true);
    return () => {
      observer.disconnect();
      visibility.disconnect();
      window.removeEventListener("scroll", onScroll);
      clearTimeout(scrollEnd);
    };
  }, [root, sync, observedRoot]);
  return sync;
}
