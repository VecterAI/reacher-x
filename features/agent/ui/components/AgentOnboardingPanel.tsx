"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@nanostores/react";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { buildSetupPreviewProfileData } from "@/features/agent/lib/setupPreviewProfileData";
import type { SetupInputMode } from "@/features/agent/lib/setupOnboarding";
import { EvidencePostsPanel, ProspectProfilePanel } from "@/features/prospects";
import { PageContent, PageHeader } from "@/features/webapp/ui/components";
import {
  useActiveUseCaseLabels,
  useQueryWithStatus,
  useSetupThreadDraft,
  useViewerUserRecord,
  useWorkspace,
} from "@/shared/hooks";
import {
  $setupUseCaseDraftKey,
  setSetupUseCaseDraftKey,
} from "@/shared/stores/setupUseCaseDraft";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { Button } from "@/shared/ui/components/Button";
import { Progress } from "@/shared/ui/components/Progress";
import { Card, CardContent } from "@/shared/ui/components/Card";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import { cn } from "@/shared/lib/utils";
import { getUrlFromWholeValue } from "@/shared/lib/urls/urlParsing";
import { ConnectionsStep } from "./onboarding/ConnectionsStep";
import { PlanStep } from "./onboarding/PlanStep";
import { PreferenceStep } from "./onboarding/PreferenceStep";
import { UseCaseStep } from "./onboarding/UseCaseStep";
import { WorkspaceInputStep } from "./onboarding/WorkspaceInputStep";
import { SETUP_PANEL_STEP_TITLES } from "@/features/agent/lib/setupOnboardingStepTitles";

const FALLBACK_VISIBLE_STEPS = [
  { id: "use_case", label: "Use case", stepNumber: 1 },
  { id: "input", label: "Input", stepNumber: 2 },
  { id: "connections", label: "Connections", stepNumber: 3 },
  { id: "plan", label: "Plan", stepNumber: 4 },
  { id: "preference", label: "Preferences", stepNumber: 5 },
] as const;

type VisibleStepRecord = {
  id: string;
  label: string;
  stepNumber: number;
};

type PanelStepId = (typeof FALLBACK_VISIBLE_STEPS)[number]["id"];

const STEP_TITLES: Record<PanelStepId, string> = SETUP_PANEL_STEP_TITLES;

interface AgentOnboardingPanelProps {
  className?: string;
  threadId?: string | null;
  /** Hides progress + step counter; used when panel is embedded from /workspace Refine. */
  embedRefine?: boolean;
  /** Called after preview approval when embedRefine (session discarded server-side). */
  onRefineComplete?: () => void;
  /** Cancel from Refine panel (workspace page exits edit mode). */
  onRefineCancel?: () => void | Promise<void>;
}

