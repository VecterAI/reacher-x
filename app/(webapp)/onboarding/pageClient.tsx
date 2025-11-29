"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/components/Button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/shared/ui/components/Form";
// Textarea is now embedded in a shared component
import { useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  onboardingSchema,
  type OnboardingFormValues,
} from "@/shared/lib/schemas/validation";
import { DESCRIPTION_CONSTRAINTS } from "@/shared/lib/utils/validation";
import {
  storeWorkspaceDescription,
  storeWorkspaceName,
} from "@/shared/lib/utils/localStorage";
import { storeWorkspaceSourceUrl } from "@/shared/lib/utils/localStorage";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import { PageLayout, PageContent } from "@/features/webapp/ui/components";
import { logger } from "@/shared/lib/logger";
import { useKeywordSuggestions } from "@/features/keywords/hooks/useKeywordSuggestions";
import { useEffect, useState } from "react";
import { useKeywordSync } from "@/shared/hooks/useKeywordSync";
import { useOptimisticSearch } from "@/features/search/hooks/useOptimisticSearch";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import { DescriptionAutoFillTextarea } from "@/shared/ui/components/DescriptionAutoFillTextarea";
import { getDescriptionHelpText } from "@/shared/lib/descriptionHelp";

const MIN_CHARS = DESCRIPTION_CONSTRAINTS.MIN_LENGTH;
const MAX_CHARS = DESCRIPTION_CONSTRAINTS.MAX_LENGTH;
const SEED_REDIRECT_COUNTDOWN_SECONDS = 10;

// Spinner moved to shared component (AsciiSpinnerText)

