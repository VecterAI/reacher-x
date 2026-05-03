"use client";

import { useCallback, useState, type KeyboardEvent } from "react";
import { Button } from "@/shared/ui/components/Button";
import { Badge } from "@/shared/ui/components/Badge";
import { Input } from "@/shared/ui/components/Input";
import { AddIcon, CloseIcon } from "@/shared/ui/components/icons";
import { cn } from "@/shared/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/components/Dialog";

export interface WorkspaceIcpPainPointsFieldProps {
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}

/**
 * Editable pain points as a horizontal badge row (ProspectCard footer pattern)
 * plus a compact add row.
 */
export function WorkspaceIcpPainPointsField({
  value,
  onChange,
  className,
}: WorkspaceIcpPainPointsFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const add = useCallback(() => {
    const t = draft.trim();
    if (!t) return;
    if (value.includes(t)) {
      setDraft("");
      return;
    }
    onChange([...value, t]);
    setDraft("");
    setOpen(false);
  }, [draft, onChange, value]);

  const removeAt = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [onChange, value]
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        add();
      }
    },
    [add]
  );

  return (
    <>
      <div className={cn("flex flex-col gap-2", className)}>
        {value.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {value.map((p, i) => (
              <Badge
                key={`${p}-${i}`}
                variant="outline"
                className="text-foreground inline-flex max-w-full items-center gap-0.5 rounded-md py-0.5 pr-1 pl-2.5 font-normal"
              >
                <span className="wrap-break-word">{p}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xsIcon"
                  className="size-4 shrink-0"
                  aria-label={`Remove ${p}`}
                  onClick={() => removeAt(i)}
                >
                  <CloseIcon className="size-2.5 fill-current" />
                </Button>
              </Badge>
            ))}
          </div>
        )}
        <Button
          type="button"
          className="w-fit"
          variant="outline"
          size="xs"
          onClick={() => setOpen(true)}
        >
          <AddIcon className="fill-current" />
          Add
        </Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setDraft("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add pain point</DialogTitle>
            <DialogDescription>
              Add a specific pain point this profile is dealing with.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type the pain point"
              autoFocus
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => {
                  setOpen(false);
                  setDraft("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" size="xs" disabled={!draft.trim()}>
                Add pain point
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
