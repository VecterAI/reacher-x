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
import { Button } from "@/shared/ui/components/Button";

export interface LinkedInConnectNoticeDialogProps {
  open: boolean;
  isSubmitting?: boolean;
  onCancel: () => void;
  onContinue: () => void;
  onOpenPasswordReset: () => void;
}

export function LinkedInConnectNoticeDialog({
  open,
  isSubmitting = false,
  onCancel,
  onContinue,
  onOpenPasswordReset,
}: LinkedInConnectNoticeDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle>Connect LinkedIn</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <span className="block">
              If your LinkedIn account was created with Google, the normal
              LinkedIn sign-in may fail unless you already have a LinkedIn
              password.
            </span>
            <span className="block">
              If you do not know your LinkedIn password, set or reset it first,
              then come back and connect LinkedIn here.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </AlertDialogCancel>
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={isSubmitting}
            onClick={onOpenPasswordReset}
          >
            Set/reset password
          </Button>
          <AlertDialogAction disabled={isSubmitting} onClick={onContinue}>
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
