"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/convex/_generated/api";
import {
  PageHeader,
  PageLayout,
  PageContent,
} from "@/features/webapp/ui/components";
import { Button } from "@/shared/ui/components/Button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/components/Form";
import { Input } from "@/shared/ui/components/Input";
import { Textarea } from "@/shared/ui/components/TextArea";
import { CharacterCounter } from "@/shared/ui/components/CharacterCounter";
import { Skeleton } from "@/shared/ui/components/Skeleton";
// import { Upload } from "lucide-react";
import { DESCRIPTION_CONSTRAINTS } from "@/shared/lib/utils/validation";
import { EditIcon } from "@/shared/ui/components/icons";
import { useAuth } from "@/shared/hooks/useAuth";
import { useToast } from "@/shared/ui/hooks/useToast";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import { logger } from "@/shared/lib/logger";
import {
  workspaceSchema,
  type WorkspaceFormValues,
} from "@/shared/lib/schemas/validation";

const MIN_CHARS = DESCRIPTION_CONSTRAINTS.MIN_LENGTH;
const MAX_CHARS = DESCRIPTION_CONSTRAINTS.MAX_LENGTH;

export default function WorkspacePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, workspace } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const updateWorkspace = useMutation(api.workspaces.updateWorkspace);
  const ensureDefaultWorkspace = useMutation(
    api.workspaces.ensureDefaultWorkspace
  );

  const form = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceSchema),
    // Avoid showing placeholder defaults to prevent flicker before real data loads
    defaultValues: {
      name: "",
      description: "",
    },
    // When authenticated and workspace is available, provide values directly
    // so the form mounts with the correct data and avoids any intermediate state
    values:
      isAuthenticated && workspace
        ? {
            name: workspace.name,
            description: workspace.description,
          }
        : undefined,
    resetOptions: {
      keepDirtyValues: true,
      keepErrors: true,
    },
    mode: "onChange",
  });

  // Avoid redundant effects: values prop above keeps form in sync with data.

  const onSubmit = async (data: WorkspaceFormValues) => {
    try {
      // Only authenticated users can save workspace settings
      if (workspace) {
        await updateWorkspace({
          workspaceId: workspace._id,
          name: data.name,
          description: data.description,
        });
        toast({
          title: "☑︎ Updated!",
          description: "Workspace settings updated successfully.",
        });
        setIsEditing(false); // Exit edit mode
        form.reset(data); // Reset dirty state
      }
    } catch (error) {
      logger.error("Failed to save workspace:", error);
      toast({
        variant: "destructive",
        title: "☒ Error!",
        description: "Failed to save workspace settings.",
      });
    }
  };

  const handleCancel = () => {
    if (workspace) {
      form.reset({
        name: workspace.name,
        description: workspace.description,
      });
    }
    setIsEditing(false); // Exit edit mode
  };

  const description = form.watch("description") || "";
  const charCount = description.length;
  const isFormValid = form.formState.isValid && charCount >= MIN_CHARS;

  // Show loading skeleton until workspace data is ready to avoid empty flicker
  const isHydrating = isAuthenticated && workspace === undefined;
  if (authLoading || isHydrating) {
    return (
      <PageLayout>
        <PageHeader title="Workspace" onBack={() => router.back()} />
        <PageContent className="mx-4 mt-4 pb-4">
          <div className="space-y-8">
            {/* Workspace Image Skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-32 w-32 rounded-lg" />
            </div>

            {/* Form Skeletons */}
            <div className="space-y-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title="Workspace"
        onBack={() => router.back()}
        actions={
          isAuthenticated ? (
            isEditing ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="xs" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button
                  size="xs"
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={
                    !form.formState.isDirty ||
                    !isFormValid ||
                    form.formState.isSubmitting
                  }
                >
                  {form.formState.isSubmitting ? "..." : "Done"}
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setIsEditing(true)}
              >
                <EditIcon className="fill-current" />
                Edit
              </Button>
            )
          ) : null
        }
      />

      <PageContent className="mx-4 mt-4 pb-4">
        {/* Error message for workspace creation failures */}
        {isAuthenticated && workspace === null && !authLoading && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Failed to create workspace. Please try refreshing the page.
              <div className="mt-3 flex gap-2">
                <Button
                  size="xs"
                  onClick={async () => {
                    try {
                      await ensureDefaultWorkspace({});
                      router.refresh();
                    } catch (error) {
                      logger.error("Failed to ensure workspace:", error);
                      toast({
                        variant: "destructive",
                        title: "Error",
                        description:
                          "Failed to create workspace. Please try again.",
                      });
                    }
                  }}
                >
                  Try again
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => router.refresh()}
                >
                  Refresh
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Authentication message for unauthenticated users */}
        {!isAuthenticated && !authLoading && (
          <Alert className="mb-6">
            <AlertTitle>Account required</AlertTitle>
            <AlertDescription>
              To use the workspace feature and save your data, please create an
              account or sign in. Your workspace data will be synced to your
              account.
              <div className="mt-3">
                <Button size="xs" onClick={() => router.push("/login")}>
                  Sign in
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Only show workspace content for authenticated users */}
        {isAuthenticated && (
          <>
            {/* Workspace Image Section */}
            {/* <div className="space-y-4">
              <div className="flex flex-col items-center space-y-4">
                <div className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Max size 5MB.</p>
              </div>
            </div> */}

            {/* Note Section */}
            <Alert>
              <AlertTitle>Note</AlertTitle>
              <AlertDescription>
                Changing this description will modify how the system finds
                keywords and posts for your current product or service. Only
                edit it if you want to experiment with different descriptions to
                improve results.
                <br />
                <br />
                For a different product or service, create a new workspace
                instead. Currently, you can use an incognito window or new
                browser profile as a workaround until multiple workspaces are
                supported.
              </AlertDescription>
            </Alert>

            {/* Workspace Details Form */}
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={!isEditing}
                          placeholder="Enter workspace name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          id="workspace-description"
                          disabled={!isEditing}
                          placeholder="Briefly describe your product, service, or skill..."
                          className="min-h-[120px] resize-none"
                          autoResize
                          maxLength={MAX_CHARS + 50}
                        />
                      </FormControl>
                      <div className="flex items-center justify-between">
                        <CharacterCounter current={charCount} max={MAX_CHARS} />
                        {charCount < MIN_CHARS && isEditing && (
                          <p className="text-sm text-muted-foreground">
                            Describe more ({MIN_CHARS - charCount} more
                            characters needed)
                          </p>
                        )}
                      </div>
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </>
        )}
      </PageContent>
    </PageLayout>
  );
}
