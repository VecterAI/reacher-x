"use client";

import { useCallback } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import {
  getWorkspaceUseCase,
  type WorkspaceUseCaseKey,
} from "@/shared/lib/workspaceUseCases";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import { AnimatedElapsedTimer } from "@/shared/ui/components/AnimatedElapsedTimer";
import { Button } from "@/shared/ui/components/Button";
import { InlineFeatureStrip } from "@/shared/ui/components/InlineFeatureStrip";
import { ChangeHistoryIcon, OpenInNewIcon } from "@/shared/ui/components/icons";
import {
  IDEAL_CUSTOMER_PROFILE_LIST_CLASS_NAME,
  IdealCustomerProfileCard,
} from "@/features/prospects/ui/components/ideal-customer-profile";
import { InlineProgressCard } from "./InlineProgressCard";

const PANEL_ANCHOR_ID = "rx-onboarding-panel";

type SetupInputPhase =
  | "collecting_input"
  | "generating_icps"
  | "awaiting_icp_approval"
  | "provisioning_preview_workspace"
  | "discovering_preview_prospects"
  | "preview_search_in_progress"
  | "awaiting_preview_approval"
  | null;

type GeneratedProfile = {
  title: string;
  description: string;
  painPoints: string[];
  channels: string[];
  syntheticPosts?: string[];
  qualificationKeywords?: string[];
};

type SetupOnboardingInlineCardProps = {
  sessionId: Id<"workspaceSetupSessions">;
  mode: "first_workspace" | "new_workspace";
  useCaseKey: WorkspaceUseCaseKey;
  title: string;
  stepNumber: number;
  stepTotal: number;
  inputPhase: SetupInputPhase;
  generatedProfiles: GeneratedProfile[];
  previewProgress: {
    discoveredCount: number;
    qualifiedCount: number;
    enrichedCount: number;
    selectedCount: number;
  };
  statusUpdatedAt: number;
  className?: string;
  onContinue?: () => void;
  onApproveIdealProfiles?: () => void;
};

export function SetupOnboardingInlineCard({
  useCaseKey,
  title,
  stepNumber,
  stepTotal,
  inputPhase,
  generatedProfiles,
  previewProgress,
  statusUpdatedAt,
  className,
  onContinue,
  onApproveIdealProfiles,
}: SetupOnboardingInlineCardProps) {
  const useCase = getWorkspaceUseCase(useCaseKey);
  const profileLabelPluralLower = useCase.profileLabelPlural.toLowerCase();
  const entityPluralLower = useCase.entityPlural.toLowerCase();
  const progress =
    stepTotal > 0 ? Math.min(100, (stepNumber / stepTotal) * 100) : 0;

  const scrollToPanel = useCallback(() => {
    document
      .getElementById(PANEL_ANCHOR_ID)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const handleOpenPanel = useCallback(() => {
    onContinue?.();
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(scrollToPanel);
    });
  }, [onContinue, scrollToPanel]);

  if (inputPhase === "generating_icps") {
    return (
      <InlineProgressCard
        title={`Building ${profileLabelPluralLower}`}
        progress={45}
        className={className}
        status={
          <AsciiSpinnerText
            text={`Turning your description into ${profileLabelPluralLower}…`}
            variant="spinner"
            className="text-muted-foreground text-xs"
          />
        }
      />
    );
  }

  if (inputPhase === "awaiting_icp_approval") {
    return (
      <div className={className}>
        <section className="space-y-3" aria-label={useCase.profileLabelPlural}>
          <p className="text-muted-foreground text-xs font-medium">
            {useCase.profileLabelPlural}
          </p>
          <div className="flex flex-col gap-3">
            {generatedProfiles.map((profile) => (
              <IdealCustomerProfileCard
                key={profile.title}
                profile={profile}
                maxPainBadges={2}
                className={IDEAL_CUSTOMER_PROFILE_LIST_CLASS_NAME}
              />
            ))}
          </div>
        </section>
        <InlineFeatureStrip
          className="mt-2"
          leading={
            <>
              <div className="border-border shrink-0 rounded-md border p-1">
                <ChangeHistoryIcon className="text-foreground size-4 fill-current" />
              </div>
              <span className="min-w-0 truncate text-sm font-medium">
                Review required →
              </span>
            </>
          }
          trailing={
            <>
              <Button type="button" size="xs" onClick={onApproveIdealProfiles}>
                Approve
              </Button>
              <Button
                type="button"
                size="xsIcon"
                variant="outline"
                aria-label="Open ideal profile review"
                onClick={handleOpenPanel}
              >
                <OpenInNewIcon className="fill-current" />
              </Button>
            </>
          }
        />
      </div>
    );
  }

  if (
    inputPhase === "provisioning_preview_workspace" ||
    inputPhase === "discovering_preview_prospects" ||
    inputPhase === "preview_search_in_progress"
  ) {
    const completed = Math.max(
      previewProgress.selectedCount,
      previewProgress.enrichedCount,
      previewProgress.qualifiedCount
    );
    const previewProgressPercent = Math.min(90, 35 + completed * 15);

    return (
      <InlineProgressCard
        title={`Finding preview ${entityPluralLower}`}
        progress={previewProgressPercent}
        className={className}
        headerAction={
          <AsciiSpinnerText
            variant="spinner"
            className="text-muted-foreground block font-mono text-sm leading-5"
          />
        }
        status={
          <AnimatedElapsedTimer
            startedAt={statusUpdatedAt}
            className="text-muted-foreground text-xs tabular-nums"
          />
        }
        footerAction={
          <Button type="button" size="xs" onClick={handleOpenPanel}>
            Open
          </Button>
        }
      />
    );
  }

  if (inputPhase === "awaiting_preview_approval") {
    return null;
  }

  return (
    <InlineProgressCard
      title={title}
      progress={progress}
      className={className}
      status={
        <p>
          Step{" "}
          <span className="text-foreground font-mono tabular-nums">
            {stepNumber}/{stepTotal}
          </span>
        </p>
      }
      footerAction={
        <Button type="button" size="xs" onClick={handleOpenPanel}>
          Open
        </Button>
      }
    />
  );
}

export { PANEL_ANCHOR_ID };
