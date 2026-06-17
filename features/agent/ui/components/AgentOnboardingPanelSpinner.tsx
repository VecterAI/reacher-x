"use client";

import { cn } from "@/shared/lib/utils";
import { Spinner } from "@/shared/ui/components/Spinner";

interface AgentOnboardingPanelSpinnerProps {
  className?: string;
}

export function AgentOnboardingPanelSpinner({
  className,
}: AgentOnboardingPanelSpinnerProps) {
  return (
    <aside
      id="rx-onboarding-panel"
      className={cn(
        "bg-background flex h-full min-h-0 w-full max-w-lg flex-1 overflow-hidden md:min-w-0 md:border-r",
        className
      )}
    >
      <div className="flex h-full min-h-0 w-full items-center justify-center">
        <Spinner
          variant="circle"
          className="text-muted-foreground size-5"
          aria-label="Loading onboarding draft"
        />
      </div>
    </aside>
  );
}
