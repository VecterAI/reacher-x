"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@nanostores/react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type {
  SetupGeneratedResult,
  SetupInputMode,
} from "@/features/agent/lib/setupOnboarding";
import { PageContent, PageHeader } from "@/features/webapp/ui/components";
import {
  useActiveUseCaseLabels,
  useSetupThreadDraft,
  useWorkspace,
} from "@/shared/hooks";
import {
  $setupUseCaseDraftKey,
  setSetupUseCaseDraftKey,
} from "@/shared/stores/setupUseCaseDraft";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { Button } from "@/shared/ui/components/Button";
import { Progress } from "@/shared/ui/components/Progress";
import { Badge } from "@/shared/ui/components/Badge";
import { Card, CardContent } from "@/shared/ui/components/Card";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import { cn } from "@/shared/lib/utils";
import { getUrlFromWholeValue } from "@/shared/lib/urls/urlParsing";
import { OnboardingProgressCard } from "./OnboardingProgressCard";
import { ConnectionsStep } from "./onboarding/ConnectionsStep";
import { PlanStep } from "./onboarding/PlanStep";
import { PreferenceStep } from "./onboarding/PreferenceStep";
import { UseCaseStep } from "./onboarding/UseCaseStep";
import { WorkspaceInputStep } from "./onboarding/WorkspaceInputStep";

const PANEL_STEPS = [
  { id: "use_case", label: "Use case" },
  { id: "input", label: "Input" },
  { id: "connections", label: "Connections" },
  { id: "plan", label: "Plan" },
  { id: "preference", label: "Preferences" },
] as const;

/** Displayed in onboarding headers (Figma: five-step setup flow). */
const SETUP_STEP_DISPLAY_TOTAL = 5;

type PanelStepId = (typeof PANEL_STEPS)[number]["id"] | "progress";

interface AgentOnboardingPanelProps {
  className?: string;
  threadId?: string | null;
}

function getStepIndex(step: PanelStepId): number {
  if (step === "progress") {
    return PANEL_STEPS.length;
  }

  const stepIndex = PANEL_STEPS.findIndex((candidate) => candidate.id === step);
  return stepIndex >= 0 ? stepIndex + 1 : 1;
}

