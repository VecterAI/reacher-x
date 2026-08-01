import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/shared/ui/components/Button";
import { Card, CardContent } from "@/shared/ui/components/Card";
import { InlineFeatureStrip } from "@/shared/ui/components/InlineFeatureStrip";
import {
  PromptInput,
  PromptInputActions,
  PromptInputTextarea,
} from "@/shared/ui/components/PromptInput";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { CharacterCounter } from "@/shared/ui/components/CharacterCounter";
import {
  ArrowUpwardIcon,
  ChangeHistoryIcon,
} from "@/shared/ui/components/icons";
import { UrlDescriptionFooterSlot } from "@/shared/ui/components/UrlDescriptionStatus";
import {
  IdealCustomerProfileCard,
  IdealCustomerProfileCardSkeleton,
  IDEAL_CUSTOMER_PROFILE_LIST_CLASS_NAME,
} from "@/features/prospects";
import { InlineProfilePreviewCard } from "@/features/agent/ui/components/InlineProfilePreviewCard";
import {
  buildSetupPreviewProfileData,
  type SetupPreviewProfilePanelTarget,
  type SetupPreviewProspectRecord,
} from "@/features/agent/lib/setupPreviewProfileData";
import { useUrlDescription } from "@/shared/hooks/useUrlDescription";
import {
  DESCRIPTION_CONSTRAINTS,
  cn,
  validateDescription,
} from "@/shared/lib/utils";
import { getUrlFromWholeValue } from "@/shared/lib/urls/urlParsing";
import { resolveUrlDescriptionStatusText } from "@/shared/lib/urls/urlDescriptionStatus";
import {
  getWorkspaceUseCase,
  type WorkspaceUseCaseKey,
} from "@/shared/lib/workspaceUseCases";
import { getSetupExampleDescriptions } from "@/shared/lib/setupExampleDescriptions";
import { SetupPreviewWaitingState } from "./SetupPreviewWaitingState";

type GeneratedIcp = {
  title: string;
  description: string;
  painPoints: string[];
  channels: string[];
};

type SetupInputPhase =
  | "collecting_input"
  | "generating_icps"
  | "awaiting_icp_approval"
  | "provisioning_preview_workspace"
  | "discovering_preview_prospects"
  | "preview_search_in_progress"
  | "awaiting_preview_approval"
  | null;

interface WorkspaceInputStepProps {
  inputValue: string;
  isSubmitting: boolean;
  profileLabelPlural: string;
  sourceUrl: string | null;
  useCaseKey: WorkspaceUseCaseKey;
  generatedProfiles: GeneratedIcp[];
  inputPhase: SetupInputPhase | null;
  previewProspects: SetupPreviewProspectRecord[];
  previewProgress: {
    discoveredCount: number;
    qualifiedCount: number;
    enrichedCount: number;
    selectedCount: number;
  };
  previewDiscoveryStartedAt: number | null;
  previewStatusUpdatedAt: number | null;
  errorMessage: string | null;
  onContinue: () => void;
  onConfirmIdealProfiles: () => void;
  onApprovePreviewPeople: () => void;
  onInputValueChange: (nextValue: string) => void;
  onInputModeChange: (nextMode: "url" | "manual") => void;
  onSourceUrlChange: (nextUrl: string | null) => void;
  onOpenPreviewProfile?: (target: SetupPreviewProfilePanelTarget) => void;
  /**
   * Chat-first setup: one composer in chat only. Panel keeps review/actions
   * (ICPs, preview) but must not show a second description input.
   */
  hidePromptComposer?: boolean;
}

