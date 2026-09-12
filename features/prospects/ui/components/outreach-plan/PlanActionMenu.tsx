"use client";

import * as React from "react";
import { Button } from "@/shared/ui/components/Button";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";
import {
  DeleteIcon,
  EditIcon,
  MoreHorizIcon,
} from "@/shared/ui/components/icons";

interface PlanActionMenuProps {
  onEdit?: () => void;
  onDelete?: () => void | Promise<void>;
  disabled?: boolean;
  align?: "start" | "center" | "end";
  ariaLabel?: string;
}

export function PlanActionMenu({
  onEdit,
  onDelete,
  disabled = false,
  align = "end",
  ariaLabel = "Plan menu",
}: PlanActionMenuProps) {
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const isMountedRef = React.useRef(true);

  React.useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    []
  );

  if (!onEdit && !onDelete) {
    return null;
  }

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete();
      if (isMountedRef.current) {
        setDeleteOpen(false);
      }
    } finally {
      if (isMountedRef.current) {
        setIsDeleting(false);
      }
    }
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            size="xsIcon"
            variant="outline"
            disabled={disabled}
            aria-label={ariaLabel}
            title={ariaLabel}
          >
            <MoreHorizIcon className="fill-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="min-w-44">
          <DropdownMenuLabel>↳ Menu</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {onEdit ? (
            <DropdownMenuItem
              disabled={disabled}
              onSelect={(event) => {
                event.preventDefault();
                onEdit();
              }}
            >
              <EditIcon className="fill-current" />
              Edit
            </DropdownMenuItem>
          ) : null}
          {onDelete ? (
            <DropdownMenuItem
              disabled={disabled}
              onSelect={(event) => {
                event.preventDefault();
                setDeleteOpen(true);
              }}
            >
              <DeleteIcon className="fill-current" />
              Delete
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the outreach plan, its tasks, and any
              pending approvals or notifications tied to it. If it is currently
              running, execution will be stopped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="xs" disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              size="xs"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