export function AgentOnboardingPanel({
  className,
  threadId,
}: AgentOnboardingPanelProps) {
  const router = useRouter();
  const optimisticUseCaseKey = useStore($setupUseCaseDraftKey);
  const { workspace } = useWorkspace();
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
  const selectSetupPlan = useMutation(api.setupSessions.selectSetupPlan);
  const selectSetupPreference = useMutation(
    api.setupSessions.selectSetupPreference
  );
  const finalizeSetupSession = useMutation(
    api.setupSessions.finalizeSetupSession
  );
  const sessionId = setupSession?.sessionId ?? null;
  const generatedResult = useMemo<SetupGeneratedResult | null>(() => {
    if (
      !setupSession ||
      !setupSession.improvedDescription ||
      setupSession.generatedProfiles.length === 0
    ) {
      return null;
    }

    return {
      order: 0,
      improvedDescription: setupSession.improvedDescription,
      icps: setupSession.generatedProfiles.map((profile) => ({
        title: profile.title,
        description: profile.description,
        painPoints: profile.painPoints,
        channels: profile.channels,
      })),
      seedDescription: setupSession.seedDescription,
      descriptionSource: setupSession.sourceUrl ? "url" : "manual",
      sourceUrl: setupSession.sourceUrl,
      suggestedWorkspaceName: setupSession.draftName,
    };
  }, [setupSession]);

  const canonicalPanelStep = setupSession?.panelStep ?? "use_case";
  const canonicalStep: PanelStepId =
    canonicalPanelStep === "review" ? "input" : canonicalPanelStep;
  const [stepOverride, setStepOverride] = useState<PanelStepId | null>(null);
  const step = stepOverride ?? canonicalStep;
  const [, setInputMode] = useState<SetupInputMode>("url");
  const [inputValue, setInputValue] = useState("");
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [isSavingUseCase, setIsSavingUseCase] = useState(false);
  const [isSubmittingInput, setIsSubmittingInput] = useState(false);
  const [isCompletingPreferences, setIsCompletingPreferences] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");

  const lastSuggestedWorkspaceNameRef = useRef<string | null>(null);
  const pendingPreSessionUseCaseKeyRef = useRef<typeof activeUseCaseKey | null>(
    null
  );
  const inFlightUseCaseSyncKeyRef = useRef<typeof activeUseCaseKey | null>(
    null
  );

  const isThreadReady = Boolean(threadId);
  const suggestedWorkspaceName =
    setupSession?.draftName ?? workspace?.name ?? activeUseCase.displayName;

  useEffect(() => {
    setStepOverride(null);
  }, [canonicalStep]);

  useEffect(() => {
    if (!suggestedWorkspaceName) {
      return;
    }

    if (
      workspaceName.trim().length === 0 ||
      workspaceName === lastSuggestedWorkspaceNameRef.current
    ) {
      setWorkspaceName(suggestedWorkspaceName);
      lastSuggestedWorkspaceNameRef.current = suggestedWorkspaceName;
    }
  }, [suggestedWorkspaceName, workspaceName]);

  useEffect(() => {
    const setupSourceUrl = setupSession?.sourceUrl ?? null;
    const setupSeedDescription = setupSession?.seedDescription ?? null;

    if (setupSourceUrl && !sourceUrl) {
      setSourceUrl(setupSourceUrl);
      setInputMode("url");
    }

    if (setupSeedDescription && inputValue.trim().length === 0) {
      setInputValue(setupSeedDescription);
      if (!setupSourceUrl) {
        setInputMode("manual");
      }
    }
  }, [
    setupSession?.seedDescription,
    setupSession?.sourceUrl,
    inputValue,
    sourceUrl,
  ]);

  useEffect(() => {
    if (setupSession?.status === "awaiting_review") {
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
    const detectedUrl = sourceUrl ?? getUrlFromWholeValue(trimmedValue);
    const resolvedInputMode: SetupInputMode = detectedUrl ? "url" : "manual";
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
  }, [inputValue, sourceUrl, sessionId, submitSetupInput]);

  const handleApproveGeneratedDraft = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    try {
      await approveSetupGeneration({ sessionId });
    } catch (error) {
      toast.error("Could not continue to connections", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  }, [approveSetupGeneration, sessionId]);

  const handlePlanChoice = useCallback(
    async (choice: "free" | "base" | "pro") => {
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

      const checkoutUrl = process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL;
      if (checkoutUrl) {
        const sep = checkoutUrl.includes("?") ? "&" : "?";
        window.open(
          `${checkoutUrl}${sep}plan=${choice}`,
          "_blank",
          "noopener,noreferrer"
        );
        return;
      }

      toast.info("Checkout will open here once billing is connected.");
    },
    [selectSetupPlan, sessionId]
  );

  const handleCompletePreferences = useCallback(async () => {
    if (!sessionId) {
      toast.error("Setup draft is still loading", {
        description: "Please wait a moment and try again.",
      });
      return;
    }

    setIsCompletingPreferences(true);
    try {
      if (setupSession?.status === "awaiting_final_confirmation") {
        await finalizeSetupSession({
          sessionId,
          workspaceName:
            workspaceName.trim() ||
            suggestedWorkspaceName ||
            "Untitled workspace",
        });
      } else {
        await selectSetupPreference({
          sessionId,
          preferenceChoice: "qualified_only",
        });
      }
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
    finalizeSetupSession,
    router,
    selectSetupPreference,
    sessionId,
    setupSession?.status,
    suggestedWorkspaceName,
    workspaceName,
  ]);

  const currentStepIndex = getStepIndex(step);
  const isBusy =
    isSavingUseCase ||
    isSubmittingInput ||
    isCompletingPreferences ||
    setupSession?.status === "generating" ||
    setupSession?.status === "provisioning_workspace" ||
    setupSession?.status === "running_initial_discovery" ||
    setupSession?.status === "waiting_for_first_ready_profile";

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
            setupStatus={setupSession?.status ?? "awaiting_input"}
            generatedResult={generatedResult}
            errorMessage={setupSession?.errorMessage ?? null}
            onContinue={handleSubmitInput}
            onDone={handleApproveGeneratedDraft}
            onInputValueChange={setInputValue}
            onSourceUrlChange={setSourceUrl}
          />
        );
      case "connections":
        return null;
      case "plan":
        return (
          <PlanStep
            onSelectFree={() => void handlePlanChoice("free")}
            onUpgradePaid={(tier) => void handlePlanChoice(tier)}
          />
        );
      case "preference":
        return <PreferenceStep useCase={activeUseCase} />;
      case "progress":
        return setupSession?.targetWorkspaceId ? (
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-sm font-medium">
                {setupSession.existingWorkspaceId
                  ? "Workspace updated"
                  : "Workspace created"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {setupSession.status === "ready"
                  ? "The workspace is unlocked and the first ready results are available."
                  : "The onboarding workflow has started. You can keep an eye on the first search, qualification, and enrichment stages here."}
              </p>
            </div>
            <OnboardingProgressCard
              workspaceId={setupSession.targetWorkspaceId}
            />
          </section>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <aside
      className={cn(
        "bg-background flex h-full min-h-0 w-full max-w-lg flex-1 overflow-hidden border-r md:min-w-0",
        step === "use_case" && "rounded-none",
        className
      )}
    >
      <div className="flex h-full min-h-0 w-full flex-col">
        {step === "use_case" ? (
          <>
            <PageHeader
              title="Who to reach?"
              titleSuffix={
                <span className="text-muted-foreground font-mono text-sm">
                  {" "}
                  · 1/{SETUP_STEP_DISPLAY_TOTAL}
                </span>
              }
              backDisabled
              className="rounded-none"
              onBack={handleUseCaseStepHeaderBack}
            />
            <Progress
              aria-label="Setup progress: step 1 of 5"
              className="h-0.5 rounded-none border-0"
              indicatorClassName="bg-foreground rounded-none"
              value={20}
            />
          </>
        ) : step === "input" ? (
          <>
            <PageHeader
              title="Your audience"
              titleSuffix={
                <span className="text-muted-foreground font-mono text-sm">
                  {" "}
                  · 2/{SETUP_STEP_DISPLAY_TOTAL}
                </span>
              }
              className="rounded-none"
              onBack={() => setStepOverride("use_case")}
              actions={
                <>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setStepOverride("use_case")}
                  >
                    Back
                  </Button>
                  <Button
                    size="xs"
                    variant="secondary"
                    disabled={
                      !generatedResult ||
                      generatedResult.icps.length === 0 ||
                      setupSession?.status === "generating" ||
                      isSubmittingInput
                    }
                    onClick={() => void handleApproveGeneratedDraft()}
                  >
                    Done
                  </Button>
                </>
              }
            />
            <Progress
              aria-label="Setup progress: step 2 of 5"
              className="h-0.5 rounded-none border-0"
              indicatorClassName="bg-foreground rounded-none"
              value={40}
            />
          </>
        ) : step === "connections" ? (
          <>
            <PageHeader
              title="Connect accounts"
              titleSuffix={
                <span className="text-muted-foreground font-mono text-sm">
                  {" "}
                  · 3/{SETUP_STEP_DISPLAY_TOTAL}
                </span>
              }
              className="rounded-none"
              onBack={() => setStepOverride("input")}
            />
            <Progress
              aria-label="Setup progress: step 3 of 5"
              className="h-0.5 rounded-none border-0"
              indicatorClassName="bg-foreground rounded-none"
              value={60}
            />
          </>
        ) : step === "plan" ? (
          <>
            <PageHeader
              title="Plans"
              titleSuffix={
                <span className="text-muted-foreground font-mono text-sm">
                  {" "}
                  · 4/{SETUP_STEP_DISPLAY_TOTAL}
                </span>
              }
              className="rounded-none"
              onBack={() => setStepOverride("connections")}
            />
            <Progress
              aria-label={`Setup progress: step 4 of ${SETUP_STEP_DISPLAY_TOTAL}`}
              className="h-0.5 rounded-none border-0"
              indicatorClassName="bg-foreground rounded-none"
              value={80}
            />
          </>
        ) : step === "preference" ? (
          <>
            <PageHeader
              title="Preferences"
              titleSuffix={
                <span className="text-muted-foreground font-mono text-sm">
                  {" "}
                  · {SETUP_STEP_DISPLAY_TOTAL}/{SETUP_STEP_DISPLAY_TOTAL}
                </span>
              }
              className="rounded-none"
              onBack={() => setStepOverride("plan")}
            />
            <Progress
              aria-label={`Setup progress: step ${SETUP_STEP_DISPLAY_TOTAL} of ${SETUP_STEP_DISPLAY_TOTAL}`}
              className="h-0.5 rounded-none border-0"
              indicatorClassName="bg-foreground rounded-none"
              value={100}
            />
          </>
        ) : (
          <PageHeader
            title="Workspace setup"
            titleSuffix={
              <Badge variant="secondary">{activeUseCase.displayName}</Badge>
            }
            actions={
              <Badge variant="outline">
                Step {currentStepIndex}/{PANEL_STEPS.length}
              </Badge>
            }
          />
        )}
        {step === "input" ? (
          <div className="min-h-0 flex-1">{renderStep()}</div>
        ) : step === "connections" ? (
          !isThreadReady ? (
            <ScrollArea className="min-h-0 flex-1">
              <PageContent className="space-y-4 px-4 py-4">
                {isSetupDraftLoading ? (
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
              onBack={() => setStepOverride("input")}
              onCompleteStep={() => setStepOverride(null)}
            />
          )
        ) : step === "preference" ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <ScrollArea className="min-h-0 flex-1">
              <PageContent className="space-y-4 px-4 py-4">
                {!isThreadReady && isSetupDraftLoading ? (
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
                    isCompletingPreferences ||
                    setupSession?.status === "provisioning_workspace"
                  }
                  onClick={() => setStepOverride("plan")}
                >
                  Back
                </Button>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    size="xs"
                    disabled={
                      isCompletingPreferences ||
                      setupSession?.status === "provisioning_workspace"
                    }
                    onClick={() => void handleCompletePreferences()}
                  >
                    Show {activeUseCase.pageLabels.entities}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="min-h-0 flex-1">
            <PageContent className="space-y-4 px-4 py-4">
              {!isThreadReady && isSetupDraftLoading ? (
                <Card>
                  <CardContent className="p-4">
                    <AsciiSpinnerText text="Starting onboarding..." />
                  </CardContent>
                </Card>
              ) : null}

              {renderStep()}

              {isBusy && step !== "progress" ? (
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
