import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/shared/ui/components/Button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/components/Accordion";
import { Card, CardContent } from "@/shared/ui/components/Card";
import { InlineFeatureStrip } from "@/shared/ui/components/InlineFeatureStrip";
import {
  PromptInput,
  PromptInputActions,
  PromptInputTextarea,
} from "@/shared/ui/components/PromptInput";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { CharacterCounter } from "@/shared/ui/components/CharacterCounter";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import {
  ArrowUpwardIcon,
  ChangeHistoryIcon,
} from "@/shared/ui/components/icons";
import {
  ProspectCard,
  ProspectCardSkeleton,
  IdealCustomerProfileCard,
} from "@/features/prospects";
import type { ProspectCardRecord } from "@/features/prospects/lib/getProspectDisplayData";
import { useUrlDescription } from "@/shared/hooks/useUrlDescription";
import {
  DESCRIPTION_CONSTRAINTS,
  validateDescription,
} from "@/shared/lib/utils";
import { getUrlFromWholeValue } from "@/shared/lib/urls/urlParsing";
import type { Id } from "@/convex/_generated/dataModel";
import type { WorkspaceUseCaseKey } from "@/shared/lib/workspaceUseCases";
import { getSetupExampleDescriptions } from "@/shared/lib/setupExampleDescriptions";

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
  previewProspects: ProspectCardRecord[];
  errorMessage: string | null;
  onContinue: () => void;
  onConfirmIdealProfiles: () => void;
  onApprovePreviewPeople: () => void;
  onInputValueChange: (nextValue: string) => void;
  onSourceUrlChange: (nextUrl: string | null) => void;
  onOpenPreviewProfile?: (prospectId: Id<"prospects">) => void;
}

