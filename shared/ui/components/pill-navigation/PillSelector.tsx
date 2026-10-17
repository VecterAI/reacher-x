"use client";
import { useEffect, useRef } from "react";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/shared/ui/components/ToggleGroup";
import { pillClassName, pillListClassName } from "./Pill";

/**
 * Single-choice pill row that scrolls horizontally. The active pill is
 * scrolled into view whenever `value` changes, so external drivers (e.g. a
 * synced carousel) keep the highlight visible without user interaction.
 */
export function PillSelector<T extends string>({
  items,
  value,
  onValueChange,
  label,
}: {
  items: readonly { value: T; label: string }[];
  value: T;
  onValueChange: (value: T) => void;
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>("[data-state=checked]");
    if (!active) return;
    // Compare viewport rects: offsetLeft would measure from the nearest
    // positioned ancestor, which may be far outside this container.
    const activeRect = active.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    if (activeRect.left < containerRect.left) {
      container.scrollLeft += activeRect.left - containerRect.left;
    } else if (activeRect.right > containerRect.right) {
      container.scrollLeft += activeRect.right - containerRect.right;
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="scroll-fade-x max-w-full scrollbar-none overflow-x-auto"
    >
      <ToggleGroup
        type="single"
        value={value}
        aria-label={label}
        className={pillListClassName}
        onValueChange={(next) => {
          const item = items.find((item) => item.value === next);
          if (item) onValueChange(item.value);
        }}
      >
        {items.map((item) => (
          <ToggleGroupItem
            key={item.value}
            value={item.value}
            className={pillClassName}
          >
            {item.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