export default function OnboardingClient() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const createDefaultWorkspace = useMutation(
    api.workspaces.createDefaultWorkspace
  );
  const setOnboardingCompleted = useMutation(api.users.setOnboardingCompleted);
  const { generateSeedKeyword } = useKeywordSuggestions();
  const { addOrUseKeyword } = useKeywordSync();
  const { startOptimisticSearch } = useOptimisticSearch();

  const [isGeneratingSeed, setIsGeneratingSeed] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(
    null
  );
  const [countdownFinished, setCountdownFinished] = useState(false);

  // URL auto-fill: state managed via shared component callbacks
  const [isReadingUrl, setIsReadingUrl] = useState(false);
  const [currentSourceUrl, setCurrentSourceUrl] = useState<string | null>(null);

  // Start a short countdown while generating the seed. Cleans up on unmount or when cancelled.
  useEffect(() => {
    if (!isGeneratingSeed) {
      setRedirectCountdown(null);
      setCountdownFinished(false);
      return;
    }

    const startAt = Date.now();
    const deadline = startAt + SEED_REDIRECT_COUNTDOWN_SECONDS * 1000;
    setRedirectCountdown(SEED_REDIRECT_COUNTDOWN_SECONDS);
    setCountdownFinished(false);

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const remainingMs = Math.max(0, deadline - now);
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      setRedirectCountdown(remainingSeconds);
      if (remainingMs === 0) {
        setCountdownFinished(true);
        window.clearInterval(intervalId);
      }
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isGeneratingSeed]);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(
      onboardingSchema
    ) as unknown as Resolver<OnboardingFormValues>,
    defaultValues: { description: "" },
    mode: "onChange",
  });

  const description = form.watch("description");
  const charCount = description.length;
  const isFormValid = form.formState.isValid && charCount >= MIN_CHARS;
  const helpText = getDescriptionHelpText(charCount);

  const onSubmit = async (data: OnboardingFormValues) => {
    try {
      setIsGeneratingSeed(true);

      // Kick off lightweight tasks immediately and in parallel
      // 1) Ensure local workspace data is saved for unauthenticated users
      if (!isAuthenticated) {
        storeWorkspaceDescription(data.description);
        storeWorkspaceName("Default workspace");
        if (currentSourceUrl) {
          storeWorkspaceSourceUrl(currentSourceUrl);
        }
        try {
          window.localStorage.setItem(
            "RX_ONBOARDING_COMPLETED",
            String(Date.now())
          );
        } catch {}
      }

      // 2) Set onboarding cookie early to avoid middleware round-trip
      const cookiePromise = fetch("/api/onboarding/complete", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        keepalive: true,
      }).catch(() => {});

      // 3) Fire Convex mutations without blocking navigation
      if (isAuthenticated) {
        void Promise.allSettled([
          createDefaultWorkspace({
            description: data.description,
            name: "Default workspace",
            descriptionSource: currentSourceUrl ? "url" : "manual",
            sourceUrl: currentSourceUrl || undefined,
            lastGeneratedAt: currentSourceUrl ? Date.now() : undefined,
          }),
          setOnboardingCompleted({}),
        ]);
      }

      logger.info("[ONBOARDING] Generating seed keyword for instant search");

      // Generate seed keyword with explicit description to avoid hydration race
      const abortRef = new AbortController();
      // Cancel on unmount/navigation
      const cancel = () => abortRef.abort();
      window.addEventListener("beforeunload", cancel);
      try {
        // Attempt with light client-side retry to smooth transient failures
        const getSeedWithRetry = async (desc: string) => {
          for (let attempt = 1; attempt <= 3; attempt++) {
            const r = await generateSeedKeyword(desc);
            if (r) return r;
            await new Promise((res) => setTimeout(res, attempt * 500));
          }
          return null;
        };

        const seedResult = await getSeedWithRetry(data.description);
        if (seedResult) {
          logger.info(
            "[ONBOARDING] Seed keyword generated, routing to search:",
            {
              keyword: seedResult.keyword,
              exactMatch: seedResult.exactMatch,
            }
          );

          // Ensure onboarding cookie exists before navigating to avoid middleware status fetch
          try {
            await cookiePromise;
          } catch {}

          // For authenticated users, ensure server flag is set before navigation to satisfy middleware status checks
          if (isAuthenticated) {
            try {
              await setOnboardingCompleted({});
            } catch {}
          }

          // Warm optimistic results to mirror manual search UX
          try {
            startOptimisticSearch(seedResult.keyword, seedResult.exactMatch);
          } catch {}

          // Create/use keyword to obtain a stable keywordId for progress subscription
          let keywordId = "";
          try {
            keywordId = await addOrUseKeyword(
              seedResult.keyword,
              "ai_suggestion",
              seedResult.exactMatch
            );
          } catch {}

          const searchParams = new URLSearchParams();
          searchParams.set("q", seedResult.keyword);
          if (seedResult.exactMatch) {
            searchParams.set("exact", "true");
          }
          if (keywordId) {
            searchParams.set("keywordId", keywordId);
          }
          searchParams.set("tour", "starter");
          router.push(`/search?${searchParams.toString()}`);
        } else {
          logger.warn("[ONBOARDING] No seed keyword generated");
          throw new Error("Seed generation returned null");
        }
      } finally {
        window.removeEventListener("beforeunload", cancel);
      }
    } catch (error) {
      logger.error("Failed to submit onboarding:", error);
      // Ensure cookie is set to avoid middleware gating on subsequent attempts
      try {
        await fetch("/api/onboarding/complete", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          keepalive: true,
        });
      } catch {}
    } finally {
      // Ensure the button is re-enabled in all paths (no spinner UI used)
      setIsGeneratingSeed(false);
    }
  };

  if (authLoading) {
    return (
      <PageLayout className="mx-auto md:border-r-0">
        <PageContent className="mx-4 mt-12 pb-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-32 w-full" />
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  return (
    <PageLayout className="mx-auto md:border-r-0">
      <PageContent className="mx-4 mt-12 pb-4">
        <h1 className="mb-4 text-center text-2xl font-medium tracking-tight">
          How will you help?
        </h1>

        {process.env.NODE_ENV === "development" && (
          <Alert className="mb-6">
            <AlertTitle>Debug - Onboarding Status</AlertTitle>
            <AlertDescription className="font-mono text-xs">
              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="font-semibold text-blue-600">
                    Authentication Status:
                  </div>
                  <div>
                    Status:{" "}
                    {isAuthenticated ? "Authenticated" : "Not Authenticated"}
                  </div>
                  <div>Loading: {authLoading ? "Yes" : "No"}</div>
                  <div>
                    Data Strategy:{" "}
                    {isAuthenticated
                      ? "Save to Convex account"
                      : "Save locally, sync on signup"}
                  </div>
                </div>
                <div className="space-y-1 border-t pt-1">
                  <div className="font-semibold text-green-600">
                    Form State:
                  </div>
                  <div>Character Count: {charCount}</div>
                  <div>Min Required: {MIN_CHARS}</div>
                  <div>Max Allowed: {MAX_CHARS}</div>
                  <div>Form Valid: {isFormValid ? "Yes" : "No"}</div>
                  <div>
                    Submitting: {form.formState.isSubmitting ? "Yes" : "No"}
                  </div>
                  <div>Help Text: {helpText.text}</div>
                  <div>Help Variant: {helpText.variant}</div>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="description" className="sr-only">
                    Description
                  </FormLabel>
                  <FormControl>
                    <DescriptionAutoFillTextarea
                      value={field.value}
                      onValueChange={(val) => field.onChange(val)}
                      setText={(text, opts) =>
                        form.setValue("description", text, {
                          shouldValidate: opts?.validate ?? true,
                          shouldDirty: opts?.dirty ?? true,
                        })
                      }
                      onSourceUrlChange={(url) => {
                        try {
                          if (url) storeWorkspaceSourceUrl(url);
                        } catch {}
                        setCurrentSourceUrl(url);
                      }}
                      onReadingChange={(r) => setIsReadingUrl(r)}
                      aria-required="true"
                      rightActions={
                        <Button
                          type="submit"
                          size="xs"
                          disabled={
                            isReadingUrl ||
                            !isFormValid ||
                            form.formState.isSubmitting ||
                            isGeneratingSeed
                          }
                        >
                          {(() => {
                            if (isReadingUrl) return "Auto-filling...";
                            if (isGeneratingSeed) {
                              if (
                                redirectCountdown !== null &&
                                redirectCountdown > 0
                              ) {
                                return (
                                  <>
                                    <span>Redirecting in</span>{" "}
                                    <AnimatedNumber value={redirectCountdown} />
                                  </>
                                );
                              }
                              return countdownFinished
                                ? "Searching..."
                                : "Generating...";
                            }
                            return form.formState.isSubmitting
                              ? "..."
                              : "Continue";
                          })()}
                        </Button>
                      }
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>
      </PageContent>
    </PageLayout>
  );
}
