"use client";

import { Progress } from "@/shared/ui/components/Progress";
import { cn } from "@/shared/lib/utils";
import { useWorkspaceTransition } from "@/features/webapp/contexts/WorkspaceTransitionContext";

export function WorkspaceTransitionBar() {
  const { isTransitioning, progress } = useWorkspaceTransition();

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed top-12 right-0 left-0 z-30 transition-opacity duration-200",
        isTransitioning ? "opacity-100" : "opacity-0"
      )}
    >
      <Progress value={progress} className="h-0.5 rounded-none border-0" />
    </div>
  );
}