export function AgentOnboardingPanel({
  className,
  threadId,
  embedRefine = false,
  onRefineComplete,
  onRefineCancel,
}: AgentOnboardingPanelProps) {
  const router = useRouter();
  const optimisticUseCaseKey = useStore($setupUseCaseDraftKey);
  const { workspace } = useWorkspace();
  const { currentUser, isProvisioning: isViewerProvisioning } =
    useViewerUserRecord();
  const { activeUseCase, activeUseCaseKey } = useActiveUseCaseLabels();
  const { setupDraft: setupSession, isLoading: isSetupDraftLoading } =
    useSetupThreadDraft(threadId);
  const selectSetupSessionUseCase = useMutation(
    api.setupSessions.selectSetupSessionUseCase
  );
  const advanceSetupSessionFromUseCaseStep = useMutation(
    api.setupSessions.advanceSetupSessionFromUseCaseStep
  );
  const submitSetupInput = useMutation(api.setupSessions.submitSetupInput);
  const approveSetupGeneration = useMutation(
    api.setupSessions.approveSetupGeneration
  );
  const confirmSetupIcps = useMutation(api.setupSessions.confirmSetupIcps);
  const selectSetupPlan = useMutation(api.setupSessions.selectSetupPlan);
  const selectSetupPreference = useMutation(
    api.setupSessions.selectSetupPreference
  );
  const startCheckoutFlow = useAction(api.billing.startCheckoutFlow);
  const sessionId = setupSession?.sessionId ?? null;
  const visibleSteps: VisibleStepRecord[] = useMemo(
    () => setupSession?.visibleSteps ?? [...FALLBACK_VISIBLE_STEPS],
    [setupSession?.visibleSteps]
  );
  const visibleStepIds = useMemo(
    () => visibleSteps.map((step: VisibleStepRecord) => step.id as PanelStepId),
    [visibleSteps]
  );
  const canonicalStep = (setupSession?.currentStepId ??
    (embedRefine ? "input" : "use_case")) as PanelStepId;
  const [stepOverride, setStepOverride] = useState<PanelStepId | null>(null);
  const [openPreviewId, setOpenPreviewId] = useState<Id<"prospects"> | null>(
    null
  );
  const [previewEvidencePanel, setPreviewEvidencePanel] = useState<{
    title: string;
    posts: unknown[];
    platform: "twitter" | "linkedin";
  } | null>(null);
  const step =
    stepOverride && visibleStepIds.includes(stepOverride)
      ? stepOverride
      : canonicalStep;
  const [inputMode, setInputMode] = useState<SetupInputMode>("manual");
  const [inputValue, setInputValue] = useState("");
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [isSavingUseCase, setIsSavingUseCase] = useState(false);
  const [isSubmittingInput, setIsSubmittingInput] = useState(false);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [isCompletingPreferences, setIsCompletingPreferences] = useState(false);
  const [fitScoreRange, setFitScoreRange] = useState<[number, number]>([
    70, 100,
  ]);

  const pendingPreSessionUseCaseKeyRef = useRef<typeof activeUseCaseKey | null>(
    null
  );
  const inFlightUseCaseSyncKeyRef = useRef<typeof activeUseCaseKey | null>(
    null
  );
  const previousCanonicalStepRef = useRef(canonicalStep);

  const isThreadReady = Boolean(threadId);
  const stepNumber =
    visibleSteps.find((candidate: VisibleStepRecord) => candidate.id === step)
      ?.stepNumber ?? 1;
  const stepTotal = setupSession?.totalSteps ?? visibleSteps.length;
  const previousVisibleStep =
    stepNumber > 1
      ? ((visibleSteps[stepNumber - 2]?.id as PanelStepId | undefined) ?? null)
      : null;
  const progressValue = stepTotal > 0 ? (stepNumber / stepTotal) * 100 : 0;
  const headerBackDisabled = !previousVisibleStep;
  const previewSummariesQuery = useQueryWithStatus(
    api.setupSessions.getSetupPreviewSummaries,
    currentUser
      ? sessionId
        ? {
            sessionId,
          }
        : threadId
          ? {
              threadId,
            }
          : "skip"
      : "skip"
  );
  const previewSummaries = previewSummariesQuery.data ?? [];
  const openPreviewProspectQuery = useQueryWithStatus(
    api.setupSessions.getSetupPreviewProspect,
    currentUser && openPreviewId
      ? {
          prospectId: openPreviewId,
          sessionId: sessionId ?? undefined,
          threadId: sessionId ? undefined : (threadId ?? undefined),
        }
      : "skip"
  );
  const openPreviewProspect = openPreviewProspectQuery.data ?? null;
  const previewProfile = useMemo(
    () =>
      openPreviewProspect
        ? buildSetupPreviewProfileData(openPreviewProspect)
        : null,
    [openPreviewProspect]
  );

  useEffect(() => {
    if (stepOverride && !visibleStepIds.includes(stepOverride)) {
      setStepOverride(null);
    }
  }, [stepOverride, visibleStepIds]);

  useEffect(() => {
    if (stepOverride && canonicalStep !== previousCanonicalStepRef.current) {
      setStepOverride(null);
    }
    previousCanonicalStepRef.current = canonicalStep;
  }, [canonicalStep, stepOverride]);

  useEffect(() => {
    setFitScoreRange([
      workspace?.fitScoreMin ?? 70,
      workspace?.fitScoreMax ?? 100,
    ]);
  }, [workspace?.fitScoreMax, workspace?.fitScoreMin]);

  useEffect(() => {
    const setupSourceUrl = setupSession?.sourceUrl ?? null;
    const setupSeedDescription = setupSession?.seedDescription ?? null;
    const setupInputMode = setupSession?.inputMode ?? null;

    if (setupInputMode === "url" && setupSourceUrl && !sourceUrl) {
      setSourceUrl(setupSourceUrl);
      setInputMode("url");
    }

    if (setupSeedDescription && inputValue.trim().length === 0) {
      setInputValue(setupSeedDescription);
      if (setupInputMode === "manual" || !setupSourceUrl) {
        setInputMode("manual");
      }
    }

    if (setupInputMode === "manual" && sourceUrl) {
      setSourceUrl(null);
    }
  }, [
    setupSession?.inputMode,
    setupSession?.seedDescription,
    setupSession?.sourceUrl,
    inputValue,
    sourceUrl,
  ]);

  useEffect(() => {
    if (
      setupSession?.status !== "generating_profiles" &&
      setupSession?.status !== "provisioning_preview_workspace" &&
      setupSession?.status !== "discovering_preview_prospects"
    ) {
      setIsSubmittingInput(false);
    }
  }, [setupSession?.status]);

  useEffect(() => {
    if (
      setupSession?.errorMessage &&
      setupSession.status === "awaiting_input"
    ) {
      setIsSubmittingInput(false);
    }
  }, [setupSession?.errorMessage, setupSession?.status]);

  useEffect(() => {
    if (
      openPreviewId &&
      (step !== "input" ||
        setupSession?.inputPhase !== "awaiting_preview_approval")
    ) {
      setOpenPreviewId(null);
    }
  }, [openPreviewId, setupSession?.inputPhase, step]);

  useEffect(() => {
    setPreviewEvidencePanel(null);
  }, [openPreviewId]);

  const syncSetupUseCase = useCallback(
    async (
      nextUseCaseKey: typeof activeUseCaseKey,
      showErrorToast: boolean
    ) => {
      if (!sessionId) {
        return;
      }

      setIsSavingUseCase(true);
      try {
        await selectSetupSessionUseCase({
          sessionId,
          useCaseKey: nextUseCaseKey,
        });
      } catch (error) {
        if (showErrorToast) {
          toast.error("Could not update workspace use case", {
            description:
              error instanceof Error ? error.message : "Please try again.",
          });
        }
        throw error;
      } finally {
        setIsSavingUseCase(false);
      }
    },
    [selectSetupSessionUseCase, sessionId]
  );

  useEffect(() => {
    if (
      inFlightUseCaseSyncKeyRef.current &&
      setupSession?.useCaseKey === inFlightUseCaseSyncKeyRef.current
    ) {
      inFlightUseCaseSyncKeyRef.current = null;
    }
  }, [setupSession?.useCaseKey]);

  useEffect(() => {
    if (!sessionId || !optimisticUseCaseKey) {
      return;
    }

    if (setupSession?.useCaseKey === optimisticUseCaseKey) {
      pendingPreSessionUseCaseKeyRef.current = null;
      return;
    }

    if (inFlightUseCaseSyncKeyRef.current === optimisticUseCaseKey) {
      return;
    }

    if (pendingPreSessionUseCaseKeyRef.current !== optimisticUseCaseKey) {
      return;
    }

    inFlightUseCaseSyncKeyRef.current = optimisticUseCaseKey;
    pendingPreSessionUseCaseKeyRef.current = null;

    void syncSetupUseCase(optimisticUseCaseKey, false).catch((error) => {
      inFlightUseCaseSyncKeyRef.current = null;
      setSetupUseCaseDraftKey(
        setupSession?.useCaseKey ?? workspace?.useCaseKey ?? null
      );
      toast.error("Could not sync the selected use case", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    });
  }, [
    optimisticUseCaseKey,
    setupSession?.useCaseKey,
    sessionId,
    syncSetupUseCase,
    workspace?.useCaseKey,
  ]);

  const handleUseCaseStepHeaderBack = useCallback(() => {
    // First panel step: no upstream step to return to; control stays visible but disabled.
  }, []);

  const handleContinueFromUseCaseStep = useCallback(async () => {
    if (sessionId) {
      try {
        await advanceSetupSessionFromUseCaseStep({ sessionId });
      } catch (error) {
        toast.error("Could not continue", {
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
        return;
      }
    }
    setStepOverride("input");
  }, [advanceSetupSessionFromUseCaseStep, sessionId]);

  const handleSelectUseCase = useCallback(
    (nextUseCaseKey: typeof activeUseCaseKey) => {
      const previousUseCaseKey =
        optimisticUseCaseKey ??
        setupSession?.useCaseKey ??
        workspace?.useCaseKey ??
        null;

      setSetupUseCaseDraftKey(nextUseCaseKey);
      if (!sessionId) {
        pendingPreSessionUseCaseKeyRef.current = nextUseCaseKey;
        return;
      }

      pendingPreSessionUseCaseKeyRef.current = null;
      inFlightUseCaseSyncKeyRef.current = nextUseCaseKey;

      void syncSetupUseCase(nextUseCaseKey, true).catch(() => {
        inFlightUseCaseSyncKeyRef.current = null;
        setSetupUseCaseDraftKey(previousUseCaseKey);
      });
    },
    [
      optimisticUseCaseKey,
      setupSession?.useCaseKey,
      sessionId,
      syncSetupUseCase,
      workspace?.useCaseKey,
    ]
  );

  const handleSubmitInput = useCallback(async () => {
    if (!sessionId) {
      toast.error("Setup draft is still loading", {
        description: "Please wait a moment and try again.",
      });
      return;
    }

    const trimmedValue = inputValue.trim();
    const pastedUrl = getUrlFromWholeValue(trimmedValue);
    const resolvedInputMode: SetupInputMode =
      pastedUrl || (inputMode === "url" && sourceUrl) ? "url" : "manual";
    const detectedUrl =
      resolvedInputMode === "url" ? (pastedUrl ?? sourceUrl) : null;
    const hasValidInput = Boolean(detectedUrl) || trimmedValue.length > 0;

    if (!hasValidInput) {
      toast.error("Add workspace input first", {
        description: "Paste a URL or provide a clear description to continue.",
      });
      return;
    }

    setIsSubmittingInput(true);
    setInputMode(resolvedInputMode);

    try {
      await submitSetupInput({
        sessionId,
        inputMode: resolvedInputMode,
        inputValue: trimmedValue,
        sourceUrl: detectedUrl ?? undefined,
      });
    } catch (error) {
      setIsSubmittingInput(false);
      toast.error("Could not send setup input", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  }, [inputMode, inputValue, sourceUrl, sessionId, submitSetupInput]);

  const handleConfirmIdealProfiles = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    try {
      await confirmSetupIcps({ sessionId });
    } catch (error) {
      toast.error("Could not start preview search", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  }, [confirmSetupIcps, sessionId]);

  const handleApproveGeneratedDraft = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    try {
      await approveSetupGeneration({ sessionId });
      if (embedRefine) {
        toast.success("Workspace updated", {
          description: "Your audience and profiles were saved.",
        });
        onRefineComplete?.();
      }
    } catch (error) {
      toast.error(
        embedRefine ? "Could not save" : "Could not continue to connections",
        {
          description:
            error instanceof Error ? error.message : "Please try again.",
        }
      );
    }
  }, [approveSetupGeneration, embedRefine, onRefineComplete, sessionId]);

  const handleInputStepDone = useCallback(async () => {
    if (setupSession?.inputPhase === "awaiting_icp_approval") {
      await handleConfirmIdealProfiles();
      return;
    }
    if (setupSession?.inputPhase === "awaiting_preview_approval") {
      await handleApproveGeneratedDraft();
    }
  }, [
    handleApproveGeneratedDraft,
    handleConfirmIdealProfiles,
    setupSession?.inputPhase,
  ]);

  const handlePlanChoice = useCallback(
    async (
      choice: "free" | "base" | "pro",
      billingPeriod: "monthly" | "yearly" = "monthly"
    ) => {
      if (choice === "free") {
        if (!sessionId) {
          toast.error("Setup draft is still loading", {
            description: "Please wait a moment and try again.",
          });
          return;
        }

        try {
          await selectSetupPlan({
            sessionId,
            planChoice: "free",
          });
        } catch (error) {
          toast.error("Could not save plan step", {
            description:
              error instanceof Error ? error.message : "Please try again.",
          });
        }
        return;
      }

      if (typeof window === "undefined") {
        return;
      }

      setIsStartingCheckout(true);
      try {
        const returnUrl = new URL(window.location.href);
        returnUrl.searchParams.delete("code");
        returnUrl.searchParams.delete("state");
        returnUrl.searchParams.delete("error");
        returnUrl.searchParams.delete("error_description");

        const { url } = await startCheckoutFlow({
          tier: choice,
          billingPeriod,
          source: "onboarding_plan",
          origin: returnUrl.origin,
          returnTo: `${returnUrl.pathname}${returnUrl.search}`,
          sessionId: sessionId ?? undefined,
        });
        window.location.assign(url);
      } catch (error) {
        toast.error("Could not start checkout", {
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
      } finally {
        setIsStartingCheckout(false);
      }
    },
    [selectSetupPlan, sessionId, startCheckoutFlow]
  );

  const handleCompletePreferences = useCallback(async () => {
    if (!sessionId) {
      toast.error("Setup draft is still loading", {
        description: "Please wait a moment and try again.",
      });
      return;
    }

    if (setupSession?.status === "ready") {
      router.push("/");
      return;
    }

    if (setupSession?.status !== "awaiting_preferences") {
      toast.error("Preferences are already up to date", {
        description:
          "Setup has already moved past this step. Opening your workspace instead.",
      });
      router.push("/");
      return;
    }

    setIsCompletingPreferences(true);
    try {
      await selectSetupPreference({
        sessionId,
        fitScoreMin: fitScoreRange[0],
        fitScoreMax: fitScoreRange[1],
      });
      router.push("/");
    } catch (error) {
      toast.error("Could not finish setup", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsCompletingPreferences(false);
    }
  }, [
    fitScoreRange,
    router,
    selectSetupPreference,
    sessionId,
    setupSession?.status,
  ]);

  const isBusy =
    isSavingUseCase ||
    isSubmittingInput ||
    isStartingCheckout ||
    isCompletingPreferences ||
    setupSession?.status === "generating_profiles" ||
    setupSession?.status === "provisioning_preview_workspace" ||
    setupSession?.status === "discovering_preview_prospects";
  const canCompleteInputStep =
    setupSession?.inputPhase === "awaiting_icp_approval" ||
    setupSession?.inputPhase === "awaiting_preview_approval";

  if (previewProfile) {
    return (
      <div
        id="rx-onboarding-panel"
        className={cn(
          "bg-background flex h-full min-h-0 w-full max-w-lg flex-1 overflow-hidden md:min-w-0 md:border-r",
          className
        )}
      >
        {previewEvidencePanel ? (
          <EvidencePostsPanel
            title={previewEvidencePanel.title}
            posts={previewEvidencePanel.posts}
            platform={previewEvidencePanel.platform}
            onBack={() => setPreviewEvidencePanel(null)}
            readOnly
            className="w-full max-w-none border-0"
          />
        ) : (
          <ProspectProfilePanel
            prospect={previewProfile}
            mode="onboarding_preview"
            onBack={() => setOpenPreviewId(null)}
            onOpenEvidencePosts={setPreviewEvidencePanel}
            disableMobileDrawer
            className="w-full max-w-none border-0"
          />
        )}
      </div>
    );
  }

  const renderStep = () => {
    if (!isThreadReady && step !== "use_case" && step !== "connections") {
      return (
        <Card>
          <CardContent className="p-4">
            <AsciiSpinnerText text="Starting the setup thread..." />
          </CardContent>
        </Card>
      );
    }

    switch (step) {
      case "use_case":
        return (
          <UseCaseStep
            activeUseCaseKey={activeUseCaseKey}
            onSelectUseCase={handleSelectUseCase}
          />
        );
      case "input":
        return (
          <WorkspaceInputStep
            inputValue={inputValue}
            isSubmitting={isSubmittingInput}
            profileLabelPlural={activeUseCase.profileLabelPlural}
            sourceUrl={sourceUrl}
            useCaseKey={activeUseCaseKey}
            generatedProfiles={setupSession?.generatedProfiles ?? []}
            inputPhase={setupSession?.inputPhase ?? "collecting_input"}
            previewProspects={previewSummaries ?? []}
            previewReadyCount={setupSession?.previewProgress.enrichedCount ?? 0}
            errorMessage={setupSession?.errorMessage ?? null}
            onContinue={handleSubmitInput}
            onConfirmIdealProfiles={handleConfirmIdealProfiles}
            onApprovePreviewPeople={handleApproveGeneratedDraft}
            onInputValueChange={setInputValue}
            onInputModeChange={setInputMode}
            onSourceUrlChange={setSourceUrl}
            onOpenPreviewProfile={setOpenPreviewId}
          />
        );
      case "connections":
        return null;
      case "plan":
        return (
          <PlanStep
            onSelectFree={() => void handlePlanChoice("free")}
            onUpgradePaid={({ tier, billing }) =>
              void handlePlanChoice(tier, billing)
            }
            isStartingCheckout={isStartingCheckout}
          />
        );
      case "preference":
        return (
          <PreferenceStep
            useCase={activeUseCase}
            workspaceId={
              setupSession?.targetWorkspaceId ?? workspace?._id ?? null
            }
            defaultRange={fitScoreRange}
            onRangeChange={setFitScoreRange}
          />
        );
      default:
        return null;
    }
  };

  return (
    <aside
      id="rx-onboarding-panel"
      className={cn(
        "bg-background flex h-full min-h-0 w-full max-w-lg flex-1 overflow-hidden md:min-w-0 md:border-r",
        step === "use_case" && "rounded-none",
        className
      )}
    >
      <div className="flex h-full min-h-0 w-full flex-col">
        <PageHeader
          title={
            embedRefine && step === "input"
              ? "Your audience"
              : STEP_TITLES[step]
          }
          titleSuffix={
            embedRefine ? null : (
              <span className="text-muted-foreground font-mono text-sm">
                {" "}
                · {stepNumber}/{stepTotal}
              </span>
            )
          }
          backDisabled={embedRefine ? false : headerBackDisabled}
          className="rounded-none"
          onBack={
            embedRefine && step === "input"
              ? () => void onRefineCancel?.()
              : previousVisibleStep
                ? () => setStepOverride(previousVisibleStep)
                : handleUseCaseStepHeaderBack
          }
          actions={
            step === "input" ? (
              embedRefine ? (
                <>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => void onRefineCancel?.()}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="xs"
                    variant="secondary"
                    disabled={
                      !canCompleteInputStep ||
                      setupSession?.status === "generating_profiles" ||
                      setupSession?.status ===
                        "provisioning_preview_workspace" ||
                      setupSession?.status ===
                        "discovering_preview_prospects" ||
                      isSubmittingInput
                    }
                    onClick={() => void handleInputStepDone()}
                  >
                    Done
                  </Button>
                </>
              ) : (
                <>
                  {previousVisibleStep ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => setStepOverride(previousVisibleStep)}
                    >
                      Back
                    </Button>
                  ) : null}
                  <Button
                    size="xs"
                    variant="secondary"
                    disabled={
                      !canCompleteInputStep ||
                      setupSession?.status === "generating_profiles" ||
                      setupSession?.status ===
                        "provisioning_preview_workspace" ||
                      setupSession?.status ===
                        "discovering_preview_prospects" ||
                      isSubmittingInput
                    }
                    onClick={() => void handleInputStepDone()}
                  >
                    Done
                  </Button>
                </>
              )
            ) : undefined
          }
        />
        {!embedRefine ? (
          <Progress
            aria-label={`Setup progress: step ${stepNumber} of ${stepTotal}`}
            className="h-0.5 rounded-none border-0"
            indicatorClassName="bg-foreground rounded-none"
            value={progressValue}
          />
        ) : null}
        {step === "input" ? (
          <div className="min-h-0 flex-1">{renderStep()}</div>
        ) : step === "connections" ? (
          !isThreadReady ? (
            <ScrollArea className="min-h-0 flex-1">
              <PageContent className="space-y-4 px-4 py-4">
                {isSetupDraftLoading || isViewerProvisioning ? (
                  <Card>
                    <CardContent className="p-4">
                      <AsciiSpinnerText text="Starting onboarding..." />
                    </CardContent>
                  </Card>
                ) : null}
                <Card>
                  <CardContent className="p-4">
                    <AsciiSpinnerText text="Starting the setup thread..." />
                  </CardContent>
                </Card>
              </PageContent>
            </ScrollArea>
          ) : (
            <ConnectionsStep
              sessionId={sessionId}
              onBack={() => {
                if (previousVisibleStep) {
                  setStepOverride(previousVisibleStep);
                }
              }}
              onCompleteStep={() => setStepOverride(null)}
            />
          )
        ) : step === "preference" ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <ScrollArea className="min-h-0 flex-1">
              <PageContent className="space-y-4 px-4 py-4">
                {!isThreadReady &&
                (isSetupDraftLoading || isViewerProvisioning) ? (
                  <Card>
                    <CardContent className="p-4">
                      <AsciiSpinnerText text="Starting onboarding..." />
                    </CardContent>
                  </Card>
                ) : null}
                {renderStep()}
                {isBusy ? (
                  <p className="text-muted-foreground text-sm">
                    The setup assistant is working in the background. You can
                    keep using the panel while the chat updates.
                  </p>
                ) : null}
              </PageContent>
            </ScrollArea>
            <div className="bg-background shrink-0 border-t px-4 py-2">
              <div className="flex w-full min-w-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="shrink-0"
                  disabled={
                    !previousVisibleStep ||
                    isCompletingPreferences ||
                    setupSession?.status === "provisioning_preview_workspace" ||
                    setupSession?.status === "discovering_preview_prospects"
                  }
                  onClick={() => {
                    if (previousVisibleStep) {
                      setStepOverride(previousVisibleStep);
                    }
                  }}
                >
                  Back
                </Button>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    size="xs"
                    disabled={
                      isCompletingPreferences ||
                      setupSession?.status ===
                        "provisioning_preview_workspace" ||
                      setupSession?.status ===
                        "discovering_preview_prospects" ||
                      (setupSession?.status !== "awaiting_preferences" &&
                        setupSession?.status !== "ready")
                    }
                    onClick={() => void handleCompletePreferences()}
                  >
                    {setupSession?.status === "ready"
                      ? `Open ${activeUseCase.pageLabels.entities}`
                      : `Show ${activeUseCase.pageLabels.entities}`}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="min-h-0 flex-1">
            <PageContent className="space-y-4 px-4 py-4">
              {!isThreadReady &&
              (isSetupDraftLoading || isViewerProvisioning) ? (
                <Card>
                  <CardContent className="p-4">
                    <AsciiSpinnerText text="Starting onboarding..." />
                  </CardContent>
                </Card>
              ) : null}

              {renderStep()}

              {isBusy ? (
                <p className="text-muted-foreground text-sm">
                  The setup assistant is working in the background. You can keep
                  using the panel while the chat updates.
                </p>
              ) : null}
            </PageContent>
          </ScrollArea>
        )}
        {step === "use_case" ? (
          <div className="px-4 py-2">
            <Button
              size="xs"
              className="w-full"
              disabled={isSavingUseCase}
              onClick={() => void handleContinueFromUseCaseStep()}
            >
              Continue
            </Button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