export function WorkspaceInputStep({
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
  onSourceUrlChange,
  onOpenPreviewProfile,
}: WorkspaceInputStepProps) {
  const exampleDescriptions = useMemo(
    () => getSetupExampleDescriptions(useCaseKey),
    [useCaseKey]
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
  const showLoadingState =
    isSubmitting ||
    phase === "generating_icps" ||
    phase === "provisioning_preview_workspace" ||
    phase === "discovering_preview_prospects";
  const showAutoFillState = isReadingUrl;
  const showPromptComposer = phase !== "provisioning_preview_workspace";
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
  const footerStatusText = showAutoFillState
    ? "Auto-filling description..."
    : phase === "generating_icps"
      ? "Generating ideal profiles..."
      : phase === "provisioning_preview_workspace"
        ? "Provisioning preview workspace..."
        : phase === "discovering_preview_prospects"
          ? "Finding preview people..."
          : null;
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
      void beginRead(candidate);
      return;
    }

    const hasUrlBacked = Boolean(sourceUrl ?? getUrlFromWholeValue(trimmed));
    if (!hasUrlBacked && !validateDescription(trimmed, true).isValid) {
      return;
    }

    onContinue();
  }, [
    beginRead,
    inputValue,
    onContinue,
    showAutoFillState,
    showLoadingState,
    sourceUrl,
  ]);

  const handlePromptValueChange = useCallback(
    (nextValue: string) => {
      onInputValueChange(nextValue);

      if (showAutoFillState || showLoadingState) {
        return;
      }

      scheduleReadIfValid(nextValue);
    },
    [
      onInputValueChange,
      scheduleReadIfValid,
      showAutoFillState,
      showLoadingState,
    ]
  );

  const headerCopy = useMemo(() => {
    switch (phase) {
      case "collecting_input":
        return {
          title: "Describe it. We'll find them.",
          description: "We'll find the right people based on what you share.",
        };
      case "generating_icps":
        return {
          title: "Building ideal profiles",
          description:
            "We’re turning your description into a set of ideal profiles.",
        };
      case "awaiting_icp_approval":
        return {
          title: "Refine until it feels right",
          description:
            "Review these ideal profiles. Edit the description below and generate again if needed.",
        };
      case "provisioning_preview_workspace":
        return {
          title: "Provisioning preview workspace",
          description:
            "We’re creating a real draft workspace so the preview can use live prospect data.",
        };
      case "discovering_preview_prospects":
        return {
          title: "Finding preview people",
          description:
            "We’re matching real people against the approved ideal profiles.",
        };
      case "awaiting_preview_approval":
        return {
          title: "Preview people",
          description:
            "Review the people we found. Open profiles to inspect them before you commit.",
        };
      default:
        return {
          title: "Describe it. We'll find them.",
          description: "We'll find the right people based on what you share.",
        };
    }
  }, [phase]);

  const mainContent = useMemo(() => {
    switch (phase) {
      case "collecting_input":
        return (
          <section
            aria-labelledby="great-descriptions-label"
            className="mt-4 space-y-2 px-4"
          >
            <p
              id="great-descriptions-label"
              className="text-muted-foreground text-xs"
            >
              Great descriptions
            </p>
            <Accordion type="multiple">
              {exampleDescriptions.map((example) => (
                <AccordionItem key={example.id} value={example.id}>
                  <AccordionTrigger className="py-3 text-left text-base font-medium hover:no-underline">
                    {example.title}
                  </AccordionTrigger>
                  <AccordionContent className="pt-0 pb-3 text-sm leading-6">
                    {example.description}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        );
      case "generating_icps":
        return (
          <section className="space-y-3 px-4" aria-live="polite">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`icp-skel-${index}`}
                className="bg-muted/40 h-28 animate-pulse rounded-xl border"
              />
            ))}
          </section>
        );
      case "awaiting_icp_approval":
        return (
          <section className="space-y-3 px-4" aria-label="Ideal profiles">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Ideal profiles ({profileLabelPlural})
            </p>
            <div className="flex flex-col gap-3">
              {generatedProfiles.map((icp, index) => (
                <IdealCustomerProfileCard
                  key={`${icp.title}-${index}`}
                  profile={icp}
                  maxPainBadges={2}
                />
              ))}
            </div>
          </section>
        );
      case "provisioning_preview_workspace":
        return (
          <section className="space-y-3 px-4" aria-live="polite">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Preview workspace
            </p>
            <Card className="shadow-none">
              <CardContent className="space-y-3 p-4">
                <AsciiSpinnerText text="Provisioning preview workspace..." />
                <p className="text-muted-foreground text-sm leading-6">
                  We&apos;re creating the real draft workspace and immediately
                  starting live discovery.
                </p>
              </CardContent>
            </Card>
          </section>
        );
      case "discovering_preview_prospects":
        return (
          <section className="space-y-3 px-4" aria-live="polite">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Preview people
            </p>
            <div className="space-y-3">
              {previewProspects.map((prospect) => {
                const previewProspectId =
                  "prospectId" in prospect ? prospect.prospectId : prospect._id;
                return (
                  <ProspectCard
                    key={`setup-preview-${previewProspectId}`}
                    prospect={prospect}
                    onClick={
                      onOpenPreviewProfile
                        ? () => onOpenPreviewProfile(previewProspectId)
                        : undefined
                    }
                    mode="onboarding_preview"
                    interactive={Boolean(onOpenPreviewProfile)}
                  />
                );
              })}
              {Array.from({
                length: Math.max(1, 5 - previewProspects.length),
              }).map((_, index) => (
                <ProspectCardSkeleton key={`preview-skeleton-${index}`} />
              ))}
            </div>
          </section>
        );
      case "awaiting_preview_approval":
        return (
          <section className="space-y-2 px-4" aria-label="Preview results">
            {previewProspects.map((prospect) => {
              const previewProspectId =
                "prospectId" in prospect ? prospect.prospectId : prospect._id;
              return (
                <ProspectCard
                  key={`setup-preview-${previewProspectId}`}
                  prospect={prospect}
                  onClick={
                    onOpenPreviewProfile
                      ? () => onOpenPreviewProfile(previewProspectId)
                      : undefined
                  }
                  mode="onboarding_preview"
                  interactive={Boolean(onOpenPreviewProfile)}
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
    onOpenPreviewProfile,
    phase,
    previewProspects,
    profileLabelPlural,
  ]);

  return (
    <section className="flex h-full min-h-0 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 py-4">
          <div>
            <header className="mb-4 space-y-1 border-b px-4 pb-4">
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
              <Card className="mx-3 rounded-tl-xl rounded-tr-xl rounded-br-none rounded-bl-none shadow-none">
                <CardContent className="p-2">
                  <InlineFeatureStrip
                    className="rounded-none border-0 bg-transparent px-0 py-0"
                    leading={
                      <>
                        <div className="border-border rounded-md border p-1">
                          <ChangeHistoryIcon className="text-foreground size-4 fill-current" />
                        </div>
                        <p className="text-sm font-medium">
                          Happy with these ideal profiles?
                        </p>
                      </>
                    }
                    trailing={
                      <Button size="xs" onClick={onConfirmIdealProfiles}>
                        Yes
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
                <CardContent className="p-2">
                  <InlineFeatureStrip
                    className="rounded-none border-0 bg-transparent px-0 py-0"
                    leading={
                      <>
                        <div className="border-border rounded-md border p-1">
                          <ChangeHistoryIcon className="text-foreground size-4 fill-current" />
                        </div>
                        <p className="text-sm font-medium">
                          Happy with the results?
                        </p>
                      </>
                    }
                    trailing={
                      <Button size="xs" onClick={onApprovePreviewPeople}>
                        Yes
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
                className="px-1 pt-0.5 text-sm"
                placeholder="Describe or paste a link..."
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
                <div className="min-w-0 flex-1">
                  {footerStatusText ? (
                    <AsciiSpinnerText
                      text={footerStatusText}
                      className="text-muted-foreground inline-flex max-w-full min-w-0 text-sm"
                    />
                  ) : (
                    <CharacterCounter
                      current={inputValue.length}
                      max={DESCRIPTION_CONSTRAINTS.MAX_LENGTH}
                    />
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {footerStatusText && isReadingUrl ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={handleCancel}
                    >
                      Cancel
                    </Button>
                  ) : footerStatusText ? null : (
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
                  )}
                </div>
              </PromptInputActions>
            </PromptInput>
          </div>
        ) : null}
      </div>
    </section>
  );
}
