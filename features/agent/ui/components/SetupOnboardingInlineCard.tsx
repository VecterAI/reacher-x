"use client";

import type { Doc } from "@/convex/_generated/dataModel";
import type { SetupInputPhase } from "@/convex/lib/setupFlowCore";
import {
  getWorkspaceUseCase,
  type WorkspaceUseCaseKey,
} from "@/shared/lib/workspaceUseCases";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import { Button } from "@/shared/ui/components/Button";
import { InlineProgressCard } from "./InlineProgressCard";

export const PANEL_ANCHOR_ID = "rx-onboarding-panel";

export function SetupOnboardingInlineCard({
  useCaseKey,
  title,
  stepNumber,
  stepTotal,
  inputPhase,
  generatedProfiles,
  className,
  onContinue,
  errorMessage,
  onRetry,
}: {
  useCaseKey: WorkspaceUseCaseKey;
  title: string;
  stepNumber: number;
  stepTotal: number;
  inputPhase: SetupInputPhase;
  generatedProfiles: NonNullable<Doc<"workspaces">["icps"]>;
  className?: string;
  onContinue?: () => void;
  errorMessage?: string | null;
  onRetry?: () => void;
}) {
  const labels = getWorkspaceUseCase(useCaseKey);
  const entities = labels.entityPlural.toLowerCase();
  if (errorMessage)
    return (
      <InlineProgressCard
        title={`Couldn't generate example ${entities}`}
        progress={0}
        className={className}
        status={
          <span role="alert">
            Your description is saved. Try again, or tell Agent what to change.
          </span>
        }
        footerAction={
          onRetry ? (
            <Button size="xs" onClick={onRetry}>
              Retry
            </Button>
          ) : undefined
        }
      />
    );
  if (inputPhase === "generating_icps")
    return (
      <InlineProgressCard
        title={`Creating example ${entities}`}
        progress={45}
        className={className}
        status={
          <AsciiSpinnerText
            text="Working..."
            className="text-muted-foreground text-xs"
          />
        }
      />
    );
  const reviewing = inputPhase === "awaiting_icp_approval";
  const count = generatedProfiles.reduce(
    (total, profile) => total + (profile.syntheticExamples?.length ?? 0),
    0
  );
  return (
    <InlineProgressCard
      title={reviewing ? `Example ${entities}` : title}
      progress={reviewing ? 100 : (stepNumber / Math.max(1, stepTotal)) * 100}
      className={className}
      status={
        reviewing
          ? `${count} ${count === 1 ? labels.entitySingular.toLowerCase() : entities} ready to review`
          : `Step ${stepNumber} of ${stepTotal}`
      }
      footerAction={
        onContinue ? (
          <Button size="xs" onClick={onContinue}>
            {reviewing ? "Review" : title}
          </Button>
        ) : undefined
      }
    />
  );
}
