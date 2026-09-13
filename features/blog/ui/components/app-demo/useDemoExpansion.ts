"use client";

import { useEffect, type RefObject } from "react";

export function useDemoExpansion(
  root: RefObject<HTMLElement | null>,
  expanded: boolean,
  setExpanded: (value: boolean) => void
) {
  useEffect(() => {
    if (!expanded) return;
    const before = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const inertSiblings: Array<{ node: HTMLElement; inert: boolean }> = [];
    let ancestor: HTMLElement | null = root.current;
    while (ancestor && ancestor !== document.body) {
      for (const sibling of Array.from(
        ancestor.parentElement?.children ?? []
      )) {
        if (sibling !== ancestor && sibling instanceof HTMLElement) {
          inertSiblings.push({ node: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
      ancestor = ancestor.parentElement;
    }
    root.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
      if (event.key === "Tab") {
        const controls = root.current?.querySelectorAll<HTMLElement>(
          "button,iframe,input"
        );
        if (!controls?.length) return;
        if (
          event.shiftKey &&
          (document.activeElement === controls[0] ||
            document.activeElement === root.current)
        ) {
          event.preventDefault();
          controls[controls.length - 1].focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === controls[controls.length - 1]
        ) {
          event.preventDefault();
          controls[0].focus();
        }
      }
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = previousOverflow;
      inertSiblings.forEach(({ node, inert }) => {
        node.inert = inert;
      });
      document.removeEventListener("keydown", escape);
      if (before instanceof HTMLElement) before.focus();
    };
  }, [expanded, root, setExpanded]);
}
