"use client";

import { useId, useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/components/Command";
import { Label } from "@/shared/ui/components/Label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/components/Popover";
import {
  WORKSPACE_USE_CASE_KEYS,
  workspaceUseCaseRegistry,
  type WorkspaceUseCaseKey,
} from "@/shared/lib/workspaceUseCases";

const OPTIONS = WORKSPACE_USE_CASE_KEYS.map((key) => ({
  value: key,
  label: workspaceUseCaseRegistry[key].displayName,
}));

export interface WorkspaceUseCaseComboboxProps {
  id?: string;
  value: WorkspaceUseCaseKey;
  onValueChange: (next: WorkspaceUseCaseKey) => void;
  disabled?: boolean;
  className?: string;
}

export function WorkspaceUseCaseCombobox({
  id: idProp,
  value,
  onValueChange,
  disabled,
  className,
}: WorkspaceUseCaseComboboxProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [open, setOpen] = useState(false);
  const label = useMemo(
    () => OPTIONS.find((o) => o.value === value)?.label ?? value,
    [value]
  );

  return (
    <div className={cn("space-y-0", className)}>
      <Label className="text-foreground mb-2.5 block" htmlFor={id}>
        Who to find/reach
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="border-input bg-background hover:bg-background w-full justify-between px-3 font-normal"
          >
            <span className="truncate">{label}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="border-input w-(--radix-popover-trigger-width) p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Search use case..." />
            <CommandList>
              <CommandEmpty>No match.</CommandEmpty>
              <CommandGroup>
                {OPTIONS.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    onSelect={() => {
                      onValueChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    {opt.label}
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        value === opt.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
