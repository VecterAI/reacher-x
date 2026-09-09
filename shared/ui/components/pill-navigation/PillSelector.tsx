"use client";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/shared/ui/components/ToggleGroup";
import { pillClassName, pillListClassName } from "./Pill";
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
  return (
    <div className="scroll-fade-x max-w-full scrollbar-none overflow-x-auto">
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
