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
import { useEffect, useState } from "react";
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

  const [isSubmitting, setIsSubmitting] = useState(false);

  // URL auto-fill: state managed via shared component callbacks
  const [isReadingUrl, setIsReadingUrl] = useState(false);
  const [currentSourceUrl, setCurrentSourceUrl] = useState<string | null>(null);

  // Removed seed keyword generation - will be handled by agent in v4

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
      setIsSubmitting(true);

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

      // Ensure onboarding cookie exists before navigating
      try {
        await cookiePromise;
      } catch {}

      // For authenticated users, ensure server flag is set before navigation
      if (isAuthenticated) {
        try {
          await setOnboardingCompleted({});
        } catch {}
      }

      // In v4, agent will handle onboarding - redirect to home for now
      router.push("/");
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
      setIsSubmitting(false);
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
                            isSubmitting
                          }
                        >
                          {(() => {
                            if (isReadingUrl) return "Auto-filling...";
                            if (isSubmitting || form.formState.isSubmitting)
                              return "Submitting...";
                            return "Continue";
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