export function WorkspaceInputStep(props: WorkspaceInputStepProps) {
  const phase = props.inputPhase ?? "collecting_input";
  const isPreviewSearchWaiting =
    phase === "provisioning_preview_workspace" ||
    phase === "discovering_preview_prospects" ||
    phase === "preview_search_in_progress";

  if (isPreviewSearchWaiting) {
    const useCase = getWorkspaceUseCase(props.useCaseKey);

    return (
      <SetupPreviewWaitingState
        entityPlural={useCase.entityPlural}
        progress={props.previewProgress}
        startedAt={
          props.previewDiscoveryStartedAt ?? props.previewStatusUpdatedAt
        }
        className="h-full"
      />
    );
  }

  return <WorkspaceInputContent {...props} inputPhase={phase} />;
}

function WorkspaceInputContent({
  inputValue,
  isSubmitting,
  profileLabelPlural,
  sourceUrl,
  useCaseKey,
  generatedProfiles,
  inputPhase,
  previewProspects,
  errorMessage,
  onContinue,
  onConfirmIdealProfiles,
  onApprovePreviewPeople,
  onInputValueChange,
  onInputModeChange,
  onSourceUrlChange,
  onOpenPreviewProfile,
  hidePromptComposer = false,
}: WorkspaceInputStepProps) {
  const exampleDescriptions = useMemo(
    () => getSetupExampleDescriptions(useCaseKey),
    [useCaseKey]
  );
  const useCase = useMemo(() => getWorkspaceUseCase(useCaseKey), [useCaseKey]);
  const entityPluralLower = useMemo(
    () => useCase.entityPlural.toLowerCase(),
    [useCase.entityPlural]
  );
  const lastToastedError = useRef<string | null>(null);

  const {
    isReadingUrl,
    readError,
    scheduleReadIfValid,
    beginRead,
    cancelRead,
  } = useUrlDescription({
    setText: onInputValueChange,
    onSourceUrlChange,
  });

  const phase = inputPhase ?? "collecting_input";
  const showLoadingState = isSubmitting || phase === "generating_icps";
  const showAutoFillState = isReadingUrl;
  const showPromptComposer =
    !hidePromptComposer &&
    phase !== "collecting_input" &&
    phase !== "provisioning_preview_workspace" &&
    phase !== "preview_search_in_progress" &&
    phase !== "discovering_preview_prospects";
  const isPromptDisabled = showAutoFillState || showLoadingState;
  const trimmedInput = inputValue.trim();
  const urlFromWholeInput = getUrlFromWholeValue(trimmedInput);
  /** Matches AgentOnboardingPanel: sourceUrl ?? getUrlFromWholeValue(trimmed) */
  const hasUrlBackedInput = Boolean(sourceUrl ?? urlFromWholeInput);
  const isOverCharacterLimit =
    inputValue.length > DESCRIPTION_CONSTRAINTS.MAX_LENGTH;
  const manualDescriptionValid = validateDescription(trimmedInput, true);
  const canContinue =
    !isPromptDisabled &&
    !isOverCharacterLimit &&
    (hasUrlBackedInput || manualDescriptionValid.isValid);
  const footerStatusText = resolveUrlDescriptionStatusText({
    isReadingUrl: showAutoFillState,
    isGeneratingProfiles: phase === "generating_icps",
  });
  useEffect(() => {
    if (readError && readError !== lastToastedError.current) {
      lastToastedError.current = readError;
      toast.error("Couldn't read the URL", {
        description: readError,
      });
    }
    if (!readError) {
      lastToastedError.current = null;
    }
  }, [readError]);

  const handleCancel = useCallback(() => {
    if (isReadingUrl) {
      cancelRead();
    }
  }, [cancelRead, isReadingUrl]);

  const handleSubmit = useCallback(() => {
    if (showAutoFillState || showLoadingState) {
      return;
    }

    if (inputValue.length > DESCRIPTION_CONSTRAINTS.MAX_LENGTH) {
      return;
    }

    const trimmed = inputValue.trim();
    const candidate = getUrlFromWholeValue(trimmed);
    if (candidate) {
      onInputModeChange("url");
      void beginRead(candidate);
      return;
    }

    const hasUrlBacked = Boolean(sourceUrl ?? getUrlFromWholeValue(trimmed));
    if (!hasUrlBacked && !validateDescription(trimmed, true).isValid) {
      return;
    }

    onInputModeChange(hasUrlBacked ? "url" : "manual");
    onContinue();
  }, [
    beginRead,
    inputValue,
    onContinue,
    onInputModeChange,
    showAutoFillState,
    showLoadingState,
    sourceUrl,
  ]);

  const handlePromptValueChange = useCallback(
    (nextValue: string) => {
      onInputValueChange(nextValue);

      if (!getUrlFromWholeValue(nextValue.trim())) {
        onInputModeChange("manual");
        if (sourceUrl) {
          onSourceUrlChange(null);
        }
      }

      if (showAutoFillState || showLoadingState) {
        return;
      }

      scheduleReadIfValid(nextValue);
    },
    [
      onInputValueChange,
      onInputModeChange,
      onSourceUrlChange,
      scheduleReadIfValid,
      showAutoFillState,
      showLoadingState,
      sourceUrl,
    ]
  );

  const headerCopy = useMemo(() => {
    switch (phase) {
      case "collecting_input":
        return hidePromptComposer
          ? {
              title: "Describe who to find in chat",
              description: (
                <>
                  Use the <span className="text-foreground">chat composer</span>{" "}
                  on the left. Paste a website or describe the audience — Agent
                  will generate{" "}
                  <span className="text-foreground">
                    {profileLabelPlural.toLowerCase()}
                  </span>{" "}
                  next.
                </>
              ),
            }
          : {
              title: "Describe what Agent should look for",
              description: (
                <>
                  <span className="text-foreground">Paste a website</span>, or
                  describe the{" "}
                  <span className="text-foreground">traits and signals</span>{" "}
                  that matter. Agent will generate{" "}
                  <span className="text-foreground">
                    {profileLabelPlural.toLowerCase()}
                  </span>{" "}
                  for you to{" "}
                  <span className="text-foreground">review and approve</span>{" "}
                  before searching starts.
                </>
              ),
            };
      case "generating_icps":
        return {
          title: "Building ideal profiles",
          description:
            "Agent is turning your description into a set of ideal profiles.",
        };
      case "awaiting_icp_approval":
        return {
          title: "Review the ideal profiles",
          description: (
            <>
              <span className="text-foreground font-medium">Approve them</span>{" "}
              if they look right. Agent will{" "}
              <span className="text-foreground font-medium">
                use these profiles
              </span>{" "}
              to find real{" "}
              <span className="text-foreground font-medium">
                {entityPluralLower}
              </span>{" "}
              and{" "}
              <span className="text-foreground font-medium">
                show you a preview
              </span>{" "}
              before setup finishes. Edit the description below to generate
              again.
            </>
          ),
        };
      case "awaiting_preview_approval":
        return {
          title: `Preview ${entityPluralLower}`,
          description: (
            <>
              Review the{" "}
              <span className="text-foreground font-medium">
                {entityPluralLower}
              </span>{" "}
              Agent found. These are just{" "}
              <span className="text-foreground font-medium">previews</span>.
              Agent may swap in{" "}
              <span className="text-foreground font-medium">
                stronger matches
              </span>{" "}
              while you review. Continue when the preview looks directionally
              right.
            </>
          ),
        };
      default:
        return {
          title: "Describe what Agent should look for",
          description: (
            <>
              Agent will generate{" "}
              <span className="text-foreground font-medium">
                {profileLabelPlural.toLowerCase()}
              </span>{" "}
              for you to{" "}
              <span className="text-foreground font-medium">
                review and approve
              </span>{" "}
              before searching starts.
            </>
          ),
        };
    }
  }, [
    entityPluralLower,
    hidePromptComposer,
    phase,
    profileLabelPlural,
    useCase.entityPlural,
  ]);

  const mainContent = useMemo(() => {
    const setupCardClassName =
      "border-l-foreground bg-background w-full rounded-none border-y-0 border-r-0 border-l-2 px-4 py-0 text-left transition-colors";

    switch (phase) {
      case "collecting_input":
        if (hidePromptComposer) {
          return null;
        }
        return (
          <section
            aria-labelledby="example-descriptions-label"
            className="mt-4 space-y-3 px-4"
          >
            <div className="space-y-0.5">
              <p
                id="example-descriptions-label"
                className="text-foreground text-sm font-semibold"
              >
                Example descriptions
              </p>
              <p className="text-muted-foreground text-xs">
                Click one to use it as a starting point.
              </p>
            </div>
            <div className="space-y-2">
              {exampleDescriptions.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  className={cn(
                    setupCardClassName,
                    "hover:border-l-foreground hover:bg-accent/30 focus-visible:ring-ring focus-visible:border-l-foreground focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
                  )}
                  onClick={() => {
                    onInputModeChange("manual");
                    if (sourceUrl) {
                      onSourceUrlChange(null);
                    }
                    onInputValueChange(example.description);
                  }}
                >
                  <span className="text-foreground block text-sm font-medium">
                    {example.title}
                  </span>
                  <span className="text-muted-foreground mt-1 block text-sm leading-6">
                    {example.description}
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      case "generating_icps":
        return (
          <section className="space-y-3 px-4" aria-live="polite">
            {Array.from({ length: 3 }).map((_, index) => (
              <IdealCustomerProfileCardSkeleton
                key={`icp-skel-${index}`}
                className={IDEAL_CUSTOMER_PROFILE_LIST_CLASS_NAME}
              />
            ))}
          </section>
        );
      case "awaiting_icp_approval":
        return (
          <section className="space-y-3 px-4" aria-label="Ideal profiles">
            <p className="text-muted-foreground text-xs font-medium">
              Ideal profiles ({profileLabelPlural})
            </p>
            <div className="flex flex-col gap-3">
              {generatedProfiles.map((icp, index) => (
                <IdealCustomerProfileCard
                  key={`${icp.title}-${index}`}
                  profile={icp}
                  maxPainBadges={2}
                  className={IDEAL_CUSTOMER_PROFILE_LIST_CLASS_NAME}
                />
              ))}
            </div>
          </section>
        );
      case "awaiting_preview_approval":
        return (
          <section className="space-y-3 px-4" aria-label="Preview results">
            {previewProspects.map((prospect) => {
              const previewProfile = buildSetupPreviewProfileData(prospect);
              const previewTarget = previewProfile.target;
              return (
                <InlineProfilePreviewCard
                  key={`setup-preview-${prospect._id}`}
                  variant={previewProfile.variant}
                  prospectId={prospect._id}
                  platform={previewProfile.platform}
                  profileData={previewProfile.profileData}
                  label={previewProfile.label}
                  context={previewProfile.context}
                  interactive={Boolean(onOpenPreviewProfile && previewTarget)}
                  openOnCardClick
                  showActions={false}
                  showFeatureStrip={false}
                  onOpenPanel={
                    onOpenPreviewProfile && previewTarget
                      ? () => onOpenPreviewProfile(previewTarget)
                      : undefined
                  }
                />
              );
            })}
          </section>
        );
      default:
        return null;
    }
  }, [
    exampleDescriptions,
    generatedProfiles,
    hidePromptComposer,
    onInputModeChange,
    onInputValueChange,
    onOpenPreviewProfile,
    onSourceUrlChange,
    phase,
    previewProspects,
    profileLabelPlural,
    sourceUrl,
  ]);

  return (
    <section className="flex h-full min-h-0 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 py-4">
          <div>
            <header className="mb-4 space-y-1 px-4 pb-1">
              <h2 className="text-xl font-semibold">{headerCopy.title}</h2>
              <p className="text-muted-foreground text-sm">
                {headerCopy.description}
              </p>
              {errorMessage ? (
                <p className="my-4 text-sm text-red-500">{errorMessage}</p>
              ) : null}
            </header>
            {mainContent}
          </div>
        </div>
      </ScrollArea>

      <div className="bg-background shrink-0 px-4 pt-3 pb-4 backdrop-blur-xl">
        <AnimatePresence initial={false}>
          {phase === "awaiting_icp_approval" ? (
            <motion.div
              key="icp-satisfaction-strip"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="-mb-0.5"
            >
              <Card className="mx-3 overflow-clip rounded-tl-xl rounded-tr-xl rounded-br-none rounded-bl-none shadow-none">
                <CardContent className="p-0">
                  <InlineFeatureStrip
                    className="w-full rounded-none border-0 bg-transparent"
                    leading={
                      <>
                        <div className="border-border rounded-md border p-1">
                          <ChangeHistoryIcon className="text-foreground size-4 fill-current" />
                        </div>
                        <p className="text-sm font-medium">
                          Approve these ideal profiles?
                        </p>
                      </>
                    }
                    trailing={
                      <Button size="xs" onClick={onConfirmIdealProfiles}>
                        Approve
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            </motion.div>
          ) : null}
          {phase === "awaiting_preview_approval" ? (
            <motion.div
              key="preview-satisfaction-strip"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="-mb-0.5"
            >
              <Card className="mx-3 rounded-tl-xl rounded-tr-xl rounded-br-none rounded-bl-none shadow-none">
                <CardContent className="p-0">
                  <InlineFeatureStrip
                    className="w-full rounded-none border-0 bg-transparent"
                    leading={
                      <>
                        <div className="border-border rounded-md border p-1">
                          <ChangeHistoryIcon className="text-foreground size-4 fill-current" />
                        </div>
                        <p className="text-sm font-medium">
                          Continue with these profiles?
                        </p>
                      </>
                    }
                    trailing={
                      <Button size="xs" onClick={onApprovePreviewPeople}>
                        Continue
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {showPromptComposer ? (
          <div className="relative z-10">
            <PromptInput
              value={inputValue}
              onValueChange={handlePromptValueChange}
              onSubmit={handleSubmit}
              isLoading={showAutoFillState || showLoadingState}
              disabled={isPromptDisabled}
            >
              <PromptInputTextarea
                autoFocus
                className="px-1 pt-0.5 text-sm"
                placeholder="Paste a website or describe what Agent should use..."
                inlineAutocompleteContext={{
                  surfaceLabel: "workspace_onboarding_input",
                  platform: "generic",
                  useCaseKey,
                  toneHint:
                    "Complete the user's audience or use-case description clearly and concretely.",
                }}
                onPaste={(event) => {
                  if (showAutoFillState || showLoadingState) {
                    return;
                  }

                  const pasted = event.clipboardData.getData("text");
                  const candidate = getUrlFromWholeValue(pasted);
                  if (!candidate) {
                    return;
                  }

                  onInputValueChange(pasted);
                  event.preventDefault();

                  void beginRead(candidate);
                }}
                onBlur={(event) => {
                  if (showAutoFillState || showLoadingState) {
                    return;
                  }

                  const candidate = getUrlFromWholeValue(
                    event.currentTarget.value
                  );
                  if (!candidate) {
                    return;
                  }

                  void beginRead(candidate);
                }}
              />
              <PromptInputActions className="justify-between pt-1">
                <UrlDescriptionFooterSlot
                  statusText={footerStatusText}
                  isReadingUrl={isReadingUrl}
                  onCancel={handleCancel}
                  idleLeft={
                    <CharacterCounter
                      current={inputValue.length}
                      max={DESCRIPTION_CONSTRAINTS.MAX_LENGTH}
                    />
                  }
                  idleRight={
                    <Button
                      type="button"
                      variant="default"
                      size="xsIcon"
                      onClick={handleSubmit}
                      disabled={!canContinue}
                      aria-label="Submit audience description"
                    >
                      <ArrowUpwardIcon className="fill-current" />
                    </Button>
                  }
                />
              </PromptInputActions>
            </PromptInput>
          </div>
        ) : null}
      </div>
    </section>
  );
}
