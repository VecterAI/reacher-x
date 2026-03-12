"use client";

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

interface NewWorkspaceDraftModalProps {
  draftLabel: string;
  isSubmitting: boolean;
  open: boolean;
  onCancel: () => void;
  onContinueDraft: () => void;
  onDiscardAndStartFresh: () => void;
}

export function NewWorkspaceDraftModal({
  draftLabel,
  isSubmitting,
  open,
  onCancel,
  onContinueDraft,
  onDiscardAndStartFresh,
}: NewWorkspaceDraftModalProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && onCancel()}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader className="space-y-3 text-left">
          <AlertDialogTitle>Unfinished workspace draft</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              You already have an unfinished setup draft:
            </span>
            <span className="text-foreground block font-medium">
              {draftLabel}
            </span>
            <span className="block">
              Continue editing that draft, or discard it and start a new
              workspace from scratch.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:flex-col sm:space-x-0">
          <AlertDialogAction
            className="w-full"
            disabled={isSubmitting}
            onClick={onContinueDraft}
          >
            Continue draft
          </AlertDialogAction>
          <AlertDialogAction
            variant="outline"
            className="w-full"
            disabled={isSubmitting}
            onClick={onDiscardAndStartFresh}
          >
            Discard draft and start fresh
          </AlertDialogAction>
          <AlertDialogCancel
            className="w-full"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            Cancel
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
