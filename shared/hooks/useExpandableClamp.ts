"use client";

import * as React from "react";

export function useExpandableClamp(text: string, expanded: boolean) {
  const textRef = React.useRef<HTMLSpanElement | null>(null);
  const [canExpand, setCanExpand] = React.useState(false);

  React.useEffect(() => {
    const node = textRef.current;
    if (!node || expanded) {
      return;
    }

    const measure = () => {
      const currentNode = textRef.current;
      if (!currentNode) {
        return;
      }

      setCanExpand(currentNode.scrollHeight > currentNode.clientHeight + 1);
    };

    measure();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => measure())
        : null;
    resizeObserver?.observe(node);
    window.addEventListener("resize", measure);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [expanded, text]);

  return {
    canExpand,
    textRef,
  };
}
