"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import CharacterCounter from "@/shared/ui/components/CharacterCounter";
import { Button } from "@/shared/ui/components/Button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/shared/ui/components/Form";
import { Textarea } from "@/shared/ui/components/TextArea";
import { cn } from "@/shared/lib/utils/utils";
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
import { Skeleton } from "@/shared/ui/components/Skeleton";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";

// Character count constants
const MIN_CHARS = DESCRIPTION_CONSTRAINTS.MIN_LENGTH;
const MAX_CHARS = DESCRIPTION_CONSTRAINTS.MAX_LENGTH;

/**
 * Helper function to get help text based on character count
 * Following the specification for different states
 */
function getHelpText(charCount: number): {
  text: string;
  variant: "default" | "warning" | "error";
} {
  if (charCount === 0) {
    return {
      text: "↳ Required for keyword suggestions and filtering.",
      variant: "default",
    };
  }

  if (charCount < MIN_CHARS) {
    return {
      text: "↳ Describe more.",
      variant: "warning",
    };
  }

  if (charCount >= MAX_CHARS) {
    return {
      text: "↳ Character limit reached.",
      variant: "error",
    };
  }

  return {
    text: "↳ Keywords will be suggested based on this description.",
    variant: "default",
  };
}

// CharacterCounter moved to shared component

export default function OnboardingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const createDefaultWorkspace = useMutation(
    api.workspaces.createDefaultWorkspace
  );

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      description: "",
    },
    mode: "onChange", // Validate on change for real-time feedback
  });

  // Watch the description field for real-time character counting
  const description = form.watch("description");
  const charCount = description.length;

  // Calculate button state based on character count and form validity
  const isFormValid = form.formState.isValid && charCount >= MIN_CHARS;
  const helpText = getHelpText(charCount);

  /**
   * Form submission handler
   * Handles both authenticated and unauthenticated users
   */
  const onSubmit = async (data: OnboardingFormValues) => {
    try {
      if (isAuthenticated) {
        // User is authenticated: Create workspace in Convex directly
        await createDefaultWorkspace({
          description: data.description,
          name: "Default workspace",
        });
        console.log("Workspace created in Convex for authenticated user");
      } else {
        // User is not authenticated: Store in localStorage for later sync
        storeWorkspaceDescription(data.description);
        storeWorkspaceName("Default workspace");
        console.log(
          "Workspace data stored in localStorage for unauthenticated user"
        );
      }

      // Navigate to the main app
      router.push("/");
    } catch (error) {
      console.error("Failed to submit onboarding:", error);
      // In a real app, you might want to show a toast notification here
    }
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      {/* Page heading */}
      <h1 className="mb-4 text-center text-2xl font-medium tracking-tight">
        How will you help?
      </h1>

      {/* Onboarding Debug Information */}
      {process.env.NODE_ENV === "development" && (
        <Alert className="mb-6">
          <AlertTitle>Debug - Onboarding Status</AlertTitle>
          <AlertDescription className="font-mono text-xs">
            <div className="space-y-2">
              {/* Authentication Status */}
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

              {/* Form State */}
              <div className="space-y-1 border-t pt-1">
                <div className="font-semibold text-green-600">Form State:</div>
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

              {/* System Performance */}
              <div className="space-y-1 border-t pt-1">
                <div className="font-semibold text-purple-600">
                  System Performance:
                </div>
                <div>
                  Render Time: {Date.now() - (window.performance?.now() || 0)}ms
                </div>
                <div>
                  Memory Usage:{" "}
                  {"memory" in navigator
                    ? `${Math.round(
                        (navigator as { memory: { usedJSHeapSize: number } })
                          .memory.usedJSHeapSize /
                          1024 /
                          1024
                      )}MB`
                    : "N/A"}
                </div>
                <div>
                  Online Status: {navigator.onLine ? "Online" : "Offline"}
                </div>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Main form */}
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
                  <Textarea
                    id="description"
                    placeholder="Briefly describe your product, service, or skill in 'English'..."
                    className={cn(
                      "max-h-fit min-h-[120px] resize-y",
                      // Add error styling when at character limit
                      charCount > MAX_CHARS && "border-destructive"
                    )}
                    {...field}
                    maxLength={MAX_CHARS + 50} // Allow slight overflow for better UX
                    aria-required="true"
                  />
                </FormControl>
                <div
                  className={cn(
                    "text-sm transition-colors",
                    helpText.variant === "error"
                      ? "text-red-500 focus-visible:ring-red-500"
                      : helpText.variant === "warning"
                        ? "text-primary dark:text-primary"
                        : "text-muted-foreground"
                  )}
                >
                  {helpText.text}
                </div>
                <div className="flex items-center justify-between">
                  <CharacterCounter current={charCount} max={MAX_CHARS} />
                  <Button
                    type="submit"
                    size="xs"
                    disabled={!isFormValid || form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting ? "..." : "Continue"}
                  </Button>
                </div>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  );
}
