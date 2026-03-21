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
import { ProspectCard, ProspectCardSkeleton } from "@/features/prospects";
import type { ProspectCardRecord } from "@/features/prospects/lib/getProspectDisplayData";
import type { SetupGeneratedResult } from "@/features/agent/lib/setupOnboarding";
import { useUrlDescription } from "@/shared/hooks/useUrlDescription";
import {
  DESCRIPTION_CONSTRAINTS,
  validateDescription,
} from "@/shared/lib/utils";
import { getUrlFromWholeValue } from "@/shared/lib/urls/urlParsing";
import type { Id } from "@/convex/_generated/dataModel";

const EXAMPLE_DESCRIPTIONS = [
  {
    id: "product",
    title: "Product",
    description:
      "I'm building Reacher, an AI outreach tool for B2B SaaS founders who struggle to find and reach their ideal customers.",
  },
  {
    id: "service",
    title: "Service",
    description:
      "I run a paid ads agency for e-commerce brands doing $50k-$500k/month who want to scale without burning budget.",
  },
  {
    id: "game",
    title: "Game",
    description:
      "I made a mobile puzzle game for casual gamers who enjoy short sessions and minimalist design.",
  },
] as const;

function buildPreviewProspects(
  generatedResult: SetupGeneratedResult | null
): ProspectCardRecord[] {
  if (!generatedResult) {
    return [];
  }

  const now = Date.now();

  return generatedResult.icps.slice(0, 5).map((profile, index) => {
    const displayName = `Preview person ${index + 1}`;
    return {
      _id: `preview-summary-${index}` as Id<"prospectSummaries">,
      _creationTime: now - index * 1000,
      prospectId: `preview-prospect-${index}` as Id<"prospects">,
      workspaceId: "preview-workspace" as Id<"workspaces">,
      userId: "preview-user" as Id<"users">,
      platform: index % 2 === 0 ? "twitter" : "linkedin",
      status: "new",
      qualificationStatus: undefined,
      enrichmentStatus: undefined,
      planGenerationStatus: undefined,
      readyQualifiedEnriched: true,
      sortQualificationScore: 100 - index,
      qualificationScore: 95 - index,
      prospectCreatedAt: now - index * 60_000,
      updatedAt: now - index * 60_000,
      displayName,
      title: profile.title,
      briefIntro: profile.description,
      matchedKeywords: profile.channels,
      location: profile.channels[0] ?? "Remote",
      financeDisplayValue: undefined,
      prospectType: "individual",
      avatarUrl: undefined,
      profileUrl: undefined,
      twitterUsername: undefined,
      linkedInUsername: undefined,
      verified: false,
      conversationPlaceholderLabel: displayName,
    } as ProspectCardRecord;
  });
}

interface WorkspaceInputStepProps {
  inputValue: string;
  isSubmitting: boolean;
  profileLabelPlural: string;
  sourceUrl: string | null;
  setupStatus:
    | "draft"
    | "awaiting_input"
    | "generating"
    | "awaiting_review"
    | "awaiting_connections"
    | "awaiting_plan"
    | "awaiting_preferences"
    | "awaiting_final_confirmation"
    | "provisioning_workspace"
    | "running_initial_discovery"
    | "waiting_for_first_ready_profile"
    | "ready"
    | "failed"
    | "discarded";
  generatedResult: SetupGeneratedResult | null;
  errorMessage: string | null;
  onContinue: () => void;
  onDone: () => void;
  onInputValueChange: (nextValue: string) => void;
  onSourceUrlChange: (nextUrl: string | null) => void;
}

export function WorkspaceInputStep({
  inputValue,
  isSubmitting,
  profileLabelPlural,
  sourceUrl,
  setupStatus,
  generatedResult,
  errorMessage,
  onContinue,
  onDone,
  onInputValueChange,
  onSourceUrlChange,
}: WorkspaceInputStepProps) {
  const previewProspects = useMemo(
    () => buildPreviewProspects(generatedResult),
    [generatedResult]
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

  const showLoadingState = isSubmitting || setupStatus === "generating";
  const showAutoFillState = isReadingUrl;
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
  const showResults = !showLoadingState && previewProspects.length > 0;
  const footerStatusText = showAutoFillState
    ? "Auto-filling description..."
    : showLoadingState
      ? "Prospecting in background..."
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

  return (
    <section className="flex h-full min-h-0 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 py-4">
          <div>
            <header className="mb-4 space-y-1 border-b px-4">
              <h2 className="text-xl font-semibold">
                {showResults || showLoadingState
                  ? "Refine until it feels right"
                  : "Describe it. We'll find them."}
              </h2>
              <p className="text-muted-foreground text-sm">
                {showResults || showLoadingState
                  ? `We're matching ${profileLabelPlural.toLowerCase()} based on what you share. Edit the description below and submit again until it feels right.`
                  : "We'll find the right people based on what you share."}
              </p>
              {errorMessage ? (
                <p className="my-4 text-sm text-red-500">{errorMessage}</p>
              ) : null}
            </header>

            {!showResults && !showLoadingState ? (
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
                  {EXAMPLE_DESCRIPTIONS.map((example) => (
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
            ) : null}

            {showLoadingState ? (
              <section className="space-y-3" aria-live="polite">
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <ProspectCardSkeleton key={index} />
                  ))}
                </div>
              </section>
            ) : null}

            {showResults ? (
              <section className="space-y-3" aria-label="Preview results">
                {previewProspects.map((prospect, index) => (
                  <ProspectCard
                    key={`setup-preview-${index}`}
                    prospect={prospect}
                    interactive={false}
                    showMenu={false}
                  />
                ))}
              </section>
            ) : null}
          </div>
        </div>
      </ScrollArea>

      <div className="bg-background shrink-0 px-4 pt-3 pb-4 backdrop-blur-xl">
        <AnimatePresence initial={false}>
          {showResults ? (
            <motion.div
              key="satisfaction-strip"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="-mb-3"
            >
              <Card className="shadow-none">
                <CardContent className="flex items-center justify-between gap-3 p-3">
                  <div className="flex items-center gap-2">
                    <ChangeHistoryIcon className="text-foreground size-4 fill-current" />
                    <p className="text-sm font-medium">
                      Satisfied with the results?
                    </p>
                  </div>
                  <Button size="xs" onClick={onDone}>
                    Yes
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : null}
        </AnimatePresence>

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
      </div>
    </section>
  );
}
