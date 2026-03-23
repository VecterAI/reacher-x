"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import { Button } from "@/shared/ui/components/Button";
import { Card, CardContent } from "@/shared/ui/components/Card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";
import { Progress } from "@/shared/ui/components/Progress";
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
import { MoreHorizontal } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import type { WorkspaceUseCaseKey } from "@/shared/lib/workspaceUseCases";

const PANEL_ANCHOR_ID = "rx-onboarding-panel";

type SetupSessionMode = "first_workspace" | "new_workspace";

type SetupOnboardingInlineCardProps = {
  sessionId: Id<"workspaceSetupSessions">;
  mode: SetupSessionMode;
  useCaseKey: WorkspaceUseCaseKey;
  title: string;
  stepNumber: number;
  stepTotal: number;
  className?: string;
  /** Opens the onboarding side panel (e.g. desktop split view); scroll runs after it mounts */
  onContinue?: () => void;
};

export function SetupOnboardingInlineCard({
  sessionId,
  mode,
  useCaseKey,
  title,
  stepNumber,
  stepTotal,
  className,
  onContinue,
}: SetupOnboardingInlineCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const discardSetupSession = useMutation(
    api.setupSessions.discardSetupSession
  );
  const startSetupSession = useMutation(api.setupSessions.startSetupSession);

  const progress =
    stepTotal > 0 ? Math.min(100, (stepNumber / stepTotal) * 100) : 0;

  const scrollToPanel = useCallback(() => {
    const el = document.getElementById(PANEL_ANCHOR_ID);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const handleContinueClick = useCallback(() => {
    onContinue?.();
    if (typeof window === "undefined") {
      return;
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scrollToPanel();
      });
    });
  }, [onContinue, scrollToPanel]);

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

  const handleReset = useCallback(async () => {
    setMenuOpen(false);
    setResetOpen(false);
    try {
      await discardSetupSession({ sessionId });
      const next = await startSetupSession({
        mode,
        useCaseKey,
      });
      router.push(
        `/agent/setup?sessionId=${next.sessionId}&threadId=${encodeURIComponent(next.threadId)}`
      );
      toast.success("Starting a fresh setup from step one.");
    } catch (error) {
      toast.error("Could not reset setup", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  }, [
    discardSetupSession,
    mode,
    router,
    sessionId,
    startSetupSession,
    useCaseKey,
  ]);

  const handleDeleteDraft = useCallback(async () => {
    setMenuOpen(false);
    setDeleteOpen(false);
    try {
      const result = await discardSetupSession({ sessionId });
      if (!result.hasDefaultWorkspace) {
        const next = await startSetupSession({
          mode,
          useCaseKey,
        });
        router.push(
          `/agent/setup?sessionId=${next.sessionId}&threadId=${encodeURIComponent(next.threadId)}`
        );
        toast.success("Draft removed. Starting setup again.");
        return;
      }
      router.push("/");
      toast.success("Draft removed. Switched back to your workspace.");
    } catch (error) {
      toast.error("Could not delete draft", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  }, [
    discardSetupSession,
    mode,
    router,
    sessionId,
    startSetupSession,
    useCaseKey,
  ]);

  return (
    <>
      <Card
        className={cn(
          "border-border overflow-hidden rounded-xl border shadow-none",
          className
        )}
      >
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-foreground min-w-0 flex-1 text-sm font-semibold">
              {title}
            </h3>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="xsIcon"
                  variant="ghost"
                  className="shrink-0"
                  aria-label="Setup actions"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    deferDialogOpen("reset");
                  }}
                >
                  Reset
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    deferDialogOpen("delete");
                  }}
                >
                  Delete draft
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Progress
            className="h-0.5 rounded-none"
            indicatorClassName="bg-foreground rounded-none"
            value={progress}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs">
              Step{" "}
              <span className="text-foreground font-mono tabular-nums">
                {stepNumber}/{stepTotal}
              </span>
            </p>
            <Button type="button" size="xs" onClick={handleContinueClick}>
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>

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
            <AlertDialogAction onClick={() => void handleReset()}>
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
            <AlertDialogAction onClick={() => void handleDeleteDraft()}>
              Delete draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export { PANEL_ANCHOR_ID };
