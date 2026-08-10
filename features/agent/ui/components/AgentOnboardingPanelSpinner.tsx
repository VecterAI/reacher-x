"use client";

import { cn } from "@/shared/lib/utils";
import { Spinner } from "@/shared/ui/components/Spinner";
import { DESKTOP_PANEL_BORDER_CLASS_NAME } from "@/features/webapp/ui/components/page/PageLayout";

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
        "bg-background flex h-full min-h-0 w-full max-w-lg flex-1 overflow-hidden md:min-w-0",
        DESKTOP_PANEL_BORDER_CLASS_NAME,
        className
      )}
    >
      <div className="flex h-full min-h-0 w-full items-center justify-center">
        <Spinner
          variant="circle"
          className="size-5"
          aria-label="Loading onboarding draft"
        />
      </div>
    </aside>
  );
}
