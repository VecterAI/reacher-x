"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import { Button } from "@/shared/ui/components/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/components/AlertDialog";
import {
  DeleteIcon,
  MoreHorizIcon,
  RefreshIcon,
} from "@/shared/ui/components/icons";

type SetupOnboardingCardMenuProps = {
  onConfirmReset: () => void | Promise<void>;
  onConfirmDeleteDraft: () => void | Promise<void>;
  className?: string;
};

export function SetupOnboardingCardMenu({
  onConfirmReset,
  onConfirmDeleteDraft,
  className,
}: SetupOnboardingCardMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const deferDialogOpen = useCallback((dialog: "reset" | "delete") => {
    setMenuOpen(false);
    setResetOpen(false);
    setDeleteOpen(false);

    window.requestAnimationFrame(() => {
      if (dialog === "reset") {
        setResetOpen(true);
        return;
      }
      setDeleteOpen(true);
    });
  }, []);

  useLayoutEffect(() => {
    return () => {
      setMenuOpen(false);
      setResetOpen(false);
      setDeleteOpen(false);
    };
  }, []);

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="xsIcon"
            variant="outline"
            className={className}
            aria-label="Setup actions"
          >
            <MoreHorizIcon className="fill-muted-foreground" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuLabel>↳ Menu</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              deferDialogOpen("reset");
            }}
          >
            <RefreshIcon className="fill-current" aria-hidden />
            Reset
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              deferDialogOpen("delete");
            }}
          >
            <DeleteIcon className="fill-current" aria-hidden />
            Delete draft
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset onboarding?</AlertDialogTitle>
            <AlertDialogDescription>
              This discards the current draft and starts a new setup from step
              one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setResetOpen(false);
                void onConfirmReset();
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              The draft will be removed. If you already have a workspace, you
              will return to it; otherwise setup starts again from step one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDeleteOpen(false);
                void onConfirmDeleteDraft();
              }}
            >
              Delete draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
